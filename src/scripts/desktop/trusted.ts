/* Trusted Types policy for the handful of innerHTML sinks we control: the
   GitHub README (already sanitized in sanitizeReadme) and the static cursor
   SVGs. Prod CSP sets `require-trusted-types-for 'script'; trusted-types
   notone`, so string→innerHTML assignments must be TrustedHTML — this provides
   it. Browsers without Trusted Types ignore the directive; we pass through. */

interface TrustedTypesApi {
  createPolicy(
    name: string,
    rules: { createHTML: (s: string) => string },
  ): { createHTML(input: string): { toString(): string } };
}

let policy: ReturnType<TrustedTypesApi["createPolicy"]> | null = null;

export function trustedHTML(html: string): string {
  const tt = (window as unknown as { trustedTypes?: TrustedTypesApi }).trustedTypes;
  if (!tt) return html;
  // Identity policy — the inputs are already sanitized (README) or static
  // (SVGs); Trusted Types is the enforcement boundary, our sanitizer the logic.
  if (!policy) policy = tt.createPolicy("notone", { createHTML: (s) => s });
  return policy.createHTML(html) as unknown as string;
}
