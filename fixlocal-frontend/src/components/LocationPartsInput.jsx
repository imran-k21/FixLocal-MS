import { useEffect, useMemo, useRef, useState } from "react";
import { buildCityStateCountry, splitCityStateCountry } from "../utils/locationFormat";
import { fetchCityOptions, fetchCountryOptions, fetchStateOptions } from "../utils/locationSuggestions";

function LocationPartsInput({
  value = "",
  onChange,
  required = false,
  disabled = false,
  showLabels = true,
  wrapperClassName = "grid gap-2 sm:grid-cols-1 lg:grid-cols-3",
  labelClassName = "mb-1 text-xs font-semibold text-slate-600",
  inputClassName = "w-full min-h-[46px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100",
}) {
  const [parts, setParts] = useState(() => splitCityStateCountry(value));
  const [countryOptions, setCountryOptions] = useState([]);
  const [stateOptions, setStateOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [searchText, setSearchText] = useState({ country: "", state: "", city: "" });
  const [openField, setOpenField] = useState("");
  const [loading, setLoading] = useState({ countries: false, states: false, cities: false });
  const [error, setError] = useState("");

  const containerRef = useRef(null);
  const lastExternalValueRef = useRef(value);

  useEffect(() => {
    const externalValue = String(value || "");
    if (externalValue === lastExternalValueRef.current) return;
    lastExternalValueRef.current = externalValue;
    setParts(splitCityStateCountry(externalValue));
    setSearchText({ country: "", state: "", city: "" });
    setOpenField("");
  }, [value]);

  useEffect(() => {
    if (!openField) return undefined;

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpenField("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openField]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading((prev) => ({ ...prev, countries: true }));
        const countries = await fetchCountryOptions();
        if (!active) return;
        setCountryOptions(countries);
      } catch (loadError) {
        if (!active) return;
        setError(loadError?.message || "Failed to load countries");
      } finally {
        if (active) {
          setLoading((prev) => ({ ...prev, countries: false }));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!parts.country) {
      setStateOptions([]);
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        setLoading((prev) => ({ ...prev, states: true }));
        const states = await fetchStateOptions(parts.country);
        if (!active) return;
        setStateOptions(states);
      } catch (loadError) {
        if (!active) return;
        setError(loadError?.message || "Failed to load states");
      } finally {
        if (active) {
          setLoading((prev) => ({ ...prev, states: false }));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [parts.country]);

  useEffect(() => {
    let active = true;

    if (!parts.country || !parts.state) {
      setCityOptions([]);
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        setLoading((prev) => ({ ...prev, cities: true }));
        const cities = await fetchCityOptions(parts.country, parts.state);
        if (!active) return;
        setCityOptions(cities);
      } catch (loadError) {
        if (!active) return;
        setError(loadError?.message || "Failed to load cities");
      } finally {
        if (active) {
          setLoading((prev) => ({ ...prev, cities: false }));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [parts.country, parts.state]);

  const updateCombinedLocation = (nextParts) => {
    const combined = buildCityStateCountry(nextParts.city, nextParts.state, nextParts.country);
    onChange?.(combined);
  };

  const handleChangePart = (part, selectedValue) => {
    let nextParts = { ...parts, [part]: selectedValue };
    if (part === "country") {
      nextParts = { ...nextParts, state: "", city: "" };
      setSearchText((prev) => ({ ...prev, state: "", city: "" }));
    }
    if (part === "state") {
      nextParts = { ...nextParts, city: "" };
      setSearchText((prev) => ({ ...prev, city: "" }));
    }

    setParts(nextParts);
    updateCombinedLocation(nextParts);
    setOpenField("");
    setError("");
  };

  const countrySelectOptions = useMemo(() => {
    const items = [...countryOptions];
    if (parts.country && !items.includes(parts.country)) {
      items.push(parts.country);
    }
    return items;
  }, [countryOptions, parts.country]);

  const filteredCountryOptions = useMemo(() => {
    const term = searchText.country.trim().toLowerCase();
    if (!term) return countrySelectOptions;
    return countrySelectOptions.filter((item) => item.toLowerCase().includes(term));
  }, [countrySelectOptions, searchText.country]);

  const stateSelectOptions = useMemo(() => {
    const items = [...stateOptions];
    if (parts.state && !items.includes(parts.state)) {
      items.push(parts.state);
    }
    return items;
  }, [stateOptions, parts.state]);

  const filteredStateOptions = useMemo(() => {
    const term = searchText.state.trim().toLowerCase();
    if (!term) return stateSelectOptions;
    return stateSelectOptions.filter((item) => item.toLowerCase().includes(term));
  }, [stateSelectOptions, searchText.state]);

  const citySelectOptions = useMemo(() => {
    const items = [...cityOptions];
    if (parts.city && !items.includes(parts.city)) {
      items.push(parts.city);
    }
    return items;
  }, [cityOptions, parts.city]);

  const filteredCityOptions = useMemo(() => {
    const term = searchText.city.trim().toLowerCase();
    if (!term) return citySelectOptions;
    return citySelectOptions.filter((item) => item.toLowerCase().includes(term));
  }, [citySelectOptions, searchText.city]);

  const dropdownButtonClass = `${inputClassName} flex items-center justify-between text-left`;
  const popupInputClass = "w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

  const renderSearchableDropdown = ({
    field,
    label,
    value,
    options,
    searchPlaceholder,
    emptyLabel,
    loadingLabel,
    disabledField,
  }) => {
    const isOpen = openField === field;

    return (
      <div className="relative min-w-0">
        {showLabels && <p className={labelClassName}>{label}</p>}

        <button
          type="button"
          onClick={() => {
            if (disabledField) return;
            setOpenField((prev) => (prev === field ? "" : field));
          }}
          disabled={disabled || disabledField}
          className={dropdownButtonClass}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className={value ? "text-slate-900" : "text-slate-500"}>{value || emptyLabel}</span>
          <span className="text-slate-500">▾</span>
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full z-40 mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="p-2 border-b border-slate-100">
              <input
                type="text"
                value={searchText[field]}
                onChange={(event) =>
                  setSearchText((prev) => ({ ...prev, [field]: event.target.value }))
                }
                placeholder={searchPlaceholder}
                autoFocus
                className={popupInputClass}
              />
            </div>

            <div className="max-h-56 overflow-y-auto py-1" role="listbox">
              {loadingLabel ? (
                <p className="px-3 py-2 text-xs text-slate-500">{loadingLabel}</p>
              ) : options.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-500">No results found</p>
              ) : (
                options.map((option) => (
                  <button
                    key={`${field}-${option}`}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                    onClick={() => handleChangePart(field, option)}
                  >
                    {option}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={wrapperClassName} ref={containerRef}>
      {renderSearchableDropdown({
        field: "country",
        label: "Country",
        value: parts.country,
        options: filteredCountryOptions,
        searchPlaceholder: "Search country",
        emptyLabel: "Select country",
        loadingLabel: loading.countries ? "Loading countries..." : "",
        disabledField: false,
      })}

      {renderSearchableDropdown({
        field: "state",
        label: "State",
        value: parts.state,
        options: filteredStateOptions,
        searchPlaceholder: "Search state",
        emptyLabel: "Select state",
        loadingLabel: loading.states ? "Loading states..." : "",
        disabledField: !parts.country,
      })}

      {renderSearchableDropdown({
        field: "city",
        label: "City / Village",
        value: parts.city,
        options: filteredCityOptions,
        searchPlaceholder: "Search city / village",
        emptyLabel: "Select city / village",
        loadingLabel: loading.cities ? "Loading cities..." : "",
        disabledField: !parts.country || !parts.state,
      })}

      {required && (
        <input
          type="text"
          value={buildCityStateCountry(parts.city, parts.state, parts.country)}
          readOnly
          required
          tabIndex={-1}
          aria-hidden="true"
          className="absolute h-0 w-0 overflow-hidden border-0 p-0 opacity-0 pointer-events-none"
        />
      )}

      {error && <p className="text-xs text-red-500 md:col-span-3">{error}</p>}
    </div>
  );
}

export default LocationPartsInput;
