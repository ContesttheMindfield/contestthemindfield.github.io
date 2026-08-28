import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildCatalog,
  buildIconCatalog,
  cardSlug,
  compactPrintings,
  slugify,
} from "../scripts/lib/fab-catalog.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const source = {
  repository: "https://example.test/cards",
  ref: "abc123",
  cardsPath: "cards.json",
};

function printing(id, image, extra = {}) {
  return {
    id,
    image_url: image,
    edition: "Unlimited",
    foiling: "S",
    art_variations: [],
    ...extra,
  };
}

function card(overrides = {}) {
  return {
    unique_id: "card-1",
    name: "Aurora, Shooting Star",
    color: "",
    pitch: "",
    printings: [printing("AST001", "https://images.example.test/AST001.webp")],
    ...overrides,
  };
}

test("card slugs normalize names and append pitch colors", () => {
  assert.equal(slugify("Potion of Déjà Vu"), "potion-of-deja-vu");
  assert.equal(cardSlug(card()), "aurora-shooting-star");
  assert.equal(cardSlug(card({ name: "Pummel", color: "Red", pitch: "1" })), "pummel-red");
  assert.equal(cardSlug(card({ name: "Pummel", color: "", pitch: "2" })), "pummel-yellow");
});

test("catalogs choose the first normal-art printing as the default", () => {
  const catalog = buildCatalog(
    [
      card({
        printings: [
          printing("FAB001", "https://images.example.test/FAB001.webp", {
            art_variations: ["AA"],
          }),
          printing("AST001", "https://images.example.test/AST001.webp"),
        ],
      }),
    ],
    source,
  );

  assert.equal(catalog.cards["aurora-shooting-star"].defaultPrinting, "AST001");
  assert.equal(catalog.cards["aurora-shooting-star"].printings.length, 2);
});

test("duplicate printing IDs prefer their normal-art image", () => {
  const printings = compactPrintings([
    printing("AST001", "https://images.example.test/alternate.webp", {
      art_variations: ["AA"],
    }),
    printing("AST001", "https://images.example.test/standard.webp"),
  ]);

  assert.deepEqual(printings.map(({ id, image }) => ({ id, image })), [
    { id: "AST001", image: "https://images.example.test/standard.webp" },
  ]);
});

test("cards without an upstream image remain cataloged without a default", () => {
  const catalog = buildCatalog(
    [card({ printings: [printing("AST001", null)] })],
    source,
  );

  assert.equal(catalog.cards["aurora-shooting-star"].defaultPrinting, null);
  assert.deepEqual(catalog.cards["aurora-shooting-star"].printings, []);
});

test("duplicate generated slugs fail catalog generation", () => {
  assert.throws(
    () =>
      buildCatalog(
        [card(), card({ unique_id: "card-2" })],
        source,
      ),
    /Duplicate generated card slug/,
  );
});

test("the icon catalog contains eight canonical symbols and the armor alias", async () => {
  const config = JSON.parse(
    await readFile(resolve(projectRoot, "scripts/fab-source.json"), "utf8"),
  );
  const catalog = buildIconCatalog(config.icons);

  assert.deepEqual(catalog.iconOrder, [
    "power",
    "defense",
    "life",
    "intellect",
    "resource",
    "chi",
    "tap",
    "untap",
  ]);
  assert.deepEqual(catalog.iconAliases, { armor: "defense" });
  assert.deepEqual(catalog.supportedIconKeys, [...catalog.iconOrder, "armor"]);
  assert.equal(catalog.icons.defense.labels["pt-BR"], "Defesa");
});

test("generated Hugo and Sveltia catalogs stay identical", async () => {
  const hugo = await readFile(resolve(projectRoot, "data/fab/cards.json"), "utf8");
  const sveltia = await readFile(resolve(projectRoot, "static/admin/fab-cards.json"), "utf8");
  assert.equal(sveltia, hugo);
});

test("README card and icon examples resolve against the generated catalog", async () => {
  const readme = await readFile(resolve(projectRoot, "README.md"), "utf8");
  const catalog = JSON.parse(
    await readFile(resolve(projectRoot, "data/fab/cards.json"), "utf8"),
  );

  const cardReferences = Array.from(
    readme.matchAll(/#fab-card:([a-z0-9-]+)(?:@([A-Z0-9-]+))?/g),
  );
  assert.ok(cardReferences.length >= 3, "README should document card references");
  for (const [, slug, printingID] of cardReferences) {
    const catalogCard = catalog.cards[slug];
    assert.ok(catalogCard, `README card slug should exist: ${slug}`);
    if (printingID) {
      assert.ok(
        catalogCard.printings.some(({ id }) => id === printingID),
        `README printing should exist: ${slug}@${printingID}`,
      );
    }
  }

  const supportedIcons = new Set(catalog.supportedIconKeys);
  const iconReferences = Array.from(readme.matchAll(/#fab-icon:([a-z-]+)/g));
  assert.ok(iconReferences.length >= supportedIcons.size);
  for (const [, icon] of iconReferences) {
    assert.ok(supportedIcons.has(icon), `README icon should be supported: ${icon}`);
  }
  assert.deepEqual(
    new Set(iconReferences.map(([, icon]) => icon)),
    supportedIcons,
    "README should document every supported icon key",
  );
});

test("all configured icon sources are official and local files are valid PNG images", async () => {
  const source = JSON.parse(
    await readFile(resolve(projectRoot, "scripts/fab-source.json"), "utf8"),
  );
  const catalog = JSON.parse(
    await readFile(resolve(projectRoot, "data/fab/cards.json"), "utf8"),
  );

  assert.deepEqual(catalog.iconOrder, Object.keys(source.icons));
  for (const [key, icon] of Object.entries(source.icons)) {
    assert.match(icon.source, /^https:\/\/rules\.fabtcg\.com\/en\/assets\/images\/icon_[a-z]\.png$/);
    assert.equal(catalog.icons[key].file, `images/fab/${icon.filename}`);
    const path = resolve(projectRoot, "static", catalog.icons[key].file);
    const [metadata, contents] = await Promise.all([stat(path), readFile(path)]);
    assert.ok(metadata.size > 1000, `${icon.filename} should not be empty`);
    assert.deepEqual(Array.from(contents.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  }
});
