const MULTI_SPACE_REGEX = /\s+/g;

function normalizePart(value) {
  return String(value || "").trim().replace(MULTI_SPACE_REGEX, " ");
}

export function normalizeCityStateCountry(raw) {
  if (typeof raw !== "string") return "";
  const parts = raw
    .split(",")
    .map((part) => normalizePart(part))
    .filter(Boolean);

  if (parts.length !== 3) return "";
  return parts.join(", ");
}

export function splitCityStateCountry(raw) {
  const normalized = normalizeCityStateCountry(raw);
  if (!normalized) {
    return { city: "", state: "", country: "" };
  }

  const [city, state, country] = normalized.split(",").map((part) => normalizePart(part));
  return { city: city || "", state: state || "", country: country || "" };
}

export function isValidCityStateCountry(raw) {
  return Boolean(normalizeCityStateCountry(raw));
}

export function buildCityStateCountry(city, state, country) {
  return normalizeCityStateCountry([city, state, country].filter(Boolean).join(", "));
}
