import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const projectRoot = resolve(import.meta.dirname, "..");

async function render(body) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "mindfield-fab-test-"));
  const contentRoot = join(temporaryRoot, "content");
  const articleDirectory = join(contentRoot, "en", "articles", "fab-references");
  const outputDirectory = join(temporaryRoot, "public");
  const configDirectory = join(temporaryRoot, "config");
  const environmentConfigDirectory = join(configDirectory, "fab-test");
  await mkdir(articleDirectory, { recursive: true });
  await mkdir(join(contentRoot, "pt-br"), { recursive: true });
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

async function withRender(body, callback) {
  const result = await render(body);
  try {
    await callback(result);
  } finally {
    await rm(result.temporaryRoot, { recursive: true, force: true });
  }
}

test("Hugo renders cards, a printing override, icons, and attribution", async () => {
  await withRender(
    [
      "[Aurora, Shooting Star](#fab-card:aurora-shooting-star)",
      "[Aurora AST001](#fab-card:aurora-shooting-star@AST001)",
      "[Power](#fab-icon:power) [Life](#fab-icon:life) [Resource](#fab-icon:resource)",
    ].join("\n\n"),
    async ({ status, output, outputDirectory }) => {
      assert.equal(status, 0, output);
      const htmlPath = join(outputDirectory, "en", "articles", "fab-references", "index.html");
      const html = await readFile(htmlPath, "utf8");
      assert.match(html, /data-fab-card-trigger/);
      assert.match(html, /AST001\.webp/);
      assert.match(html, /class="fab-inline-icon"/);
      assert.match(html, /icon_p\.png/);
      assert.match(html, /icon_h\.png/);
      assert.match(html, /icon_r\.png/);
      assert.match(html, /Card images and game symbols © Legend Story Studios\./);
      assert.doesNotMatch(html, /#fab-(?:card|icon):/);
    },
  );
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
    name: "unknown icons",
    body: "[Defense](#fab-icon:defense)",
    error: /Unknown Flesh and Blood icon/,
  },
]) {
  test(`Hugo rejects ${scenario.name}`, async () => {
    await withRender(scenario.body, async ({ status, output }) => {
      assert.notEqual(status, 0);
      assert.match(output, scenario.error);
    });
  });
}
