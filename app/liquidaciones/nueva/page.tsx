"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const cardOptions = ["visa", "mastercard", "amex", "otros"];

export default function NuevaLiquidacionPage() {
  const router = useRouter();
  const [cardBrand, setCardBrand] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [createdBy, setCreatedBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!cardBrand || !pdfFile || !csvFile) {
      setMessage("Completa tarjeta y ambos archivos.");
      return;
    }

    setLoading(true);
    setMessage(null);
    setDuplicateId(null);

    try {
      const formData = new FormData();
      formData.append("cardBrand", cardBrand);
      formData.append("pdfFile", pdfFile);
      formData.append("csvFile", csvFile);
      if (createdBy) formData.append("createdBy", createdBy);

      const response = await fetch("/api/settlements", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!payload.success) {
        setMessage(payload.error || "No pudimos procesar la liquidación");
      } else if (payload.duplicate) {
        setMessage(
          payload.message ||
            "Esa liquidación ya existe. Podés abrirla desde el historial.",
        );
        setDuplicateId(payload.settlementId ?? null);
      } else {
        router.push(`/liquidaciones/${payload.settlementId}`);
      }
    } catch (error) {
      console.error(error);
      setMessage("No pudimos procesar la liquidación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
        <header className="space-y-2">
          <Link href="/liquidaciones" className="text-sm text-slate-500">
            Volver al historial
          </Link>
          <h1 className="text-3xl font-semibold text-slate-900">Nueva liquidación</h1>
          <p className="text-sm text-slate-600">
            Cargá los archivos del día y elegí la tarjeta correspondiente.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="grid gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Tarjeta
              </label>
              <select
                value={cardBrand}
                onChange={(event) => setCardBrand(event.target.value)}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Seleccioná tarjeta</option>
                {cardOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Operador
              </label>
              <input
                type="text"
                value={createdBy}
                onChange={(event) => setCreatedBy(event.target.value)}
                placeholder="Nombre o email"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  PDF Liquidación diaria
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  CSV Transacciones procesadas
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
            {message ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {message}
                {duplicateId ? (
                  <Link
                    href={`/liquidaciones/${duplicateId}`}
                    className="ml-2 font-semibold text-slate-900"
                  >
                    Abrir detalle
                  </Link>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className={`rounded-full px-6 py-3 text-sm font-semibold transition ${
                loading
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : "bg-[#B1C20E] text-black hover:bg-[#c7da1a]"
              }`}
            >
              {loading ? "Procesando..." : "Procesar y conciliar"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
