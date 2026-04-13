"use client";

import { useOrganizerOnboardingForm } from "@/hooks/useOrganizerOnboardingForm";

export const OrganizerResumeDraftDialog = () => {
  const { showResumePrompt, resumeDraft, discardDraft } =
    useOrganizerOnboardingForm();

  if (!showResumePrompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#B1C20E]">
          Retomar solicitud
        </p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-900">
          Encontramos una ficha de organizador sin terminar
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Puedes continuar donde la dejaste y revisar todo antes de enviarlo.
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
