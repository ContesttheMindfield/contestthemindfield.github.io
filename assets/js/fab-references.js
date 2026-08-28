(function () {
  "use strict";

  var references = Array.from(document.querySelectorAll("[data-fab-card-reference]"));
  if (!references.length) {
    return;
  }

  var pinnedReference = null;
  var positionFrame = 0;

  function parts(reference) {
    return {
      trigger: reference.querySelector("[data-fab-card-trigger]"),
      preview: reference.querySelector("[data-fab-card-preview]")
    };
  }

  function position(reference) {
    var elements = parts(reference);
    if (!elements.trigger || !elements.preview) {
      return;
    }

    var triggerRect = elements.trigger.getBoundingClientRect();
    var previewRect = elements.preview.getBoundingClientRect();
    var margin = 12;
    var gap = 10;
    var halfWidth = previewRect.width / 2;
    var halfHeight = previewRect.height / 2;
    var left = triggerRect.left + triggerRect.width / 2;
    var above = triggerRect.top - gap - halfHeight;
    var below = triggerRect.bottom + gap + halfHeight;
    var top = above - halfHeight < margin ? below : above;

    left = Math.max(margin + halfWidth, Math.min(window.innerWidth - margin - halfWidth, left));
    top = Math.max(margin + halfHeight, Math.min(window.innerHeight - margin - halfHeight, top));
    elements.preview.style.setProperty("--fab-card-left", left + "px");
    elements.preview.style.setProperty("--fab-card-top", top + "px");
  }

  function schedulePosition(reference) {
    window.cancelAnimationFrame(positionFrame);
    positionFrame = window.requestAnimationFrame(function () {
      position(reference);
    });
  }

  function setOpen(reference, open) {
    var elements = parts(reference);
    if (!elements.trigger || !elements.preview) {
      return;
    }

    reference.classList.toggle("is-open", open);
    elements.trigger.setAttribute("aria-expanded", String(open));
    elements.preview.setAttribute("aria-hidden", String(!open));
    if (open) {
      schedulePosition(reference);
    }
  }

  function close(reference) {
    if (!reference) {
      return;
    }
    if (pinnedReference === reference) {
      pinnedReference = null;
    }
    reference.dataset.fabPinned = "false";
    setOpen(reference, false);
  }

  function open(reference, pinned) {
    if (pinnedReference && pinnedReference !== reference) {
      close(pinnedReference);
    }
    reference.dataset.fabPinned = String(pinned);
    if (pinned) {
      pinnedReference = reference;
    }
    setOpen(reference, true);
  }

  function isPinned(reference) {
    return reference.dataset.fabPinned === "true";
  }

  references.forEach(function (reference) {
    var elements = parts(reference);
    if (!elements.trigger || !elements.preview) {
      return;
    }

    elements.trigger.addEventListener("click", function (event) {
      event.preventDefault();
      if (isPinned(reference)) {
        close(reference);
      } else {
        open(reference, true);
      }
    });

    reference.addEventListener("pointerenter", function (event) {
      if (event.pointerType !== "touch") {
        open(reference, isPinned(reference));
      }
    });

    reference.addEventListener("pointerleave", function () {
      if (!isPinned(reference) && !reference.contains(document.activeElement)) {
        setOpen(reference, false);
      }
    });

    reference.addEventListener("focusin", function () {
      open(reference, isPinned(reference));
    });

    reference.addEventListener("focusout", function () {
      window.setTimeout(function () {
        if (!isPinned(reference) && !reference.contains(document.activeElement)) {
          setOpen(reference, false);
        }
      }, 0);
    });

    var image = reference.querySelector("[data-fab-card-image]");
    var error = reference.querySelector("[data-fab-card-error]");
    if (image && error) {
      image.addEventListener("error", function () {
        image.hidden = true;
        error.hidden = false;
        schedulePosition(reference);
      });
    }
  });

  document.addEventListener("pointerdown", function (event) {
    if (pinnedReference && !pinnedReference.contains(event.target)) {
      close(pinnedReference);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && pinnedReference) {
      var trigger = parts(pinnedReference).trigger;
      close(pinnedReference);
      if (trigger) {
        trigger.focus();
      }
    }
  });

  function repositionOpenReference() {
    var openReference = pinnedReference || references.find(function (reference) {
      return reference.classList.contains("is-open");
    });
    if (openReference) {
      schedulePosition(openReference);
    }
  }

  window.addEventListener("resize", repositionOpenReference);
  document.addEventListener("scroll", repositionOpenReference, true);
})();
