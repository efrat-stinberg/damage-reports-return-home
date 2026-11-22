// Address helpers. Addresses are entered as "רחוב, מספר, ישוב", so the settlement is the last comma-separated part.
// Addresses without a comma have no recognizable settlement (null) and are simply not offered in the settlement filter.
function getSettlement(address) {
  const parts = String(address || '').split(',');
  if (parts.length < 2) return null;
  return parts[parts.length - 1].trim() || null;
}

module.exports = { getSettlement };
