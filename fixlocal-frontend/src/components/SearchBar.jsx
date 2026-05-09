import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { reverseGeocodeCity } from "../utils/geocode";

const SERVICES = [
  { value: "", label: "All Services" },
  { value: "electrician", label: "Electrician" },
  { value: "plumber", label: "Plumber" },
  { value: "carpenter", label: "Carpenter" },
  { value: "painter", label: "Painter" },
  { value: "cleaning", label: "Cleaning" },
  { value: "ac-repair", label: "AC Repair" },
  { value: "appliance-repair", label: "Appliance Repair" },
  { value: "pest-control", label: "Pest Control" },
  { value: "waterproofing", label: "Waterproofing" },
];

function SearchBar({ initialCity = "", initialService = "", onSearch }) {

  const [city, setCity] = useState(initialCity);
  const [service, setService] = useState(initialService);
  const [locationLoading, setLocationLoading] = useState(false);
  const [allCities, setAllCities] = useState([]);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    setCity(initialCity);
  }, [initialCity]);

  useEffect(() => {
    setService(initialService);
  }, [initialService]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function fetchCities() {
      try {
        const response = await fetch(
          "https://countriesnow.space/api/v0.1/countries/cities",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ country: "India" }),
            signal: controller.signal,
          }
        );
        const payload = await response.json();
        if (!cancelled && payload?.data) {
          const uniqueCities = Array.from(new Set(payload.data)).sort((a, b) =>
            a.localeCompare(b)
          );
          setAllCities(uniqueCities);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to load city list", error);
        }
      }
    }

    fetchCities();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    }

    if (showSuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSuggestions]);

  const handleCityInput = (value) => {
    setCity(value);
    if (!value.trim()) {
      setCitySuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const prefix = value.toLowerCase();
    const matches = allCities.filter((name) =>
      name.toLowerCase().startsWith(prefix)
    );
    setCitySuggestions(matches);
    setShowSuggestions(matches.length > 0);
  };

  const handleSelectCity = (selectedCity) => {
    setCity(selectedCity);
    setShowSuggestions(false);
  };

  const handleSearch = () => {

    if (!city) {
      alert("Please enter city");
      return;
    }

    if (onSearch) {
      onSearch({ city, service });
      return;
    }

    const params = new URLSearchParams({ city });
    if (service) {
      params.append("service", service);
    }

    navigate(`/search?${params.toString()}`);

  };

  const handleUseMyLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser.");
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const resolvedCity = await reverseGeocodeCity(
            position.coords.latitude,
            position.coords.longitude
          );
          if (resolvedCity) {
            setCity(resolvedCity);
          } else {
            alert("Unable to determine city from your location.");
          }
        } catch (err) {
          alert("Failed to detect city. Please enter it manually.");
        } finally {
          setLocationLoading(false);
        }
      },
      () => {
        alert("Unable to access your location.");
        setLocationLoading(false);
      }
    );
  };

  return (
    <div className="glass-panel-strong animated-outline animate-fade-in-up relative z-30 flex flex-col justify-center gap-3 overflow-visible rounded-2xl p-3 sm:gap-4 sm:p-4 md:flex-row md:items-center md:p-5">
      <div className="relative z-40 w-full md:flex-1" ref={suggestionsRef}>
        <input
          type="text"
          placeholder="Enter city"
          className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-text-primary shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          value={city}
          onChange={(e) => handleCityInput(e.target.value)}
          onFocus={() => city && setShowSuggestions(citySuggestions.length > 0)}
          autoComplete="off"
        />
        {showSuggestions && citySuggestions.length > 0 && (
          <div className="absolute left-0 top-full z-[90] mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
            {citySuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="block w-full px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-primary/10"
                onClick={() => handleSelectCity(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleUseMyLocation}
        className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-text-primary transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg md:w-auto"
        disabled={locationLoading}
      >
        {locationLoading ? "Detecting…" : "Use My Location"}
      </button>

      <select
        className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-text-primary shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 md:w-auto"
        value={service ?? ""}
        onChange={(e) => setService(e.target.value)}
      >
        {SERVICES.map((svc) => (
          <option key={svc.value} value={svc.value}>
            {svc.label}
          </option>
        ))}
      </select>

      <button
        onClick={handleSearch}
        className="btn-glow shimmer relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-primary via-indigo-600 to-fuchsia-600 px-6 py-2.5 text-white transition hover:from-indigo-600 hover:to-primary md:w-auto"
      >
        Search
      </button>
    </div>
  );
}

export default SearchBar;
