"use client";

import { useOnboardingForm } from "@/hooks/useOnboardingForm";

export const ResumeDraftDialog = () => {
  const { showResumePrompt, resumeDraft, discardDraft } = useOnboardingForm();

  if (!showResumePrompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#B1C20E]">
          Retomar solicitud
        </p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-900">
          Encontramos una solicitud de alta sin terminar
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          ¿Querés continuar donde la dejaste? Vas a poder revisar los datos antes
          de enviarlos.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={resumeDraft}
            className="flex-1 rounded-full bg-[#B1C20E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#9EAD0E]"
          >
            Continuar
          </button>
          <button
            onClick={discardDraft}
            className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            Empezar de cero
          </button>
        </div>
      </div>
    </div>
  );
};
