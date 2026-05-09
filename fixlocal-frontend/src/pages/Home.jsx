import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import testimonialApi from "../api/testimonialService";
import { reverseGeocodeCity } from "../utils/geocode";

export const services = [
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

const trustBadges = [
  {
    title: "ID & Document Check",
    copy: "Every pro uploads KYC documents that are revalidated quarterly.",
  },
  {
    title: "Insurance Verified",
    copy: "We request liability cover proof for high-risk trades like roofing.",
  },
  {
    title: "Real Reviews Only",
    copy: "Ratings are tied to completed FixLocal bookings for authenticity.",
  },
];

const highlights = [
  {
    label: "Trades screened",
    value: "2,400+",
    detail: "interviewed & identity verified",
  },
  {
    label: "Jobs completed",
    value: "18,000+",
    detail: "with escrow protection",
  },
  {
    label: "Avg. rating",
    value: "4.8/5",
    detail: "across all categories",
  },
];

const howItWorks = [
  {
    step: "1",
    title: "Search by city & trade",
    copy: "Filter by service, price band, rating, and availability in seconds.",
  },
  {
    step: "2",
    title: "Chat & confirm",
    copy: "Send photos, discuss requirements, and lock pricing inside the app.",
  },
  {
    step: "3",
    title: "Track & pay securely",
    copy: "Follow live ETA, release escrow only when you mark the job complete.",
  },
];

function Home() {
  const DEFAULT_RADIUS_KM = 10;
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [city, setCity] = useState("");
  const [allCities, setAllCities] = useState([]);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const cityDropdownRef = useRef(null);
  const [service, setService] = useState("");
  const [testimonials, setTestimonials] = useState([]);
  const [testimonialError, setTestimonialError] = useState("");
  const [testimonialForm, setTestimonialForm] = useState({
    name: "",
    city: "",
    role: "Homeowner",
    quote: "",
  });
  const [testimonialSubmitting, setTestimonialSubmitting] = useState(false);
  const [testimonialSuccess, setTestimonialSuccess] = useState("");
  const [testimonialFormError, setTestimonialFormError] = useState("");
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationError, setLocationError] = useState("");

  const handleSearch = () => {
    if (!city.trim()) return;
    const url = new URLSearchParams({ city: city.trim() });
    if (service.trim()) url.append("service", service.trim());
    navigate(`/search?${url.toString()}`);
  };

  const handleSearchByCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    setLocationSearching(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        try {
          const detectedCity = await reverseGeocodeCity(latitude, longitude);
          const cityToSearch = (detectedCity || city || "").trim();
          if (!cityToSearch) {
            setLocationError("Couldn't detect city from GPS. Please enter city manually.");
            return;
          }

          setCity(cityToSearch);
          const url = new URLSearchParams({
            city: cityToSearch,
            latitude: String(latitude),
            longitude: String(longitude),
            radiusKm: String(DEFAULT_RADIUS_KM),
          });
          if (service.trim()) url.append("service", service.trim());
          navigate(`/search?${url.toString()}`);
        } catch (error) {
          setLocationError("Failed to detect your location. Please try again.");
        } finally {
          setLocationSearching(false);
        }
      },
      () => {
        setLocationError("Unable to access your location. Please allow GPS permission.");
        setLocationSearching(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    testimonialApi
      .list(6)
      .then(({ data }) => setTestimonials(data || []))
      .catch(() => setTestimonialError("Unable to load community stories"));
  }, []);

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
          setAllCities(Array.from(new Set(payload.data)).sort((a, b) => a.localeCompare(b)));
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Could not load city list", error);
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
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target)) {
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
    const matches = allCities.filter((name) => name.toLowerCase().startsWith(prefix));
    setCitySuggestions(matches);
    setShowSuggestions(matches.length > 0);
  };

  const selectCity = (value) => {
    setCity(value);
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (user) {
      setTestimonialForm((prev) => ({
        ...prev,
        name: user.name || prev.name,
        role: user.role === "TRADESPERSON" ? "Tradesperson" : "Homeowner",
      }));
    }
  }, [user]);

  const handleTestimonialChange = (field, value) => {
    setTestimonialForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTestimonialSubmit = async (event) => {
    event.preventDefault();
    setTestimonialFormError("");
    setTestimonialSuccess("");
    const payload = {
      name: testimonialForm.name.trim(),
      city: testimonialForm.city.trim(),
      role: testimonialForm.role.trim(),
      quote: testimonialForm.quote.trim(),
    };
    if (!payload.name || !payload.city || !payload.quote) {
      setTestimonialFormError("Please fill in your name, city, and testimonial.");
      return;
    }
    if (payload.quote.length < 20) {
      setTestimonialFormError("Tell us a bit more (minimum 20 characters).");
      return;
    }
    try {
      setTestimonialSubmitting(true);
      const { data } = await testimonialApi.submit(payload);
      setTestimonials((prev) => [data, ...prev].slice(0, 6));
      setTestimonialSuccess("Thanks for sharing your FixLocal story!");
      setTestimonialForm((prev) => ({ ...prev, quote: "" }));
    } catch (error) {
      setTestimonialFormError("Unable to save testimonial. Please try again.");
    } finally {
      setTestimonialSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <section
        className="animate-aurora relative overflow-visible rounded-[1.5rem] bg-gradient-to-r from-[#1d4ed8] via-[#6366f1] to-[#a855f7] px-4 py-12 text-white shadow-2xl shimmer sm:rounded-[2rem] sm:px-6 sm:py-16 lg:py-20"
        style={{ overflow: "visible" }}
      >
        <div className="pointer-events-none absolute -left-10 top-10 h-44 w-44 rounded-full bg-white/20 blur-3xl animate-soft-float" />
        <div className="pointer-events-none absolute -right-8 bottom-8 h-56 w-56 rounded-full bg-cyan-300/30 blur-3xl animate-soft-float-delayed" />

        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
            Book trusted pros for any job
          </h1>
          <p className="mb-8 text-base text-white/90 sm:text-lg">
            Instant bookings, live tracking, secure payments, and in-app chat.
          </p>

          <div className="glass-panel-strong animated-outline relative z-30 mx-auto flex max-w-5xl flex-col gap-3 overflow-visible rounded-2xl p-4 text-left sm:gap-4 sm:p-6 md:flex-row md:items-center">
            <div className="relative z-40 flex-1" ref={cityDropdownRef}>
              <input
                value={city}
                onChange={(e) => handleCityInput(e.target.value)}
                onFocus={() => city && setShowSuggestions(citySuggestions.length > 0)}
                placeholder="Enter city"
                className="w-full rounded-xl border border-white/60 bg-white px-4 py-3 text-gray-900 shadow"
                autoComplete="off"
              />
              {showSuggestions && citySuggestions.length > 0 && (
                <div className="absolute left-0 top-full z-[90] mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white text-left shadow-lg">
                  {citySuggestions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="block w-full px-4 py-2 text-sm text-slate-700 hover:bg-primary/10"
                      onClick={() => selectCity(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="flex-1 rounded-xl border border-white/60 bg-white px-4 py-3 text-gray-900 shadow"
            >
              <option value="">All Services</option>
              {services.map((service) => (
                <option key={service.value} value={service.value}>
                  {service.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleSearch}
              className="btn-glow w-full rounded-xl bg-white px-6 py-3 font-semibold text-blue-700 md:w-auto"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleSearchByCurrentLocation}
              disabled={locationSearching}
              className="w-full rounded-xl border border-white/60 px-5 py-3 font-semibold text-white transition hover:bg-white/15 disabled:opacity-70 md:w-auto"
            >
              {locationSearching ? "Detecting GPS..." : "Search by Current GPS"}
            </button>
          </div>
          {locationError && (
            <p className="mt-3 rounded-lg bg-amber-100/20 px-3 py-2 text-sm text-amber-100">{locationError}</p>
          )}
        </div>
      </section>

      <section className="stagger-children mx-auto grid max-w-6xl gap-4 px-1 py-6 sm:gap-6 sm:px-2 sm:py-8 md:grid-cols-3">
        {trustBadges.map((badge) => (
          <div key={badge.title} className="lift-card hover-tilt gradient-border glass-panel rounded-2xl p-6 shadow-lg">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-2xl">🔒</span>
            <h3 className="text-xl font-semibold mt-3">{badge.title}</h3>
            <p className="text-slate-600 mt-2">{badge.copy}</p>
          </div>
        ))}
      </section>

      <section className="animate-aurora overflow-hidden rounded-[1.5rem] bg-gradient-to-r from-[#0f172a] via-[#1d4ed8] to-[#6d28d9] text-white shadow-2xl sm:rounded-[2rem]">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 py-10 sm:gap-6 sm:px-6 sm:py-14 md:grid-cols-3">
          {highlights.map((item) => (
            <div key={item.label} className="lift-card hover-tilt rounded-2xl border border-white/20 bg-white/10 p-5 text-center backdrop-blur">
              <p className="text-4xl font-bold">{item.value}</p>
              <p className="text-sm uppercase tracking-wide mt-2 text-white/70">{item.label}</p>
              <p className="text-white/80 mt-1">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-1 py-8 sm:px-2 sm:py-10">
        <h2 className="text-gradient mb-8 text-center text-2xl font-bold sm:text-3xl">
          Why homeowners love FixLocal
        </h2>
        {testimonialError && (
          <p className="text-center text-sm text-red-500 mb-4">{testimonialError}</p>
        )}
        <div className="stagger-children grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.id || t.name} className="lift-card hover-tilt gradient-border glass-panel rounded-2xl p-6 shadow-lg">
              <p className="text-slate-700 italic">“{t.quote}”</p>
              <div className="mt-4 text-sm text-slate-500">
                <p className="font-semibold text-slate-900">{t.name}</p>
                <p>{t.city} · {t.role}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10">
          {isAuthenticated ? (
            <form
              onSubmit={handleTestimonialSubmit}
              className="glass-panel-strong animated-outline grid gap-4 rounded-2xl p-4 shadow-lg sm:p-6 md:grid-cols-2"
            >
              <div className="col-span-1">
                <label className="block text-sm font-semibold text-slate-700">Name</label>
                <input
                  type="text"
                  className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2"
                  value={testimonialForm.name}
                  onChange={(e) => handleTestimonialChange("name", e.target.value)}
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-semibold text-slate-700">City</label>
                <input
                  type="text"
                  className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2"
                  value={testimonialForm.city}
                  onChange={(e) => handleTestimonialChange("city", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">I’m a</label>
                <select
                  className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2"
                  value={testimonialForm.role}
                  onChange={(e) => handleTestimonialChange("role", e.target.value)}
                >
                  <option value="Homeowner">Homeowner</option>
                  <option value="Tradesperson">Tradesperson</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700">Share your FixLocal experience</label>
                <textarea
                  className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2"
                  rows={4}
                  value={testimonialForm.quote}
                  onChange={(e) => handleTestimonialChange("quote", e.target.value)}
                  placeholder="What did you book and how did it go?"
                />
              </div>
              {testimonialFormError && (
                <p className="text-sm text-red-500 md:col-span-2">{testimonialFormError}</p>
              )}
              {testimonialSuccess && (
                <p className="text-sm text-emerald-600 md:col-span-2">{testimonialSuccess}</p>
              )}
              <div className="flex md:col-span-2 md:justify-end">
                <button
                  type="submit"
                  className="btn-glow w-full rounded-full bg-gradient-to-r from-primary to-violet-600 px-5 py-2 text-white disabled:opacity-60 md:w-auto"
                  disabled={testimonialSubmitting}
                >
                  {testimonialSubmitting ? "Saving..." : "Submit testimonial"}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-center text-sm text-slate-500">
              Sign in to share your FixLocal experience.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200/70 bg-gradient-to-r from-slate-100 to-white shadow-lg sm:rounded-[2rem]">
        <div className="stagger-children mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:gap-6 sm:px-6 sm:py-16 md:grid-cols-3">
          {howItWorks.map((item) => (
            <div key={item.step} className="lift-card hover-tilt gradient-border rounded-2xl bg-white p-6 shadow-lg">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary animate-pulse-glow">
                {item.step}
              </div>
              <h3 className="text-xl font-semibold mt-4">{item.title}</h3>
              <p className="text-slate-600 mt-2">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-1 py-8 sm:gap-6 sm:px-2 sm:py-12 md:grid-cols-2">
        <div className="lift-card hover-tilt glass-panel-strong gradient-border rounded-2xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-slate-900 sm:text-2xl">Popular categories</h3>
          <p className="text-slate-600 mt-2">
            Trending FixLocal requests across metros — tap to explore specialists instantly.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {services.map((item) => (
              <button
                key={item.value}
                onClick={() =>
                  navigate(`/search?city=${encodeURIComponent(city || "Bengaluru")}&service=${encodeURIComponent(item.value)}`)
                }
                className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-left text-sm transition hover:-translate-y-0.5 hover:bg-primary/10"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="lift-card hover-tilt shimmer animate-aurora relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-indigo-600 to-fuchsia-600 p-6 text-white shadow-2xl">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
          <h3 className="text-xl font-bold sm:text-2xl">FixLocal Assurance</h3>
          <p className="text-white/80 mt-2">
            Every booking includes ₹25,000 workmanship cover plus dispute mediation. Need help choosing a pro? Chat with FixLocal concierge on
            WhatsApp or phone — we’ll shortlist the best matches for you.
          </p>
          <ul className="mt-4 space-y-2 text-white/90">
            <li>• Escrow-backed payments</li>
            <li>• Mandatory background re-check every 6 months</li>
            <li>• Instant rebooking if a pro cancels</li>
          </ul>
          <button
            onClick={() => navigate("/register")}
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-2 font-semibold text-primary transition hover:-translate-y-0.5 hover:bg-slate-100 sm:w-auto"
          >
            Become a verified pro
          </button>
        </div>
      </section>
    </div>
  );
}

export default Home;
