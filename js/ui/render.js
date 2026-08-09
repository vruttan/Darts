// Small, framework-free DOM helper functions shared by every screen.

import { t } from "../i18n.js";

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (typeof value === "boolean") {
      if (value) node.setAttribute(key, "");
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.appendChild(typeof child === "string" || typeof child === "number" ? document.createTextNode(child) : child);
  }
  return node;
}

export function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function mount(root, node) {
  clearNode(root);
  root.appendChild(node);
}

// In-app replacement for window.confirm(): browsers add a "don't allow this
// site to prompt again" checkbox to native confirm() after repeated calls,
// which then silently blocks all future prompts. This avoids that entirely.
// `message` is either a string or an array of strings (one <p> per line), so
// callers can add extra detail (e.g. a list of affected matches) above the
// confirm/cancel actions.
export function showConfirm(message, onConfirm) {
  const lines = [].concat(message);
  const overlay = el("div", { class: "modal-overlay" }, [
    el("div", { class: "modal-dialog" }, [
      ...lines.map((line) => el("p", { text: line })),
      el("div", { class: "actions row-actions" }, [
        el("button", { class: "secondary", text: t("cancel"), onclick: () => overlay.remove() }),
        el("button", {
          class: "primary",
          text: t("confirm"),
          onclick: () => {
            overlay.remove();
            onConfirm();
          },
        }),
      ]),
    ]),
  ]);
  document.body.appendChild(overlay);
}
