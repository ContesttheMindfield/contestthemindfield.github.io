const PITCH_COLORS = new Map([
  ["1", "red"],
  ["2", "yellow"],
  ["3", "blue"],
]);

function requiredString(value, field, context) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context} is missing ${field}`);
  }
  return value.trim();
}

function normalizedImageUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error(`Card image URL must use HTTPS: ${value}`);
  }
  return url.toString();
}

export function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cardSlug(card) {
  const name = requiredString(card.name, "name", "Card");
  const color =
    typeof card.color === "string" && card.color.trim() !== ""
      ? slugify(card.color)
      : PITCH_COLORS.get(String(card.pitch ?? "").trim()) ?? "";
  const base = slugify(name);

  if (!base) {
    throw new Error(`Card name cannot be converted to a slug: ${name}`);
  }
  return color ? `${base}-${color}` : base;
}

function printingRecord(printing) {
  const id = requiredString(printing.id, "printing id", "Card printing");
  const image = normalizedImageUrl(printing.image_url);
  if (!image) {
    return null;
  }

  const record = { id, image };
  const rotation = Number(printing.image_rotation_degrees ?? 0);
  if (Number.isFinite(rotation) && rotation !== 0) {
    record.rotation = rotation;
  }
  if (typeof printing.edition === "string" && printing.edition) {
    record.edition = printing.edition;
  }
  if (typeof printing.foiling === "string" && printing.foiling) {
    record.foiling = printing.foiling;
  }
  if (Array.isArray(printing.art_variations) && printing.art_variations.length) {
    record.artVariations = printing.art_variations;
  }
  return record;
}

function hasStandardArt(printing) {
  return !Array.isArray(printing.art_variations) || printing.art_variations.length === 0;
}

export function compactPrintings(printings = []) {
  const groups = new Map();

  for (const printing of printings) {
    const record = printingRecord(printing);
    if (!record) {
      continue;
    }
    if (!groups.has(record.id)) {
      groups.set(record.id, []);
    }
    groups.get(record.id).push({ source: printing, record });
  }

  return Array.from(groups.values(), (candidates) => {
    const preferred = candidates.find(({ source }) => hasStandardArt(source));
    return (preferred ?? candidates[0]).record;
  });
}

export function buildCatalog(sourceCards, source) {
  if (!Array.isArray(sourceCards)) {
    throw new Error("The upstream card payload must be an array");
  }

  const entries = [];
  for (const sourceCard of sourceCards) {
    const slug = cardSlug(sourceCard);
    const id = requiredString(sourceCard.unique_id, "unique_id", `Card ${slug}`);
    const name = requiredString(sourceCard.name, "name", `Card ${slug}`);
    const printings = compactPrintings(sourceCard.printings);
    const defaultPrinting =
      printings.find((printing) => !printing.artVariations?.length)?.id ??
      printings[0]?.id ??
      null;

    entries.push([
      slug,
      {
        id,
        name,
        color: typeof sourceCard.color === "string" ? sourceCard.color : "",
        pitch: String(sourceCard.pitch ?? ""),
        defaultPrinting,
        printings,
      },
    ]);
  }

  entries.sort(([left], [right]) => left.localeCompare(right));
  const cards = {};
  for (const [slug, card] of entries) {
    if (cards[slug]) {
      throw new Error(`Duplicate generated card slug: ${slug}`);
    }
    cards[slug] = card;
  }

  return {
    meta: {
      repository: requiredString(source.repository, "repository", "FAB source"),
      ref: requiredString(source.ref, "ref", "FAB source"),
      cardsPath: requiredString(source.cardsPath, "cardsPath", "FAB source"),
    },
    cards,
  };
}
