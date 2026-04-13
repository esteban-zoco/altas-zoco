"use client";

import Image from "next/image";
import Link from "next/link";

import { OrganizerConfirmationScreen } from "@/components/organizers/OrganizerConfirmationScreen";
import { OrganizerResumeDraftDialog } from "@/components/organizers/OrganizerResumeDraftDialog";
import { OrganizerStepOne } from "@/components/organizers/OrganizerStepOne";
import { OrganizerStepThree } from "@/components/organizers/OrganizerStepThree";
import { OrganizerStepTwo } from "@/components/organizers/OrganizerStepTwo";
import {
  OrganizerOnboardingFormProvider,
  useOrganizerOnboardingForm,
} from "@/hooks/useOrganizerOnboardingForm";
import Logo from "../Logo ZOCO (solo) 1 (2).svg";

const StepContent = () => {
  const { currentStep, isComplete } = useOrganizerOnboardingForm();

  if (isComplete) {
    return <OrganizerConfirmationScreen />;
  }

  if (currentStep === 1) return <OrganizerStepOne />;
  if (currentStep === 2) return <OrganizerStepTwo />;
  return <OrganizerStepThree />;
};

const OrganizerShell = () => (
  <div className="min-h-screen bg-slate-50">
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="space-y-3">
        <Image
          src={Logo}
          alt="Logo de Zoco"
          className="h-8 w-auto sm:h-10"
          priority
        />
        <div className="space-y-3 pt-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#B1C20E]">
            Ficha de alta organizador de eventos
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-4xl">
            Da de alta tu perfil como organizador de eventos
          </h1>
          <p className="text-sm text-slate-600 sm:text-base">
            Completa esta ficha con tus datos y la documentacion respaldatoria
            para que podamos validar tu alta de forma agil.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#B1C20E] underline-offset-4 hover:underline"
            >
              Volver al alta de comercios
            </Link>
            <Link
              href="/modificaciones"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#B1C20E] underline-offset-4 hover:underline"
            >
              Necesitas actualizar datos existentes
            </Link>
          </div>
        </div>
      </header>
      <StepContent />
    </div>
    <OrganizerResumeDraftDialog />
  </div>
);

export default function OrganizerOnboardingPage() {
  return (
    <OrganizerOnboardingFormProvider>
      <OrganizerShell />
    </OrganizerOnboardingFormProvider>
  );
}
