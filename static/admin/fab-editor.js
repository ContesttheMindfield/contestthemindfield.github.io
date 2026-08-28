(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.FabEditor = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var CARD_PATTERN = /\[((?:\\.|[^\]\\\n])*)\]\(#fab-card:([a-z0-9-]+)(?:@([A-Z0-9-]+))?\)/;
  var ICON_PATTERN = /\[((?:\\.|[^\]\\\n])*)\]\(#fab-icon:([a-z][a-z-]*)\)/;

  function escapeMarkdownLabel(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/([\[\]])/g, "\\$1");
  }

  function unescapeMarkdownLabel(value) {
    return String(value || "").replace(/\\(.)/g, "$1");
  }

  function parseCardSelection(value) {
    var selection = String(value || "");
    var separator = selection.lastIndexOf("@");
    if (separator <= 0 || separator === selection.length - 1) {
      return null;
    }
    return {
      slug: selection.slice(0, separator),
      printing: selection.slice(separator + 1)
    };
  }

  function orderedPrintings(card) {
    var printings = Array.isArray(card.printings) ? card.printings.slice() : [];
    return printings.sort(function (left, right) {
      if (left.id === card.defaultPrinting) {
        return right.id === card.defaultPrinting ? 0 : -1;
      }
      return right.id === card.defaultPrinting ? 1 : 0;
    });
  }

  function buildCardOptions(catalog) {
    var cards = catalog && catalog.cards ? catalog.cards : {};
    var entries = Object.keys(cards).map(function (slug) {
      return { slug: slug, card: cards[slug] };
    });

    entries.sort(function (left, right) {
      return (
        left.card.name.localeCompare(right.card.name, "en") ||
        String(left.card.color || "").localeCompare(String(right.card.color || ""), "en") ||
        left.slug.localeCompare(right.slug, "en")
      );
    });

    var options = [];
    var values = new Set();
    entries.forEach(function (entry) {
      orderedPrintings(entry.card).forEach(function (printing) {
        var value = entry.slug + "@" + printing.id;
        if (values.has(value)) {
          throw new Error("Duplicate FAB card-picker option: " + value);
        }
        values.add(value);

        var color = entry.card.color || "No color";
        var label = entry.card.name + " — " + color + " — " + printing.id;
        if (printing.id === entry.card.defaultPrinting) {
          label += " (default)";
        }
        options.push({ label: label, value: value });
      });
    });
    return options;
  }

  function resolveIcon(catalog, name) {
    var icons = catalog && catalog.icons ? catalog.icons : {};
    var aliases = catalog && catalog.iconAliases ? catalog.iconAliases : {};
    var canonical = icons[name] ? name : aliases[name];
    return canonical && icons[canonical]
      ? { key: canonical, icon: icons[canonical] }
      : null;
  }

  function buildIconOptions(catalog) {
    var order = Array.isArray(catalog && catalog.iconOrder) ? catalog.iconOrder : [];
    return order.map(function (key) {
      var resolved = resolveIcon(catalog, key);
      var label = resolved && resolved.icon.labels ? resolved.icon.labels.en : key;
      if (key === "defense" && catalog.iconAliases && catalog.iconAliases.armor === key) {
        label += " (Armor)";
      }
      return { label: label, value: key };
    });
  }

  function cardFromBlock(match, catalog) {
    var slug = match[2];
    var card = catalog.cards && catalog.cards[slug];
    var printing = match[3] || (card && card.defaultPrinting) || "";
    var label = unescapeMarkdownLabel(match[1]);
    return {
      card: printing ? slug + "@" + printing : slug,
      text: card && label === card.name ? "" : label
    };
  }

  function cardToBlock(data, catalog) {
    var selection = parseCardSelection(data && data.card);
    var card = selection && catalog.cards ? catalog.cards[selection.slug] : null;
    var printing = card && Array.isArray(card.printings)
      ? card.printings.find(function (candidate) {
          return candidate.id === selection.printing;
        })
      : null;
    if (!card || !printing) {
      return "";
    }

    var sourceText = data && data.text !== undefined && data.text !== null
      ? String(data.text)
      : "";
    var label = sourceText.trim() ? sourceText : card.name;
    var suffix = selection.printing === card.defaultPrinting ? "" : "@" + selection.printing;
    return (
      "[" + escapeMarkdownLabel(label) + "](#fab-card:" + selection.slug + suffix + ")"
    );
  }

  function iconFromBlock(match, catalog) {
    var requested = match[2];
    var resolved = resolveIcon(catalog, requested);
    var canonical = resolved ? resolved.key : requested;
    var label = unescapeMarkdownLabel(match[1]);
    var canonicalLabel = resolved && resolved.icon.labels ? resolved.icon.labels.en : "";
    return {
      icon: canonical,
      text: label === canonicalLabel ? "" : label
    };
  }

  function iconToBlock(data, catalog) {
    var resolved = resolveIcon(catalog, data && data.icon);
    if (!resolved) {
      return "";
    }
    var sourceText = data && data.text !== undefined && data.text !== null
      ? String(data.text)
      : "";
    var label = sourceText.trim() ? sourceText : resolved.icon.labels.en;
    return "[" + escapeMarkdownLabel(label) + "](#fab-icon:" + resolved.key + ")";
  }

  function editorComponents(catalog) {
    var cardOptions = buildCardOptions(catalog);
    var iconOptions = buildIconOptions(catalog);

    var cardComponent = {
      id: "fab-card",
      label: "FAB Card",
      icon: "style",
      trigger: "button",
      mode: "dialog",
      summary: "{{card}}",
      fields: [
        {
          name: "card",
          label: "Card and printing",
          widget: "select",
          options: cardOptions,
          dropdown_threshold: 0
        },
        {
          name: "text",
          label: "Display text",
          widget: "string",
          required: false,
          hint: "Leave blank to use the official English card name."
        }
      ],
      pattern: CARD_PATTERN,
      fromBlock: function (match) {
        return cardFromBlock(match, catalog);
      },
      toBlock: function (data) {
        return cardToBlock(data, catalog);
      },
      toPreview: function (data) {
        return cardToBlock(data, catalog);
      }
    };

    var iconComponent = {
      id: "fab-icon",
      label: "FAB Icon",
      icon: "stat_1",
      trigger: "button",
      mode: "dialog",
      summary: "{{icon}}",
      fields: [
        {
          name: "icon",
          label: "Game symbol",
          widget: "select",
          options: iconOptions,
          dropdown_threshold: 8
        },
        {
          name: "text",
          label: "Source text",
          widget: "string",
          required: false,
          hint: "Leave blank to use the canonical English label."
        }
      ],
      pattern: ICON_PATTERN,
      fromBlock: function (match) {
        return iconFromBlock(match, catalog);
      },
      toBlock: function (data) {
        return iconToBlock(data, catalog);
      },
      toPreview: function (data) {
        return iconToBlock(data, catalog);
      }
    };

    return [cardComponent, iconComponent];
  }

  function registerFabEditorComponents(CMS, catalog) {
    if (!CMS || typeof CMS.registerEditorComponent !== "function") {
      throw new Error("Sveltia CMS editor-component API is unavailable.");
    }
    if (!catalog || !catalog.cards || !catalog.icons || !catalog.iconAliases) {
      throw new Error("The local Flesh and Blood catalog is incomplete.");
    }

    var components = editorComponents(catalog);
    components.forEach(function (component) {
      CMS.registerEditorComponent(component);
    });
    return components;
  }

  function initializeFabCms(CMS, catalogPromise, logger) {
    var log = logger && typeof logger.error === "function" ? logger : console;
    return Promise.resolve(catalogPromise)
      .then(function (catalog) {
        if (!catalog) {
          throw new Error("The local Flesh and Blood catalog could not be loaded.");
        }
        registerFabEditorComponents(CMS, catalog);
        return true;
      })
      .catch(function (error) {
        log.error(
          "FAB editor buttons are unavailable; continuing with manual Markdown editing.",
          error
        );
        return false;
      })
      .then(function (registered) {
        CMS.init();
        return registered;
      });
  }

  return {
    CARD_PATTERN: CARD_PATTERN,
    ICON_PATTERN: ICON_PATTERN,
    buildCardOptions: buildCardOptions,
    buildIconOptions: buildIconOptions,
    cardFromBlock: cardFromBlock,
    cardToBlock: cardToBlock,
    editorComponents: editorComponents,
    escapeMarkdownLabel: escapeMarkdownLabel,
    iconFromBlock: iconFromBlock,
    iconToBlock: iconToBlock,
    initializeFabCms: initializeFabCms,
    parseCardSelection: parseCardSelection,
    registerFabEditorComponents: registerFabEditorComponents,
    resolveIcon: resolveIcon,
    unescapeMarkdownLabel: unescapeMarkdownLabel
  };
});
