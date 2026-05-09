import { useState } from "react";

function ConversationPanel({ conversations = [], onSelect, activeConversationId }) {
  const [filter, setFilter] = useState("");
  const filtered = conversations.filter((c) =>
    c.tradespersonName?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-3 shadow sm:p-4">
      <div>
        <h3 className="text-lg font-semibold">Conversations</h3>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search"
          className="mt-2 w-full border rounded-lg p-2 text-sm"
        />
      </div>
      <div className="max-h-64 overflow-y-auto space-y-2">
        {filtered.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelect?.(conversation)}
            className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${
              activeConversationId === conversation.id
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200"
            }`}
          >
            <p className="font-semibold">{conversation.tradespersonName}</p>
            <p className="text-xs text-slate-500">{conversation.lastMessage}</p>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-slate-500 text-sm">No conversations yet.</p>
        )}
      </div>
    </div>
  );
}

export default ConversationPanel;