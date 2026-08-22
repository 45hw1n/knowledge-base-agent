/**
 * Parses an RFC 5322-style "From" header value into a plain
 * `{name, email}` pair — e.g. `"Vendor Inc" <billing@vendor.com>` or a bare
 * `billing@vendor.com`. Never throws; returns `{name: null, email: null}`
 * for anything unparseable rather than guessing.
 *
 * @param {string} value
 * @returns {{ name: string|null, email: string|null }}
 */
function parseFromHeader(value) {
  if (!value || typeof value !== 'string') return { name: null, email: null };

  const angleMatch = value.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (angleMatch) {
    const name = angleMatch[1].trim();
    const email = angleMatch[2].trim().toLowerCase();
    return { name: name || null, email: email || null };
  }

  const trimmed = value.trim();
  if (trimmed.includes('@')) {
    return { name: null, email: trimmed.toLowerCase() };
  }

  return { name: trimmed || null, email: null };
}

module.exports = { parseFromHeader };
