import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import LocationPartsInput from "../components/LocationPartsInput";
import { useAuth } from "../context/AuthContext";
import { dashboardService } from "../api/dashboardService";
import reviewService from "../api/reviewService";
import userService from "../api/userService";
import { isValidCityStateCountry, normalizeCityStateCountry } from "../utils/locationFormat";

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-slate-800 font-semibold">{value || "—"}</span>
    </div>
  );
}

function Profile() {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth() || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userStats, setUserStats] = useState(null);
  const [tradespersonStats, setTradespersonStats] = useState(null);
  const [tradespersonReviews, setTradespersonReviews] = useState([]);
  const [form, setForm] = useState({
    name: "",
    workingCity: "",
    phone: "",
    bio: "",
    skillTags: [],
  });
  const [skillInput, setSkillInput] = useState("");
  const [skillError, setSkillError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadStats() {
      if (!user) return;
      setError("");
      setLoading(true);
      try {
        if (user.role === "USER") {
          const { data } = await dashboardService.getUserDashboard();
          if (active) setUserStats(data);
        } else if (user.role === "TRADESPERSON") {
          const { data } = await dashboardService.getTradespersonDashboard();
          if (active) setTradespersonStats(data);
          const reviewsRes = await reviewService.getTradespersonReviews(data?.profile?.id || user.id);
          if (active) setTradespersonReviews(reviewsRes.data || []);
        }
      } catch (err) {
        if (active) setError("Failed to load profile insights");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadStats();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || "",
      workingCity: user.workingCity || "",
      phone: user.phone || "",
      bio: user.bio || "",
      skillTags: user.skillTags || [],
    });
    setSkillInput("");
    setSkillError("");
    setSaveSuccess("");
    setSaveError("");
    setDeleteAccountError("");
  }, [user]);

  const isTradesperson = user?.role === "TRADESPERSON";

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddSkill = () => {
    const value = skillInput.trim();
    if (!value) {
      return;
    }

    if (form.skillTags.includes(value)) {
      setSkillError("Skill already added");
      return;
    }

    if (form.skillTags.length >= 15) {
      setSkillError("You can add up to 15 skill tags");
      return;
    }

    const normalized = value.length > 50 ? value.slice(0, 50) : value;
    setForm((prev) => ({ ...prev, skillTags: [...prev.skillTags, normalized] }));
    setSkillInput("");
    setSkillError("");
  };

  const handleSkillKeyDown = (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      handleAddSkill();
    }
  };

  const handleRemoveSkill = (tag) => {
    setForm((prev) => ({
      ...prev,
      skillTags: prev.skillTags.filter((item) => item !== tag),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;
    setSaveError("");
    setSaveSuccess("");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        workingCity: normalizeCityStateCountry(form.workingCity),
        bio: form.bio?.trim() || "",
        phone: form.phone?.trim() || "",
      };

      if (!isValidCityStateCountry(payload.workingCity)) {
        setSaveError("Working location must be in format: City, State, Country");
        setSaving(false);
        return;
      }

      if (isTradesperson) {
        payload.skillTags = form.skillTags;
      }

      await userService.updateProfile(payload);
      await (refreshUser ? refreshUser() : Promise.resolve());
      setSaveSuccess("Profile updated successfully");
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to update profile";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    const confirmed = window.confirm(
      "Are you sure you want to permanently delete your account? This action cannot be undone."
    );

    if (!confirmed) return;

    setDeleteAccountError("");
    setSaveSuccess("");
    setDeletingAccount(true);

    try {
      await userService.deleteMyAccount();
      if (logout) logout();
      navigate("/login");
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to delete account";
      setDeleteAccountError(message);
    } finally {
      setDeletingAccount(false);
    }
  };

  const isSaveDisabled = saving || !form.name.trim() || !form.workingCity.trim();

  const metrics = useMemo(() => {
    if (user?.role === "USER" && userStats) {
      return [
        { label: "Upcoming Bookings", value: userStats.upcomingBookings },
        { label: "Active Bookings", value: userStats.activeBookings },
        { label: "Completed Bookings", value: userStats.completedBookings },
        { label: "Total Bookings", value: userStats.totalBookings },
      ];
    }
    if (user?.role === "TRADESPERSON" && tradespersonStats) {
      return [
        { label: "Pending Requests", value: tradespersonStats.pendingRequests },
        { label: "Active Jobs", value: tradespersonStats.activeBookings },
        { label: "Completed Jobs", value: tradespersonStats.completedBookings },
        { label: "Total Jobs", value: tradespersonStats.totalBookings },
        {
          label: "Average Rating",
          value: tradespersonStats.averageRating?.toFixed(1) ?? "0.0",
        },
        { label: "Total Reviews", value: tradespersonStats.totalReviews },
      ];
    }
    return [];
  }, [user?.role, userStats, tradespersonStats]);

  if (!user) {
    return (
      <DashboardLayout title="My Profile">
        <p className="text-slate-600">Loading profile...</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Profile" subtitle="Manage your account details">
      <div className="bg-white rounded-2xl shadow border border-slate-100 p-6 space-y-6">
        <div className="flex flex-wrap gap-6 items-center">
          <div>
            <p className="text-xs uppercase text-slate-500">Name</p>
            <h2 className="text-2xl font-bold text-slate-900">{user.name}</h2>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-semibold">
            {user.role}
          </span>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {loading ? (
          <p className="text-slate-500 text-sm">Loading insights...</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoRow label="Occupation" value={user.occupation} />
            <InfoRow label="City" value={user.workingCity} />
            <InfoRow label="Mobile" value={user.phone} />
            <InfoRow label="Experience" value={user.experience ? `${user.experience} yrs` : "—"} />
            <InfoRow label="Status" value={user.status} />
            <InfoRow label="Verified" value={user.verified ? "Yes" : "No"} />
            <InfoRow label="Blocked" value={user.blocked ? "Yes" : "No"} />
            {metrics.map((metric) => (
              <InfoRow key={metric.label} label={metric.label} value={metric.value} />
            ))}
          </div>
        )}

        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">Edit Details</h3>
          <p className="text-sm text-slate-500">Update how clients see you on FixLocal.</p>
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="flex flex-col text-sm text-slate-600">
                Full Name
                <input
                  name="name"
                  type="text"
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={form.name}
                  onChange={handleInputChange}
                  required
                />
              </label>
              <label className="flex flex-col text-sm text-slate-600">
                Working Location
                <div className="mt-1">
                  <LocationPartsInput
                  value={form.workingCity}
                  onChange={(combinedLocation) =>
                    setForm((prev) => ({ ...prev, workingCity: combinedLocation }))
                  }
                  showLabels={false}
                  wrapperClassName="grid gap-2 sm:grid-cols-1 lg:grid-cols-3"
                  inputClassName="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                  />
                </div>
              </label>
              <label className="flex flex-col text-sm text-slate-600">
                Mobile Number
                <input
                  name="phone"
                  type="tel"
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={form.phone}
                  onChange={handleInputChange}
                  placeholder="Optional"
                />
              </label>
              <label className="flex flex-col text-sm text-slate-600 md:col-span-2">
                Bio
                <textarea
                  name="bio"
                  rows={3}
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={form.bio}
                  onChange={handleInputChange}
                  placeholder="Tell customers about your expertise"
                />
              </label>
            </div>

            {isTradesperson && (
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Skill tags</p>
                  <p className="text-xs text-slate-500">{form.skillTags.length}/15</p>
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={handleSkillKeyDown}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Add skill tag"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
                    disabled={!skillInput.trim()}
                  >
                    Add
                  </button>
                </div>
                {skillError && <p className="text-xs text-red-500 mt-1">{skillError}</p>}
                <div className="flex flex-wrap gap-2 mt-3">
                  {form.skillTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs inline-flex items-center gap-2"
                    >
                      {tag}
                      <button
                        type="button"
                        className="text-blue-500 hover:text-blue-700"
                        onClick={() => handleRemoveSkill(tag)}
                        aria-label={`Remove ${tag}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {saveError && <p className="text-sm text-red-500">{saveError}</p>}
            {saveSuccess && <p className="text-sm text-green-600">{saveSuccess}</p>}

            {deleteAccountError && <p className="text-sm text-red-500">{deleteAccountError}</p>}

            <div className="flex flex-wrap justify-between gap-3">
              <button
                type="button"
                className="px-5 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-semibold disabled:opacity-50"
                onClick={handleDeleteAccount}
                disabled={deletingAccount || saving}
              >
                {deletingAccount ? "Deleting..." : "Delete account"}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
                disabled={isSaveDisabled || deletingAccount}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>

        {isTradesperson && tradespersonReviews.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs uppercase text-slate-500">Recent Feedback</p>
            <div className="mt-3 space-y-3">
              {tradespersonReviews.slice(0, 3).map((review) => (
                <div key={review.id} className="border border-slate-100 rounded-lg p-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-slate-800">{review.userName || "Client"}</span>
                    <span className="text-amber-500 font-semibold">{review.rating.toFixed(1)} ★</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{review.comment}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default Profile;
