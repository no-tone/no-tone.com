/* CSP-safe dynamic stylesheet using adoptedStyleSheets.
   CSSStyleSheet.replaceSync() is not subject to CSP restrictions,
   so this is a clean alternative to element.style.* assignments
   or style="..." attributes that would require 'unsafe-inline'. */

export class DynCSS {
  private sheet: CSSStyleSheet;

  constructor() {
    this.sheet = new CSSStyleSheet();
    document.adoptedStyleSheets.push(this.sheet);
  }

  /** Replace all rules with a single CSS string. */
  set(rules: string): void {
    this.sheet.replaceSync(rules);
  }

  /** Append rules (preserving existing). */
  append(rules: string): void {
    this.sheet.replaceSync(
      Array.from(this.sheet.cssRules)
        .map((r) => r.cssText)
        .concat(rules)
        .join("\n"),
    );
  }
}
