import { useEffect, useState } from "react";
import disputeService from "../api/disputeService";

const statusTone = {
  OPEN: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-200 text-slate-800",
};

const severityTone = {
  HIGH: "bg-rose-100 text-rose-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-emerald-100 text-emerald-700",
};

function StatusPill({ status }) {
  const tone = statusTone[status] || "bg-slate-200 text-slate-700";
  return (
    <span className={`px-2 py-1 text-[11px] font-semibold rounded-full ${tone}`}>
      {status?.replace("_", " ")}
    </span>
  );
}

function SeverityPill({ severity }) {
  if (!severity) return null;
  const tone = severityTone[severity] || "bg-slate-100 text-slate-700";
  return (
    <span className={`px-2 py-1 text-[11px] font-semibold rounded-full ${tone}`}>
      {severity}
    </span>
  );
}

function DisputeCard({ dispute, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(dispute)}
      className="w-full text-left border border-slate-100 rounded-2xl p-4 bg-white shadow-sm space-y-3 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase">Booking</p>
          <p className="text-sm font-semibold text-blue-600">#{dispute.bookingId?.slice(-6)}</p>
        </div>
        <div className="flex items-center gap-2">
          <SeverityPill severity={dispute.aiTriage?.severity} />
          <StatusPill status={dispute.status} />
        </div>
      </div>
      <div>
        <p className="text-xs uppercase text-slate-500">Reason</p>
        <p className="text-sm text-slate-800 whitespace-pre-wrap">{dispute.reason}</p>
      </div>
      <div className="text-xs text-slate-500">
        Opened {new Date(dispute.createdAt).toLocaleString()}
      </div>
      {dispute.aiTriage && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 space-y-1">
          <p className="text-[11px] uppercase text-violet-700 font-semibold">Priority Triage</p>
          <p className="text-xs text-slate-700 line-clamp-3">{dispute.aiTriage.summary}</p>
          <div className="text-[11px] text-slate-600">
            Urgency: <span className="font-semibold">{dispute.aiTriage.urgencyScore ?? "-"}/100</span>
          </div>
        </div>
      )}
      {dispute.messages?.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
          <p className="text-xs text-slate-500 uppercase">Latest update</p>
          <p className="text-sm text-slate-800">{dispute.messages[dispute.messages.length - 1].message}</p>
          <p className="text-[11px] text-slate-500">
            {new Date(dispute.messages[dispute.messages.length - 1].timestamp).toLocaleString()}
          </p>
        </div>
      )}
    </button>
  );
}

function MyDisputesPanel({ title = "My Disputes", limit = 3, onSelect }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    disputeService
      .listMine()
      .then(({ data }) => {
        if (active) setItems(data || []);
      })
      .catch(() => {
        if (active) setError("Failed to load disputes");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        {loading && <span className="text-xs text-slate-500">Refreshing…</span>}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!error && !loading && items.length === 0 && (
        <p className="text-sm text-slate-500">No disputes yet.</p>
      )}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {items.slice(0, limit ?? items.length).map((dispute) => (
          <DisputeCard key={dispute.id} dispute={dispute} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

export default MyDisputesPanel;