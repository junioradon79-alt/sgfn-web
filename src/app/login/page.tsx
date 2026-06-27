"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/services/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const { error } = await signIn(email, password);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-center">
          Connexion
        </h1>

        <p className="mt-2 text-center text-slate-600">
          Système de Gestion du Foncier Numérique
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">

          <div>
            <label className="block mb-2">
              Adresse e-mail
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border p-3"
            />
          </div>

          <div>
            <label className="block mb-2">
              Mot de passe
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border p-3"
            />
          </div>

          {message && (
            <p className="text-red-600 text-sm">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-700 py-3 text-white font-semibold"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>

        </form>
      </div>
    </main>
  );
}