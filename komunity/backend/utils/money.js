/**
 * Compute an affiliate commission amount (pure).
 * @param {number} amountPaidCents - the amount the member paid, in cents
 * @param {number} percent - commission percentage (e.g. 40 for 40%)
 * @returns {number} commission in major units (e.g. dollars), 0 if not applicable
 */
function computeCommission(amountPaidCents, percent) {
  const cents = Number(amountPaidCents);
  const pct = Number(percent);
  if (!cents || cents <= 0 || !pct || pct <= 0) return 0;
  return (cents / 100) * (pct / 100);
}

module.exports = { computeCommission };
