"use client";

import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { useMemo, useState, useTransition } from "react";
import { formatMoney, formatPercent } from "@/lib/money";
import type {
  GeneratedAmbientAnimation,
  GeneratedAmbientEffect,
  GeneratedAmbientElement,
  GeneratedAmbientKeyframe,
  GeneratedAmbientStyle,
  GeneratedManifest,
} from "@/lib/storefront-theme";
import { defaultManifest } from "@/lib/storefront-theme";
import type { CartItemView, ProductView } from "@/lib/storefront-contract";

type CheckoutResult = {
  id: string;
  kind: "LIVE" | "VALIDATION";
  commissionInCents: number;
  affiliateSlug?: string;
};

type CommerceExperienceProps = {
  products: ProductView[];
  affiliateSlug?: string;
  validationRunId?: string;
  preview?: boolean;
  generated?: boolean;
  manifest?: GeneratedManifest | null;
  viewer?: {
    name: string;
    dashboardHref: string;
  } | null;
};

const MAX_AMBIENT_EFFECTS = 3;
const MAX_AMBIENT_ELEMENTS = 18;
const MAX_AMBIENT_KEYFRAMES = 6;

export function CommerceExperience({
  products,
  affiliateSlug,
  validationRunId,
  preview,
  generated,
  manifest,
  viewer,
}: CommerceExperienceProps) {
  const tone = manifest || defaultManifest(affiliateSlug);
  const ambientEffects = generated ? sanitizeAmbientEffects(tone.ambientEffects) : [];
  const hasAmbientEffects = ambientEffects.length > 0;
  const [cartItems, setCartItems] = useState<CartItemView[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [email, setEmail] = useState("validation@scentforge.test");
  const [address, setAddress] = useState("12 Atelier Lane, Mumbai 400001");
  const [error, setError] = useState("");
  const [order, setOrder] = useState<CheckoutResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalAmountInCents = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.product.priceInCents * item.quantity, 0),
    [cartItems],
  );
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const heroProduct = products[0];

  function addToCart(productId: string) {
    const product = products.find((item) => item.id === productId);

    if (!product) {
      return;
    }

    setCartItems((items) => {
      const existing = items.find((item) => item.product.id === product.id);

      if (existing) {
        return items.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [...items, { product, quantity: 1 }];
    });
    setCartOpen(true);
  }

  function removeItem(productId: string) {
    setCartItems((items) => items.filter((item) => item.product.id !== productId));
  }

  function pay() {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          address,
          affiliateSlug,
          validationRunId,
          items: cartItems.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        }),
      });
      const payload = (await response.json()) as { order?: CheckoutResult; error?: string };

      if (!response.ok || !payload.order) {
        setError(payload.error || "Checkout failed.");
        return;
      }

      setOrder(payload.order);
      setCartItems([]);
      setCartOpen(false);
      setCheckoutOpen(false);
    });
  }

  if (order) {
    const success = tone.success || defaultManifest(affiliateSlug).success!;

    return (
      <main
        className={`commerce-shell success-shell ${generated ? "generated-tone" : ""} ${hasAmbientEffects ? "has-ambient-effects" : ""}`}
        data-testid="storefront-root"
        style={toneStyles(tone)}
      >
        {hasAmbientEffects ? <AmbientEffects effects={ambientEffects} /> : null}
        {preview ? <div className="preview-ribbon">Draft preview — validation mode</div> : null}
        <section className="success-panel" data-testid="success-message">
          <p className="eyebrow">{success.eyebrow}</p>
          <h1>{success.title}</h1>
          <p>{formatSuccessText(success.body, order)}</p>
          {order.affiliateSlug ? (
            <p>{formatSuccessText(success.affiliateAttribution, order)}</p>
          ) : null}
          <button className="primary-action" onClick={() => setOrder(null)}>
            {success.continueLabel}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      className={`commerce-shell ${generated ? "generated-tone" : ""} ${hasAmbientEffects ? "has-ambient-effects" : ""}`}
      data-testid="storefront-root"
      style={toneStyles(tone)}
    >
      {hasAmbientEffects ? <AmbientEffects effects={ambientEffects} /> : null}
      {preview ? <div className="preview-ribbon">Draft preview — validation mode</div> : null}
      <nav className="store-nav" aria-label="Store navigation">
        <Link href="/" className="brand-mark">
          ScentForge
        </Link>
        <div className="nav-actions">
          {viewer ? (
            <>
              <span className="viewer-pill">{viewer.name}</span>
              <Link href={viewer.dashboardHref}>Dashboard</Link>
            </>
          ) : (
            <Link href="/login">Affiliate login</Link>
          )}
          <button className="cart-trigger" data-testid="cart-button" onClick={() => setCartOpen(true)}>
            Cart <span>{cartCount}</span>
          </button>
        </div>
      </nav>

      <section className="store-hero">
        <div className="hero-editorial">
          <p className="eyebrow">{tone.eyebrow}</p>
          <h1>{tone.hero}</h1>
          <p className="store-hero-lede">{tone.subcopy}</p>
          <div className="hero-proof-row" aria-label="Storefront proof points">
            <span>Codex generated</span>
            <span>Checkout validated</span>
            <span>Live metrics isolated</span>
          </div>
        </div>

        <div className="hero-bottle-stage" aria-label="Featured fragrance">
          <div className="stage-metadata">
            <span>{tone.badge}</span>
            <span>{affiliateSlug ? `/a/${affiliateSlug}` : "House storefront"}</span>
          </div>
          <div
            className={`hero-bottle-visual ${heroProduct?.imageUrl ? "has-photo" : ""} bottle-${heroProduct?.gradient || "amber"}`}
            aria-hidden="true"
          >
            {heroProduct?.imageUrl ? (
              <Image
                className="product-photo"
                src={heroProduct.imageUrl}
                alt=""
                fill
                sizes="(max-width: 900px) 92vw, 360px"
                priority
              />
            ) : (
              <span>01</span>
            )}
          </div>
          <div className="stage-caption">
            <span>{heroProduct ? heroProduct.scentFamily : "Fragrance edit"}</span>
            <strong>{heroProduct ? heroProduct.name : "ScentForge house edit"}</strong>
          </div>
          {affiliateSlug ? <Link href={`/a/${affiliateSlug}`}>Affiliate link: /a/{affiliateSlug}</Link> : null}
        </div>
      </section>

      <section className="product-runway" aria-label="Perfume products">
        {products.map((product, index) => (
          <article className="perfume-card" data-testid="product-card" data-product-slug={product.slug} key={product.id}>
            <div
              className={`bottle-visual ${product.imageUrl ? "has-photo" : ""} bottle-${product.gradient || "amber"}`}
              aria-hidden="true"
            >
              {product.imageUrl ? (
                <Image
                  className="product-photo"
                  src={product.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 900px) 100vw, 33vw"
                  priority={index < 3}
                />
              ) : (
                <>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </>
              )}
            </div>
            <div className="perfume-card-copy">
              <p>{product.scentFamily}</p>
              <h2>{product.name}</h2>
              <div className="product-commercials">
                <span>{formatMoney(product.priceInCents)}</span>
                <span>{formatPercent(Number.isFinite(product.commissionRate) ? product.commissionRate : 0.1)} commission</span>
              </div>
              <p>{product.description}</p>
            </div>
            <button data-testid="add-to-cart-button" onClick={() => addToCart(product.id)}>
              Add to cart
            </button>
          </article>
        ))}
      </section>

      {cartOpen ? (
        <aside className="cart-drawer" data-testid="cart-drawer">
          <div className="drawer-header">
            <div>
              <p className="eyebrow">Cart</p>
              <h2>{cartItems.length ? "A small ceremony" : "Your tray is empty"}</h2>
            </div>
            <button className="text-button" onClick={() => setCartOpen(false)}>
              Close
            </button>
          </div>

          {cartItems.length ? (
            <>
              <div className="cart-lines">
                {cartItems.map((item) => (
                  <div className="cart-line" key={item.product.id}>
                    <div>
                      <strong>{item.product.name}</strong>
                      <span>
                        {item.quantity} x {formatMoney(item.product.priceInCents)}
                      </span>
                    </div>
                    <button onClick={() => removeItem(item.product.id)}>Remove</button>
                  </div>
                ))}
              </div>
              <div className="cart-total">
                <span>Total</span>
                <strong>{formatMoney(totalAmountInCents)}</strong>
              </div>
              <button
                className="primary-action"
                data-testid="checkout-button"
                onClick={() => setCheckoutOpen(true)}
              >
                Checkout
              </button>
            </>
          ) : (
            <p>Choose a bottle from the runway and it will appear here.</p>
          )}
        </aside>
      ) : null}

      {checkoutOpen ? (
        <section className="checkout-stage" aria-label="Checkout">
          <div className="drawer-header">
            <div>
              <p className="eyebrow">Secure test checkout</p>
              <h2>{tone.checkoutLanguage}</h2>
            </div>
            <button className="text-button" onClick={() => setCheckoutOpen(false)}>
              Close
            </button>
          </div>
          <div className="demo-card-details" aria-label="Demo credit card details">
            <span>Demo card</span>
            <strong>4242 4242 4242 4242</strong>
            <span>Expiry 12/30 · CVC 123 · ZIP 400001</span>
          </div>
          <label>
            Email
            <input
              data-testid="checkout-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Address
            <textarea
              data-testid="checkout-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Shipping address"
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-action" data-testid="pay-button" disabled={isPending} onClick={pay}>
            {isPending ? "Processing" : `Pay ${formatMoney(totalAmountInCents)}`}
          </button>
        </section>
      ) : null}
    </main>
  );
}

