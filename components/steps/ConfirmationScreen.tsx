"use client";

import { CheckCircle2 } from "lucide-react";

import { useOnboardingForm } from "@/hooks/useOnboardingForm";

export const ConfirmationScreen = () => {
  const { resetAll } = useOnboardingForm();

  return (
    <section className="mx-auto mt-10 max-w-2xl rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
      <CheckCircle2 className="mx-auto h-16 w-16 text-[#B1C20E]" />
      <h1 className="mt-4 text-3xl font-semibold text-slate-900">
        ¡Bienvenido aliado Zoco!
      </h1>
      <p className="mt-3 text-slate-600">
        Recibimos tu solicitud de alta y ya estamos trabajando para activar tu cuenta.
        Muy pronto vas a recibir un correo con tu bienvenida oficial y los próximos pasos.
        Zoco crece con vos. ¡Gracias por sumarte!
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
