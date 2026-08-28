(function () {
  "use strict";

  var h = window.h;
  var createClass = window.createClass;
  var fabCatalogPromise = window
    .fetch("/admin/fab-cards.json", { cache: "force-cache" })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Unable to load the Flesh and Blood card catalog.");
      }
      return response.json();
    });
  window.FAB_CATALOG_PROMISE = fabCatalogPromise;

  if (!window.CMS || !h || !createClass) {
    return;
  }

  function field(entry, name, fallback) {
    var value = entry.getIn(["data", name]);
    return value === undefined || value === null || value === "" ? fallback : value;
  }

  function values(entry, name) {
    var value = entry.getIn(["data", name]);
    if (!value) {
      return [];
    }
    return typeof value.toArray === "function" ? value.toArray() : value;
  }

  function itemField(item, name) {
    if (!item) {
      return undefined;
    }
    return typeof item.get === "function" ? item.get(name) : item[name];
  }

  function assetUrl(getAsset, value) {
    if (!value) {
      return "";
    }
    var asset = getAsset(value);
    if (!asset) {
      return "";
    }
    if (typeof asset === "string") {
      return asset;
    }
    if (asset.url) {
      return asset.url;
    }
    return typeof asset.toString === "function" ? asset.toString() : "";
  }

  function toDate(value) {
    if (!value) {
      return null;
    }
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function fabReference(value) {
    var cardPrefix = "#fab-card:";
    var iconPrefix = "#fab-icon:";

    if (value.indexOf(cardPrefix) === 0) {
      var cardMatch = value.slice(cardPrefix.length).match(
        /^([a-z0-9-]+)(?:@([A-Z0-9-]+)(?:~([A-Z0-9-]+))?)?$/
      );
      return cardMatch
        ? {
            type: "card",
            slug: cardMatch[1],
            printing: cardMatch[2] || "",
            treatment: cardMatch[3] || ""
          }
        : null;
    }
    if (value.indexOf(iconPrefix) === 0) {
      return { type: "icon", name: value.slice(iconPrefix.length) };
    }
    return null;
  }

  function cleanFabReference(anchor) {
    var preview = anchor.querySelector("[data-fab-card-preview]");
    if (preview) {
      preview.remove();
    }
    anchor.classList.remove(
      "fab-card-reference",
      "fab-card-trigger",
      "fab-inline-icon-preview",
      "fab-reference-error",
      "is-open"
    );
    anchor.removeAttribute("aria-controls");
    anchor.removeAttribute("aria-expanded");
    anchor.removeAttribute("aria-label");
    anchor.removeAttribute("role");
    anchor.removeAttribute("tabindex");
    anchor.removeAttribute("title");
    anchor.removeAttribute("data-fab-preview-reference");
    anchor.onclick = null;
    anchor.onkeydown = null;
    anchor.onmouseenter = null;
    anchor.onmouseleave = null;
    anchor.onfocus = null;
    anchor.onblur = null;
  }

  function positionFabPreview(anchor) {
    var preview = anchor.querySelector("[data-fab-card-preview]");
    if (!preview) {
      return;
    }

    var anchorRect = anchor.getBoundingClientRect();
    var previewRect = preview.getBoundingClientRect();
    var view = anchor.ownerDocument.defaultView;
    var margin = 12;
    var gap = 10;
    var halfWidth = previewRect.width / 2;
    var halfHeight = previewRect.height / 2;
    var left = anchorRect.left + anchorRect.width / 2;
    var above = anchorRect.top - gap - halfHeight;
    var below = anchorRect.bottom + gap + halfHeight;
    var top = above - halfHeight < margin ? below : above;

    left = Math.max(margin + halfWidth, Math.min(view.innerWidth - margin - halfWidth, left));
    top = Math.max(margin + halfHeight, Math.min(view.innerHeight - margin - halfHeight, top));
    preview.style.setProperty("--fab-card-left", left + "px");
    preview.style.setProperty("--fab-card-top", top + "px");
  }

  function setFabPreviewOpen(anchor, open) {
    var preview = anchor.querySelector("[data-fab-card-preview]");
    anchor.classList.toggle("is-open", open);
    anchor.setAttribute("aria-expanded", String(open));
    if (preview) {
      preview.setAttribute("aria-hidden", String(!open));
    }
    if (open) {
      window.requestAnimationFrame(function () {
        positionFabPreview(anchor);
      });
    }
  }

  function enhanceFabCard(anchor, reference, catalog, locale, ordinal) {
    var card = catalog && catalog.cards ? catalog.cards[reference.slug] : null;
    var printingID = reference.printing || (card && card.defaultPrinting);
    var treatment =
      reference.treatment || (!reference.printing && card && card.defaultTreatment) || "";
    var printing = card
      ? card.printings.find(function (candidate) {
          return (
            candidate.id === printingID &&
            (!treatment || candidate.treatment === treatment)
          );
        })
      : null;

    if (!card || !printing) {
      anchor.classList.add("fab-reference-error");
      anchor.title = locale === "pt-BR"
        ? "Referência de carta, impressão ou tratamento desconhecida"
        : "Unknown card, printing, or treatment reference";
      return;
    }

    var document = anchor.ownerDocument;
    var previewID = "sveltia-fab-card-preview-" + ordinal;
    var preview = document.createElement("span");
    var frame = document.createElement("span");
    var image = document.createElement("img");
    var fallback = document.createElement("span");
    var showLabel = locale === "pt-BR"
      ? "Mostrar a imagem da carta " + card.name
      : "Show the card image for " + card.name;

    anchor.classList.add("fab-card-reference", "fab-card-trigger");
    anchor.setAttribute("role", "button");
    anchor.setAttribute("tabindex", "0");
    anchor.setAttribute("aria-label", showLabel);
    anchor.setAttribute("aria-controls", previewID);
    anchor.setAttribute("aria-expanded", "false");

    preview.id = previewID;
    preview.className = "fab-card-preview";
    preview.setAttribute("role", "tooltip");
    preview.setAttribute("aria-hidden", "true");
    preview.setAttribute("data-fab-card-preview", "");
    frame.className = "fab-card-preview__frame";
    image.className = "fab-card-preview__image";
    image.src = printing.image;
    image.alt = (locale === "pt-BR" ? "Imagem da carta: " : "Card image: ") + card.name;
    image.width = 450;
    image.height = 628;
    image.loading = "lazy";
    image.decoding = "async";
    image.style.setProperty("--fab-card-rotation", (printing.rotation || 0) + "deg");
    fallback.className = "fab-card-preview__fallback";
    fallback.hidden = true;
    fallback.textContent = locale === "pt-BR"
      ? "A imagem da carta " + card.name + " não está disponível."
      : "The card image for " + card.name + " is unavailable.";
    image.onerror = function () {
      image.hidden = true;
      fallback.hidden = false;
      positionFabPreview(anchor);
    };

    frame.appendChild(image);
    frame.appendChild(fallback);
    preview.appendChild(frame);
    anchor.appendChild(preview);

    anchor.onclick = function (event) {
      event.preventDefault();
      var wasOpen = anchor.classList.contains("is-open");
      Array.from(document.querySelectorAll(".fab-card-reference.is-open")).forEach(function (open) {
        setFabPreviewOpen(open, false);
      });
      setFabPreviewOpen(anchor, !wasOpen);
    };
    anchor.onkeydown = function (event) {
      if (event.key === " ") {
        event.preventDefault();
        anchor.click();
      } else if (event.key === "Escape") {
        setFabPreviewOpen(anchor, false);
      }
    };
    anchor.onmouseenter = function () {
      setFabPreviewOpen(anchor, true);
    };
    anchor.onmouseleave = function () {
      if (anchor.ownerDocument.activeElement !== anchor) {
        setFabPreviewOpen(anchor, false);
      }
    };
    anchor.onfocus = function () {
      setFabPreviewOpen(anchor, true);
    };
    anchor.onblur = function () {
      setFabPreviewOpen(anchor, false);
    };
  }

  function enhanceFabIcon(anchor, reference, catalog, locale) {
    var resolved = window.FabEditor && window.FabEditor.resolveIcon(catalog, reference.name);
    var icon = resolved && resolved.icon;

    if (!icon) {
      anchor.classList.add("fab-reference-error");
      anchor.title = locale === "pt-BR" ? "Ícone desconhecido" : "Unknown icon";
      return;
    }

    anchor.classList.add("fab-inline-icon-preview");
    anchor.style.setProperty("--fab-icon-image", 'url("/' + icon.file + '")');
    anchor.setAttribute("role", "img");
    anchor.setAttribute(
      "aria-label",
      icon.labels[locale] || icon.labels.en || resolved.key
    );
    anchor.setAttribute("tabindex", "-1");
    anchor.onclick = function (event) {
      event.preventDefault();
    };
  }

  function enhanceFabReferences(previewDocument, locale) {
    if (!previewDocument) {
      return;
    }

    fabCatalogPromise.then(function (catalog) {
      if (!catalog || !previewDocument.getElementById("content")) {
        return;
      }

      Array.from(previewDocument.querySelectorAll("[data-fab-preview-reference]")).forEach(
        function (anchor) {
          var current = fabReference(anchor.getAttribute("href") || "");
          if (!current) {
            cleanFabReference(anchor);
          }
        }
      );

      var ordinal = 0;
      Array.from(previewDocument.querySelectorAll("#content a")).forEach(function (anchor) {
        var href = anchor.getAttribute("href") || "";
        var reference = fabReference(href);
        if (!reference) {
          return;
        }
        if (anchor.getAttribute("data-fab-preview-reference") === href) {
          var isCompleteCard =
            reference.type === "card" && anchor.querySelector("[data-fab-card-preview]");
          var isCompleteIcon =
            reference.type === "icon" && anchor.classList.contains("fab-inline-icon-preview");
          if (isCompleteCard || isCompleteIcon || anchor.classList.contains("fab-reference-error")) {
            return;
          }
        }

        cleanFabReference(anchor);
        anchor.setAttribute("data-fab-preview-reference", href);
        if (reference.type === "card") {
          ordinal += 1;
          enhanceFabCard(anchor, reference, catalog, locale, ordinal);
        } else {
          enhanceFabIcon(anchor, reference, catalog, locale);
        }
      });
    }).catch(function () {
      // CMS initialization reports catalog failures once and keeps manual Markdown available.
    });
  }

  function formatDate(value, locale, includeTime) {
    var date = toDate(value);
    if (!date) {
      return value || "";
    }

    var options = {
      year: "numeric",
      month: "long",
      day: "numeric"
    };

    if (includeTime) {
      options.hour = "numeric";
      options.minute = "2-digit";
    }

    return new Intl.DateTimeFormat(locale, {
      year: options.year,
      month: options.month,
      day: options.day,
      hour: options.hour,
      minute: options.minute
    }).format(date);
  }

  function latestHistoryDate(entry) {
    return values(entry, "history").reduce(function (latest, item) {
      var candidate = toDate(itemField(item, "date"));
      return candidate && (!latest || candidate > latest) ? candidate : latest;
    }, null);
  }

  function isSameDay(first, second) {
    return (
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate()
    );
  }

  function TimestampPreview(props) {
    var publishedValue = field(props.entry, "date", "");
    var published = toDate(publishedValue);
    var modified = latestHistoryDate(props.entry);
    var hasModification = published && modified && modified > published;
    var includeTime = hasModification && isSameDay(published, modified);
    var publishedLabel = props.locale === "pt-BR" ? "Publicado em" : "Published on";
    var modifiedLabel = props.locale === "pt-BR" ? "modificado em" : "modified on";

    if (!hasModification) {
      return h(
        "time",
        { dateTime: publishedValue },
        formatDate(publishedValue, props.locale, false)
      );
    }

    return h(
      "div",
      { id: "timestamp" },
      h("span", null, publishedLabel + " "),
      h(
        "time",
        { dateTime: published.toISOString() },
        formatDate(published, props.locale, includeTime)
      ),
      ", ",
      h("span", null, modifiedLabel + " "),
      h(
        "time",
        { dateTime: modified.toISOString() },
        formatDate(modified, props.locale, includeTime)
      ),
      "."
    );
  }

  function applyPreviewTheme(previewDocument) {
    if (!previewDocument) {
      return;
    }

    var theme = document.documentElement.dataset.theme;

    if (theme !== "light" && theme !== "dark") {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    previewDocument.documentElement.dataset.theme = theme;
    previewDocument.documentElement.style.colorScheme = theme;

    if (previewDocument.body) {
      previewDocument.body.dataset.scheme = theme;
    }
  }

  function startPreviewThemeSync(previewDocument) {
    var observer = new MutationObserver(function () {
      applyPreviewTheme(previewDocument);
    });

    applyPreviewTheme(previewDocument);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    return function () {
      observer.disconnect();
    };
  }

  function ArticlePreview(props) {
    var entry = props.entry;
    var locale = props.locale;
    var authors = values(entry, "authors");
    var tags = values(entry, "tags");
    var series = values(entry, "series");
    var audio = assetUrl(props.getAsset, field(entry, "audio", ""));
    var title = field(entry, "title", locale === "pt-BR" ? "Artigo sem título" : "Untitled article");
    var subtitle = field(entry, "subtitle", "");
    var body = field(entry, "body", "");
    var hasFabCard = body.indexOf("](#fab-card:") !== -1;

    return h(
      "main",
      { id: "page", className: "post sveltia-preview" },
      series.length
        ? h(
            "div",
            { id: "has-stage", className: "section-title pagewidth" },
            h("span", { id: "series" }, series[0])
          )
        : null,
      h(
        "article",
        { id: "main-article", className: "pagewidth rm", role: "document", "aria-labelledby": "title" },
        h(
          "header",
          { "aria-labelledby": "title" },
          subtitle
            ? h(
                "hgroup",
                null,
                h("h1", { id: "title" }, title),
                h("p", { className: "subtitle", role: "doc-subtitle" }, subtitle)
              )
            : h("h1", { id: "title" }, title),
          authors.length
            ? h(
                "div",
                { id: "doc-author", className: "textsw" },
                authors.map(function (author, index) {
                  return h(
                    "span",
                    { className: "author", key: author },
                    index ? ", " + author : author
                  );
                })
              )
            : null,
          h(TimestampPreview, { entry: entry, locale: locale })
        ),
        audio
          ? h(
              "audio",
              { controls: true, preload: "metadata" },
              h("source", { src: audio })
            )
          : null,
        h(
          "section",
          { id: "content", className: "content", "aria-labelledby": "title" },
          props.widgetFor("body"),
          hasFabCard
            ? h(
                "p",
                { className: "fab-copyright" },
                locale === "pt-BR"
                  ? "Imagens das cartas e símbolos do jogo © Legend Story Studios."
                  : "Card images and game symbols © Legend Story Studios."
              )
            : null
        ),
        tags.length
          ? h(
              "footer",
              null,
              h(
                "nav",
                { id: "keywords", "aria-label": locale === "pt-BR" ? "Tags" : "Tags" },
                h("span", null, "Tags: "),
                tags.map(function (tag, index) {
                  return h("span", { key: tag }, (index ? ", " : "") + tag);
                })
              )
            )
          : null
      )
    );
  }

  function AuthorPreview(props) {
    var entry = props.entry;
    var cover = assetUrl(props.getAsset, field(entry, "cover", ""));
    var title = field(entry, "title", props.fallbackTitle);
    var postsBy = props.locale === "pt-BR" ? "Artigos de" : "Articles by";

    return h(
      "main",
      { id: "term", className: "sveltia-preview" },
      cover
        ? h(
            "div",
            { id: "top" },
            h(
              "section",
              { className: "hero", "aria-label": title },
              h(
                "picture",
                { className: "hero__image auto" },
                h("img", { src: cover, alt: field(entry, "alt", "") })
              ),
              h("div", { className: "hero__content" }, props.widgetFor("body"))
            )
          )
        : null,
      h(
        "section",
        { id: "list-posts", className: "pagewidth", "aria-labelledby": "list-post-heading" },
        h(
          "h1",
          { id: "author", className: "section-title" },
          h("strong", { id: "list-post-heading" }, postsBy + ": " + title)
        ),
        cover ? null : h("div", { className: "content" }, props.widgetFor("body"))
      )
    );
  }

  function PagePreview(props) {
    var entry = props.entry;
    var title = field(entry, "title", props.fallbackTitle);

    return h(
      "main",
      { id: "page", className: "sveltia-preview" },
      h(
        "article",
        { id: "main-article", className: "pagewidth sf", role: "document", "aria-labelledby": "title" },
        h("header", { "aria-labelledby": "title" }, h("h1", { id: "title" }, title)),
        h(
          "section",
          { id: "content", className: "content", "aria-labelledby": "title" },
          props.widgetFor("body")
        )
      )
    );
  }

  function previewTemplate(component, extraProps) {
    return createClass({
      componentDidMount: function () {
        this.stopPreviewThemeSync = startPreviewThemeSync(this.props.document);
        enhanceFabReferences(this.props.document, extraProps.locale || "en-US");
      },
      componentDidUpdate: function (previousProps) {
        if (previousProps.document !== this.props.document) {
          if (this.stopPreviewThemeSync) {
            this.stopPreviewThemeSync();
          }
          this.stopPreviewThemeSync = startPreviewThemeSync(this.props.document);
        }
        enhanceFabReferences(this.props.document, extraProps.locale || "en-US");
      },
      componentWillUnmount: function () {
        if (this.stopPreviewThemeSync) {
          this.stopPreviewThemeSync();
        }
      },
      render: function () {
        return h(component, Object.assign({}, this.props, extraProps));
      }
    });
  }

  function articleTemplate(locale) {
    return previewTemplate(ArticlePreview, { locale: locale });
  }

  function authorTemplate(fallbackTitle, locale) {
    return previewTemplate(AuthorPreview, { fallbackTitle: fallbackTitle, locale: locale });
  }

  function pageTemplate(fallbackTitle) {
    return previewTemplate(PagePreview, { fallbackTitle: fallbackTitle });
  }

  window.CMS.registerPreviewStyle("/hugo-brewm.min.css");
  window.CMS.registerPreviewStyle("/admin/preview.css");
  window.CMS.registerPreviewTemplate("en_articles", articleTemplate("en-US"));
  window.CMS.registerPreviewTemplate("pt_br_articles", articleTemplate("pt-BR"));
  window.CMS.registerPreviewTemplate("en_authors", authorTemplate("Untitled author", "en-US"));
  window.CMS.registerPreviewTemplate("pt_br_authors", authorTemplate("Autor sem título", "pt-BR"));
  window.CMS.registerPreviewTemplate("en_pages", pageTemplate("Untitled page"));
  window.CMS.registerPreviewTemplate("pt_br_pages", pageTemplate("Página sem título"));
})();
