(function () {
  "use strict";

  const SIGN_IN_LABEL = "Sign In with";
  const GITHUB_LABEL = "GitHub";
  const SWITCH_URL =
    "https://github.com/login?add_account=1&return_to=%2FContesttheMindfield%2Fcontestthemindfield.github.io";

  let oauthAttempted = false;
  let allowNextAttempt = false;
  let switchWindow;

  const isGitHubSignInButton = (element) => {
    const button = element?.closest?.("button");
    const label = button?.dataset?.label || button?.textContent || "";

    return button && label.includes(SIGN_IN_LABEL) && label.includes(GITHUB_LABEL)
      ? button
      : null;
  };

  const closeDialog = () => {
    document.querySelector("[data-github-account-dialog]")?.remove();
  };

  const openAccountDialog = (signInButton) => {
    closeDialog();

    switchWindow = window.open(
      SWITCH_URL,
      "github-account-switch",
      "popup,width=960,height=760",
    );

    const dialog = document.createElement("div");
    dialog.dataset.githubAccountDialog = "";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "github-account-dialog-title");
    dialog.innerHTML = `
      <div class="github-account-dialog__card">
        <h2 id="github-account-dialog-title">Use a different GitHub account</h2>
        <p>
          In the GitHub window, sign in with or switch to an account that has access to
          <strong>ContesttheMindfield/contestthemindfield.github.io</strong>.
          Then return here and continue.
        </p>
        <p class="github-account-dialog__popup-warning" hidden>
          The GitHub window was blocked. Open it using the link below.
        </p>
        <div class="github-account-dialog__actions">
          <a href="${SWITCH_URL}" target="github-account-switch" rel="noopener">
            Open GitHub account switcher
          </a>
          <button type="button" data-github-account-continue>Continue with GitHub</button>
          <button type="button" data-github-account-cancel>Cancel</button>
        </div>
      </div>
    `;

    if (!switchWindow) {
      dialog.querySelector(".github-account-dialog__popup-warning").hidden = false;
    }

    dialog
      .querySelector("[data-github-account-continue]")
      .addEventListener("click", () => {
        allowNextAttempt = true;
        switchWindow?.close();
        closeDialog();
        signInButton.click();
      });

    dialog
      .querySelector("[data-github-account-cancel]")
      .addEventListener("click", () => {
        switchWindow?.close();
        closeDialog();
        signInButton.focus();
      });

    document.body.append(dialog);
    dialog.querySelector("[data-github-account-continue]").focus();
  };

  const styles = document.createElement("style");
  styles.textContent = `
    [data-github-account-dialog] {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      place-items: center;
      box-sizing: border-box;
      padding: 1rem;
      background: rgb(0 0 0 / 55%);
      font: 1rem/1.5 system-ui, sans-serif;
    }

    .github-account-dialog__card {
      width: min(32rem, 100%);
      box-sizing: border-box;
      padding: 1.5rem;
      border-radius: 0.75rem;
      color: CanvasText;
      background: Canvas;
      box-shadow: 0 1rem 3rem rgb(0 0 0 / 35%);
    }

    .github-account-dialog__card h2 {
      margin: 0 0 0.75rem;
      font-size: 1.25rem;
    }

    .github-account-dialog__card p {
      margin: 0 0 1rem;
    }

    .github-account-dialog__popup-warning {
      color: #b42318;
    }

    .github-account-dialog__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
    }

    .github-account-dialog__actions a,
    .github-account-dialog__actions button {
      box-sizing: border-box;
      min-height: 2.5rem;
      padding: 0.55rem 0.85rem;
      border: 1px solid ButtonBorder;
      border-radius: 0.4rem;
      color: ButtonText;
      background: ButtonFace;
      font: inherit;
      text-decoration: none;
      cursor: pointer;
    }

    .github-account-dialog__actions [data-github-account-continue] {
      color: white;
      background: #1f883d;
      border-color: #1f883d;
    }
  `;
  document.head.append(styles);

  document.addEventListener(
    "click",
    (event) => {
      const signInButton = isGitHubSignInButton(event.target);

      if (!signInButton) {
        return;
      }

      if (allowNextAttempt) {
        allowNextAttempt = false;
        oauthAttempted = true;
        return;
      }

      if (!oauthAttempted) {
        oauthAttempted = true;
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      openAccountDialog(signInButton);
    },
    true,
  );
})();
