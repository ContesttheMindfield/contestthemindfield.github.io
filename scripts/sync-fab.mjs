import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildCatalog } from "./lib/fab-catalog.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceConfigPath = resolve(projectRoot, "scripts", "fab-source.json");
const hugoCatalogPath = resolve(projectRoot, "data", "fab", "cards.json");
const adminCatalogPath = resolve(projectRoot, "static", "admin", "fab-cards.json");
const iconDirectory = resolve(projectRoot, "static", "images", "fab");

async function fetchChecked(url, expectedType) {
  const response = await fetch(url, {
    headers: { "user-agent": "contest-the-mindfield-fab-sync" },
  });
  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const expectedTypes = Array.isArray(expectedType) ? expectedType : [expectedType];
  if (!expectedTypes.some((type) => contentType.toLowerCase().includes(type))) {
    throw new Error(`Unexpected content type for ${url}: ${contentType || "unknown"}`);
  }
  return response;
}

async function main() {
  const source = JSON.parse(await readFile(sourceConfigPath, "utf8"));
  const cardsUrl = new URL(
    `${source.ref}/${source.cardsPath}`,
    "https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/",
  );

  const cardsResponse = await fetchChecked(cardsUrl, ["json", "text/plain"]);
  const sourceCards = await cardsResponse.json();
  const catalog = buildCatalog(sourceCards, source);
  const catalogJson = `${JSON.stringify(catalog, null, 2)}\n`;

  const iconDownloads = await Promise.all(
    Object.entries(source.icons).map(async ([name, icon]) => {
      const response = await fetchChecked(icon.source, "image/");
      return {
        name,
        filename: icon.filename,
        bytes: new Uint8Array(await response.arrayBuffer()),
      };
    }),
  );

  await Promise.all([
    mkdir(dirname(hugoCatalogPath), { recursive: true }),
    mkdir(dirname(adminCatalogPath), { recursive: true }),
    mkdir(iconDirectory, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(hugoCatalogPath, catalogJson, "utf8"),
    writeFile(adminCatalogPath, catalogJson, "utf8"),
    ...iconDownloads.map((icon) =>
      writeFile(resolve(iconDirectory, icon.filename), icon.bytes),
    ),
  ]);

  process.stdout.write(
    `Synced ${Object.keys(catalog.cards).length} cards at ${source.ref.slice(0, 12)} and ` +
      `${iconDownloads.length} icons (${iconDownloads.map((icon) => icon.name).join(", ")}).\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
