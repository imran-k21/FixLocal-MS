import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { encryptAuthFields } from "../utils/authEncryption";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { encryptionKeyId, encrypted } = await encryptAuthFields({ password });
      const { data } = await api.post("/auth/login", {
        email,
        encryptedPassword: encrypted.password,
        encryptionKeyId,
      });
      await login({ token: data.token, user: data.user });
      navigate("/");
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in-up flex items-center justify-center px-1 py-8 sm:px-2 sm:py-12 md:py-16">
      <div className="glass-panel-strong animated-outline hover-tilt w-full max-w-md rounded-2xl p-5 shadow-2xl sm:rounded-3xl sm:p-8">
        <h1 className="mb-2 text-center text-3xl font-bold text-gradient-fire">Welcome back</h1>
        <p className="mb-6 text-center text-sm text-slate-600">Login to continue booking trusted local pros.</p>
        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{error}</p>}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white/90 p-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white/90 p-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            required
          />
          <div className="text-right">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-glow shimmer relative overflow-hidden w-full rounded-xl bg-gradient-to-r from-primary via-indigo-600 to-fuchsia-600 py-3 text-white transition hover:from-indigo-600 hover:to-primary"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          New to FixLocal?{" "}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;