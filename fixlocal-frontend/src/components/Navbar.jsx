import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { notificationService } from "../api/notificationService";

function Navbar({ onToggleSidebar }) {
  const notificationHeadings = {
    BOOKING_CREATED: "New booking request",
    BOOKING_ACCEPTED: "Booking accepted",
    BOOKING_REJECTED: "Booking rejected",
    BOOKING_EN_ROUTE: "Tradesperson is on the way",
    BOOKING_ARRIVED: "Tradesperson arrived",
    BOOKING_COMPLETED: "Booking completed",
    BOOKING_CANCELLED: "Booking cancelled",
    OFFER_SUBMITTED: "New counter offer",
    OFFER_ACCEPTED: "Offer accepted",
  };

  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const notificationPanelRef = useRef(null);
  const [isNarrowScreen, setIsNarrowScreen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 600;
  });
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [hiddenNotificationIds, setHiddenNotificationIds] = useState([]);

  useEffect(() => {
    const handleResize = () => setIsNarrowScreen(window.innerWidth < 600);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const loadNotifications = useCallback(
    async ({ silent = false } = {}) => {
      if (!isAuthenticated) return;

      if (!silent) {
        setLoadingNotifications(true);
      }

      try {
        const { data } = await notificationService.list(0, 8);
        const visibleNotifications = (data?.content || []).filter(
          (item) => !hiddenNotificationIds.includes(item.id)
        );
        setNotifications(visibleNotifications);
        if (!silent) {
          setNotificationError("");
        }
      } catch (error) {
        if (!silent) {
          setNotificationError("Failed to load notifications");
        }
      } finally {
        if (!silent) {
          setLoadingNotifications(false);
        }
      }
    },
    [hiddenNotificationIds, isAuthenticated]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setNotificationOpen(false);
      setNotificationError("");
      return;
    }

    loadNotifications();
    const intervalId = window.setInterval(() => {
      loadNotifications({ silent: true });
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, loadNotifications]);

  useEffect(() => {
    if (!notificationOpen) return;

    const handleOutsideClick = (event) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target)) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [notificationOpen]);

  const handleLogout = () => {
    setNotificationOpen(false);
    setNotifications([]);
    logout();
    navigate("/login");
  };

  const handleNotificationToggle = () => {
    const nextOpen = !notificationOpen;
    setNotificationOpen(nextOpen);
    if (nextOpen) {
      loadNotifications();
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                read: true,
              }
            : item
        )
      );
    } catch (error) {
      setNotificationError("Failed to update notification");
    }
  };

  const handleHideNotification = (notificationId) => {
    setHiddenNotificationIds((prev) =>
      prev.includes(notificationId) ? prev : [...prev, notificationId]
    );
    setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
  };

  const handleHideAllNotifications = () => {
    setHiddenNotificationIds((prev) => {
      const idsToHide = notifications.map((item) => item.id);
      return Array.from(new Set([...prev, ...idsToHide]));
    });
    setNotifications([]);
    setNotificationError("");
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (error) {
      setNotificationError("Failed to mark all notifications as read");
    }
  };

  const formatNotificationTime = (timestamp) => {
    if (!timestamp) return "Just now";
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return "Just now";
    return parsed.toLocaleString();
  };

  const getNotificationHeading = (type) => {
    if (!type) return "Notification";
    return (
      notificationHeadings[type] ||
      type
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    );
  };

  const authButtonClass =
    "btn-glow rounded-full bg-gradient-to-r from-primary to-indigo-600 px-4 py-2 text-xs text-white transition hover:from-indigo-600 hover:to-primary sm:px-5 sm:text-sm";

  return (
    <nav className="animate-aurora sticky top-0 z-50 border-b border-white/40 bg-gradient-to-r from-[#1e3a8a]/95 via-[#2a64f5]/95 to-[#7c3aed]/95 shadow-2xl backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3 md:px-6 xl:px-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/40 bg-white/10 p-0 text-xl leading-none text-white transition hover:bg-white/20 sm:h-[42px] sm:w-[42px] sm:text-2xl"
            onClick={onToggleSidebar || (() => {})}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
          <Link to="/" className="shimmer relative flex items-center overflow-hidden rounded-2xl px-0.5 sm:px-1">
            <img src="/logo.png" alt="FixLocal logo" className="navbar-logo" />
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-medium text-gray-100 sm:gap-3 sm:text-sm md:gap-4">
          {isAuthenticated ? (
            <>
              <div className="relative" ref={notificationPanelRef}>
                <button
                  type="button"
                  onClick={handleNotificationToggle}
                  className={`relative rounded-full border border-white/40 px-2.5 py-1.5 text-white transition hover:bg-white/15 sm:px-3 sm:py-2 ${
                    unreadCount > 0 ? "animate-pulse-glow" : ""
                  }`}
                  aria-label="Toggle notifications"
                >
                  🔔
                  {unreadCount > 0 && (
                    <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {notificationOpen && (
                  <div
                    className={`glass-panel-strong animate-pop-in z-50 mt-2 rounded-2xl p-3 text-left shadow-xl ${
                      isNarrowScreen
                        ? "fixed left-3 right-3 top-[72px]"
                        : "absolute right-0 w-80 sm:w-96"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">Notifications</p>
                      {notifications.length > 0 && (
                        <div className="flex items-center gap-3">
                          {unreadCount > 0 && (
                            <button
                              type="button"
                              onClick={handleMarkAllAsRead}
                              className="text-xs font-medium text-blue-600 hover:text-blue-700"
                            >
                              Mark all read
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleHideAllNotifications}
                            className="text-xs font-medium text-slate-600 hover:text-slate-700"
                          >
                            Hide all
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="mb-2 text-[11px] text-slate-500">
                      “Mark read” keeps the notification visible; “Hide” removes it from this list.
                    </p>

                    {loadingNotifications ? (
                      <p className="py-5 text-center text-xs text-slate-500">Loading...</p>
                    ) : notifications.length === 0 ? (
                      <p className="py-5 text-center text-xs text-slate-500">No notifications yet</p>
                    ) : (
                      <ul className="max-h-80 space-y-2 overflow-y-auto">
                        {notifications.map((item) => (
                          <li
                            key={item.id}
                            className={`hover-tilt rounded-xl border p-2 ${
                              item.read
                                ? "border-slate-200 bg-slate-50"
                                : "border-blue-100 bg-blue-50"
                            }`}
                          >
                            <p className="text-xs font-semibold text-slate-700">
                              {getNotificationHeading(item.type)}
                            </p>
                            <p className="mt-1 text-sm text-slate-800">{item.message}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {formatNotificationTime(item.createdAt)}
                            </p>

                            <div className="mt-2 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleHideNotification(item.id)}
                                className="rounded-md bg-slate-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-slate-700"
                              >
                                Hide
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMarkAsRead(item.id)}
                                disabled={item.read}
                                className="rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                              >
                                {item.read ? "Read" : "Mark read"}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    {notificationError && (
                      <p className="mt-2 text-xs text-red-500">{notificationError}</p>
                    )}
                  </div>
                )}
              </div>

              {!isNarrowScreen && (
                <>
                  <span className="hidden text-white/90 md:inline">
                    Signed in as <strong>{user?.name || "User"}</strong>
                  </span>
                  <Link to="/profile" className="transition hover:text-white">
                    My Profile
                  </Link>
                </>
              )}
              <button
                onClick={handleLogout}
                className="btn-glow shimmer relative overflow-hidden rounded-full bg-white/15 px-3 py-1.5 text-xs text-white transition hover:bg-white/25 sm:px-4 sm:py-2 sm:text-sm"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={authButtonClass}>
                Login
              </Link>
              <Link
                to="/register"
                className={authButtonClass}
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
