export type GeneratedManifest = {
  title: string;
  eyebrow: string;
  hero: string;
  subcopy: string;
  badge: string;
  checkoutLanguage: string;
  palette: {
    background: string;
    ink: string;
    panel: string;
    accent: string;
    rose: string;
  };
};

export function defaultManifest(slug?: string): GeneratedManifest {
  return {
    title: slug ? `A private fragrance edit by ${slug}` : "ScentForge Atelier",
    eyebrow: slug ? "Affiliate collection" : "Fictional fragrance marketplace",
    hero: slug ? "Perfume commerce with a personal signature." : "Perfume commerce, remixed by every affiliate.",
    subcopy: slug
      ? "A curated storefront where every checkout carries the creator's commission trail."
      : "A fictional fragrance marketplace where creators use Codex to generate their own storefronts, validate the checkout flow, and earn commission.",
    badge: slug ? `Curated by ${slug}` : "ScentForge house edit",
    checkoutLanguage: "Secure the bottle",
    palette: {
      background: "#F6F0E6",
      ink: "#10100E",
      panel: "#E9DFCD",
      accent: "#C58A3A",
      rose: "#C97B7B",
    },
  };
}
