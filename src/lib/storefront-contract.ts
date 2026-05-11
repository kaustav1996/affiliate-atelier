export type ProductView = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceInCents: number;
  scentFamily: string;
  commissionRate: number;
  imageUrl?: string | null;
  gradient?: string | null;
};

export type CartItemView = {
  product: ProductView;
  quantity: number;
};

export type StorefrontProps = {
  products: ProductView[];
  affiliateSlug?: string;
  cartItems: CartItemView[];
  onAddToCart: (productId: string) => void;
  onOpenCart: () => void;
};

export type CartExperienceProps = {
  items: CartItemView[];
  totalAmountInCents: number;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
  onClose: () => void;
};

export type CheckoutExperienceProps = {
  items: CartItemView[];
  totalAmountInCents: number;
  email: string;
  address: string;
  onEmailChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onPay: () => void;
  isPaying: boolean;
};

export type SuccessExperienceProps = {
  orderId: string;
  commissionPreviewInCents?: number;
  affiliateSlug?: string;
};
