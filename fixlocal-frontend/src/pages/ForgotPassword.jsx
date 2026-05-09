import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { encryptAuthFields } from "../utils/authEncryption";

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password must match");
      return;
    }

    setLoading(true);
    try {
      const { encryptionKeyId, encrypted } = await encryptAuthFields({
        newPassword,
        confirmPassword,
      });

      await api.post("/auth/forgot-password", {
        email,
        encryptedNewPassword: encrypted.newPassword,
        encryptedConfirmPassword: encrypted.confirmPassword,
        encryptionKeyId,
      });
      setSuccess("Password changed successfully. Redirecting to login...");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center px-1 py-8 sm:px-2 sm:py-12 md:py-16">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg sm:p-8">
        <h1 className="text-2xl font-bold mb-2 text-center text-text-primary">Forgot Password</h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          Enter your email and set a new password.
        </p>

        {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}
        {success && <p className="text-green-600 mb-4 text-sm">{success}</p>}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg p-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />

          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border rounded-lg p-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
            minLength={6}
          />

          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border rounded-lg p-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
            minLength={6}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg transition hover:bg-accent disabled:opacity-60"
          >
            {loading ? "Updating..." : "Change password"}
          </button>
        </form>

        <p className="text-sm text-slate-600 mt-4 text-center">
          Remembered your password?{" "}
          <Link to="/login" className="text-primary hover:underline font-semibold">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;
