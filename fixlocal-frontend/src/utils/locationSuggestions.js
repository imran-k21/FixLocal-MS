const COUNTRIES_STATES_ENDPOINT = "https://countriesnow.space/api/v0.1/countries/states";
const STATE_CITIES_ENDPOINT = "https://countriesnow.space/api/v0.1/countries/state/cities";

let countriesStatesPromise = null;
const cityCache = new Map();

function normalizeValue(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeLocationLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLookup(value) {
  return normalizeValue(sanitizeLocationLabel(value));
}

function toSortedUnique(list = []) {
  return Array.from(new Set((Array.isArray(list) ? list : []).filter(Boolean)))
    .map((item) => sanitizeLocationLabel(item))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

async function loadCountriesStatesDataset() {
  if (!countriesStatesPromise) {
    countriesStatesPromise = fetch(COUNTRIES_STATES_ENDPOINT)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.error) {
          throw new Error(payload?.msg || "Failed to fetch countries and states");
        }

        return Array.isArray(payload?.data) ? payload.data : [];
      })
      .catch((error) => {
        countriesStatesPromise = null;
        throw error;
      });
  }

  return countriesStatesPromise;
}

function resolveCountryRecord(dataset, countryName) {
  const wanted = normalizeLookup(countryName);
  return dataset.find((entry) => normalizeLookup(entry?.name) === wanted);
}

function resolveStateName(countryRecord, stateName) {
  const wanted = normalizeLookup(stateName);
  const state = (countryRecord?.states || []).find(
    (entry) => normalizeLookup(entry?.name) === wanted
  );
  return state?.name || stateName;
}

export async function fetchCountryOptions() {
  const dataset = await loadCountriesStatesDataset();
  return toSortedUnique(dataset.map((entry) => entry?.name));
}

export async function fetchStateOptions(countryName) {
  if (!countryName) return [];

  const dataset = await loadCountriesStatesDataset();
  const countryRecord = resolveCountryRecord(dataset, countryName);
  if (!countryRecord) return [];

  return toSortedUnique((countryRecord.states || []).map((state) => state?.name));
}

export async function fetchCityOptions(countryName, stateName) {
  if (!countryName || !stateName) return [];

  const dataset = await loadCountriesStatesDataset();
  const countryRecord = resolveCountryRecord(dataset, countryName);
  const resolvedCountry = countryRecord?.name || countryName;
  const resolvedState = resolveStateName(countryRecord, stateName);
  const cacheKey = `${normalizeValue(resolvedCountry)}::${normalizeValue(resolvedState)}`;

  if (cityCache.has(cacheKey)) {
    return cityCache.get(cacheKey);
  }

  const response = await fetch(STATE_CITIES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ country: resolvedCountry, state: resolvedState }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(payload?.msg || "Failed to fetch cities");
  }

  const cities = toSortedUnique(payload?.data);
  cityCache.set(cacheKey, cities);
  return cities;
}
