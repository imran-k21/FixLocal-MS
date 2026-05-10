import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { reverseGeocodeCity } from "../utils/geocode";
import { isValidCityStateCountry, normalizeCityStateCountry } from "../utils/locationFormat";
import LocationPartsInput from "./LocationPartsInput";

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
  const [locationValue, setLocationValue] = useState(initialCity);
  const [service, setService] = useState(initialService);
  const [locationLoading, setLocationLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLocationValue(initialCity);
  }, [initialCity]);

  useEffect(() => {
    setService(initialService);
  }, [initialService]);

  const handleSearch = () => {
    const normalizedCity = normalizeCityStateCountry(locationValue);
    if (!normalizedCity || !isValidCityStateCountry(normalizedCity)) {
      alert("Please select City, State and Country");
      return;
    }

    if (onSearch) {
      onSearch({ city: normalizedCity, service });
      return;
    }

    const params = new URLSearchParams({ city: normalizedCity });
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
            setLocationValue(resolvedCity);
          } else {
            alert("Unable to determine location from your GPS.");
          }
        } catch (err) {
          alert("Failed to detect location. Please enter it manually.");
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
    <div className="glass-panel-strong animated-outline animate-fade-in-up relative z-30 flex flex-col justify-center gap-3 overflow-visible rounded-2xl p-3 sm:gap-4 sm:p-4 md:p-5">
      <LocationPartsInput
        value={locationValue}
        onChange={setLocationValue}
        required
        wrapperClassName="grid gap-3 sm:grid-cols-1 lg:grid-cols-3"
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
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
    </div>
  );
}

export default SearchBar;
