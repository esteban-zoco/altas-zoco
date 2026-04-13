"use client";

import Image from "next/image";
import Link from "next/link";

import { PaidOrganizerConfirmationScreen } from "@/components/organizersPaid/ConfirmationScreen";
import { PaidOrganizerResumeDraftDialog } from "@/components/organizersPaid/ResumeDraftDialog";
import { PaidOrganizerStepOne } from "@/components/organizersPaid/StepOne";
import { PaidOrganizerStepThree } from "@/components/organizersPaid/StepThree";
import { PaidOrganizerStepTwo } from "@/components/organizersPaid/StepTwo";
import {
  PaidOrganizerOnboardingFormProvider,
  usePaidOrganizerOnboardingForm,
} from "@/hooks/usePaidOrganizerOnboardingForm";
import Logo from "../Logo ZOCO (solo) 1 (2).svg";

const StepContent = () => {
  const { currentStep, isComplete } = usePaidOrganizerOnboardingForm();

  if (isComplete) {
    return <PaidOrganizerConfirmationScreen />;
  }

  if (currentStep === 1) return <PaidOrganizerStepOne />;
  if (currentStep === 2) return <PaidOrganizerStepTwo />;
  return <PaidOrganizerStepThree />;
};

const PaidOrganizerShell = () => (
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
            Alta organizador - eventos pagos
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-4xl">
            Da de alta tu perfil para vender entradas con Zoco
          </h1>
          <p className="text-sm text-slate-600 sm:text-base">
            Completa esta ficha con los datos del organizador y la
            documentacion necesaria para habilitar la venta y el cobro de tus
            eventos.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#B1C20E] underline-offset-4 hover:underline"
            >
              Volver a altas comunes
            </Link>
            <Link
              href="/organizadores"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#B1C20E] underline-offset-4 hover:underline"
            >
              Ir a eventos gratis
            </Link>
          </div>
        </div>
      </header>
      <StepContent />
    </div>
    <PaidOrganizerResumeDraftDialog />
  </div>
);

export default function PaidOrganizerOnboardingPage() {
  return (
    <PaidOrganizerOnboardingFormProvider>
      <PaidOrganizerShell />
    </PaidOrganizerOnboardingFormProvider>
  );
}
