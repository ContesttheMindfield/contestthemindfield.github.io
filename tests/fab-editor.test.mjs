import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const FabEditor = require("../static/admin/fab-editor.js");

const catalog = {
  iconOrder: ["power", "defense", "life", "intellect", "resource", "chi", "tap", "untap"],
  iconAliases: { armor: "defense" },
  icons: {
    power: { file: "images/fab/icon_p.png", labels: { en: "Power", "pt-BR": "Poder" } },
    defense: { file: "images/fab/icon_d.png", labels: { en: "Defense", "pt-BR": "Defesa" } },
    life: { file: "images/fab/icon_h.png", labels: { en: "Life", "pt-BR": "Vida" } },
    intellect: { file: "images/fab/icon_i.png", labels: { en: "Intellect", "pt-BR": "Intelecto" } },
    resource: { file: "images/fab/icon_r.png", labels: { en: "Resource", "pt-BR": "Recurso" } },
    chi: { file: "images/fab/icon_c.png", labels: { en: "Chi", "pt-BR": "Chi" } },
    tap: { file: "images/fab/icon_t.png", labels: { en: "Tap", "pt-BR": "Virar" } },
    untap: { file: "images/fab/icon_u.png", labels: { en: "Untap", "pt-BR": "Desvirar" } },
  },
  cards: {
    "aurora-shooting-star": {
      name: "Aurora, Shooting Star",
      color: "",
      defaultPrinting: "AST001",
      printings: [
        { id: "LGS999", image: "https://example.test/LGS999.webp" },
        { id: "AST001", image: "https://example.test/AST001.webp" },
      ],
    },
    "pummel-red": {
      name: "Pummel",
      color: "Red",
      defaultPrinting: "WTR206",
      printings: [{ id: "WTR206", image: "https://example.test/WTR206.webp" }],
    },
  },
};

test("card-picker options are unique, searchable labels with defaults first", () => {
  const options = FabEditor.buildCardOptions(catalog);
  assert.equal(new Set(options.map(({ value }) => value)).size, options.length);
  assert.deepEqual(options.slice(0, 2), [
    {
      label: "Aurora, Shooting Star — No color — AST001 (default)",
      value: "aurora-shooting-star@AST001",
    },
    {
      label: "Aurora, Shooting Star — No color — LGS999",
      value: "aurora-shooting-star@LGS999",
    },
  ]);
  assert.ok(options.some(({ label }) => /Pummel — Red — WTR206/.test(label)));
});

test("card references serialize defaults, alternates, custom text, and escaping", () => {
  assert.equal(
    FabEditor.cardToBlock({ card: "aurora-shooting-star@AST001", text: "" }, catalog),
    "[Aurora, Shooting Star](#fab-card:aurora-shooting-star)",
  );
  assert.equal(
    FabEditor.cardToBlock({ card: "aurora-shooting-star@LGS999", text: "Aurora art" }, catalog),
    "[Aurora art](#fab-card:aurora-shooting-star@LGS999)",
  );

  const escaped = FabEditor.cardToBlock(
    { card: "aurora-shooting-star@AST001", text: "Use [Aurora] \\ now" },
    catalog,
  );
  assert.equal(escaped, "[Use \\[Aurora\\] \\\\ now](#fab-card:aurora-shooting-star)");
  const parsed = FabEditor.CARD_PATTERN.exec(escaped);
  assert.deepEqual(FabEditor.cardFromBlock(parsed, catalog), {
    card: "aurora-shooting-star@AST001",
    text: "Use [Aurora] \\ now",
  });
});

test("existing card references reopen with their printing and custom text", () => {
  const defaultMatch = FabEditor.CARD_PATTERN.exec(
    "[Aurora, Shooting Star](#fab-card:aurora-shooting-star)",
  );
  assert.deepEqual(FabEditor.cardFromBlock(defaultMatch, catalog), {
    card: "aurora-shooting-star@AST001",
    text: "",
  });

  const alternateMatch = FabEditor.CARD_PATTERN.exec(
    "[A translated name](#fab-card:aurora-shooting-star@LGS999)",
  );
  assert.deepEqual(FabEditor.cardFromBlock(alternateMatch, catalog), {
    card: "aurora-shooting-star@LGS999",
    text: "A translated name",
  });
});

test("icon picker supports all canonical symbols and parses the armor alias", () => {
  const options = FabEditor.buildIconOptions(catalog);
  assert.deepEqual(options.map(({ value }) => value), catalog.iconOrder);
  assert.equal(options.find(({ value }) => value === "defense").label, "Defense (Armor)");

  for (const key of catalog.iconOrder) {
    const label = catalog.icons[key].labels.en;
    const markdown = FabEditor.iconToBlock({ icon: key, text: "" }, catalog);
    assert.equal(markdown, `[${label}](#fab-icon:${key})`);
    assert.deepEqual(FabEditor.iconFromBlock(FabEditor.ICON_PATTERN.exec(markdown), catalog), {
      icon: key,
      text: "",
    });
  }

  const armor = FabEditor.ICON_PATTERN.exec("[Armor](#fab-icon:armor)");
  assert.deepEqual(FabEditor.iconFromBlock(armor, catalog), {
    icon: "defense",
    text: "Armor",
  });
  assert.equal(FabEditor.iconToBlock({ icon: "armor", text: "Armor" }, catalog), "[Armor](#fab-icon:defense)");
  assert.equal(FabEditor.resolveIcon(catalog, "armor").icon.labels["pt-BR"], "Defesa");
});

test("Sveltia components use native toolbar buttons and dialog mode", () => {
  const components = FabEditor.editorComponents(catalog);
  assert.deepEqual(components.map(({ id }) => id), ["fab-card", "fab-icon"]);
  for (const component of components) {
    assert.equal(component.trigger, "button");
    assert.equal(component.mode, "dialog");
    assert.ok(component.pattern instanceof RegExp);
  }
  assert.equal(components[0].icon, "style");
  assert.equal(components[0].fields[0].dropdown_threshold, 0);
});

test("CMS waits for the catalog, registers both buttons, and initializes", async () => {
  const registered = [];
  var initialized = 0;
  const CMS = {
    registerEditorComponent(component) {
      registered.push(component.id);
    },
    init() {
      initialized += 1;
    },
  };

  const result = await FabEditor.initializeFabCms(CMS, Promise.resolve(catalog), console);
  assert.equal(result, true);
  assert.deepEqual(registered, ["fab-card", "fab-icon"]);
  assert.equal(initialized, 1);
});

test("CMS still initializes without FAB buttons when the catalog fails", async () => {
  const registered = [];
  const errors = [];
  var initialized = 0;
  const CMS = {
    registerEditorComponent(component) {
      registered.push(component.id);
    },
    init() {
      initialized += 1;
    },
  };

  const result = await FabEditor.initializeFabCms(
    CMS,
    Promise.reject(new Error("offline")),
    { error: (...args) => errors.push(args) },
  );
  assert.equal(result, false);
  assert.deepEqual(registered, []);
  assert.equal(initialized, 1);
  assert.match(errors[0][0], /manual Markdown editing/);
});
