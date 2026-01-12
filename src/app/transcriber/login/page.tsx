"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setToken } from "@/lib/client";
import { toast } from "sonner";

export default function TranscriberLoginPage() {
  const router = useRouter();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = {
        email: emailOrPhone,
        emailOrPhone,
        password,
        requestedRole: "TRANSCRIBER"
      };
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Login failed: ${res.status}`);
      if (!data.token) throw new Error("No token returned");

      setToken(data.token);
      toast.success("Welcome back!");
      router.replace("/transcriber/v2");
    } catch (e: any) {
      toast.error(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">KACCP</h1>
          <p className="text-blue-200">Voice Data Collection Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Transcriber Login</h2>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email or Phone
              </label>
              <input
                type="text"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="email@example.com or +232..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  aria-label="Toggle password visibility"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <div className="mt-1 text-right">
                <Link href="/speaker/login/forgot" className="text-xs text-blue-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center space-y-4">
            <p className="text-gray-600">
              Don&apos;t have an account?{" "}
              <button
                onClick={() => router.push("/transcriber/v2/register")}
                className="text-blue-600 hover:underline font-medium"
              >
                Register here
              </button>
            </p>

            <div className="pt-2 border-t border-gray-100">
              <Link href="/speaker/login" className="text-sm text-gray-500 hover:text-gray-700">
                Are you a speaker? Login here →
              </Link>
            </div>

            <div className="text-xs text-gray-400 pt-2">
              Built by <Link href="https://geneline-x.net" className="underline" target="_blank">Geneline-X</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
