(function () {
  "use strict";

  var h = window.h;
  var createClass = window.createClass;

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
          props.widgetFor("body")
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
      },
      componentDidUpdate: function (previousProps) {
        if (previousProps.document !== this.props.document) {
          if (this.stopPreviewThemeSync) {
            this.stopPreviewThemeSync();
          }
          this.stopPreviewThemeSync = startPreviewThemeSync(this.props.document);
        }
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
