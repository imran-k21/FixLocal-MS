import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import BookingCard from "../../components/BookingCard";
import ConversationPanel from "../../components/ConversationPanel";
import ChatThread from "../../components/ChatThread";
import { bookingService } from "../../api/bookingService";
import chatService from "../../api/chatService";
import { dashboardService } from "../../api/dashboardService";
import disputeService from "../../api/disputeService";
import MyDisputesPanel from "../../components/MyDisputesPanel";

const USER_CANCELABLE_STATUSES = new Set(["PENDING", "ACCEPTED", "EN_ROUTE", "ARRIVED"]);

const ACTION_CONFIG = {
  PENDING: {
    primaryAction: "ACCEPT",
    primaryLabel: "Accept",
    secondaryAction: "REJECT",
    secondaryLabel: "Reject",
  },
  ACCEPTED: {
    primaryAction: "START",
    primaryLabel: "Start Trip",
  },
  EN_ROUTE: {
    primaryAction: "ARRIVED",
    primaryLabel: "Mark Arrived",
  },
  ARRIVED: {
    primaryAction: "COMPLETE",
    primaryLabel: "Complete",
  },
};

function TradespersonDashboard() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [filter, setFilter] = useState("PENDING");
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [chatVisible, setChatVisible] = useState(false);
  const [quoteValues, setQuoteValues] = useState({});
  const [quoteSubmittingByBooking, setQuoteSubmittingByBooking] = useState({});
  const [quoteAcceptingByBooking, setQuoteAcceptingByBooking] = useState({});

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await bookingService.listForTradesperson(
        filter !== "ALL" ? filter : undefined
      );
      setBookings(data?.content || data || []);
    } catch (err) {
      setError("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    let active = true;
    setSummaryLoading(true);
    setSummaryError("");
    dashboardService
      .getTradespersonDashboard()
      .then(({ data }) => {
        if (active) setSummary(data);
      })
      .catch(() => {
        if (active) setSummaryError("Failed to load performance summary");
      })
      .finally(() => {
        if (active) setSummaryLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleAction = useCallback(
    async (booking, action) => {
      if (!booking) return;
      try {
        if (action === "ACCEPT") await bookingService.acceptBooking(booking.id);
        if (action === "REJECT") await bookingService.rejectBooking(booking.id);
        if (action === "START") await bookingService.startTrip(booking.id);
        if (action === "ARRIVED") await bookingService.markArrived(booking.id);
        if (action === "COMPLETE") await bookingService.complete(booking.id);

        if (action === "ACCEPT") {
          setActionNotice("Booking accepted. Showing accepted bookings.");
          setFilter("ACCEPTED");
        } else if (action === "START") {
          setActionNotice("Trip started. Showing en-route bookings.");
          setFilter("EN_ROUTE");
        } else if (action === "ARRIVED") {
          setActionNotice("Marked as arrived. Showing arrived bookings.");
          setFilter("ARRIVED");
        } else if (action === "COMPLETE") {
          setActionNotice("Booking completed. Showing completed bookings.");
          setFilter("COMPLETED");
        } else {
          setActionNotice("Booking updated.");
          fetchBookings();
        }
      } catch (err) {
        setActionNotice("Action failed. Please retry.");
      }
    },
    [fetchBookings]
  );

  const handleQuoteChange = useCallback((booking, value) => {
    if (!booking) return;
    setQuoteValues((prev) => ({ ...prev, [booking.id]: value }));
  }, []);

  const handleQuoteSubmit = useCallback(
    async (booking) => {
      if (!booking) return;

      const rawValue = quoteValues[booking.id];
      const amount = Number(rawValue);

      if (!Number.isFinite(amount) || amount <= 0) {
        setActionNotice("Please enter a valid booking price.");
        return;
      }

      setQuoteSubmittingByBooking((prev) => ({ ...prev, [booking.id]: true }));
      try {
        await bookingService.submitOffer(booking.id, {
          amount,
          message: "Price quoted by tradesperson",
        });
        setActionNotice(`Price updated to ₹${amount}. User can now see this quoted price.`);
        fetchBookings();
      } catch (err) {
        setActionNotice(err?.response?.data?.message || "Failed to set booking price.");
      } finally {
        setQuoteSubmittingByBooking((prev) => ({ ...prev, [booking.id]: false }));
      }
    },
    [quoteValues, fetchBookings]
  );

  const getLatestOpenOffer = useCallback((booking) => {
    const offers = (booking?.offerHistory || []).slice().reverse();
    return offers.find((offer) => !offer?.accepted) || null;
  }, []);

  const canTradespersonAcceptOffer = useCallback(
    (booking) => {
      if (!booking || booking.status !== "PENDING") return false;
      if (booking.awaitingResponseFrom !== "TRADESPERSON") return false;
      const latest = getLatestOpenOffer(booking);
      return Boolean(latest?.id && latest?.offeredBy === "USER");
    },
    [getLatestOpenOffer]
  );

  const handleAcceptUserOffer = useCallback(
    async (booking) => {
      if (!booking) return;
      if (quoteAcceptingByBooking[booking.id]) return;

      const latest = getLatestOpenOffer(booking);
      if (!latest?.id) return;

      setQuoteAcceptingByBooking((prev) => ({ ...prev, [booking.id]: true }));
      try {
        await bookingService.acceptOffer(booking.id, latest.id);
        setActionNotice(`User offer accepted at ₹${latest.amount}.`);
        fetchBookings();
      } catch (err) {
        setActionNotice(err?.response?.data?.message || "Failed to accept offered amount.");
      } finally {
        setQuoteAcceptingByBooking((prev) => ({ ...prev, [booking.id]: false }));
      }
    },
    [fetchBookings, getLatestOpenOffer, quoteAcceptingByBooking]
  );

  const handleCancelBooking = useCallback(
    async (booking) => {
      if (!booking) return;
      const confirmation = window.confirm(
        "Cancel this booking? The user will be notified and can rebook another professional."
      );
      if (!confirmation) return;
      const reason =
        window.prompt("Reason for cancellation?", "Tradesperson cancelled from console") ||
        "Tradesperson cancelled from console";
      try {
        await bookingService.cancel(booking.id, reason);
        setActionNotice("Booking cancelled.");
        fetchBookings();
      } catch (err) {
        setActionNotice("Failed to cancel booking. Please retry.");
      }
    },
    [fetchBookings]
  );

  const conversations = useMemo(
    () =>
      bookings.map((booking) => ({
        id: booking.id,
        bookingId: booking.id,
        tradespersonName: booking.userName || "Customer",
        lastMessage: booking.lastMessage?.content || booking.serviceDescription,
        lastMessageAt: booking.lastMessage?.createdAt,
        participantId: booking.userId,
      })),
    [bookings]
  );

  const fetchConversation = useCallback(async (bookingId, seed) => {
    setChatLoading(true);
    setChatError("");
    try {
      const { data: conversation } = await chatService.getConversation(bookingId);
      setActiveConversation({
        ...(seed || {}),
        id: conversation.id,
        bookingId,
        tradespersonName: seed?.tradespersonName || conversation.userName || "Customer",
      });
      const { data } = await chatService.getMessages(conversation.id);
      const items = data?.content || [];
      setMessages(
        items
          .slice()
          .reverse()
          .map((msg) => ({
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt,
            mine: msg.senderRole === "TRADESPERSON",
            attachment: msg.attachment,
          }))
      );
    } catch (err) {
      setChatError("Failed to load chat");
    } finally {
      setChatLoading(false);
    }
  }, []);

  const handleConversationSelect = useCallback(
    (conversation, { toggleOnly } = {}) => {
      if (!conversation) {
        setActiveConversation(null);
        setMessages([]);
        setChatVisible(false);
        return;
      }

      const isSameConversation = activeConversation?.bookingId === conversation.bookingId;

      if (toggleOnly && isSameConversation) {
        setChatVisible((prev) => !prev);
        return;
      }

      setActiveConversation(conversation);
      setChatVisible(true);
      fetchConversation(conversation.bookingId, conversation);
    },
    [activeConversation?.bookingId, fetchConversation]
  );

  const handleSendMessage = useCallback(
    async (content, attachment) => {
      if (!activeConversation) return;
      try {
        await chatService.sendMessage(activeConversation.bookingId, { content, attachment });
        fetchConversation(activeConversation.bookingId, activeConversation);
      } catch (err) {
        setChatError("Failed to send message");
      }
    },
    [activeConversation, fetchConversation]
  );

  const filteredBookings = bookings;

  const getActionConfig = (status) => ACTION_CONFIG[status] || {};

  return (
    <DashboardLayout
      title="Tradesperson Console"
      subtitle="Manage requests, trips, and chats"
      actions={
        <div className="flex gap-3">
          <select
            className="border rounded-lg px-3 py-1 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="ALL">All</option>
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="EN_ROUTE">En Route</option>
            <option value="ARRIVED">Arrived</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <Link
            to="/dashboard/tradesperson/ratings"
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            View Ratings
          </Link>
        </div>
      }
    >
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {summaryError && <p className="text-red-500 text-sm mb-4">{summaryError}</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {(summaryLoading ? [1, 2, 3, 4] : summary ? [
          { label: "Pending", value: summary.pendingRequests },
          { label: "Active", value: summary.activeBookings },
          { label: "Completed", value: summary.completedBookings },
          { label: "Total", value: summary.totalBookings },
          { label: "Avg Rating", value: `${(summary.averageRating ?? 0).toFixed(1)} ★` },
          { label: "Reviews", value: summary.totalReviews },
        ] : []).map((tile, idx) => (
          <div
            key={tile?.label ?? idx}
            className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"
          >
            <p className="text-xs uppercase text-slate-500">
              {tile?.label || "Loading"}
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{tile?.value ?? "…"}</p>
          </div>
        ))}
      </div>
      {actionNotice && <p className="text-blue-600 text-sm mb-4">{actionNotice}</p>}
      {loading ? (
        <p className="text-slate-600">Loading requests...</p>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid gap-4">
            {filteredBookings.map((booking) => {
              const actionConfig = getActionConfig(booking.status);
              const canCancel = USER_CANCELABLE_STATUSES.has(booking.status);
              const latestOpenOffer = getLatestOpenOffer(booking);
              const canAcceptUserOffer = canTradespersonAcceptOffer(booking);
              return (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onChat={() =>
                    handleConversationSelect({
                      bookingId: booking.id,
                      id: booking.id,
                      tradespersonName: booking.userName || "Customer",
                    }, { toggleOnly: true })
                  }
                  onPrimaryAction={
                    actionConfig.primaryAction
                      ? () => handleAction(booking, actionConfig.primaryAction)
                      : undefined
                  }
                  primaryLabel={actionConfig.primaryLabel}
                  onSecondaryAction={
                    actionConfig.secondaryAction
                      ? () => handleAction(booking, actionConfig.secondaryAction)
                      : undefined
                  }
                  secondaryLabel={actionConfig.secondaryLabel}
                  onDangerAction={canCancel ? handleCancelBooking : undefined}
                  dangerLabel={canCancel ? "Cancel Booking" : undefined}
                  canQuotePrice={booking.status === "PENDING"}
                  quoteValue={
                    quoteValues[booking.id] ??
                    booking.price ??
                    booking.initialOfferAmount ??
                    ""
                  }
                  onQuoteChange={handleQuoteChange}
                  onQuoteSubmit={handleQuoteSubmit}
                  quoteSubmitting={Boolean(quoteSubmittingByBooking[booking.id])}
                  onQuoteAccept={canAcceptUserOffer ? handleAcceptUserOffer : undefined}
                  quoteAcceptLabel={
                    canAcceptUserOffer
                      ? quoteAcceptingByBooking[booking.id]
                        ? "Accepting..."
                        : `Accept ₹${latestOpenOffer?.amount ?? ""}`
                      : undefined
                  }
                  quoteAccepting={Boolean(quoteAcceptingByBooking[booking.id])}
                  showCustomerDetails
                  onDispute={async (payload) =>
                    disputeService.create({
                      bookingId: payload.bookingId,
                      reason: payload.reason,
                      desiredOutcome: payload.desiredOutcome,
                    })
                  }
                />
              );
            })}
            {filteredBookings.length === 0 && (
              <p className="text-slate-600">No bookings in this state.</p>
            )}
          </div>
          <div className="space-y-4">
            <div className="bg-white border border-slate-100 rounded-2xl p-4">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Need quick access?</h3>
              <p className="text-sm text-slate-600 mb-4">
                Jump to the dedicated current job tracker or browse your past bookings.
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  to="/dashboard/tradesperson/current"
                  className="rounded-lg bg-blue-600 text-white text-center px-4 py-2 text-sm font-semibold"
                >
                  View current booking
                </Link>
                <Link
                  to="/dashboard/tradesperson/history"
                  className="rounded-lg border border-slate-200 text-center px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Browse history
                </Link>
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase text-slate-500">My disputes</p>
                  <p className="text-lg font-semibold text-slate-900">Track status</p>
                </div>
                <Link
                  to="/dashboard/tradesperson/disputes"
                  className="text-sm text-primary font-semibold"
                >
                  View all
                </Link>
              </div>
              <MyDisputesPanel title="My Disputes" limit={2} />
            </div>
            {chatVisible && (
              <>
                <ConversationPanel
                  conversations={conversations}
                  activeConversationId={activeConversation?.id}
                  onSelect={(conversation) => handleConversationSelect(conversation)}
                />
                <ChatThread
                  conversation={activeConversation}
                  messages={messages}
                  onSend={handleSendMessage}
                  loading={chatLoading}
                  error={chatError}
                />
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default TradespersonDashboard;