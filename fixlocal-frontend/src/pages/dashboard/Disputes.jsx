
import { useEffect, useMemo, useState } from "react";
import { adminService } from "../../api/adminService";
import DashboardLayout from "../../components/DashboardLayout";

const statusOptions = [
  { value: "OPEN", label: "Open", tone: "bg-blue-100 text-blue-700" },
  { value: "UNDER_REVIEW", label: "Under Review", tone: "bg-amber-100 text-amber-700" },
  { value: "RESOLVED", label: "Resolved", tone: "bg-emerald-100 text-emerald-700" },
  { value: "CLOSED", label: "Closed", tone: "bg-slate-200 text-slate-800" },
];

const severityTone = {
  HIGH: "bg-rose-100 text-rose-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-emerald-100 text-emerald-700",
};

function StatusBadge({ value }) {
  const option = statusOptions.find((opt) => opt.value === value);
  if (!option) return null;
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${option.tone}`}>
      {option.label}
    </span>
  );
}

function SeverityBadge({ value }) {
  if (!value) return null;
  const tone = severityTone[value] || "bg-slate-100 text-slate-700";
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${tone}`}>
      {value}
    </span>
  );
}

function DisputeDetailDrawer({
  dispute,
  onClose,
  onStatusChange,
  onAddNote,
  onBlockRespondent,
  blocking,
  saving,
}) {
  const [note, setNote] = useState("");
  useEffect(() => {
    setNote("");
  }, [dispute?.id]);

  if (!dispute) return null;
  const disabled = saving;

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) return;
    onAddNote(trimmed).then(() => setNote(""));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex justify-end z-40">
      <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-start">
          <div>
            <p className="text-xs uppercase text-slate-500">Dispute</p>
            <h2 className="text-2xl font-semibold">Booking #{dispute.bookingId}</h2>
            <p className="text-sm text-slate-500 mt-1">Opened {new Date(dispute.createdAt).toLocaleString()}</p>
          </div>
          <button className="text-slate-500 hover:text-slate-800" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="p-6 space-y-6">
          {dispute.aiTriage && (
            <section className="border border-violet-100 bg-violet-50/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-violet-800">Priority Triage Assistant</h3>
                <div className="flex items-center gap-2">
                  <SeverityBadge value={dispute.aiTriage?.severity} />
                  <span className="px-2 py-1 text-xs rounded-full bg-white text-violet-700 border border-violet-200">
                    Urgency {dispute.aiTriage?.urgencyScore ?? "-"}/100
                  </span>
                </div>
              </div>
              {dispute.aiTriage?.summary && (
                <p className="text-sm text-slate-700">{dispute.aiTriage.summary}</p>
              )}
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div className="bg-white rounded-xl p-3 border border-violet-100">
                  <p className="text-xs uppercase text-slate-500">Suggested status</p>
                  <p className="font-semibold text-slate-800">{dispute.aiTriage?.suggestedStatus || "-"}</p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-violet-100">
                  <p className="text-xs uppercase text-slate-500">Recommended action</p>
                  <p className="text-slate-700">{dispute.aiTriage?.recommendedAction || "-"}</p>
                </div>
              </div>
              {(dispute.aiTriage?.signals || []).length > 0 && (
                <div>
                  <p className="text-xs uppercase text-slate-500 mb-2">Detected signals</p>
                  <div className="flex flex-wrap gap-2">
                    {dispute.aiTriage.signals.map((signal, idx) => (
                      <span
                        key={`${signal}-${idx}`}
                        className="px-2 py-1 text-xs rounded-full bg-white border border-violet-100 text-slate-700"
                      >
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Status</h3>
              <div className="flex items-center gap-3">
                <StatusBadge value={dispute.status} />
                <select
                  className="border border-slate-200 rounded-lg px-3 py-1 text-sm"
                  value={dispute.status}
                  onChange={(e) => onStatusChange(e.target.value)}
                  disabled={saving}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-xs text-slate-500 uppercase">Reason</p>
              <p className="text-slate-800 text-sm mt-1 whitespace-pre-wrap">{dispute.reason}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-xs text-slate-500 uppercase">Desired outcome</p>
              <p className="text-slate-800 text-sm mt-1 whitespace-pre-wrap">{dispute.desiredOutcome}</p>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-100 rounded-2xl p-4">
              <p className="text-xs text-slate-500 uppercase">Reporter</p>
              <h4 className="text-lg font-semibold text-slate-900">{dispute.reporter?.name || "Unknown"}</h4>
              <p className="text-sm text-slate-600">{dispute.reporter?.email}</p>
              {dispute.reporter?.phone && (
                <p className="text-sm text-slate-600 mt-1">{dispute.reporter.phone}</p>
              )}
              <span className="inline-flex mt-3 px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700">
                {dispute.reporter?.role}
              </span>
            </div>
            <div className="border border-slate-100 rounded-2xl p-4">
              <p className="text-xs text-slate-500 uppercase">Respondent</p>
              <h4 className="text-lg font-semibold text-slate-900">{dispute.respondent?.name || "Unknown"}</h4>
              <p className="text-sm text-slate-600">{dispute.respondent?.email}</p>
              {dispute.respondent?.phone && (
                <p className="text-sm text-slate-600 mt-1">{dispute.respondent.phone}</p>
              )}
              <span className="inline-flex mt-3 px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700">
                {dispute.respondent?.role}
              </span>
              {!!dispute.respondent?.id && (
                <button
                  type="button"
                  className="mt-4 text-sm font-semibold text-red-600 disabled:opacity-50"
                  onClick={() =>
                    onBlockRespondent({
                      userId: dispute.respondent?.id,
                      userName: dispute.respondent?.name,
                    })
                  }
                  disabled={blocking || dispute.respondent?.blocked}
                >
                  {dispute.respondent?.blocked
                    ? "Respondent blocked"
                    : blocking
                    ? "Blocking..."
                    : "Block respondent"}
                </button>
              )}
            </div>
          </section>

          <section className="border border-slate-100 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Booking summary</p>
                <h4 className="text-lg font-semibold text-slate-900">{dispute.booking?.serviceDescription || "Service details"}</h4>
              </div>
              {dispute.booking?.price && (
                <p className="text-sm font-semibold text-slate-800">₹ {dispute.booking.price}</p>
              )}
            </div>
            <p className="text-sm text-slate-600">{dispute.booking?.serviceAddress}</p>
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-500">
              <div>
                <p className="text-xs uppercase">Customer</p>
                <p className="text-slate-800">{dispute.booking?.userName || "-"}</p>
                <p>{dispute.booking?.userPhone || ""}</p>
              </div>
              <div>
                <p className="text-xs uppercase">Tradesperson</p>
                <p className="text-slate-800">{dispute.booking?.tradespersonName || "-"}</p>
                <p>{dispute.booking?.tradespersonPhone || ""}</p>
              </div>
            </div>
          </section>

          <section className="border border-slate-100 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Message history</h3>
              {dispute.messages.length > 0 && (
                <p className="text-xs text-slate-500">{dispute.messages.length} entries</p>
              )}
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {dispute.messages.length === 0 && (
                <p className="text-xs text-slate-500">No notes yet.</p>
              )}
              {dispute.messages.map((message, index) => (
                <div key={`${message.senderId}-${index}`} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-sm text-slate-900">{message.message}</p>
                  <div className="mt-2 text-[11px] uppercase text-slate-500 flex justify-between">
                    <span>{message.senderName || message.senderRole || "Collaborator"}</span>
                    <span>{new Date(message.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
            <form className="mt-4 space-y-2" onSubmit={handleSubmit}>
              <textarea
                className="w-full border border-slate-200 rounded-lg p-3 text-sm"
                placeholder="Add admin note"
                rows={3}
                value={note}
                disabled={disabled}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm disabled:opacity-50"
                disabled={disabled || !note.trim()}
              >
                {saving ? "Saving..." : "Add note"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

function Disputes() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const selectedDispute = useMemo(() => disputes.find((d) => d.id === selectedId) || null, [disputes, selectedId]);

  const loadDisputes = () => {
    setLoading(true);
    setError("");
    adminService
      .getDisputes()
      .then((res) => setDisputes(res.data || []))
      .catch(() => setError("Failed to load disputes"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDisputes();
  }, []);

  const refreshDispute = (id) => {
    adminService
      .getDisputeById(id)
      .then(({ data }) => {
        setDisputes((prev) => prev.map((d) => (d.id === id ? data : d)));
      })
      .catch(() => {});
  };

  const handleUpdateStatus = (id, status) => {
    setSaving(true);
    adminService
      .updateDispute(id, { status })
      .then(() => {
        refreshDispute(id);
      })
      .catch(() => setError("Failed to update dispute"))
      .finally(() => setSaving(false));
  };

  const handleAddNote = (id, message) => {
    setSaving(true);
    return adminService
      .addDisputeNote(id, { message })
      .then(() => {
        refreshDispute(id);
      })
      .catch(() => setError("Failed to add note"))
      .finally(() => setSaving(false));
  };

  const handleBlockRespondent = ({ userId, userName }) => {
    if (!userId) return;
    if (
      !window.confirm(
        `Block ${userName || "this user"}? They will be prevented from logging in until manually unblocked.`
      )
    ) {
      return;
    }
    setBlocking(true);
    adminService
      .blockUser(userId)
      .then(() => {
        if (selectedId) {
          refreshDispute(selectedId);
        }
      })
      .catch(() => setError("Failed to block respondent"))
      .finally(() => setBlocking(false));
  };

  return (
    <DashboardLayout title="Disputes" subtitle="Manage platform conflicts">
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {loading ? (
        <p className="text-slate-600">Loading disputes...</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl shadow border border-slate-100">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Booking ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Reporter
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {disputes.map((dispute) => (
                <tr key={dispute.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <button className="text-left text-blue-600" onClick={() => setSelectedId(dispute.id)}>
                      {dispute.bookingId}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{dispute.reporter?.name || "-"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-md truncate">
                    {dispute.reason}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge value={dispute.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <SeverityBadge value={dispute.aiTriage?.severity} />
                      {typeof dispute.aiTriage?.urgencyScore === "number" && (
                        <span className="text-xs text-slate-500">{dispute.aiTriage.urgencyScore}/100</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <select
                      value={dispute.status}
                      onChange={(e) => handleUpdateStatus(dispute.id, e.target.value)}
                      className="py-2 px-3 border border-slate-200 rounded-md text-sm"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {disputes.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-slate-500 text-sm">
                    No disputes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <DisputeDetailDrawer
        dispute={selectedDispute}
        saving={saving}
        blocking={blocking}
        onClose={() => setSelectedId(null)}
        onStatusChange={(status) => selectedDispute && handleUpdateStatus(selectedDispute.id, status)}
        onAddNote={(message) => selectedDispute && handleAddNote(selectedDispute.id, message)}
        onBlockRespondent={(payload) => handleBlockRespondent(payload)}
      />
    </DashboardLayout>
  );
}

export default Disputes;