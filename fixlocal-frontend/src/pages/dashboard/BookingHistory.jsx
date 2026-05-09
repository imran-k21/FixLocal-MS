import { useMemo, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import BookingCard from "../../components/BookingCard";
import PaymentSummary from "../../components/PaymentSummary";
import { useBookingsData } from "../../hooks/useBookingsData";
import { downloadBookingReceipt } from "../../utils/bookingReceipt";
import reviewService from "../../api/reviewService";
import disputeService from "../../api/disputeService";
import { bookingService } from "../../api/bookingService";

function BookingHistory() {
  const { bookings, loading, refresh } = useBookingsData();
  const [filter, setFilter] = useState("COMPLETED");
  const [downloadingReceiptId, setDownloadingReceiptId] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [inlineRatingBookingId, setInlineRatingBookingId] = useState(null);
  const [inlineRatingValues, setInlineRatingValues] = useState({});
  const [inlineRatingComments, setInlineRatingComments] = useState({});
  const [inlineRatingErrors, setInlineRatingErrors] = useState({});
  const [inlineRatingSubmitting, setInlineRatingSubmitting] = useState(false);
  const [paymentBusyByBooking, setPaymentBusyByBooking] = useState({});

  const handlePaymentAction = async (booking, action) => {
    if (!booking?.id) return;
    setActionNotice("");
    setPaymentBusyByBooking((prev) => ({ ...prev, [booking.id]: true }));
    try {
      if (action === "capture") {
        await bookingService.payments.capture(booking.id);
      } else if (action === "refund") {
        await bookingService.payments.refund(booking.id);
      } else {
        return;
      }

      setActionNotice("Payment updated successfully.");
      await refresh();
    } catch (err) {
      setActionNotice(err?.response?.data?.message || "Payment action failed. Please retry.");
    } finally {
      setPaymentBusyByBooking((prev) => ({ ...prev, [booking.id]: false }));
    }
  };

  const handleDisputeCreate = async (payload) => {
    await disputeService.create({
      bookingId: payload.bookingId,
      reason: payload.reason,
      desiredOutcome: payload.desiredOutcome,
    });
    setActionNotice("Dispute submitted successfully.");
  };

  const handleDownloadReceipt = async (booking) => {
    if (!booking?.id) return;
    setReceiptError("");
    setDownloadingReceiptId(booking.id);
    try {
      await downloadBookingReceipt(booking);
    } catch (error) {
      setReceiptError("Failed to generate PDF receipt. Please try again.");
    } finally {
      setDownloadingReceiptId("");
    }
  };

  const canRateBooking = (booking) => {
    if (!booking) return false;
    const alreadyRated = booking.reviewSubmitted || typeof booking.userRating === "number";
    return booking.status === "COMPLETED" && !alreadyRated;
  };

  const openInlineRating = (booking) => {
    setActionNotice("");
    setInlineRatingBookingId(booking.id);
    setInlineRatingValues((prev) => ({ ...prev, [booking.id]: prev[booking.id] || 5 }));
    setInlineRatingComments((prev) => ({ ...prev, [booking.id]: prev[booking.id] || "" }));
    setInlineRatingErrors((prev) => ({ ...prev, [booking.id]: "" }));
  };

  const cancelInlineRating = () => {
    setInlineRatingBookingId(null);
    setInlineRatingSubmitting(false);
  };

  const handleInlineRatingChange = (booking, value) => {
    setInlineRatingValues((prev) => ({ ...prev, [booking.id]: value }));
  };

  const handleInlineCommentChange = (booking, value) => {
    setInlineRatingComments((prev) => ({ ...prev, [booking.id]: value }));
  };

  const handleInlineRatingSubmit = async (booking) => {
    if (!booking) return;
    const comment = (inlineRatingComments[booking.id] || "").trim();
    if (!comment) {
      setInlineRatingErrors((prev) => ({ ...prev, [booking.id]: "Please add a short comment." }));
      return;
    }

    setInlineRatingSubmitting(true);
    setInlineRatingErrors((prev) => ({ ...prev, [booking.id]: "" }));
    setActionNotice("");
    try {
      await reviewService.addReview(booking.id, {
        rating: inlineRatingValues[booking.id] || 5,
        comment,
      });
      setActionNotice("Thanks for rating your booking!");
      cancelInlineRating();
      await refresh();
    } catch (err) {
      setInlineRatingErrors((prev) => ({ ...prev, [booking.id]: "Unable to submit review. Please try again." }));
    } finally {
      setInlineRatingSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    return bookings.filter((booking) =>
      filter === "ALL" ? true : booking.status === filter
    );
  }, [bookings, filter]);

  return (
    <DashboardLayout
      title="Booking History"
      subtitle="Review completed, cancelled or rejected jobs"
    >
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-slate-500">
          Showing {filtered.length} of {bookings.length} bookings
        </p>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="ALL">All</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>
      {actionNotice && <p className="text-sm text-blue-600 mb-3">{actionNotice}</p>}
      {receiptError && <p className="text-sm text-red-500 mb-3">{receiptError}</p>}
      {loading ? (
        <p className="text-slate-600">Loading bookings…</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-600">No bookings match this filter.</p>
      ) : (
        <div className="grid gap-4">
          {filtered.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              showCustomerDetails
              onDownloadReceipt={handleDownloadReceipt}
              receiptDownloading={downloadingReceiptId === booking.id}
              onDispute={handleDisputeCreate}
              onRateStart={canRateBooking(booking) ? openInlineRating : undefined}
              canRate={canRateBooking(booking)}
              isRating={inlineRatingBookingId === booking.id}
              ratingValue={inlineRatingValues[booking.id] || 5}
              ratingComment={inlineRatingComments[booking.id] || ""}
              onRatingChange={handleInlineRatingChange}
              onRatingCommentChange={handleInlineCommentChange}
              onRatingSubmit={handleInlineRatingSubmit}
              onRatingCancel={cancelInlineRating}
              ratingSubmitting={inlineRatingSubmitting}
              ratingError={inlineRatingErrors[booking.id]}
              extraContent={booking.status === "COMPLETED" ? (
                <PaymentSummary
                  booking={booking}
                  embedded
                  busy={Boolean(paymentBusyByBooking[booking.id])}
                  onCapture={(item) => handlePaymentAction(item, "capture")}
                  onRefund={(item) => handlePaymentAction(item, "refund")}
                />
              ) : null}
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

export default BookingHistory;