import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import { bookingService } from "../api/bookingService";
import { useAuth } from "../context/AuthContext";
import { formatPhoneForDisplay } from "../utils/phone";
import { formatPersonName } from "../utils/nameFormat";
import { buildCityStateCountry, isValidCityStateCountry, normalizeCityStateCountry } from "../utils/locationFormat";
import { reverseGeocodeCity } from "../utils/geocode";

function WorkerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [worker, setWorker] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [address, setAddress] = useState("");
  const [resolvedUserCity, setResolvedUserCity] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fetchingSuggestions, setFetchingSuggestions] = useState(false);
  const [coords, setCoords] = useState({ lat: "", lng: "" });
  const [offerAmount, setOfferAmount] = useState("");
  const [geoStatus, setGeoStatus] = useState("");
  const suggestionRef = useRef(null);

  useEffect(() => {
    async function fetchWorker() {
      setError("");
      try {
        const res = await api.get(`/tradespersons/${id}`);
        const fetchedWorker = res.data;
        setWorker(fetchedWorker);

        const aiSuggestedOffer = Number(fetchedWorker?.aiSuggestedOffer);
        const serviceBasePrice = Number(
          fetchedWorker?.serviceOfferings?.find((offering) =>
            Number.isFinite(Number(offering?.basePrice)) && Number(offering.basePrice) > 0
          )?.basePrice
        );
        const fallbackOffer = Number(fetchedWorker?.rate ?? fetchedWorker?.baseRate ?? 1000);

        const seededOffer =
          Number.isFinite(aiSuggestedOffer) && aiSuggestedOffer > 0
            ? aiSuggestedOffer
            : Number.isFinite(serviceBasePrice) && serviceBasePrice > 0
              ? serviceBasePrice
              : Number.isFinite(fallbackOffer) && fallbackOffer > 0
                ? fallbackOffer
                : 1000;

        setOfferAmount(String(Math.round(seededOffer)));
      } catch (err) {
        setError("Failed to load tradesperson profile.");
      }
    }
    fetchWorker();
  }, [id]);

  const captureLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus("Geolocation not supported by this browser.");
      return;
    }
    setGeoStatus("Fetching your location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude.toFixed(5),
          lng: position.coords.longitude.toFixed(5),
        });
        setGeoStatus("Location captured. You can now book.");
      },
      () => {
        setGeoStatus("Could not retrieve GPS location. Please try again.");
      }
    );
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const parseCoord = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const buildAddressLabel = (properties = {}) => {
    const streetLine = [properties.housenumber, properties.street]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ")
      .trim();

    const parts = [
      properties.name,
      streetLine,
      properties.district,
      properties.city,
      properties.state,
      properties.country,
    ]
      .map((part) => String(part || "").trim())
      .filter(Boolean);

    return Array.from(new Set(parts)).join(", ");
  };

  const buildUserCityFromSuggestion = (properties = {}) => {
    const city =
      properties.city ||
      properties.locality ||
      properties.town ||
      properties.village ||
      properties.county ||
      "";
    const state = properties.state || properties.region || properties.county || "";
    const country = properties.country || "";

    return buildCityStateCountry(city, state, country);
  };

  // load address suggestions when typing
  useEffect(() => {
    if (!address || address.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    async function fetchSuggestions() {
      try {
        setFetchingSuggestions(true);
        const query = new URLSearchParams({
          q: address,
          lang: "en",
          limit: "8",
        });
        const resp = await fetch(
          `https://photon.komoot.io/api/?${query.toString()}`,
          {
            signal: controller.signal,
            headers: {
              "User-Agent": "FixLocalApp/1.0 (contact@fixlocal.example)",
              Accept: "application/json",
            },
          }
        );
        const payload = await resp.json();
        if (active) {
          const feats = Array.isArray(payload?.features) ? payload.features : [];
          setSuggestions(feats);
          setShowSuggestions(feats.length > 0);
        }
      } catch (fetchErr) {
        if (active && fetchErr?.name !== "AbortError") {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        active && setFetchingSuggestions(false);
      }
    }

    const debounceId = setTimeout(fetchSuggestions, 250);
    return () => {
      active = false;
      clearTimeout(debounceId);
      controller.abort();
    };
  }, [address]);

  const handleBook = async () => {
    if (submitting) {
      return;
    }

    if (!isAuthenticated) {
      navigate("/login", { state: { redirectTo: `/worker/${id}` } });
      return;
    }
    if (user?.role !== "USER") {
      setError("Only customers can create bookings.");
      return;
    }
    if (!address.trim()) {
      setError("Please provide your location before booking.");
      return;
    }

    const parsedOfferAmount = Number(offerAmount);
    if (!Number.isFinite(parsedOfferAmount) || parsedOfferAmount <= 0) {
      setError("Please enter a valid offer amount.");
      return;
    }

    const normalizedServiceAddress = address.trim();
    let normalizedUserCity = normalizeCityStateCountry(resolvedUserCity || "");

    let lat = parseCoord(coords.lat);
    let lng = parseCoord(coords.lng);

    if ((lat === null || lng === null || !isValidCityStateCountry(normalizedUserCity)) && normalizedServiceAddress.length >= 3) {
      try {
        const searchParams = new URLSearchParams({
          q: normalizedServiceAddress,
          lang: "en",
          limit: "1",
        });
        const resp = await fetch(`https://photon.komoot.io/api/?${searchParams.toString()}`);
        const data = await resp.json();
        const bestMatch = data?.features?.[0];
        if (bestMatch?.geometry?.coordinates?.length === 2) {
          lat = Number(bestMatch.geometry.coordinates[1]);
          lng = Number(bestMatch.geometry.coordinates[0]);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setCoords({ lat: lat.toFixed(5), lng: lng.toFixed(5) });
          }
        }

        if (!isValidCityStateCountry(normalizedUserCity)) {
          const bestMatchCity = buildUserCityFromSuggestion(bestMatch?.properties || {});
          if (isValidCityStateCountry(bestMatchCity)) {
            normalizedUserCity = bestMatchCity;
            setResolvedUserCity(bestMatchCity);
          }
        }
      } catch (geoErr) {
        console.warn("Fallback geocode failed", geoErr);
      }
    }

    if (!isValidCityStateCountry(normalizedUserCity)) {
      const fromAddress = normalizeCityStateCountry(normalizedServiceAddress);
      if (isValidCityStateCountry(fromAddress)) {
        normalizedUserCity = fromAddress;
      }
    }

    if (!isValidCityStateCountry(normalizedUserCity) && lat !== null && lng !== null) {
      try {
        const fromGps = normalizeCityStateCountry(await reverseGeocodeCity(lat, lng));
        if (isValidCityStateCountry(fromGps)) {
          normalizedUserCity = fromGps;
          setResolvedUserCity(fromGps);
        }
      } catch (reverseErr) {
        console.warn("Reverse geocode for city failed", reverseErr);
      }
    }

    if (!isValidCityStateCountry(normalizedUserCity)) {
      setError("Please choose a location suggestion so city, state, and country are captured.");
      return;
    }

    if (lat === null || lng === null) {
      setError("Please select a suggestion or capture your precise location before booking.");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      setSuccess("");
      const now = new Date();
      const start = new Date(now.getTime() + 60 * 60 * 1000);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      await bookingService.create({
        tradespersonId: id,
        serviceAddress: normalizedServiceAddress,
        serviceDescription: `Booking with ${worker?.name || "tradesperson"}`,
        bookingStartTime: start.toISOString(),
        bookingEndTime: end.toISOString(),
        offerAmount: parsedOfferAmount,
        userCity: normalizedUserCity,
        userLatitude: lat,
        userLongitude: lng,
      });
      setSuccess("Booking request sent! You can track it from your dashboard.");
    } catch (err) {
      const errorCode = err?.response?.data?.code;
      if (errorCode === "PENDING_BOOKING_EXISTS") {
        setError(
          "You already have a pending request with this tradesperson. Please check your dashboard/current booking."
        );
        return;
      }

      setError(err?.response?.data?.message || "Failed to create booking.");
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !worker) return <p className="p-10 text-red-500">{error}</p>;
  if (!worker) return <p className="p-10 text-text-secondary">Loading...</p>;

  const workerPhone =
    worker?.phone || worker?.mobile || worker?.mobileNumber || worker?.contactNumber;
  const dialPhone = workerPhone ? String(workerPhone).replace(/[^\d+]/g, "") : "";
  const formattedPhone = workerPhone ? formatPhoneForDisplay(workerPhone) : "";
  const aiMatchScore = Number.isFinite(Number(worker?.aiMatchScore))
    ? Number(worker.aiMatchScore).toFixed(1)
    : null;
  const aiSuggestedOffer = Number.isFinite(Number(worker?.aiSuggestedOffer))
    ? Number(worker.aiSuggestedOffer)
    : null;
  const aiSuggestedMin = Number.isFinite(Number(worker?.aiSuggestedOfferMin))
    ? Number(worker.aiSuggestedOfferMin)
    : null;
  const aiSuggestedMax = Number.isFinite(Number(worker?.aiSuggestedOfferMax))
    ? Number(worker.aiSuggestedOfferMax)
    : null;
  const matchReason = worker?.aiMatchReason
    ? worker.aiMatchReason.replace(/^AI match based on\s*/i, "Strong fit based on ")
    : "";
  const displayName = formatPersonName(worker?.name) || worker?.name || "Tradesperson";

  const handleDial = (event) => {
    event?.preventDefault?.();
    if (!dialPhone) return;

    const isMobileDevice = /Android|iPhone|iPad|iPod|Windows Phone|Opera Mini|IEMobile/i.test(
      navigator.userAgent
    );

    if (isMobileDevice) {
      window.location.href = `tel:${dialPhone}`;
      return;
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(dialPhone).catch(() => {});
    }

    window.alert(`Dial this number: ${formattedPhone || dialPhone}`);
  };

  return (
    <div className="py-12">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-3xl shadow p-8 border border-gray-200 relative">
          <img
            src="/tradesperson.png"
            alt="Tradesperson badge"
            className="absolute top-1 right-1 object-contain"
            style={{ height: "150px", width: "150px" }}
          />
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase text-text-secondary">Tradesperson</p>
            <h1 className="text-4xl font-bold text-text-primary">{displayName}</h1>
            <p className="text-lg text-text-secondary">{worker.occupation}</p>
          </div>
          <dl className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-text-primary">
            <div>
              <dt className="text-sm text-text-secondary">Location</dt>
              <dd className="text-base">📍 {worker.workingCity}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-secondary">Experience</dt>
              <dd className="text-base">🧰 {worker.experience || 0} years</dd>
            </div>
            <div>
              <dt className="text-sm text-text-secondary">Mobile</dt>
              <dd className="text-base">
                📞 {formattedPhone || "Not provided"}
                {dialPhone && (
                  <button
                    type="button"
                    onClick={handleDial}
                    className="ml-2 inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Call
                  </button>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-text-secondary">Rating</dt>
              <dd className="text-base">
                ⭐ {Number.isFinite(Number(worker.averageRating)) ? Number(worker.averageRating).toFixed(1) : "N/A"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-text-secondary">Status</dt>
              <dd>
                <span
                  className={`inline-flex items-center px-3 py-1 text-xs rounded-full ${
                    worker.status === "AVAILABLE"
                      ? "bg-green-100 text-green-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {worker.status}
                </span>
              </dd>
            </div>
          </dl>

          {(aiMatchScore || worker?.aiMatchReason || aiSuggestedOffer) && (
            <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <p className="text-sm font-semibold text-indigo-800">Match Insights & Fair-Quote Guidance</p>
              {aiMatchScore && (
                <p className="mt-1 text-sm text-indigo-700">Match confidence: {aiMatchScore}/100</p>
              )}
              {matchReason && (
                <p className="mt-1 text-xs text-indigo-700/90">{matchReason}</p>
              )}
              {aiSuggestedOffer && (
                <p className="mt-2 text-sm text-emerald-700">
                  Suggested budget range: ₹{Math.round(aiSuggestedOffer)}
                  {aiSuggestedMin && aiSuggestedMax
                    ? ` (range ₹${Math.round(aiSuggestedMin)} - ₹${Math.round(aiSuggestedMax)})`
                    : ""}
                </p>
              )}
            </div>
          )}

          <div className="mt-6 grid gap-4">
            <div className="relative" ref={suggestionRef}>
              <label className="text-sm text-text-secondary">Your location</label>
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setResolvedUserCity("");
                }}
                onFocus={() => setShowSuggestions(suggestions.length > 0)}
                placeholder="Enter full service address (house, street, area)"
                className="mt-1 w-full border rounded-xl px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-56 overflow-y-auto">
                  {suggestions.map((item) => (
                    <button
                      key={item.properties?.osm_id || `${item.geometry?.coordinates?.join("-")}`}
                      type="button"
                      onClick={() => {
                        const displayLabel =
                          item.properties?.name ||
                          item.properties?.street ||
                          item.properties?.city ||
                          address;
                        const contextParts = [
                          item.properties?.city,
                          item.properties?.state,
                          item.properties?.country,
                        ].filter(Boolean);
                        const fullAddress =
                          buildAddressLabel(item.properties || {}) ||
                          [displayLabel, ...contextParts].filter(Boolean).join(", ");
                        const detectedUserCity = buildUserCityFromSuggestion(item.properties || {});
                        setAddress(fullAddress || address);
                        setResolvedUserCity(detectedUserCity || "");
                        if (item.geometry?.coordinates?.length === 2) {
                          setCoords({
                            lat: Number(item.geometry.coordinates[1]).toFixed(5),
                            lng: Number(item.geometry.coordinates[0]).toFixed(5),
                          });
                        }
                        setShowSuggestions(false);
                      }}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100"
                    >
                      <p className="font-semibold text-slate-800">
                        {item.properties?.name || item.properties?.street ||
                          "Unnamed place"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {[item.properties?.city, item.properties?.state, item.properties?.country]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {fetchingSuggestions && (
                <div className="absolute right-3 top-7 text-slate-400 text-xs">
                  Searching…
                </div>
              )}
              {resolvedUserCity && (
                <p className="mt-1 text-xs text-emerald-600">Selected city: {resolvedUserCity}</p>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="border rounded-xl px-4 py-2 text-sm text-text-secondary transition hover:bg-gray-100"
                  onClick={captureLocation}
                >
                  {coords.lat ? "Refresh my location" : "Capture my location"}
                </button>
                {geoStatus && <p className="text-xs text-text-secondary">{geoStatus}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-secondary">Latitude</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={coords.lat}
                    onChange={(e) =>
                      setCoords((prev) => ({ ...prev, lat: e.target.value }))
                    }
                    placeholder="e.g. 12.97160"
                    className="mt-1 w-full border rounded-xl px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary">Longitude</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={coords.lng}
                    onChange={(e) =>
                      setCoords((prev) => ({ ...prev, lng: e.target.value }))
                    }
                    placeholder="e.g. 77.59460"
                    className="mt-1 w-full border rounded-xl px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="text-sm font-medium text-slate-700">Your offer amount (₹)</label>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <input
                  type="number"
                  min="1"
                  step="10"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  placeholder="Enter your offer"
                  className="w-full border rounded-xl px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {aiSuggestedOffer && (
                  <button
                    type="button"
                    onClick={() => setOfferAmount(String(Math.round(aiSuggestedOffer)))}
                    className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                  >
                    Use suggested amount
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                This amount will be sent as your initial booking offer and can still be negotiated in-app.
              </p>
            </div>
          </div>
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          {success && <p className="mt-4 text-sm text-green-600">{success}</p>}
          <button
            className="mt-8 bg-accent text-white px-6 py-3 rounded-xl disabled:opacity-50 transition hover:bg-blue-800"
            onClick={handleBook}
            disabled={submitting || worker.status !== "AVAILABLE"}
          >
            {submitting ? "Sending request..." : "Book Now"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkerProfile;
