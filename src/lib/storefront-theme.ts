export type GeneratedManifest = {
  title: string;
  eyebrow: string;
  hero: string;
  subcopy: string;
  badge: string;
  checkoutLanguage: string;
  effects?: string[];
  ambientEffects?: GeneratedAmbientEffect[];
  success?: {
    eyebrow: string;
    title: string;
    body: string;
    affiliateAttribution: string;
    continueLabel: string;
  };
  palette: {
    background: string;
    ink: string;
    panel: string;
    accent: string;
    rose: string;
  };
};

export type GeneratedAmbientEffect = {
  id: string;
  label?: string;
  placement?: "background" | "foreground";
  elements: GeneratedAmbientElement[];
  keyframes: GeneratedAmbientKeyframe[];
};

export type GeneratedAmbientElement = {
  id: string;
  style: GeneratedAmbientStyle;
  animation?: GeneratedAmbientAnimation;
};

export type GeneratedAmbientAnimation = {
  durationSeconds: number;
  delaySeconds?: number;
  timingFunction?: string;
  iterationCount?: "infinite" | number;
  direction?: "normal" | "reverse" | "alternate" | "alternate-reverse";
};

export type GeneratedAmbientKeyframe = {
  offset: number;
  transform?: string;
  opacity?: number;
  filter?: string;
};

export type GeneratedAmbientStyle = {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  width?: string;
  height?: string;
  borderRadius?: string;
  background?: string;
  border?: string;
  boxShadow?: string;
  opacity?: number;
  mixBlendMode?: string;
  filter?: string;
  transform?: string;
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
    success: {
      eyebrow: "Payment success",
      title: slug ? "Your edit is being prepared." : "Your perfume is being wrapped.",
      body: "Order {orderId} completed as a {kind} checkout.",
      affiliateAttribution: "Affiliate attribution: {affiliateSlug}. Commission preview: {commission}.",
      continueLabel: "Continue shopping",
    },
    palette: {
      background: "#F6F0E6",
      ink: "#10100E",
      panel: "#E9DFCD",
      accent: "#C58A3A",
      rose: "#C97B7B",
    },
  };
}
