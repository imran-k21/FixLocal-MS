import { buildCityStateCountry } from "./locationFormat";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

export async function reverseGeocodeCity(latitude, longitude) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new Error("Latitude and longitude must be numbers");
  }

  const params = new URLSearchParams({
    format: "json",
    lat: latitude.toString(),
    lon: longitude.toString(),
    addressdetails: "1",
  });

  const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
    headers: {
      "User-Agent": "FixLocalApp/1.0 (contact@fixlocal.example)",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to reverse geocode location");
  }

  const data = await response.json();
  const city =
    data?.address?.city ||
    data?.address?.town ||
    data?.address?.village ||
    data?.address?.hamlet ||
    "";
  const state = data?.address?.state || data?.address?.state_district || data?.address?.county || "";
  const country = data?.address?.country || "";
  return buildCityStateCountry(city, state, country);
}