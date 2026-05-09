import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import WorkerCard from "../components/WorkerCard";
import SearchBar from "../components/SearchBar";

function SearchResults() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const navigate = useNavigate();
  const cityParam = params.get("city") ?? "";
  const serviceParam = params.get("service") ?? params.get("occupation") ?? "";
  const latitudeParam = params.get("latitude");
  const longitudeParam = params.get("longitude");
  const radiusKmParam = params.get("radiusKm");

  const initialLatitude = latitudeParam != null ? Number(latitudeParam) : null;
  const initialLongitude = longitudeParam != null ? Number(longitudeParam) : null;
  const initialRadiusKm = radiusKmParam != null ? Number(radiusKmParam) : null;
  const [city, setCity] = useState(cityParam);
  const [service, setService] = useState(serviceParam);
  const [latitude, setLatitude] = useState(Number.isFinite(initialLatitude) ? initialLatitude : null);
  const [longitude, setLongitude] = useState(Number.isFinite(initialLongitude) ? initialLongitude : null);
  const [radiusKm, setRadiusKm] = useState(Number.isFinite(initialRadiusKm) ? initialRadiusKm : null);
  const [priceCap, setPriceCap] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState("relevance");

  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchWorkers() {
      if (!city) {
        setWorkers([]);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ city });
        if (service) {
          query.append("occupation", service);
        }
        if (Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(radiusKm)) {
          query.append("latitude", String(latitude));
          query.append("longitude", String(longitude));
          query.append("radiusKm", String(radiusKm));
        }
        if (priceCap) {
          query.append("maxPrice", priceCap);
        }
        if (minRating) {
          query.append("minRating", String(minRating));
        }
        if (sortBy && sortBy !== "relevance") {
          query.append("sort", sortBy);
        }

        const url = `/tradespersons/search?${query.toString()}`;
        const { data } = await api.get(url);
        const results = data.content || data || [];
        setWorkers(results);
      } catch (err) {
        setError("Failed to load tradespersons. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchWorkers();
  }, [city, service, latitude, longitude, radiusKm, priceCap, minRating, sortBy]);

  useEffect(() => {
    const filtered = workers
      .filter((worker) => {
        const basePrice = worker.basePrice ?? worker.price;
        if (priceCap && basePrice && Number(basePrice) > Number(priceCap)) {
          return false;
        }
        if (minRating && worker.averageRating && worker.averageRating < minRating) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const priceA = a.basePrice ?? a.price;
        const priceB = b.basePrice ?? b.price;
        if (sortBy === "price" && priceA != null && priceB != null) {
          return priceA - priceB;
        }
        if (sortBy === "rating") {
          const ratingA = a.averageRating ?? 0;
          const ratingB = b.averageRating ?? 0;
          return ratingB - ratingA;
        }
        return 0;
      });
    setVisible(filtered);
  }, [workers, priceCap, minRating, sortBy]);

  const [visible, setVisible] = useState([]);

  const handleSearch = ({ city: nextCity, service: nextService }) => {
    setCity(nextCity);
    setService(nextService);
    setLatitude(null);
    setLongitude(null);
    setRadiusKm(null);

    const params = new URLSearchParams({ city: nextCity });
    if (nextService) {
      params.append("service", nextService);
    }

    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-1 py-6 animate-fade-in-up sm:space-y-8 sm:px-2 sm:py-8 md:py-10">
      <div className="space-y-6">
        <SearchBar initialCity={city} initialService={service} onSearch={handleSearch} />
        <div className="glass-panel-strong animated-outline grid grid-cols-1 gap-3 rounded-2xl p-3 shadow-xl sm:grid-cols-2 sm:gap-4 sm:p-4 lg:grid-cols-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 uppercase">Max price (₹)</p>
            <input
              type="number"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={priceCap}
              onChange={(e) => setPriceCap(e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 uppercase">Minimum rating</p>
            <select
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
            >
              {[0, 3, 3.5, 4, 4.5].map((rating) => (
                <option key={rating} value={rating}>
                  {rating === 0 ? "Any" : `${rating}+ ★`}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <p className="text-xs text-slate-500 uppercase">Sort by</p>
            <select
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="relevance">Relevance</option>
              <option value="price">Lowest price</option>
              <option value="rating">Highest rating</option>
            </select>
          </div>
        </div>
      </div>
      <h1 className="mb-2 text-2xl font-bold text-gradient-fire sm:text-3xl">
        {service ? `${service} in ${city || "your area"}` : `Tradespersons in ${city || "your area"}`}
      </h1>
      {loading && <p className="rounded-lg bg-white/60 px-3 py-2 text-text-secondary">Loading workers...</p>}
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-red-500">{error}</p>}
      {!loading && !error && visible.length === 0 && (
        <p className="rounded-lg bg-white/60 px-3 py-2 text-text-secondary">No tradespersons found for this search.</p>
      )}
      <div className="stagger-children grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((worker) => (
          <WorkerCard key={worker.id} worker={worker} />
        ))}
      </div>
    </div>
  );
}

export default SearchResults;