function AmbientEffects({ effects }: { effects: GeneratedAmbientEffect[] }) {
  const backgroundEffects = effects.filter((effect) => effect.placement !== "foreground");
  const foregroundEffects = effects.filter((effect) => effect.placement === "foreground");

  return (
    <>
      <style>{ambientEffectStyles(effects)}</style>
      {backgroundEffects.length ? <AmbientEffectLayer effects={backgroundEffects} placement="background" /> : null}
      {foregroundEffects.length ? <AmbientEffectLayer effects={foregroundEffects} placement="foreground" /> : null}
    </>
  );
}

function AmbientEffectLayer({
  effects,
  placement,
}: {
  effects: GeneratedAmbientEffect[];
  placement: "background" | "foreground";
}) {
  return (
    <div className={`ambient-effects ambient-effects-${placement}`} aria-hidden="true">
      {effects.flatMap((effect) =>
        effect.elements.map((element, elementIndex) => (
          <span
            className={`ambient-effect-element ambient-effect-${effect.id}-${element.id}`}
            key={`${effect.id}-${element.id}-${elementIndex}`}
            style={ambientElementStyles(effect, element)}
          />
        )),
      )}
    </div>
  );
}

function toneStyles(tone: GeneratedManifest) {
  return {
    "--tone-bg": tone.palette.background,
    "--tone-ink": tone.palette.ink,
    "--tone-panel": tone.palette.panel,
    "--tone-accent": tone.palette.accent,
    "--tone-rose": tone.palette.rose,
  } as CSSProperties;
}

