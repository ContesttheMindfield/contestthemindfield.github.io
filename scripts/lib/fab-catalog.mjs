const PITCH_COLORS = new Map([
  ["1", "red"],
  ["2", "yellow"],
  ["3", "blue"],
]);

const EDITION_LABELS = new Map([
  ["A", "Alpha"],
  ["F", "First Edition"],
  ["U", "Unlimited"],
  ["N", "No Edition"],
]);

const FOILING_LABELS = new Map([
  ["S", "Standard"],
  ["R", "Rainbow Foil"],
  ["C", "Cold Foil"],
  ["G", "Gold Cold Foil"],
]);

const ART_VARIATION_LABELS = new Map([
  ["AB", "Alternate Border"],
  ["AA", "Alternate Art"],
  ["AT", "Alternate Text"],
  ["EA", "Extended Art"],
  ["FA", "Full Art"],
  ["HS", "Half Size"],
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

function normalizedCode(value, fallback) {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return code || fallback;
}

function artVariationCodes(printing) {
  return Array.isArray(printing.art_variations)
    ? [...new Set(printing.art_variations.map((value) => normalizedCode(value, "")).filter(Boolean))].sort()
    : [];
}

function faceCode(printing) {
  const face = Array.isArray(printing.double_sided_card_info)
    ? printing.double_sided_card_info.find(
        (entry) => entry && typeof entry.is_front === "boolean",
      )
    : null;
  if (face) {
    return face.is_front ? "FRONT" : "BACK";
  }
  return /(?:-|_)BACK(?:\.[a-z0-9]+)?(?:\?.*)?$/i.test(printing.image_url || "")
    ? "BACK"
    : "";
}

export function treatmentKey(printing) {
  return [
    normalizedCode(printing.edition, "N"),
    normalizedCode(printing.foiling, "S"),
    ...artVariationCodes(printing),
  ].join("-");
}

export function treatmentLabel(printing) {
  const edition = normalizedCode(printing.edition, "N");
  const foiling = normalizedCode(printing.foiling, "S");
  const labels = [];
  if (edition !== "N") {
    labels.push(EDITION_LABELS.get(edition) ?? edition);
  }
  labels.push(FOILING_LABELS.get(foiling) ?? foiling);
  labels.push(
    ...artVariationCodes(printing).map((code) => ART_VARIATION_LABELS.get(code) ?? code),
  );
  return labels.join(" · ");
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
  const upstreamId = requiredString(printing.unique_id, "unique_id", `Card printing ${id}`);
  const image = normalizedImageUrl(printing.image_url);
  if (!image) {
    return null;
  }

  const record = {
    id,
    treatment: treatmentKey(printing),
    treatmentLabel: treatmentLabel(printing),
    upstreamId,
    image,
  };
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

function treatmentPreference(printing) {
  return (hasStandardArt(printing) ? 0 : 2) + (normalizedCode(printing.foiling, "S") === "S" ? 0 : 1);
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

  return Array.from(groups.values()).flatMap((candidates) => {
    const ordered = candidates
      .map((candidate, index) => ({ ...candidate, index }))
      .sort((left, right) =>
        treatmentPreference(left.source) - treatmentPreference(right.source) || left.index - right.index,
      );
    const byTreatment = new Map();
    for (const candidate of ordered) {
      const key = candidate.record.treatment;
      if (!byTreatment.has(key)) {
        byTreatment.set(key, []);
      }
      byTreatment.get(key).push(candidate);
    }

    for (const duplicates of byTreatment.values()) {
      if (duplicates.length < 2) {
        continue;
      }
      const faces = duplicates.map(({ source }) => faceCode(source));
      if (
        duplicates.length === 2 &&
        faces.filter((face) => face === "BACK").length === 1 &&
        faces.filter(Boolean).length === 1
      ) {
        faces[faces.indexOf("")] = "FRONT";
      }
      if (faces.every(Boolean) && new Set(faces).size === duplicates.length) {
        duplicates.forEach(({ record }, index) => {
          const face = faces[index];
          record.treatment += `-${face}`;
          record.treatmentLabel += ` · ${face === "FRONT" ? "Front Face" : "Back Face"}`;
        });
        continue;
      }

      const productIDs = duplicates.map(({ source }) =>
        normalizedCode(source.tcgplayer_product_id, ""),
      );
      if (productIDs.every(Boolean) && new Set(productIDs).size === duplicates.length) {
        duplicates.forEach(({ record }, index) => {
          record.treatment += `-PRODUCT-${productIDs[index]}`;
          record.treatmentLabel += ` · Product ${productIDs[index]}`;
        });
        continue;
      }

      duplicates.forEach(({ record }, index) => {
        const variant = record.upstreamId.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
        record.treatment += `-VARIANT-${variant}`;
        record.treatmentLabel += ` · Variant ${index + 1}`;
      });
    }

    const treatments = new Set();
    for (const { record } of ordered) {
      if (treatments.has(record.treatment)) {
        throw new Error(`Duplicate card treatment: ${record.id}~${record.treatment}`);
      }
      treatments.add(record.treatment);
    }
    return ordered.map(({ record }) => record);
  });
}

export function buildIconCatalog(sourceIcons = {}) {
  if (!sourceIcons || typeof sourceIcons !== "object" || Array.isArray(sourceIcons)) {
    throw new Error("FAB icons must be an object");
  }

  const icons = {};
  const iconAliases = {};
  const iconOrder = [];

  for (const [key, sourceIcon] of Object.entries(sourceIcons)) {
    if (!/^[a-z][a-z-]*$/.test(key)) {
      throw new Error(`Invalid Flesh and Blood icon key: ${key}`);
    }
    if (!sourceIcon || typeof sourceIcon !== "object" || Array.isArray(sourceIcon)) {
      throw new Error(`Flesh and Blood icon ${key} must be an object`);
    }

    const filename = requiredString(sourceIcon.filename, "filename", `FAB icon ${key}`);
    const labels = sourceIcon.labels;
    if (!labels || typeof labels !== "object" || Array.isArray(labels)) {
      throw new Error(`FAB icon ${key} is missing labels`);
    }

    const en = requiredString(labels.en, "English label", `FAB icon ${key}`);
    const ptBR = requiredString(labels["pt-BR"], "Portuguese label", `FAB icon ${key}`);
    const aliases = Array.isArray(sourceIcon.aliases) ? sourceIcon.aliases : [];

    icons[key] = {
      file: `images/fab/${filename}`,
      labels: { en, "pt-BR": ptBR },
    };
    iconOrder.push(key);

    for (const aliasValue of aliases) {
      const alias = requiredString(aliasValue, "alias", `FAB icon ${key}`);
      if (!/^[a-z][a-z-]*$/.test(alias)) {
        throw new Error(`Invalid Flesh and Blood icon alias: ${alias}`);
      }
      if (sourceIcons[alias] || iconAliases[alias]) {
        throw new Error(`Duplicate Flesh and Blood icon key or alias: ${alias}`);
      }
      iconAliases[alias] = key;
    }
  }

  return {
    icons,
    iconAliases,
    iconOrder,
    supportedIconKeys: [...iconOrder, ...Object.keys(iconAliases)],
  };
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
    const defaultRecord =
      printings.find((printing) => !printing.artVariations?.length && printing.foiling === "S") ??
      printings.find((printing) => !printing.artVariations?.length) ??
      printings[0] ??
      null;

    entries.push([
      slug,
      {
        id,
        name,
        color: typeof sourceCard.color === "string" ? sourceCard.color : "",
        pitch: String(sourceCard.pitch ?? ""),
        defaultPrinting: defaultRecord?.id ?? null,
        defaultTreatment: defaultRecord?.treatment ?? null,
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
    ...buildIconCatalog(source.icons),
    cards,
  };
}
