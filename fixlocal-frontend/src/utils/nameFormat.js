export function formatPersonName(name) {
  const raw = String(name || "").trim();
  if (!raw) return "";

  return raw
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
