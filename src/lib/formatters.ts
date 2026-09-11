export const fmtCurrency = (n: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  }).format(n ?? 0);

export const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n ?? 0);

export const fmtNumber = (n: number) => new Intl.NumberFormat("en-US").format(n ?? 0);

export const fmtPercent = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;
