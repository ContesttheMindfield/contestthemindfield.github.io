# Contest the Mindfield

Contest the Mindfield is a bilingual Hugo site about Flesh and Blood. It uses the [Brewm theme](https://github.com/foxihd/hugo-brewm), with English at `/en/` and Brazilian Portuguese at `/pt-br/`.

## Requirements

- Hugo Extended 0.165.x
- Node.js 22.x
- Git with submodule support

## Local setup

```sh
git submodule update --init --recursive
npm ci
hugo server --disableFastRender
```

The Hugo development server is best for editing layouts and content. Pagefind is generated only after a production build, so use this command when testing search:

```sh
npm run build:search
npx pagefind --site public --serve
```

The second command serves the indexed `public` directory. The no-JavaScript search fallback uses DuckDuckGo.

### Edit content with Sveltia CMS locally

Start Hugo, then open `http://localhost:1313/admin/index.html` in Chrome, Edge, or another Chromium-based browser. Choose **Work with Local Repository** and select this repository's root directory. Sveltia writes changes directly to the working tree; review them with Git, then commit and push them normally. Local repository editing does not require Netlify or a CMS proxy server.

## Create content

Articles are page bundles under `content/<language>/articles/<slug>/`. Select the language explicitly in the path:

```sh
# Standard article
hugo new content --contentDir content/en --kind article articles/my-article/index.md
hugo new content --contentDir content/pt-br --kind article articles/my-article/index.md

# Series article
hugo new content --contentDir content/en --kind series-article articles/my-series-article/index.md

# Media-rich article
hugo new content --contentDir content/en --kind media-article articles/my-media-article/index.md

# Author profile
hugo new content --contentDir content/en --kind author authors/author-slug/_index.md
hugo new content --contentDir content/pt-br --kind author authors/author-slug/_index.md
```

Every article must keep `type = "post"` and must list at least one author profile term in the `authors` array. Sveltia CMS fills this with the selected profile title. Categories are curated, tags are flexible, and series are optional. New articles default to `toc = true`; set it to `false` on an individual article when needed.

The media archetype includes guidance for optional covers and alt text, audio, math, syntax highlighting, and redaction history. Advanced Brewm shortcodes and external libraries should be enabled only by content that needs them.

## Flesh and Blood references

Article Markdown can display a card image when a reader hovers over, focuses, or taps an explicitly marked card name. Use an ordinary Markdown link whose destination starts with `#fab-card:`:

```md
[Aurora, Shooting Star](#fab-card:aurora-shooting-star)
```

The text inside the square brackets is what readers see and may be translated. The lookup key after `#fab-card:` always comes from the official English card name: make it lowercase, remove accents and apostrophes, and replace punctuation or spaces with hyphens. Cards with a pitch color add `-red`, `-yellow`, or `-blue`, for example:

```md
[Pummel](#fab-card:pummel-red)
```

By default, the site uses the catalog's standard printing. Add `@` and a printing ID when an article needs a particular printing or artwork:

```md
[Aurora, Shooting Star](#fab-card:aurora-shooting-star@AST001)
```

Find available printing IDs under the card's entry in `data/fab/cards.json`. Specify one only when the exact printing matters; leaving it out lets the managed catalog provide the default.

Use the same link notation to replace words with inline game-property symbols:

```md
Gain 1 [Power](#fab-icon:power), 1 [Life](#fab-icon:life), and 1 [Resource](#fab-icon:resource).
```

The link text supplies meaning while editing, and the published page replaces it with an accessible icon. The supported names are `power`, `life`, and `resource`.

On a desktop, a card image opens on pointer hover or keyboard focus. Clicking keeps it open. On a touch device, tap the card name to toggle it. Escape, moving focus away, tapping outside, or opening another card closes the image. If the remote image cannot load, readers keep the card name and see a short unavailable-image message.

Sveltia CMS accepts these as normal links in the Markdown field. Its article preview recognizes the same markers and displays the icons and card images. An unknown reference is underlined as an error in the editor; the Hugo build then stops with the exact invalid card, printing, or icon so it can be corrected before publication.

### Update the card catalog

The source revision is pinned in `scripts/fab-source.json`. To adopt a reviewed upstream revision, change that pin and regenerate the committed Hugo catalog, Sveltia preview catalog, and local icons:

```sh
npm run fab:sync
npm run test:fab
npm run build:search
```

`fab:sync` is the only step that requires network access. Normal development and deployment builds use the committed catalog and do not silently fetch new card data. Review the generated changes before committing them.

Card metadata comes from [The Fab Cube's open-source dataset](https://github.com/the-fab-cube/flesh-and-blood-cards). Card faces and symbols are official Legend Story Studios assets. Pages containing card art display the required Legend Story Studios copyright notice; use of these assets remains subject to the [LSS asset-use terms](https://fabtcg.com/resources/terms-use-licensed-assets/).

## Media guidelines

Store article media beside `index.md` in the article page bundle and author portraits beside the profile's `_index.md`. Sveltia CMS does this automatically. Use lowercase ASCII filenames with hyphens, such as `aurora-shooting-star.webp`, and avoid spaces or version suffixes such as `final-2`.

### Recommended image sizes

| Use | Recommended size | Minimum | Notes |
| --- | ---: | ---: | --- |
| General-purpose post cover | 2400 × 1600 px | 1600 × 1067 px | A 3:2 master provides enough room for the different crops used by the site. |
| Cover composed for the article page | 2000 × 1600 px | 1500 × 1200 px | The article view uses a 5:4 crop. |
| Cover composed for listings and social cards | 2400 × 1260 px | 1200 × 630 px | Post cards use approximately 1.9:1, which also suits common social previews. |
| Full-width inline image | 2000 px wide | 1400 px wide | Keep the natural aspect ratio unless a deliberate crop is required. |
| Half-width inline image | 1200 px wide | 800 px wide | Suitable for supporting artwork, charts, and screenshots. |
| Author portrait | 800 × 800 px | 400 × 400 px | Use a square source; the site displays it as a small circle. |

The post page and post list use different cover ratios. Keep faces, card text, and other important details within the central 60% of the master image so both the 5:4 article crop and 1.9:1 listing crop remain useful. Avoid placing essential text or logos near an edge.

For author portraits, use a tightly framed head-and-shoulders image with the face centered and clear space around it. Avoid text, detailed backgrounds, borders, or a circle baked into the source image; the theme applies the circular crop. Use the same portrait in both languages unless localization has a specific editorial reason to differ.

### Formats and file-size targets

- Prefer WebP for photographs and illustrations. JPEG is acceptable when a WebP source is unavailable.
- Use PNG only for transparency, diagrams, or screenshots that need lossless edges. Use SVG only for trusted, repository-owned vector artwork.
- Export raster images in the sRGB color space and remove unnecessary metadata.
- Keep post covers below 500 KB when practical and never above 1 MB without a documented reason.
- Keep author portraits below 150 KB and ordinary inline images below 300–500 KB.
- Do not commit multi-megabyte camera or print originals; retain those in an external archive and publish an optimized derivative.

### Accessibility and editorial checks

- Always complete the `alt` field for meaningful covers, portraits, diagrams, and screenshots. Describe the useful visual information without starting with “image of.”
- Use empty alt text only when an image is genuinely decorative and conveys no information.
- Translate alt text along with the article. Do not copy English alt text into the Portuguese version unless the wording is intentionally shared.
- Put detailed explanations, data, or transcribed text in the article body or a caption rather than trying to fit everything into alt text.
- Confirm that the publication has permission to use the image and add an artist, photographer, source, or license credit where required.
- Preview both the article page and the article listing at desktop and mobile sizes before publishing.

## Translations

Translations are optional. When two pages are translations of one another:

1. Use the same technical article slug in both language directories.
2. Give both files the same non-empty `translationKey`.
3. Translate titles, descriptions, taxonomy terms, body content, cover alt text, and redaction notes.
4. Use the same author profile slug in both languages, with matching author-profile `translationKey` values.

Shared section and taxonomy slugs stay in English in both languages: `articles`, `authors`, `categories`, `tags`, and `series`.

## Site configuration

Shared Hugo and Brewm settings live in `config/_default/hugo.toml`. Language definitions and localized menus are separated into:

- `config/_default/languages.toml`
- `config/_default/menus.en.toml`
- `config/_default/menus.pt-br.toml`

Series is registered as a taxonomy but is intentionally absent from the main menu. Add it to both localized menu files when the first real series is published.

## Production and deployment

Build and index locally with:

```sh
npm ci
npm run build:search
```

GitHub Pages runs the same sequence: it checks out the pinned submodule, installs the lockfile dependencies, builds with Hugo 0.165 using garbage collection and minification, runs Pagefind, and uploads `public`.

GitHub Pages is the canonical production host. The connected Netlify site supplies GitHub OAuth for Sveltia CMS and deploy previews for pull requests; it is not the canonical site. Editors use `https://contestthemindfield.github.io/admin/` and sign in through the existing Netlify-mediated GitHub OAuth flow.

The admin page intentionally loads the unversioned `https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js` bundle, so it tracks the latest Sveltia CMS release automatically. If an upstream release causes a regression, temporarily pin the CDN URL and the matching configuration schema to the last known-good version until the issue is resolved.

## Update Brewm manually

Brewm is pinned as a Git submodule. Review an upstream commit before changing the pin:

```sh
git -C themes/hugo-brewm fetch origin
git -C themes/hugo-brewm checkout <reviewed-commit>
git add themes/hugo-brewm
npm ci
npm run build:search
```

Commit the updated submodule pointer only after the production build and visual checks pass. Keep site overrides in the repository root instead of editing Brewm or its `exampleSite` files. In particular, compare the upstream list template with `layouts/_default/list.html`, which removes Brewm's demo empty-state image, and retain the responsive wordmark rules in `assets/css/custom.css`.
