/* Dynamic stylesheet using CSP-safe CSSStyleSheet.
   CSSStyleSheet.replaceSync() operates on a constructed stylesheet,
   which is NOT subject to CSP restrictions — no 'unsafe-inline' needed. */

export class DynCSS {
  private sheet: CSSStyleSheet;

  constructor() {
    this.sheet = new CSSStyleSheet();
    // adoptedStyleSheets is frozen — must assign a new array
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.sheet];
  }

  /** Replace all rules with a single CSS string. */
  set(rules: string): void {
    this.sheet.replaceSync(rules);
  }

  /** Append rules without removing existing ones. */
  append(rules: string): void {
    this.sheet.replaceSync(
      Array.from(this.sheet.cssRules)
        .map((r) => r.cssText)
        .concat(rules)
        .join("\n"),
    );
  }
}
