/**
 * Formats the last 4 digits of a card by prefixing it with a common mask.
 * @param last4 The 4-digit string representing the card ending
 * @returns Masked card string (e.g., "**** 1234")
 */
export const formatCardLast4 = (last4: string): string => {
  if (!last4) return '';
  return `**** ${last4}`;
};

/**
 * Formats the expiry month and year into a MM/YY string.
 * @param month Expiry month (1-12)
 * @param year Expiry year (e.g., 2026)
 * @returns Formatted expiry string (e.g., "04/26")
 */
export const formatExpiry = (month: number, year: number): string => {
  if (!month || !year) return '';
  // Pad the month to 2 digits
  const formattedMonth = month.toString().padStart(2, '0');
  // Get the last 2 digits of the year
  const formattedYear = year.toString().slice(-2);
  
  return `${formattedMonth}/${formattedYear}`;
};
