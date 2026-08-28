(function (root, factory) {
  "use strict";

  var api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.FabEditor = api;
  }
})(typeof window !== "undefined" ? window : null, function (root) {
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

  function cardOption(slug, card, printing) {
    var color = card.color || "No color";
    var label = card.name + " — " + color + " — " + printing.id;
    if (printing.id === card.defaultPrinting) {
      label += " (default)";
    }
    return { label: label, value: slug + "@" + printing.id };
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

        options.push(cardOption(entry.slug, entry.card, printing));
      });
    });
    return options;
  }

  function normalizeSearch(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function searchCardOptions(catalog, query, limit) {
    var normalized = normalizeSearch(query);
    var maxResults = Number.isInteger(limit) && limit > 0 ? limit : 30;
    if (normalized.length < 2) {
      return [];
    }

    var terms = normalized.split(/\s+/).filter(Boolean);
    var cards = catalog && catalog.cards ? catalog.cards : {};
    var matches = [];

    Object.keys(cards).forEach(function (slug) {
      var card = cards[slug];
      var cardName = normalizeSearch(card.name);
      var cardColor = normalizeSearch(card.color);
      var cardText = [cardName, cardColor, normalizeSearch(slug)].join(" ");

      orderedPrintings(card).forEach(function (printing, printingIndex) {
        var printingId = normalizeSearch(printing.id);
        var haystack = cardText + " " + printingId;
        if (!terms.every(function (term) { return haystack.indexOf(term) !== -1; })) {
          return;
        }

        var rank = 4;
        if (printingId === normalized) {
          rank = 0;
        } else if (cardName === normalized) {
          rank = 1;
        } else if (cardName.indexOf(normalized) === 0) {
          rank = 2;
        } else if (cardName.indexOf(normalized) !== -1) {
          rank = 3;
        }

        matches.push({
          option: cardOption(slug, card, printing),
          rank: rank,
          cardName: cardName,
          printingIndex: printingIndex,
          printingId: printingId
        });
      });
    });

    matches.sort(function (left, right) {
      return (
        left.rank - right.rank ||
        left.cardName.localeCompare(right.cardName, "en") ||
        left.printingIndex - right.printingIndex ||
        left.printingId.localeCompare(right.printingId, "en")
      );
    });

    return matches.slice(0, maxResults).map(function (match) {
      return match.option;
    });
  }

  function selectedCardOption(catalog, value) {
    var selection = parseCardSelection(value);
    var card = selection && catalog.cards ? catalog.cards[selection.slug] : null;
    var printing = card && Array.isArray(card.printings)
      ? card.printings.find(function (candidate) {
          return candidate.id === selection.printing;
        })
      : null;
    return card && printing ? cardOption(selection.slug, card, printing) : null;
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

  function createCardSearchControl(catalog, runtime) {
    var h = runtime && runtime.h;
    var createClass = runtime && runtime.createClass;
    if (typeof h !== "function" || typeof createClass !== "function") {
      throw new Error("Sveltia CMS React compatibility helpers are unavailable.");
    }

    return createClass({
      getInitialState: function () {
        return { query: "", results: [], pending: false };
      },

      componentWillUnmount: function () {
        clearTimeout(this.searchTimer);
      },

      isValid: function (value) {
        return selectedCardOption(catalog, value)
          ? true
          : { error: { message: "Search for and choose a card printing." } };
      },

      runSearch: function (query) {
        this.setState({
          pending: false,
          results: searchCardOptions(catalog, query, 30)
        });
      },

      handleInput: function (event) {
        var query = event.target.value;
        clearTimeout(this.searchTimer);
        if (normalizeSearch(query).length < 2) {
          this.setState({ query: query, results: [], pending: false });
          return;
        }

        this.setState({ query: query, results: [], pending: true });
        this.searchTimer = setTimeout(function () {
          this.runSearch(query);
        }.bind(this), 120);
      },

      handleKeyDown: function (event) {
        if (event.key === "Escape") {
          clearTimeout(this.searchTimer);
          this.setState({ results: [], pending: false });
          return;
        }
        if (event.key === "Enter" && this.state.results.length) {
          event.preventDefault();
          this.choose(this.state.results[0]);
        }
      },

      choose: function (option) {
        clearTimeout(this.searchTimer);
        this.props.onChange(option.value);
        this.setState({ query: "", results: [], pending: false });
      },

      render: function () {
        var selected = selectedCardOption(catalog, this.props.value);
        var queryLength = normalizeSearch(this.state.query).length;
        var resultId = this.props.forID + "-results";
        var hintId = this.props.forID + "-hint";
        var inputClass = [this.props.classNameWrapper, "fab-card-search__input"]
          .filter(Boolean)
          .join(" ");
        var status = queryLength < 2
          ? "Type at least 2 characters."
          : this.state.pending
            ? "Searching…"
            : this.state.results.length
              ? this.state.results.length + " result" + (this.state.results.length === 1 ? "" : "s")
              : "No matching cards.";

        return h(
          "div",
          { className: "fab-card-search" },
          selected
            ? h(
                "div",
                { className: "fab-card-search__selected", role: "status" },
                h("strong", {}, "Selected: "),
                selected.label
              )
            : null,
          h("input", {
            id: this.props.forID,
            className: inputClass,
            type: "search",
            value: this.state.query,
            placeholder: "Search by name, color, or printing ID",
            autoComplete: "off",
            role: "combobox",
            "aria-autocomplete": "list",
            "aria-controls": resultId,
            "aria-describedby": hintId,
            "aria-expanded": this.state.results.length > 0,
            onChange: this.handleInput,
            onKeyDown: this.handleKeyDown
          }),
          h("div", { id: hintId, className: "fab-card-search__status", role: "status" }, status),
          this.state.results.length
            ? h(
                "div",
                { id: resultId, className: "fab-card-search__results", role: "listbox" },
                this.state.results.map(function (option) {
                  return h(
                    "button",
                    {
                      key: option.value,
                      className: "fab-card-search__result",
                      type: "button",
                      role: "option",
                      "aria-selected": option.value === this.props.value,
                      onClick: function () { this.choose(option); }.bind(this)
                    },
                    option.label
                  );
                }.bind(this))
              )
            : null
        );
      }
    });
  }

  function editorComponents(catalog) {
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
          widget: "fab-card-search"
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

  function registerFabEditorComponents(CMS, catalog, runtime) {
    if (!CMS || typeof CMS.registerEditorComponent !== "function") {
      throw new Error("Sveltia CMS editor-component API is unavailable.");
    }
    if (typeof CMS.registerFieldType !== "function") {
      throw new Error("Sveltia CMS custom-field API is unavailable.");
    }
    if (!catalog || !catalog.cards || !catalog.icons || !catalog.iconAliases) {
      throw new Error("The local Flesh and Blood catalog is incomplete.");
    }

    var ui = runtime || root;
    CMS.registerFieldType("fab-card-search", createCardSearchControl(catalog, ui));
    var components = editorComponents(catalog);
    components.forEach(function (component) {
      CMS.registerEditorComponent(component);
    });
    return components;
  }

  function initializeFabCms(CMS, catalogPromise, logger, runtime) {
    var log = logger && typeof logger.error === "function" ? logger : console;
    return Promise.resolve(catalogPromise)
      .then(function (catalog) {
        if (!catalog) {
          throw new Error("The local Flesh and Blood catalog could not be loaded.");
        }
        registerFabEditorComponents(CMS, catalog, runtime);
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
    searchCardOptions: searchCardOptions,
    selectedCardOption: selectedCardOption,
    unescapeMarkdownLabel: unescapeMarkdownLabel
  };
});
