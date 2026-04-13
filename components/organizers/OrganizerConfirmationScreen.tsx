"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { useOrganizerOnboardingForm } from "@/hooks/useOrganizerOnboardingForm";

export const OrganizerConfirmationScreen = () => {
  const { resetAll } = useOrganizerOnboardingForm();

  return (
    <section className="mx-auto mt-10 max-w-2xl rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
      <CheckCircle2 className="mx-auto h-16 w-16 text-[#B1C20E]" />
      <h1 className="mt-4 text-3xl font-semibold text-slate-900">
        Solicitud recibida
      </h1>
      <p className="mt-3 text-slate-600">
        Recibimos la ficha de alta del organizador y ya la derivamos para
        revision. Si hace falta documentacion adicional, el equipo de Zoco se
        va a contactar con el email declarado.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          onClick={resetAll}
          className="rounded-full bg-[#B1C20E] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#9EAD0E]"
        >
          Cargar otra ficha
        </button>
        <Link
          href="/"
          className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
        >
          Volver al inicio
        </Link>
      </div>
    </section>
  );
};
