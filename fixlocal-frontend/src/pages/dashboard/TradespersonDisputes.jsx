import { useState } from "react";

import DashboardLayout from "../../components/DashboardLayout";
import MyDisputesPanel from "../../components/MyDisputesPanel";

const severityTone = {
  HIGH: "bg-rose-100 text-rose-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-emerald-100 text-emerald-700",
};

function TradespersonDisputesPage() {
  const [activeDispute, setActiveDispute] = useState(null);

  return (
    <DashboardLayout
      title="My Raised Disputes"
      subtitle="Review issues you have filed against bookings"
    >
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <MyDisputesPanel
            limit={null}
            onSelect={(dispute) => setActiveDispute(dispute)}
            title="Disputes I've Raised"
          />
        </div>
        <div className="lg:col-span-2">
          {activeDispute ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
              <div className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-slate-500">Booking</p>
                  <p className="text-xl font-semibold text-blue-600">
                    #{activeDispute.bookingId?.slice(-6)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {activeDispute.aiTriage?.severity && (
                    <span
                      className={`px-3 py-1 text-xs rounded-full font-semibold ${
                        severityTone[activeDispute.aiTriage.severity] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {activeDispute.aiTriage.severity}
                    </span>
                  )}
                  <span className="px-3 py-1 text-xs rounded-full bg-primary/10 text-primary font-semibold">
                    {activeDispute.status?.replace("_", " ")}
                  </span>
                </div>
              </div>
              {activeDispute.aiTriage && (
                <div className="p-5 border-b border-slate-100 bg-violet-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase text-violet-700 font-semibold">Priority Triage Assistant</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-white border border-violet-200 text-violet-700">
                      Urgency {activeDispute.aiTriage.urgencyScore ?? "-"}/100
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{activeDispute.aiTriage.summary}</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl border border-violet-100 p-3">
                      <p className="text-[11px] uppercase text-slate-500">Suggested status</p>
                      <p className="text-sm font-semibold text-slate-800">{activeDispute.aiTriage.suggestedStatus || "-"}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-violet-100 p-3">
                      <p className="text-[11px] uppercase text-slate-500">Recommended action</p>
                      <p className="text-sm text-slate-700">{activeDispute.aiTriage.recommendedAction || "-"}</p>
                    </div>
                  </div>
                </div>
              )}
              <dl className="p-5 grid gap-4">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Reason</dt>
                  <dd className="text-sm text-slate-800 whitespace-pre-wrap">
                    {activeDispute.reason}
                  </dd>
                </div>
                {activeDispute.desiredOutcome && (
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Desired outcome</dt>
                    <dd className="text-sm text-slate-800 whitespace-pre-wrap">
                      {activeDispute.desiredOutcome}
                    </dd>
                  </div>
                )}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Reporter</dt>
                    <dd className="text-sm text-slate-800">
                      {activeDispute.reporter?.name || "You"}
                      {activeDispute.reporter?.email && (
                        <span className="block text-xs text-slate-500">
                          {activeDispute.reporter.email}
                        </span>
                      )}
                    </dd>
                  </div>
                  {activeDispute.respondent && (
                    <div>
                      <dt className="text-xs uppercase text-slate-500">Respondent</dt>
                      <dd className="text-sm text-slate-800">
                        {activeDispute.respondent.name}
                        {activeDispute.respondent.email && (
                          <span className="block text-xs text-slate-500">
                            {activeDispute.respondent.email}
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                </div>
              </dl>
              <div className="p-5">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">
                  Message timeline
                </h4>
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {(activeDispute.messages || []).map((msg) => (
                    <div
                      key={`${msg.timestamp}-${msg.message}`}
                      className="bg-slate-50 rounded-2xl p-3 text-sm text-slate-800"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-slate-900">
                          {msg.senderName || "System"}
                          {msg.senderRole && (
                            <span className="text-xs text-slate-500 ml-2">
                              {msg.senderRole}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {msg.timestamp
                            ? new Date(msg.timestamp).toLocaleString()
                            : "Just now"}
                        </p>
                      </div>
                      <p>{msg.message}</p>
                    </div>
                  ))}
                  {(!activeDispute.messages || activeDispute.messages.length === 0) && (
                    <p className="text-sm text-slate-500">No messages yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 text-center p-10 text-slate-500">
              Select a dispute from the list to view full details.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default TradespersonDisputesPage;