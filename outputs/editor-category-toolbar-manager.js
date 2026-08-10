(function attachCategoryToolbarManager(root) {
  "use strict";

  function create(options = {}) {
    const buttons = {
      view: options.viewButton ?? null,
      add: options.addButton ?? null,
      delete: options.deleteButton ?? null,
      previous: options.previousButton ?? null,
      next: options.nextButton ?? null
    };
    let context = null;

    function syncButton(action, fallbackLabel) {
      const button = buttons[action];
      if (!button) return;
      const enabledKey = `can${action[0].toUpperCase()}${action.slice(1)}`;
      const visibleKey = `show${action[0].toUpperCase()}${action.slice(1)}`;
      const labelKey = `${action}Label`;
      const visible = Boolean(context && context[visibleKey] !== false);
      const enabled = Boolean(context && context[enabledKey] !== false);
      button.hidden = !visible;
      button.disabled = !enabled;
      button.textContent = context?.[labelKey] || fallbackLabel;
      button.dataset.categoryContext = context?.kind || "";
      button.title = button.textContent;
      button.setAttribute?.("aria-label", button.textContent);
      if (action === "view") {
        const active = Boolean(context?.viewActive);
        button.classList?.toggle("active", active);
        button.setAttribute?.("aria-pressed", String(active));
      }
    }

    function sync() {
      syncButton("view", "\uBCF4\uAE30");
      syncButton("add", "\uBD84\uB958 \uCD94\uAC00");
      syncButton("delete", "\uBD84\uB958 \uC0AD\uC81C");
      syncButton("previous", "\uC774\uC804");
      syncButton("next", "\uB2E4\uC74C");
    }

    function invoke(action) {
      const button = buttons[action];
      const handler = context?.[`on${action[0].toUpperCase()}${action.slice(1)}`];
      if (!button || button.hidden || button.disabled || typeof handler !== "function") return;
      handler();
    }

    const listeners = Object.entries(buttons).map(([action, button]) => {
      if (!button) return null;
      const listener = () => invoke(action);
      button.addEventListener("click", listener);
      return { button, listener };
    }).filter(Boolean);

    function setContext(nextContext) {
      context = nextContext || null;
      sync();
    }

    function clear() {
      setContext(null);
    }

    function destroy() {
      listeners.forEach(({ button, listener }) => button.removeEventListener("click", listener));
      clear();
    }

    sync();

    return Object.freeze({
      setContext,
      clear,
      sync,
      destroy,
      getContext: () => context
    });
  }

  root.EditorCategoryToolbarManager = Object.freeze({ create });
})(typeof window !== "undefined" ? window : globalThis);
