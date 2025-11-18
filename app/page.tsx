"use client";

import Image from "next/image";

import { ResumeDraftDialog } from "@/components/ResumeDraftDialog";
import { ConfirmationScreen } from "@/components/steps/ConfirmationScreen";
import { StepOne } from "@/components/steps/StepOne";
import { StepThree } from "@/components/steps/StepThree";
import { StepTwo } from "@/components/steps/StepTwo";
import { OnboardingFormProvider, useOnboardingForm } from "@/hooks/useOnboardingForm";
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
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-4xl mt-[40px]" style={{lineHeight: "24px"}}>
          Activá tus cobros en apenas tres pasos
        </h1>
        <p className="text-sm text-slate-600 sm:text-base">
          Te pedimos solo lo imprescindible para validar tu comercio según la
          normativa argentina. Podés guardar tu avance y seguir después.
        </p>
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
