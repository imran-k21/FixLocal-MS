import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Sidebar({ open, onClose }) {
  const { isAuthenticated, user, logout } = useAuth();

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/search", label: "Find Pros" },
    ...(isAuthenticated
      ? [
          user?.role === "USER" && { to: "/dashboard", label: "Overview" },
          user?.role === "USER" && { to: "/dashboard/current", label: "Current Booking" },
          user?.role === "USER" && { to: "/dashboard/history", label: "History" },
          user?.role === "TRADESPERSON" && {
            to: "/dashboard/tradesperson",
            label: "Tradesperson Console",
          },
          user?.role === "TRADESPERSON" && {
            to: "/dashboard/tradesperson/current",
            label: "Current Booking",
          },
          user?.role === "TRADESPERSON" && {
            to: "/dashboard/tradesperson/history",
            label: "History",
          },
          user?.role === "TRADESPERSON" && {
            to: "/dashboard/tradesperson/ratings",
            label: "My Ratings",
          },
          user?.role === "TRADESPERSON" && {
            to: "/dashboard/tradesperson/disputes",
            label: "My Disputes",
          },
          user?.role === "USER" && {
            to: "/dashboard/disputes/mine",
            label: "My Disputes",
          },
          user?.role === "ADMIN" && { to: "/dashboard/admin", label: "Admin" },
          user?.role === "ADMIN" && { to: "/dashboard/disputes", label: "Disputes" },
          { to: "/profile", label: "Profile" },
        ]
      : [
          { to: "/login", label: "Login" },
          { to: "/register", label: "Register" },
        ]
    ).filter(Boolean),
  ];

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-gradient-to-br from-slate-900/55 via-indigo-950/45 to-cyan-950/35 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        className={`glass-panel-strong animate-aurora fixed inset-y-0 left-0 z-50 w-[86vw] max-w-72 border-r border-white/70 shadow-2xl transition-transform duration-300 ease-out sm:w-72 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-4">
          <span className="text-lg font-semibold text-slate-800">Menu</span>
          <button
            type="button"
            className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-slate-200 bg-white/60 p-0 text-slate-500 transition hover:bg-slate-100"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>
        <nav className="stagger-children space-y-2 px-4 py-6 text-slate-700">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="hover-tilt gradient-border flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition hover:text-blue-700"
              onClick={onClose}
            >
              <span>{link.label}</span>
              <span className="h-2 w-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 opacity-70" />
            </Link>
          ))}
          {isAuthenticated && (
            <button
              type="button"
              className="mt-4 w-full rounded-xl border border-red-100 bg-white/80 px-3 py-2 text-sm font-semibold text-red-600 transition hover:-translate-y-0.5 hover:bg-red-50 hover:shadow"
              onClick={() => {
                logout();
                onClose();
              }}
            >
              Logout
            </button>
          )}
        </nav>
      </div>
    </>
  );
}

export default Sidebar;
