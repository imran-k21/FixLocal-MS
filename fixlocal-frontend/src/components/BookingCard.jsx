import { useState } from 'react';
import DisputeForm from "./DisputeForm";

function BookingCard({
  booking,
  onView,
  onChat,
  onPrimaryAction,
  primaryLabel,
  secondaryLabel,
  onSecondaryAction,
  dangerLabel,
  onDangerAction,
  onRateStart,
  canRate,
  isRating,
  ratingValue,
  ratingComment,
  onRatingChange,
  onRatingCommentChange,
  onRatingSubmit,
  onRatingCancel,
  ratingSubmitting,
  ratingError,
  showCustomerDetails = false,
  canQuotePrice = false,
  quoteValue,
  onQuoteChange,
  onQuoteSubmit,
  quoteSubmitting = false,
  quoteInputLabel = "Set booking price (₹)",
  quoteSubmitLabel = "Set Price",
  quoteSubmittingLabel = "Saving...",
  quotePlaceholder = "Enter amount",
  offerNotice,
  onDispute,
  onDownloadReceipt,
  receiptDownloading = false,
  extraContent,
}) {
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeError, setDisputeError] = useState("");
  const [disputeSuccess, setDisputeSuccess] = useState("");

  const handleDisputeSubmit = async (disputeData) => {
    if (!onDispute) {
      setShowDisputeForm(false);
      return;
    }

    setDisputeLoading(true);
    setDisputeError("");
    setDisputeSuccess("");
    try {
      await onDispute(disputeData);
      setDisputeSuccess("Dispute submitted successfully.");
      setShowDisputeForm(false);
    } catch (err) {
      setDisputeError(
        err?.response?.data?.message || "Failed to submit dispute. Please try again."
      );
    } finally {
      setDisputeLoading(false);
    }
  };

  const price = booking.price ?? booking.initialOfferAmount;
  const contactDetails = [
    booking.userName && `Customer: ${booking.userName}`,
    booking.userPhone && `Phone: ${booking.userPhone}`,
    booking.userCity && `Address: ${booking.userCity}`,
  ].filter(Boolean);
  const timeline = [
    { label: "Accepted", value: booking.acceptedAt },
    { label: "En Route", value: booking.enRouteAt },
    { label: "Arrived", value: booking.arrivedAt },
    { label: "Completed", value: booking.completedAt },
  ];

  const hasRating = typeof booking.userRating === "number";

  return (
    <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase text-slate-500">Service</p>
          <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
            {booking.serviceDescription}
          </h3>
          <p className="mt-1 text-xs text-slate-500">{booking.serviceAddress}</p>
        </div>
        <span className="inline-flex w-fit shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-600">
          {booking.status?.replace("_", " ")}
        </span>
      </div>
      <p className="text-sm text-slate-600">
        {new Date(booking.bookingStartTime).toLocaleString()} →{" "}
        {new Date(booking.bookingEndTime).toLocaleString()}
      </p>
      <p className="text-sm font-semibold text-slate-700">Price: ₹ {price}</p>
      {booking.lastOfferBy === "TRADESPERSON" && (
        <p className="text-xs text-blue-600 font-medium">Quoted by tradesperson</p>
      )}
      {canQuotePrice && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="text-xs text-slate-500 flex flex-col">
            {quoteInputLabel}
            <input
              type="number"
              min="1"
              step="1"
              value={quoteValue ?? ""}
              onChange={(event) => onQuoteChange && onQuoteChange(booking, event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 sm:min-w-[180px]"
              placeholder={quotePlaceholder}
            />
          </label>
          <button
            type="button"
            className="w-full rounded bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-60 sm:w-auto"
            onClick={() => onQuoteSubmit && onQuoteSubmit(booking)}
            disabled={quoteSubmitting}
          >
            {quoteSubmitting ? quoteSubmittingLabel : quoteSubmitLabel}
          </button>
        </div>
      )}
      {offerNotice && (
        <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
          {offerNotice}
        </p>
      )}
      {showCustomerDetails && contactDetails.length > 0 && (
        <div className="text-xs text-slate-500">
          {contactDetails.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
      {(hasRating || canRate || isRating) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {hasRating && (
            <div className="flex items-center gap-2 text-yellow-600">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star}>{star <= booking.userRating ? "★" : "☆"}</span>
                ))}
              </div>
              <span className="font-semibold">{booking.userRating}/5</span>
              {booking.reviewedAt && (
                <span className="text-xs text-slate-500">
                  {new Date(booking.reviewedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
          {!isRating && canRate && (
            <button
              type="button"
              className="text-xs uppercase tracking-wide text-blue-600 font-semibold"
              onClick={() => onRateStart && onRateStart(booking)}
            >
              Rate experience
            </button>
          )}
        </div>
      )}
      {isRating && (
        <div className="border border-amber-100 bg-amber-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex gap-1 text-2xl text-amber-500">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`focus:outline-none ${star <= ratingValue ? "" : "text-slate-300"}`}
                  onClick={() => onRatingChange && onRatingChange(booking, star)}
                  aria-label={`Set rating to ${star}`}
                >
                  {star <= ratingValue ? "★" : "☆"}
                </button>
              ))}
            </div>
            <span className="text-sm font-semibold text-slate-700">{ratingValue}/5</span>
          </div>
          <textarea
            className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
            rows={3}
            placeholder="Tell others about your experience"
            value={ratingComment}
            onChange={(e) => onRatingCommentChange && onRatingCommentChange(booking, e.target.value)}
          />
          {ratingError && <p className="text-sm text-red-600">{ratingError}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <button
              type="button"
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm sm:w-auto"
              onClick={() => onRatingCancel && onRatingCancel(booking)}
              disabled={ratingSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm text-white disabled:opacity-70 sm:w-auto"
              onClick={() => onRatingSubmit && onRatingSubmit(booking)}
              disabled={ratingSubmitting}
            >
              {ratingSubmitting ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </div>
      )}
      <div className="grid gap-3 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
        {timeline.map(
          (entry) =>
            entry.value && (
              <div key={entry.label}>
                <p className="uppercase tracking-wide">{entry.label}</p>
                <p className="text-slate-700 font-medium">
                  {new Date(entry.value).toLocaleString()}
                </p>
              </div>
            )
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {disputeSuccess && (
          <p className="text-xs text-emerald-600">{disputeSuccess}</p>
        )}
        {disputeError && (
          <p className="text-xs text-red-500">{disputeError}</p>
        )}
        {onView && (
          <button className="rounded-md border border-blue-100 px-2.5 py-1.5 text-xs text-blue-600 sm:text-sm" onClick={() => onView(booking)}>
            View Details
          </button>
        )}
        {onChat && (
          <button className="rounded-md border border-blue-100 px-2.5 py-1.5 text-xs text-blue-600 sm:text-sm" onClick={() => onChat(booking)}>
            Chat
          </button>
        )}
        {onDispute && (
          <button
            onClick={() => setShowDisputeForm(true)}
            className="rounded-md border border-red-100 px-2.5 py-1.5 text-xs text-red-600 sm:text-sm"
          >
            Report an Issue
          </button>
        )}
        {onSecondaryAction && secondaryLabel && (
          <button
            className="rounded border border-slate-200 px-3 py-1.5 text-xs sm:text-sm"
            onClick={() => onSecondaryAction(booking)}
          >
            {secondaryLabel}
          </button>
        )}
        {onDangerAction && dangerLabel && (
          <button
            className="rounded border border-red-100 px-3 py-1.5 text-xs text-red-600 sm:text-sm"
            onClick={() => onDangerAction(booking)}
          >
            {dangerLabel}
          </button>
        )}
        {onPrimaryAction && primaryLabel && (
          <button
            className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white sm:text-sm"
            onClick={() => onPrimaryAction(booking)}
          >
            {primaryLabel}
          </button>
        )}
        {!isRating && canRate && (
          <button
            type="button"
            className="rounded bg-amber-500 px-3 py-1.5 text-xs text-white sm:text-sm"
            onClick={() => onRateStart && onRateStart(booking)}
          >
            Rate Now
          </button>
        )}
        {booking.status === "COMPLETED" && onDownloadReceipt && (
          <button
            type="button"
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white disabled:opacity-60 sm:text-sm"
            onClick={() => onDownloadReceipt(booking)}
            disabled={receiptDownloading}
          >
            {receiptDownloading ? "Generating PDF..." : "Download E-Receipt"}
          </button>
        )}
      </div>
      {onDispute && showDisputeForm && (
        <DisputeForm
          bookingId={booking.id}
          submitting={disputeLoading}
          onSubmit={handleDisputeSubmit}
          onCancel={() => setShowDisputeForm(false)}
        />
      )}
      {extraContent}
    </div>
  );
}

export default BookingCard;
