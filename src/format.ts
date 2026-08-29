export const formatIndianNumber = (amount: number) =>
  Number(amount || 0).toLocaleString('en-IN');

export const formatCurrency = (amount: number) => `₹${formatIndianNumber(amount)}`;

export const formatCourseLabel = (courseName: string, courseKey: string) => {
  const name = String(courseName || '').trim();
  const key = String(courseKey || '').trim();

  if (!name) return key;
  if (!key || name.toLowerCase() === key.toLowerCase()) return name;
  return `${name} (${key})`;
};
