import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const projectRoot = resolve(import.meta.dirname, "..");

async function render(body, language = "en") {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "mindfield-fab-test-"));
  const contentRoot = join(temporaryRoot, "content");
  const articleDirectory = join(contentRoot, language, "articles", "fab-references");
  const outputDirectory = join(temporaryRoot, "public");
  const configDirectory = join(temporaryRoot, "config");
  const environmentConfigDirectory = join(configDirectory, "fab-test");
  await mkdir(articleDirectory, { recursive: true });
  await mkdir(join(contentRoot, language === "en" ? "pt-br" : "en"), { recursive: true });
  await cp(resolve(projectRoot, "config", "_default"), join(configDirectory, "_default"), {
    recursive: true,
  });
  await mkdir(environmentConfigDirectory, { recursive: true });
  await writeFile(
    join(environmentConfigDirectory, "languages.toml"),
    `[en]\ncontentDir = '${join(contentRoot, "en").replaceAll("\\", "/")}'\n\n` +
      `[pt-br]\ncontentDir = '${join(contentRoot, "pt-br").replaceAll("\\", "/")}'\n`,
    "utf8",
  );
  await writeFile(
    join(articleDirectory, "index.md"),
    `---\ntitle: FAB references\ndate: 2026-08-27T12:00:00-03:00\ntype: post\ndraft: false\ntoc: false\n---\n\n${body}\n`,
    "utf8",
  );

  const result = spawnSync(
    "hugo",
    [
      "--configDir",
      configDirectory,
      "--destination",
      outputDirectory,
      "--baseURL",
      "https://example.test/",
      "--environment",
      "fab-test",
      "--cleanDestinationDir",
    ],
    { cwd: projectRoot, encoding: "utf8", shell: process.platform === "win32" },
  );

  return {
    temporaryRoot,
    outputDirectory,
    status: result.status,
    output: `${result.stdout || ""}\n${result.stderr || ""}`,
  };
}

async function withRender(body, callback, language = "en") {
  const result = await render(body, language);
  try {
    await callback(result);
  } finally {
    await rm(result.temporaryRoot, { recursive: true, force: true });
  }
}

test("Hugo renders cards, a printing override, every icon, and attribution", async () => {
  await withRender(
    [
      "[Aurora, Shooting Star](#fab-card:aurora-shooting-star)",
      "[Aurora AST001](#fab-card:aurora-shooting-star@AST001)",
      "[Cindra extended art](#fab-card:cindra-dracai-of-retribution@HNT054~N-C-EA)",
      "[Cindra full art](#fab-card:cindra-dracai-of-retribution@HNT054~N-C-FA)",
      "[Power](#fab-icon:power) [Defense](#fab-icon:defense) [Armor](#fab-icon:armor)",
      "[Life](#fab-icon:life) [Intellect](#fab-icon:intellect) [Resource](#fab-icon:resource)",
      "[Chi](#fab-icon:chi) [Tap](#fab-icon:tap) [Untap](#fab-icon:untap)",
    ].join("\n\n"),
    async ({ status, output, outputDirectory }) => {
      assert.equal(status, 0, output);
      const htmlPath = join(outputDirectory, "en", "articles", "fab-references", "index.html");
      const html = await readFile(htmlPath, "utf8");
      assert.match(html, /data-fab-card-trigger/);
      assert.match(html, /AST001\.webp/);
      assert.match(html, /HNT054-MV\.webp/);
      assert.match(html, /HNT054-MV_BACK\.webp/);
      assert.match(html, /class="fab-inline-icon"/);
      for (const filename of [
        "icon_p.png",
        "icon_d.png",
        "icon_h.png",
        "icon_i.png",
        "icon_r.png",
        "icon_c.png",
        "icon_t.png",
        "icon_u.png",
      ]) {
        assert.match(html, new RegExp(filename.replace(".", "\\.")));
      }
      for (const label of ["Power", "Defense", "Life", "Intellect", "Resource", "Chi", "Tap", "Untap"]) {
        assert.match(html, new RegExp(`alt="${label}"`));
      }
      assert.equal((html.match(/icon_d\.png/g) || []).length, 2, "armor should reuse defense");
      assert.match(html, /class="fab-inline-icon"[\s\S]*?width="20"[\s\S]*?height="20"/);
      assert.match(html, /Card images and game symbols © Legend Story Studios\./);
      assert.doesNotMatch(html, /#fab-(?:card|icon):/);
    },
  );
});

test("Hugo renders Portuguese accessible icon labels", async () => {
  await withRender(
    [
      "[Defense](#fab-icon:defense)",
      "[Intellect](#fab-icon:intellect)",
      "[Tap](#fab-icon:tap)",
      "[Untap](#fab-icon:untap)",
    ].join(" "),
    async ({ status, output, outputDirectory }) => {
      assert.equal(status, 0, output);
      const htmlPath = join(outputDirectory, "pt-br", "articles", "fab-references", "index.html");
      const html = await readFile(htmlPath, "utf8");
      for (const label of ["Defesa", "Intelecto", "Virar", "Desvirar"]) {
        assert.match(html, new RegExp(`alt="${label}"`));
      }
    },
    "pt-br",
  );
});

test("reader and Sveltia preview styles keep FAB icons at text height", async () => {
  const [readerCss, previewCss] = await Promise.all([
    readFile(resolve(projectRoot, "assets/css/custom.css"), "utf8"),
    readFile(resolve(projectRoot, "static/admin/preview.css"), "utf8"),
  ]);
  assert.match(readerCss, /img\.fab-inline-icon[\s\S]*?width:\s*1em;[\s\S]*?height:\s*1em;/);
  assert.match(previewCss, /\.fab-inline-icon-preview[\s\S]*?width:\s*1em;[\s\S]*?height:\s*1em;/);
});

for (const scenario of [
  {
    name: "unknown cards",
    body: "[Missing](#fab-card:not-a-real-card)",
    error: /Unknown Flesh and Blood card slug/,
  },
  {
    name: "unknown printings",
    body: "[Aurora](#fab-card:aurora-shooting-star@BAD001)",
    error: /Unknown printing/,
  },
  {
    name: "unknown treatments",
    body: "[Cindra](#fab-card:cindra-dracai-of-retribution@HNT054~N-C-ALT)",
    error: /Unknown treatment "N-C-ALT" for printing "HNT054"/,
  },
  {
    name: "unknown icons",
    body: "[Action point](#fab-icon:action-point)",
    error: /Unknown Flesh and Blood icon[\s\S]*supported icons are power, defense, life, intellect, resource, chi, tap, untap, armor/,
  },
]) {
  test(`Hugo rejects ${scenario.name}`, async () => {
    await withRender(scenario.body, async ({ status, output }) => {
      assert.notEqual(status, 0);
      assert.match(output, scenario.error);
    });
  });
}
