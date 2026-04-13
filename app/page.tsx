"use client";

import Image from "next/image";
import Link from "next/link";

import { ResumeDraftDialog } from "@/components/ResumeDraftDialog";
import { ConfirmationScreen } from "@/components/steps/ConfirmationScreen";
import { StepOne } from "@/components/steps/StepOne";
import { StepThree } from "@/components/steps/StepThree";
import { StepTwo } from "@/components/steps/StepTwo";
import {
  OnboardingFormProvider,
  useOnboardingForm,
} from "@/hooks/useOnboardingForm";
import Logo from "./Logo ZOCO (solo) 1 (2).svg";

const StepContent = () => {
  const { currentStep, isComplete } = useOnboardingForm();

  if (isComplete) {
    return <ConfirmationScreen />;
  }

  if (currentStep === 1) return <StepOne />;
  if (currentStep === 2) return <StepTwo />;
  return <StepThree />;
};

const OnboardingShell = () => (
  <div className="min-h-screen bg-slate-50">
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="space-y-3">
        <Image
          src={Logo}
          alt="Logo de Zoco"
          className="h-8 w-auto sm:h-10"
          priority
        />
        <h1
          className="mt-[40px] text-2xl font-semibold text-slate-900 sm:text-4xl"
          style={{ lineHeight: "24px" }}
        >
          Activa tus cobros en apenas tres pasos
        </h1>
        <p className="text-sm text-slate-600 sm:text-base">
          Te pedimos solo lo imprescindible para validar tu comercio segun la
          normativa argentina. Puedes guardar tu avance y seguir despues.
        </p>
        <Link
          href="/modificaciones"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#B1C20E] underline-offset-4 hover:underline"
        >
          Necesitas actualizar tus datos? Hazlo aca
        </Link>
        <Link
          href="/organizadores"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#B1C20E] underline-offset-4 hover:underline"
        >
          Eventos gratis
        </Link>
        <Link
          href="/organizadores-pagos"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#B1C20E] underline-offset-4 hover:underline"
        >
          Eventos pagos
        </Link>
      </header>
      <StepContent />
    </div>
    <ResumeDraftDialog />
  </div>
);

export default function HomePage() {
  return (
    <OnboardingFormProvider>
      <OnboardingShell />
    </OnboardingFormProvider>
  );
}