function formatSuccessText(template: string, order: CheckoutResult) {
  return template
    .replaceAll("{orderId}", order.id.slice(0, 10))
    .replaceAll("{kind}", order.kind.toLowerCase())
    .replaceAll("{affiliateSlug}", order.affiliateSlug || "")
    .replaceAll("{commission}", formatMoney(order.commissionInCents));
}

function sanitizeAmbientEffects(effects: GeneratedManifest["ambientEffects"]): GeneratedAmbientEffect[] {
  if (!Array.isArray(effects)) {
    return [];
  }

  return effects
    .map((effect, effectIndex) => sanitizeAmbientEffect(effect, effectIndex))
    .filter(isPresent)
    .slice(0, MAX_AMBIENT_EFFECTS);
}

function sanitizeAmbientEffect(effect: GeneratedAmbientEffect, effectIndex: number): GeneratedAmbientEffect | null {
  if (!effect || typeof effect !== "object") {
    return null;
  }

  const id = safeToken(effect.id) || `effect-${effectIndex + 1}`;
  const elements = Array.isArray(effect.elements)
    ? effect.elements.map((element, index) => sanitizeAmbientElement(element, index)).filter(isPresent).slice(0, MAX_AMBIENT_ELEMENTS)
    : [];
  const keyframes = Array.isArray(effect.keyframes)
    ? effect.keyframes.map(sanitizeAmbientKeyframe).filter(isPresent).slice(0, MAX_AMBIENT_KEYFRAMES)
    : [];

  if (!elements.length || keyframes.length < 2) {
    return null;
  }

  return {
    id,
    label: typeof effect.label === "string" ? effect.label.slice(0, 80) : undefined,
    placement: effect.placement === "foreground" ? "foreground" : "background",
    elements,
    keyframes: keyframes.sort((left, right) => left.offset - right.offset),
  };
}

function sanitizeAmbientElement(element: GeneratedAmbientElement, index: number): GeneratedAmbientElement | null {
  if (!element || typeof element !== "object") {
    return null;
  }

  return {
    id: safeToken(element.id) || `element-${index + 1}`,
    style: sanitizeAmbientStyle(element.style),
    animation: sanitizeAmbientAnimation(element.animation),
  };
}

