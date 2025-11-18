"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

interface StepLayoutProps {
  step: number;
  totalSteps?: number;
  title: string;
  description?: string;
  children: ReactNode;
  onBack?: () => void;
  primaryButton: {
    label: string;
    type?: "button" | "submit";
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  onSaveDraft?: () => void;
  saveLabel?: string;
  savedFeedback?: string;
}

export const StepLayout = ({
  step,
  totalSteps = 3,
  title,
  description,
  children,
  onBack,
  primaryButton,
  onSaveDraft,
  saveLabel = "Guardar y continuar después",
  savedFeedback,
}: StepLayoutProps) => {
  const progress = Math.round((step / totalSteps) * 100);

  return (
    <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
      <header className="flex flex-col gap-4 border-b border-slate-100 pb-6">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-[#B1C20E]">
            Paso {step} de {totalSteps}
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
          {description && (
            <p className="text-sm text-slate-600">{description}</p>
          )}
        </div>
        <div className="h-2 rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[#B1C20E] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>
      <div className="mt-6 flex flex-col gap-6">{children}</div>
      <footer className="mt-8 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              Anterior
            </button>
          )}
          <button
            type={primaryButton.type ?? "button"}
            onClick={
              primaryButton.type === "button" ? primaryButton.onClick : undefined
            }
            disabled={primaryButton.disabled}
            className={clsx(
              "rounded-full bg-[#B1C20E] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#9EAD0E]",
              primaryButton.disabled && "cursor-not-allowed opacity-70",
            )}
          >
            {primaryButton.loading ? "Procesando..." : primaryButton.label}
          </button>
        </div>
        {onSaveDraft && (
          <div className="flex flex-col gap-1 text-right">
            <button
              type="button"
              onClick={onSaveDraft}
              className="text-sm font-medium text-[#B1C20E] underline-offset-4 hover:underline"
            >
              {saveLabel}
            </button>
            {savedFeedback && (
              <span className="text-xs text-emerald-600">{savedFeedback}</span>
            )}
          </div>
        )}
      </footer>
    </section>
  );
};
