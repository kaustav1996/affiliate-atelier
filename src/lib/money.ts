export function calculateCommission(totalAmountInCents: number, rate = 0.1) {
  return Math.round(totalAmountInCents * rate);
}

export function formatMoney(amountInCents: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountInCents / 100);
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
