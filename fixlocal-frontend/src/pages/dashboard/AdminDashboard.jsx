import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import { adminService } from "../../api/adminService";

const DEFAULT_PAGE = { content: [], number: 0, totalPages: 0, totalElements: 0 };
const SEARCH_DEBOUNCE_MS = 300;

function usePaginatedList(fetcher) {
  const [data, setData] = useState(DEFAULT_PAGE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handler);
  }, [search]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetcher(page, debouncedSearch);
      setData(response.data || DEFAULT_PAGE);
    } catch (err) {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, fetcher, debouncedSearch]);

  return {
    data,
    loading,
    error,
    reload: load,
    page,
    setPage,
    search,
    setSearch,
  };
}

const tileConfig = [
  { label: "Total Users", key: "totalUsers" },
  { label: "Total Tradespersons", key: "totalTradespersons" },
  { label: "Bookings", key: "totalBookings" },
  { label: "Completed", key: "completedBookings" },
  { label: "Pending", key: "pendingBookings" },
  { label: "Cancelled", key: "cancelledBookings" },
  { label: "Rejected", key: "rejectedBookings" },
  { label: "Active Conversations", key: "activeConversations" },
  { label: "Pending Verifications", key: "pendingVerifications" },
  { label: "Blocked Accounts", key: "blockedAccounts" },
];

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fetchUsers = useCallback((page, search) => adminService.getUsers(page, search), []);
  const fetchTrades = useCallback((page, search) => adminService.getTradespersons(page, search), []);
  const usersState = usePaginatedList(fetchUsers);
  const tradesState = usePaginatedList(fetchTrades);
  const [actionError, setActionError] = useState("");
  const [selectedProfile, setSelectedProfile] = useState(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/stats");
      setStats(data);
    } catch (err) {
      setError("Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const kpis = useMemo(
    () =>
      tileConfig.map((tile) => ({
        ...tile,
        value: stats?.[tile.key] ?? "-",
      })),
    [stats]
  );

  const handleBlockToggle = async (userId, blocked) => {
    try {
      setActionError("");
      if (blocked) {
        await adminService.unblockUser(userId);
      } else {
        await adminService.blockUser(userId);
      }
      await Promise.all([usersState.reload(), tradesState.reload(), loadStats()]);
    } catch (err) {
      setActionError("Failed to update user status");
    }
  };

  const renderTable = (title, pageData, state) => (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative">
            <input
              type="text"
              value={state.search}
              onChange={(e) => state.setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="border border-slate-200 rounded-full px-4 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {state.search && (
              <button
                onClick={() => state.setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"
              >
                ✕
              </button>
            )}
          </div>
          <div className="text-xs text-slate-500">
            Page {pageData.number + 1} of {Math.max(pageData.totalPages, 1)}
          </div>
        </div>
      </div>
      {state.error && <p className="text-red-500 text-sm mb-2">{state.error}</p>}
      {state.loading ? (
        <p className="text-slate-500 text-sm">Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 uppercase text-xs">
                <th className="py-2">Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageData.content.map((user) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="py-3">
                    <button
                      className="text-left"
                      onClick={() => setSelectedProfile(user)}
                    >
                      <div className="font-semibold text-slate-800 underline">
                        {user.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {user.occupation || "-"}
                      </div>
                    </button>
                  </td>
                  <td>
                    <button
                      className="text-left text-slate-600 underline"
                      onClick={() => setSelectedProfile(user)}
                    >
                      {user.email}
                    </button>
                  </td>
                  <td className="text-slate-600">{user.role}</td>
                  <td>
                    {user.blocked ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-600">
                        Blocked
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-600">
                        Active
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className="text-xs font-semibold text-blue-600"
                      onClick={() => handleBlockToggle(user.id, user.blocked)}
                    >
                      {user.blocked ? "Unblock" : "Block"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs">
        <button
          className="px-3 py-1 rounded border"
          disabled={state.page === 0}
          onClick={() => state.setPage((p) => Math.max(p - 1, 0))}
        >
          Previous
        </button>
        <button
          className="px-3 py-1 rounded border"
          disabled={pageData.number + 1 >= pageData.totalPages}
          onClick={() => state.setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <DashboardLayout title="Platform Insights" subtitle="Live health metrics">
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {actionError && <p className="text-red-500 mb-4">{actionError}</p>}
      {loading ? (
        <p className="text-slate-600">Loading metrics...</p>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {kpis.map((tile) => (
              <div key={tile.key} className="bg-white p-4 rounded-2xl shadow border border-slate-100">
                <p className="text-xs uppercase tracking-wide text-slate-500">{tile.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{tile.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl shadow border border-slate-100 p-6">
            <h3 className="text-lg font-semibold mb-4">Operational Notes</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>• Pending verifications help prioritize KYC queue.</li>
              <li>• Active conversations indicates current load on support.</li>
              <li>• Blocked accounts highlight compliance actions.</li>
            </ul>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {renderTable("Users", usersState.data, usersState)}
            {renderTable("Tradespersons", tradesState.data, tradesState)}
          </div>
        </>
      )}
      {selectedProfile && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-3" onClick={() => setSelectedProfile(null)}>
          <div
            className="relative w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
              onClick={() => setSelectedProfile(null)}
            >
              ✕
            </button>
            <div className="flex items-center gap-4 mb-4">
              <div>
                <p className="text-xs uppercase text-slate-500">Name</p>
                <h2 className="text-2xl font-semibold text-slate-900">{selectedProfile.name}</h2>
                <p className="text-sm text-slate-500">{selectedProfile.email}</p>
              </div>
              <div className="ml-auto flex flex-col items-end gap-2">
                <span
                  className={`px-3 py-1 text-xs rounded-full ${selectedProfile.blocked ? "bg-red-100 text-red-600" : "bg-emerald-50 text-emerald-700"}`}
                >
                  {selectedProfile.blocked ? "Blocked" : "Active"}
                </span>
                <button
                  className={`text-xs font-semibold ${selectedProfile.blocked ? "text-emerald-600" : "text-red-600"}`}
                  onClick={() => {
                    handleBlockToggle(selectedProfile.id, selectedProfile.blocked);
                    setSelectedProfile((prev) =>
                      prev ? { ...prev, blocked: !prev.blocked } : prev
                    );
                  }}
                >
                  {selectedProfile.blocked ? "Unblock user" : "Block user"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-slate-500">Role</p>
                <p className="font-semibold text-slate-800">{selectedProfile.role}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Status</p>
                <p className="font-semibold text-slate-800">
                  {selectedProfile.blocked ? "Blocked" : "Active"}
                </p>
              </div>
              {selectedProfile.occupation && (
                <div>
                  <p className="text-xs uppercase text-slate-500">Occupation</p>
                  <p className="font-semibold text-slate-800">{selectedProfile.occupation}</p>
                </div>
              )}
              {selectedProfile.workingCity && (
                <div>
                  <p className="text-xs uppercase text-slate-500">City</p>
                  <p className="font-semibold text-slate-800">{selectedProfile.workingCity}</p>
                </div>
              )}
              {selectedProfile.phone && (
                <div>
                  <p className="text-xs uppercase text-slate-500">Phone</p>
                  <p className="font-semibold text-slate-800">{selectedProfile.phone}</p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase text-slate-500">Verified</p>
                <p className="font-semibold text-slate-800">
                  {selectedProfile.verified ? "Yes" : "No"}
                </p>
              </div>
              {selectedProfile.role === "TRADESPERSON" && (
                <>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Experience</p>
                    <p className="font-semibold text-slate-800">
                      {selectedProfile.experience ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Completed Jobs</p>
                    <p className="font-semibold text-slate-800">
                      {selectedProfile.completedJobs ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Average Rating</p>
                    <p className="font-semibold text-slate-800">
                      {(selectedProfile.averageRating ?? 0).toFixed(1)} ★
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Total Reviews</p>
                    <p className="font-semibold text-slate-800">
                      {selectedProfile.totalReviews ?? 0}
                    </p>
                  </div>
                </>
              )}
            </div>
            {selectedProfile.skillTags?.length ? (
              <div className="mt-4">
                <p className="text-xs uppercase text-slate-500">Skills</p>
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  {selectedProfile.skillTags.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 rounded-full bg-slate-100 text-slate-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default AdminDashboard;