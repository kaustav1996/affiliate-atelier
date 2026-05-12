"use client";

import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { useMemo, useState, useTransition } from "react";
import { formatMoney, formatPercent } from "@/lib/money";
import type { GeneratedManifest } from "@/lib/storefront-theme";
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

const FLOATING_BUBBLES = [1, 2, 3, 4, 5, 6, 7] as const;

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
  const hasFloatingBubbles = generated && hasEffect(tone, "bubble");
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
      setCartOpen(false);
      setCheckoutOpen(false);
    });
  }

  if (order) {
    const success = tone.success || defaultManifest(affiliateSlug).success!;

    return (
      <main
        className={`commerce-shell success-shell ${generated ? "generated-tone" : ""} ${hasFloatingBubbles ? "effect-bubbles" : ""}`}
        data-testid="storefront-root"
        style={toneStyles(tone)}
      >
        {hasFloatingBubbles ? <FloatingBubbles /> : null}
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
      className={`commerce-shell ${generated ? "generated-tone" : ""} ${hasFloatingBubbles ? "effect-bubbles" : ""}`}
      data-testid="storefront-root"
      style={toneStyles(tone)}
    >
      {hasFloatingBubbles ? <FloatingBubbles /> : null}
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
            Cart <span>{cartItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
          </button>
        </div>
      </nav>

      <section className="store-hero">
        <div>
          <p className="eyebrow">{tone.eyebrow}</p>
          <h1>{tone.hero}</h1>
        </div>
        <div className="hero-copy-block">
          <span>{tone.badge}</span>
          <p>{tone.subcopy}</p>
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
          <div>
            <p className="eyebrow">Secure test checkout</p>
            <h2>{tone.checkoutLanguage}</h2>
            <p>Fake card: 4242 4242 4242 4242 · 12/30 · 123</p>
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

function FloatingBubbles() {
  return (
    <div className="floating-bubbles" aria-hidden="true">
      {FLOATING_BUBBLES.map((bubble) => (
        <span className={`floating-bubble floating-bubble-${bubble}`} key={bubble} />
      ))}
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

function hasEffect(tone: GeneratedManifest, effect: string) {
  const effectNeedle = effect.toLowerCase();
  const explicitEffects = tone.effects || [];

  if (explicitEffects.some((item) => item.toLowerCase().includes(effectNeedle))) {
    return true;
  }

  const success = tone.success;
  const text = [
    tone.title,
    tone.eyebrow,
    tone.hero,
    tone.subcopy,
    tone.badge,
    tone.checkoutLanguage,
    success?.eyebrow,
    success?.title,
    success?.body,
    success?.affiliateAttribution,
    success?.continueLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes(effectNeedle);
}

function formatSuccessText(template: string, order: CheckoutResult) {
  return template
    .replaceAll("{orderId}", order.id.slice(0, 10))
    .replaceAll("{kind}", order.kind.toLowerCase())
    .replaceAll("{affiliateSlug}", order.affiliateSlug || "")
    .replaceAll("{commission}", formatMoney(order.commissionInCents));
}
