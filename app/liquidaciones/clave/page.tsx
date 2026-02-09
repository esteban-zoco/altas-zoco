"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LiquidacionesClavePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/liquidaciones";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) {
      setError("Ingresá la clave.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/liquidaciones/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.success) {
        setError(payload.error || "Clave incorrecta.");
        return;
      }
      router.replace(nextPath);
    } catch (err) {
      console.error(err);
      setError("No pudimos validar la clave.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Acceso restringido</h1>
          <p className="mt-2 text-sm text-slate-600">
            Ingresá la clave para ver liquidaciones y pagos.
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Clave de acceso
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="********"
          />
          {error ? (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className={`mt-4 w-full rounded-full px-6 py-3 text-sm font-semibold ${
              submitting ? "cursor-not-allowed bg-slate-200 text-slate-500" : "bg-[#B1C20E]"
            }`}
          >
            {submitting ? "Validando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
