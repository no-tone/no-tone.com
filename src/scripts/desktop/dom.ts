/* Tiny hyperscript / DOM helpers shared by the panels. */

export type Child = Node | string | number | null | undefined | false;
export type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

export function h(tag: string, attrs: Attrs = {}, ...children: Child[]): HTMLElement {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === "class") {
      node.className = String(value);
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (value === true) {
      node.setAttribute(key, "");
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) append(node, child);
  return node;
}

export function append(parent: Node, child: Child): void {
  if (child === null || child === undefined || child === false) return;
  parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
}

export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}
