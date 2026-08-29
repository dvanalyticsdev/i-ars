export const formatIndianNumber = (amount: number) =>
  Number(amount || 0).toLocaleString('en-IN');

export const formatCurrency = (amount: number) => `₹${formatIndianNumber(amount)}`;
