// Tiny DOM helpers — keeps UI code declarative without a framework.

type Attrs = Record<string, string | number | boolean | EventListener>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = String(v);
    else if (k === "text") node.textContent = String(v);
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (typeof v === "boolean") {
      if (v) node.setAttribute(k, "");
    } else {
      node.setAttribute(k, String(v));
    }
  }
  for (const c of children) {
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

export function fmt(n: number): string {
  if (n < 1000) return String(Math.floor(n));
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10000 ? 1 : 0) + "k";
  return (n / 1_000_000).toFixed(2) + "m";
}
