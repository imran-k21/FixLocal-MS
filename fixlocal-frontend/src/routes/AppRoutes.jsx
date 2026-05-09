import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";

import Home from "../pages/Home";
import Login from "../pages/Login";
import ForgotPassword from "../pages/ForgotPassword";
import Register from "../pages/Register";
import SearchResults from "../pages/SearchResults";
import WorkerProfile from "../pages/WorkerProfile";
import Terms from "../pages/Terms";
import Privacy from "../pages/Privacy";
import UserDashboard from "../pages/dashboard/UserDashboard";
import CurrentBooking from "../pages/dashboard/CurrentBooking";
import BookingHistory from "../pages/dashboard/BookingHistory";
import TradespersonDashboard from "../pages/dashboard/TradespersonDashboard";
import TradespersonCurrentBooking from "../pages/dashboard/TradespersonCurrentBooking";
import TradespersonHistory from "../pages/dashboard/TradespersonHistory";
import TradespersonRatings from "../pages/dashboard/TradespersonRatings";
import TradespersonDisputes from "../pages/dashboard/TradespersonDisputes";
import AdminDashboard from "../pages/dashboard/AdminDashboard";
import Disputes from "../pages/dashboard/Disputes";
import MyDisputes from "../pages/dashboard/MyDisputes";
import Profile from "../pages/Profile";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import PageLoader from "../components/PageLoader";

function AppRoutesContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    setIsPageLoading(true);
    const timeoutId = setTimeout(() => {
      setIsPageLoading(false);
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [location.pathname, location.search, location.hash]);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  const ProtectedRoute = ({ allowedRoles, element }) => {
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (allowedRoles && !allowedRoles.includes(user?.role)) {
      return <Navigate to="/" replace />;
    }
    return element;
  };

  const Shell = ({ children }) => (
    <div className="app-shell-bg min-h-screen bg-slate-50">
      <Navbar onToggleSidebar={toggleSidebar} />
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="animate-fade-in-up mx-auto w-full max-w-[1600px] px-3 pb-10 pt-4 sm:px-4 sm:pb-12 sm:pt-6 md:px-6 xl:px-8 2xl:px-10">
        {children}
      </div>
      <Footer />
    </div>
  );

  const PublicLayout = () => (
    <Shell>
      <Outlet />
    </Shell>
  );

  return (
    <>
      {isPageLoading && <PageLoader />}
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/register" element={<Register />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/worker/:id" element={<WorkerProfile />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
        </Route>
        <Route
          path="/profile"
          element={
            <Shell>
              <ProtectedRoute element={<Profile />} />
            </Shell>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={["USER"]}
              element={
                <Shell>
                  <UserDashboard />
                </Shell>
              }
            />
          }
        />
        <Route
          path="/dashboard/current"
          element={
            <ProtectedRoute
              allowedRoles={["USER"]}
              element={
                <Shell>
                  <CurrentBooking />
                </Shell>
              }
            />
          }
        />
        <Route
          path="/dashboard/history"
          element={
            <ProtectedRoute
              allowedRoles={["USER"]}
              element={
                <Shell>
                  <BookingHistory />
                </Shell>
              }
            />
          }
        />
        <Route
          path="/dashboard/disputes/mine"
          element={
            <ProtectedRoute
              allowedRoles={["USER"]}
              element={
                <Shell>
                  <MyDisputes />
                </Shell>
              }
            />
          }
        />
        <Route
          path="/dashboard/tradesperson"
          element={
            <ProtectedRoute
              allowedRoles={["TRADESPERSON"]}
              element={
                <Shell>
                  <TradespersonDashboard />
                </Shell>
              }
            />
          }
        />
        <Route
          path="/dashboard/tradesperson/current"
          element={
            <ProtectedRoute
              allowedRoles={["TRADESPERSON"]}
              element={
                <Shell>
                  <TradespersonCurrentBooking />
                </Shell>
              }
            />
          }
        />
        <Route
          path="/dashboard/tradesperson/history"
          element={
            <ProtectedRoute
              allowedRoles={["TRADESPERSON"]}
              element={
                <Shell>
                  <TradespersonHistory />
                </Shell>
              }
            />
          }
        />
        <Route
          path="/dashboard/tradesperson/ratings"
          element={
            <ProtectedRoute
              allowedRoles={["TRADESPERSON"]}
              element={
                <Shell>
                  <TradespersonRatings />
                </Shell>
              }
            />
          }
        />
        <Route
          path="/dashboard/tradesperson/disputes"
          element={
            <ProtectedRoute
              allowedRoles={["TRADESPERSON"]}
              element={
                <Shell>
                  <TradespersonDisputes />
                </Shell>
              }
            />
          }
        />
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute
              allowedRoles={["ADMIN"]}
              element={
                <Shell>
                  <AdminDashboard />
                </Shell>
              }
            />
          }
        />
        <Route
          path="/dashboard/disputes"
          element={
            <ProtectedRoute
              allowedRoles={["ADMIN"]}
              element={
                <Shell>
                  <Disputes />
                </Shell>
              }
            />
          }
        />
        <Route
          path="*"
          element={
            <Shell>
              <Navigate to="/" replace />
            </Shell>
          }
        />
      </Routes>
    </>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <AppRoutesContent />
    </BrowserRouter>
  );
}

export default AppRoutes;