function sanitizeAmbientAnimation(animation: GeneratedAmbientElement["animation"]): GeneratedAmbientElement["animation"] {
  if (!animation || typeof animation !== "object") {
    return undefined;
  }

  const durationSeconds = clampNumber(animation.durationSeconds, 2, 60, 18);
  const delaySeconds = clampNumber(animation.delaySeconds || 0, -60, 30, 0);
  const iterationCount = animation.iterationCount === "infinite"
    ? "infinite"
    : typeof animation.iterationCount === "number"
      ? clampNumber(animation.iterationCount, 1, 24, 1)
      : "infinite";

  return {
    durationSeconds,
    delaySeconds,
    timingFunction: safeTimingFunction(animation.timingFunction) || "linear",
    iterationCount,
    direction: safeAnimationDirection(animation.direction) || "normal",
  };
}

function sanitizeAmbientKeyframe(keyframe: GeneratedAmbientKeyframe): GeneratedAmbientKeyframe | null {
  if (!keyframe || typeof keyframe !== "object") {
    return null;
  }

  return {
    offset: clampNumber(keyframe.offset, 0, 100, 0),
    transform: safeCssValue(keyframe.transform, 120),
    opacity: keyframe.opacity === undefined ? undefined : clampNumber(keyframe.opacity, 0, 1, 1),
    filter: safeCssValue(keyframe.filter, 120),
  };
}

function sanitizeAmbientStyle(style: GeneratedAmbientStyle = {}): GeneratedAmbientStyle {
  if (!style || typeof style !== "object") {
    return {};
  }

  return {
    top: safeCssValue(style.top),
    right: safeCssValue(style.right),
    bottom: safeCssValue(style.bottom),
    left: safeCssValue(style.left),
    width: safeCssValue(style.width),
    height: safeCssValue(style.height),
    borderRadius: safeCssValue(style.borderRadius),
    background: safeCssValue(style.background, 220),
    border: safeCssValue(style.border, 180),
    boxShadow: safeCssValue(style.boxShadow, 260),
    opacity: style.opacity === undefined ? undefined : clampNumber(style.opacity, 0, 1, 1),
    mixBlendMode: safeBlendMode(style.mixBlendMode),
    filter: safeCssValue(style.filter, 140),
    transform: safeCssValue(style.transform, 140),
  };
}

function ambientElementStyles(effect: GeneratedAmbientEffect, element: GeneratedAmbientElement) {
  const animation = element.animation;
  const style = {
    ...element.style,
    zIndex: effect.placement === "foreground" ? 3 : 0,
  } as CSSProperties;

  if (animation) {
    style.animationName = ambientAnimationName(effect.id);
    style.animationDuration = `${animation.durationSeconds}s`;
    style.animationDelay = `${animation.delaySeconds || 0}s`;
    style.animationFillMode = "both";
    style.animationTimingFunction = animation.timingFunction || "linear";
    style.animationIterationCount = String(animation.iterationCount || "infinite");
    style.animationDirection = animation.direction || "normal";
  }

  return style;
}

function ambientEffectStyles(effects: GeneratedAmbientEffect[]) {
  return effects.map((effect) => {
    const frames = effect.keyframes.map((frame) => {
      const declarations = [
        frame.transform ? `transform: ${frame.transform};` : "",
        frame.opacity !== undefined ? `opacity: ${frame.opacity};` : "",
        frame.filter ? `filter: ${frame.filter};` : "",
      ].filter(Boolean).join(" ");

      return `${frame.offset}% { ${declarations} }`;
    }).join("\n");

    return `@keyframes ${ambientAnimationName(effect.id)} { ${frames} }`;
  }).join("\n");
}

function ambientAnimationName(effectId: string) {
  return `ambient-${effectId}`;
}

function safeToken(value: unknown) {
  return typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) : "";
}

function safeCssValue(value: unknown, maxLength = 96) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > maxLength || /[<>{};]/.test(trimmed) || /url\s*\(/i.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function safeBlendMode(value: unknown) {
  const allowed = ["normal", "multiply", "screen", "overlay", "soft-light", "lighten", "darken", "color-dodge"];
  return typeof value === "string" && allowed.includes(value) ? value : undefined;
}

function safeTimingFunction(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return /^(linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\([\d.,\s-]+\))$/.test(value) ? value : undefined;
}

function safeAnimationDirection(value: unknown): GeneratedAmbientAnimation["direction"] {
  const allowed = ["normal", "reverse", "alternate", "alternate-reverse"] as const;
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as GeneratedAmbientAnimation["direction"] : undefined;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function isPresent<T>(value: T | null | undefined): value is T {
  return Boolean(value);
}
