"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import {
  readStoredPaidOrganizerSubmission,
  usePaidOrganizerOnboardingForm,
} from "@/hooks/usePaidOrganizerOnboardingForm";
import { generateSubmissionPdf } from "@/lib/generateSubmissionPdf";

export const PaidOrganizerConfirmationScreen = () => {
  const { resetAll, lastSubmission } = usePaidOrganizerOnboardingForm();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);
  const [submissionToDownload, setSubmissionToDownload] = useState(
    () => lastSubmission ?? readStoredPaidOrganizerSubmission(),
  );

  useEffect(() => {
    if (!submissionToDownload) {
      const stored = readStoredPaidOrganizerSubmission();
      if (stored) {
        setSubmissionToDownload(stored);
      }
    }
  }, [submissionToDownload]);

  useEffect(() => {
    if (!lastSubmission) return;
    setSubmissionToDownload(lastSubmission);
  }, [lastSubmission]);

  const getSubmissionSummary = () =>
    submissionToDownload ?? readStoredPaidOrganizerSubmission();

  const handleDownloadPdf = () => {
    setPdfMessage(null);
    const summary = getSubmissionSummary();
    if (!summary) {
      setPdfMessage(
        "No encontramos los datos para generar el PDF. Reenvia tu solicitud para recrearlo.",
      );
      return;
    }
    try {
      setIsGeneratingPdf(true);
      generateSubmissionPdf(summary);
      setPdfMessage("PDF descargado. Puedes guardarlo para tus registros.");
    } catch (error) {
      console.error("No se pudo generar el PDF del formulario", error);
      setPdfMessage(
        "No pudimos generar el PDF. Reintentalo o contactanos si el problema persiste.",
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <section className="mx-auto mt-10 max-w-2xl rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
      <CheckCircle2 className="mx-auto h-16 w-16 text-[#B1C20E]" />
      <h1 className="mt-4 text-3xl font-semibold text-slate-900">
        Solicitud recibida
      </h1>
      <p className="mt-3 text-slate-600">
        Recibimos la solicitud de alta del organizador y ya estamos trabajando
        para activar sus cobros. Muy pronto recibiras un correo con los
        siguientes pasos.
      </p>
      <button
        type="button"
        onClick={handleDownloadPdf}
        className="mt-8 inline-flex items-center justify-center rounded-full border border-[#B1C20E] px-6 py-3 text-sm font-semibold text-[#B1C20E] transition hover:bg-[#F7F9D7]"
        disabled={isGeneratingPdf}
      >
        {isGeneratingPdf ? "Generando PDF..." : "Descargar resumen en PDF"}
      </button>
      <p className="mt-2 text-xs text-slate-500">
        Este boton usa la ultima solicitud enviada desde este dispositivo.
      </p>
      {pdfMessage && <p className="mt-2 text-sm text-slate-600">{pdfMessage}</p>}
      <button
        onClick={resetAll}
        className="mt-4 rounded-full bg-[#B1C20E] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#9EAD0E]"
      >
        Volver al inicio
      </button>
    </section>
  );
};
