import { useNavigate } from "react-router-dom";
import { formatPhoneForDisplay } from "../utils/phone";
import { formatPersonName } from "../utils/nameFormat";

function WorkerCard({ worker }) {

  const navigate = useNavigate();
  const workerPhone =
    worker?.phone || worker?.mobile || worker?.mobileNumber || worker?.contactNumber;
  const dialPhone = workerPhone ? String(workerPhone).replace(/[^\d+]/g, "") : "";
  const formattedPhone = workerPhone ? formatPhoneForDisplay(workerPhone) : "";
  const roundedRating = Number.isFinite(Number(worker.averageRating))
    ? Number(worker.averageRating).toFixed(1)
    : "0.0";
  const aiMatchScore = Number.isFinite(Number(worker?.aiMatchScore))
    ? Number(worker.aiMatchScore).toFixed(1)
    : null;
  const aiSuggestedOffer = Number.isFinite(Number(worker?.aiSuggestedOffer))
    ? Number(worker.aiSuggestedOffer)
    : null;
  const matchReason = worker?.aiMatchReason
    ? worker.aiMatchReason.replace(/^AI match based on\s*/i, "Strong fit based on ")
    : "";
  const displayName = formatPersonName(worker?.name) || worker?.name || "Tradesperson";

  const handleDial = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!dialPhone) return;

    const isMobileDevice = /Android|iPhone|iPad|iPod|Windows Phone|Opera Mini|IEMobile/i.test(
      navigator.userAgent
    );

    if (isMobileDevice) {
      window.location.href = `tel:${dialPhone}`;
      return;
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(dialPhone).catch(() => {});
    }

    window.alert(`Dial this number: ${formattedPhone || dialPhone}`);
  };

  return (
    <div className="lift-card hover-tilt gradient-border group relative overflow-hidden rounded-2xl bg-white/90 p-4 shadow-lg backdrop-blur sm:p-5">

      <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-blue-100/70 blur-2xl transition group-hover:bg-fuchsia-100" />
      <div className="pointer-events-none absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-cyan-200/50 blur-2xl" />

      <img
        src="/tradesperson.png"
        alt="Tradesperson badge"
        className="animate-soft-float-delayed absolute right-1 top-1 object-contain opacity-95"
        style={{ height: "110px", width: "110px" }}
      />

      <h2 className="pr-20 text-lg font-bold text-text-primary sm:pr-24 sm:text-xl">
        {displayName}
      </h2>

      <p className="text-sm font-semibold text-gradient">{worker.occupation}</p>

      <p className="mt-2 text-text-secondary">📍 {worker.workingCity}</p>

      <p className="text-text-secondary">⭐ {roundedRating}</p>

      <p className="text-text-secondary">🧰 {worker.experience || 0} yrs exp</p>

      {aiMatchScore && (
        <p className="mt-1 text-xs font-semibold text-indigo-700">
          Match confidence: {aiMatchScore}/100
        </p>
      )}

      {matchReason && (
        <p className="mt-1 text-xs text-slate-500 line-clamp-2">{matchReason}</p>
      )}

      {aiSuggestedOffer && (
        <p className="mt-1 text-xs text-emerald-700">
          Suggested budget range: ₹{Math.round(worker.aiSuggestedOfferMin || aiSuggestedOffer)} - ₹{Math.round(worker.aiSuggestedOfferMax || aiSuggestedOffer)}
        </p>
      )}

      <p className="text-text-secondary">📞 {formattedPhone || "Not provided"}</p>

      {dialPhone && (
        <button
          type="button"
          onClick={handleDial}
          className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          Call Now
        </button>
      )}

      {/* ✅ Status Badge */}
      <span
        className={`inline-block mt-2 px-3 py-1 text-sm rounded-full ${
          worker.status === "AVAILABLE"
            ? "bg-green-200 text-green-800"
            : "bg-red-200 text-red-800"
        }`}
      >
        {worker.status}
      </span>

      {/* ✅ Verified */}
      {worker.verified && (
        <p className="text-blue-500 text-sm mt-1">✔ Verified</p>
      )}

      <button
        onClick={() => navigate(`/worker/${worker.id}`)}
        className="btn-glow shimmer relative mt-4 w-full overflow-hidden rounded-xl bg-gradient-to-r from-primary via-indigo-600 to-fuchsia-600 px-4 py-2 text-white transition hover:from-indigo-600 hover:to-primary"
      >
        View Profile
      </button>

    </div>
  );
}

export default WorkerCard;