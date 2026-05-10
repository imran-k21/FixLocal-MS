import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import "react-phone-input-2/lib/style.css";
import PhoneInput from "react-phone-input-2";
import { services } from "./Home";
import LocationPartsInput from "../components/LocationPartsInput";
import { encryptAuthFields } from "../utils/authEncryption";
import { isValidCityStateCountry, normalizeCityStateCountry } from "../utils/locationFormat";
const roles = [
  { value: "USER", label: "Customer" },
  { value: "TRADESPERSON", label: "Tradesperson" },
  { value: "ADMIN", label: "Admin" },
];

function Register() {
  const PhoneInputComponent = PhoneInput.default || PhoneInput;
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "USER",
    occupation: "",
    workingCity: "",
    experience: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const occupationOptions = useMemo(() => (services || []).map((item) => ({
    value: item.value,
    label: item.label,
  })), []);
  const isTradesperson = form.role === "TRADESPERSON";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        ...form,
        phone: form.phone,
        workingCity: normalizeCityStateCountry(form.workingCity),
        experience: form.experience ? Number(form.experience) : undefined,
      };

      if (isTradesperson && !isValidCityStateCountry(payload.workingCity)) {
        setError("Working location must be in format: City, State, Country");
        setLoading(false);
        return;
      }

      if (!isTradesperson) {
        delete payload.workingCity;
        delete payload.occupation;
        delete payload.experience;
      }

      const { encryptionKeyId, encrypted } = await encryptAuthFields({
        password: payload.password,
      });
      payload.encryptedPassword = encrypted.password;
      payload.encryptionKeyId = encryptionKeyId;
      delete payload.password;

      await api.post("/auth/register", payload);
      navigate("/login");
    } catch (err) {
      setError(err?.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in-up flex items-center justify-center px-1 py-6 sm:px-2 sm:py-10 md:py-12">
      <div className="glass-panel-strong animated-outline hover-tilt w-full max-w-2xl rounded-2xl p-4 shadow-2xl sm:rounded-3xl sm:p-8">
        <h1 className="mb-2 text-center text-3xl font-bold text-gradient-fire">Create your account</h1>
        <p className="mb-6 text-center text-sm text-slate-600">Join FixLocal to book or offer trusted local services.</p>
        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{error}</p>}
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Full Name"
            className="w-full rounded-xl border border-slate-200 bg-white/90 p-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            required
          />
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Email"
            className="w-full rounded-xl border border-slate-200 bg-white/90 p-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            required
          />
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Password"
            className="w-full rounded-xl border border-slate-200 bg-white/90 p-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            required
          />
          <div className="md:col-span-2">
            <label className="flex flex-col text-sm">
              <span className="text-text-secondary mb-1">Phone number</span>
              <PhoneInputComponent
                country={form.phone?.startsWith("+") ? undefined : "in"}
                value={form.phone}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, phone: value.startsWith("+") ? value : `+${value}` }))
                }
                inputProps={{ required: true, name: "phone" }}
                countryCodeEditable={false}
                enableSearch
                inputClass="!w-full !h-12 !text-base !border-slate-200 !rounded-xl !bg-white/90 focus:!border-primary focus:!outline-none focus:!ring-2 focus:!ring-primary/25"
                buttonClass="!h-12 !border-slate-200 !rounded-xl"
                dropdownClass="!text-sm"
              />
            </label>
          </div>
          <label className="flex flex-col text-sm">
            <span className="text-text-secondary mb-1">Account type</span>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 bg-white/90 p-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          {isTradesperson && (
            <>
              <div className="flex flex-col text-sm md:col-span-2">
                <span className="text-text-secondary mb-1">City</span>
                <LocationPartsInput
                  value={form.workingCity}
                  onChange={(combinedLocation) =>
                    setForm((prev) => ({ ...prev, workingCity: combinedLocation }))
                  }
                  showLabels={false}
                  wrapperClassName="grid gap-2 sm:grid-cols-1 lg:grid-cols-3"
                  inputClassName="w-full rounded-xl border border-slate-200 bg-white/90 p-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  required
                />
              </div>
              <label className="flex flex-col text-sm">
                <span className="text-text-secondary mb-1">Primary service</span>
                <select
                  name="occupation"
                  value={form.occupation}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 bg-white/90 p-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  required
                >
                  <option value="" disabled>
                    Select service category
                  </option>
                  {occupationOptions.map((option) => (
                    <option key={option.value} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-sm">
                <span className="text-text-secondary mb-1">Experience (years)</span>
                <input
                  type="number"
                  name="experience"
                  value={form.experience}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  max="60"
                  className="w-full rounded-xl border border-slate-200 bg-white/90 p-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  required
                />
              </label>
            </>
          )}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-glow shimmer relative overflow-hidden w-full rounded-xl bg-gradient-to-r from-primary via-indigo-600 to-fuchsia-600 py-3 text-white transition hover:from-indigo-600 hover:to-primary"
            >
              {loading ? "Creating account..." : "Register"}
            </button>
          </div>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;