"use client";

import { CheckCircle2 } from "lucide-react";

import { useOnboardingForm } from "@/hooks/useOnboardingForm";

export const ConfirmationScreen = () => {
  const { resetAll } = useOnboardingForm();

  return (
    <section className="mx-auto mt-10 max-w-2xl rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
      <CheckCircle2 className="mx-auto h-16 w-16 text-[#B1C20E]" />
      <h1 className="mt-4 text-3xl font-semibold text-slate-900">
        ¡Recibimos tu solicitud de alta!
      </h1>
      <p className="mt-3 text-slate-600">
        El equipo de Zoco va a revisar tus datos y documentación. Te vamos a
        avisar por email cuando tu cuenta esté lista para empezar a cobrar.
      </p>
      <button
        onClick={resetAll}
        className="mt-8 rounded-full bg-[#B1C20E] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#9EAD0E]"
      >
        Volver al inicio
      </button>
    </section>
  );
};
