"use client";

import { useState } from "react";

import { Alert } from "@/components/Alert";
import { StepLayout } from "@/components/StepLayout";
import { FileUploadItem } from "@/components/documents/FileUploadItem";
import { useOnboardingForm } from "@/hooks/useOnboardingForm";
import type {
  LegalPersonDocuments,
  NaturalPersonDocuments,
  OnboardingSubmissionPayload,
} from "@/types/onboarding";

const ACCEPT_ANY_FILE = "*/*";

export const StepThree = () => {
  const {
    state,
    updateNaturalDocuments,
    updateLegalDocuments,
    previousStep,
    saveDraft,
    lastDraftSavedAt,
    markComplete,
  } = useOnboardingForm();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedTermsAt, setAcceptedTermsAt] = useState<string | null>(null);

  const naturalDocs = state.documents.natural;
  const legalDocs = state.documents.legal;
  const isNatural = state.personType === "PF";

  const savedFeedback =
    savedToast ??
    (lastDraftSavedAt
      ? `Último guardado: ${lastDraftSavedAt.toLocaleTimeString()}`
      : undefined);

  const formatLocalDateTime = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const normalizeExtension = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!cleaned) return "";
    if (cleaned === "jpeg" || cleaned === "pjpeg") return "jpg";
    return cleaned;
  };

  const getFileExtension = (file: File) => {
    const trimmedName = file.name?.trim();
    if (trimmedName && trimmedName.includes(".")) {
      const ext = trimmedName.split(".").pop() ?? "";
      const normalized = normalizeExtension(ext);
      if (normalized) return normalized;
    }
    if (file.type) {
      const typeExt = file.type.split("/")[1] ?? "";
      const normalized = normalizeExtension(typeExt);
      if (normalized) return normalized;
    }
    return file.type?.startsWith("image/") ? "jpg" : "bin";
  };

  const buildSafeFileName = (base: string, file: File, index: number) => {
    const extension = getFileExtension(file);
    return `${base}-${index + 1}.${extension}`;
  };

  const updateNaturalFiles = (
    key: keyof NaturalPersonDocuments,
    files: File[],
  ) => {
    updateNaturalDocuments({ [key]: files } as Partial<NaturalPersonDocuments>);
  };

  const updateLegalFiles = (
    key: keyof LegalPersonDocuments,
    files: File[],
  ) => {
    updateLegalDocuments({ [key]: files });
  };

  const requiredDocumentsMissing = () => {
    const missing: string[] = [];
    if (isNatural) {
      if (!naturalDocs.dniFront.length) missing.push("DNI frente");
      if (!naturalDocs.dniBack.length) missing.push("DNI dorso");
      if (!naturalDocs.cbu.length) missing.push("Constancia / captura de CBU");
      if (!naturalDocs.afip.length) missing.push("Constancia AFIP / ARCA");
      if (!naturalDocs.rentas.length) missing.push("Constancia de Rentas");
    } else {
      if (!legalDocs.dniRepresentativeFront.length)
        missing.push("DNI frente del representante");
      if (!legalDocs.dniRepresentativeBack.length)
        missing.push("DNI dorso del representante");
      if (!legalDocs.companyCuit.length) {
        missing.push("Constancia de CUIT");
      }
      if (!legalDocs.companyCbu.length) {
        missing.push("Constancia de CBU");
      }
      if (!legalDocs.bylaws.length) {
        missing.push("Contrato social / estatuto");
      }
      if (!legalDocs.rentas.length) {
        missing.push("Constancia de Rentas");
      }
    }
    return missing;
  };

  const buildDocumentNames = (): OnboardingSubmissionPayload["documentsMeta"] => ({
    natural: {
      dniFront: naturalDocs.dniFront.map((file, index) =>
        buildSafeFileName("dni-frente", file, index),
      ),
      dniBack: naturalDocs.dniBack.map((file, index) =>
        buildSafeFileName("dni-dorso", file, index),
      ),
      cbu: naturalDocs.cbu.map((file, index) =>
        buildSafeFileName("cbu", file, index),
      ),
      afip: naturalDocs.afip.map((file, index) =>
        buildSafeFileName("afip", file, index),
      ),
      rentas: naturalDocs.rentas.map((file, index) =>
        buildSafeFileName("rentas", file, index),
      ),
    },
    legal: {
      dniRepresentativeFront: legalDocs.dniRepresentativeFront.map(
        (file, index) => buildSafeFileName("dni-representante-frente", file, index),
      ),
      dniRepresentativeBack: legalDocs.dniRepresentativeBack.map(
        (file, index) => buildSafeFileName("dni-representante-dorso", file, index),
      ),
      companyCuit: legalDocs.companyCuit.map((file, index) =>
        buildSafeFileName("cuit", file, index),
      ),
      companyCbu: legalDocs.companyCbu.map((file, index) =>
        buildSafeFileName("cbu", file, index),
      ),
      bylaws: legalDocs.bylaws.map((file, index) =>
        buildSafeFileName("contrato", file, index),
      ),
      rentas: legalDocs.rentas.map((file, index) =>
        buildSafeFileName("rentas", file, index),
      ),
    },
  });

  const buildSubmissionPayload = (
    documentNames: OnboardingSubmissionPayload["documentsMeta"],
  ): OnboardingSubmissionPayload => ({
    personType: state.personType,
    basicData: state.basicData,
    naturalPersonData: state.naturalPersonData,
    legalPersonData: state.legalPersonData,
    documentsMeta: documentNames,
    termsAcceptedAt:
      acceptedTermsAt ??
      (acceptedTerms ? formatLocalDateTime(new Date()) : undefined),
  });

  const buildFormData = (
    payload: OnboardingSubmissionPayload,
    documentNames: OnboardingSubmissionPayload["documentsMeta"],
  ) => {
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));

    naturalDocs.dniFront.forEach((file, index) =>
      formData.append(
        "pf_dni_front",
        file,
        documentNames.natural.dniFront[index] ??
          buildSafeFileName("dni-frente", file, index),
      ),
    );
    naturalDocs.dniBack.forEach((file, index) =>
      formData.append(
        "pf_dni_back",
        file,
        documentNames.natural.dniBack[index] ??
          buildSafeFileName("dni-dorso", file, index),
      ),
    );
    naturalDocs.cbu.forEach((file, index) =>
      formData.append(
        "pf_cbu",
        file,
        documentNames.natural.cbu[index] ??
          buildSafeFileName("cbu", file, index),
      ),
    );
    naturalDocs.afip.forEach((file, index) =>
      formData.append(
        "pf_afip",
        file,
        documentNames.natural.afip[index] ??
          buildSafeFileName("afip", file, index),
      ),
    );
    naturalDocs.rentas.forEach((file, index) =>
      formData.append(
        "pf_rentas",
        file,
        documentNames.natural.rentas[index] ??
          buildSafeFileName("rentas", file, index),
      ),
    );

    legalDocs.dniRepresentativeFront.forEach((file, index) =>
      formData.append(
        "pj_dni_representante_front",
        file,
        documentNames.legal.dniRepresentativeFront[index] ??
          buildSafeFileName("dni-representante-frente", file, index),
      ),
    );
    legalDocs.dniRepresentativeBack.forEach((file, index) =>
      formData.append(
        "pj_dni_representante_back",
        file,
        documentNames.legal.dniRepresentativeBack[index] ??
          buildSafeFileName("dni-representante-dorso", file, index),
      ),
    );
    legalDocs.companyCuit.forEach((file, index) =>
      formData.append(
        "pj_cuit",
        file,
        documentNames.legal.companyCuit[index] ??
          buildSafeFileName("cuit", file, index),
      ),
    );
    legalDocs.companyCbu.forEach((file, index) =>
      formData.append(
        "pj_cbu",
        file,
        documentNames.legal.companyCbu[index] ??
          buildSafeFileName("cbu", file, index),
      ),
    );
    legalDocs.bylaws.forEach((file, index) =>
      formData.append(
        "pj_contrato",
        file,
        documentNames.legal.bylaws[index] ??
          buildSafeFileName("contrato", file, index),
      ),
    );
    legalDocs.rentas.forEach((file, index) =>
      formData.append(
        "pj_rentas",
        file,
        documentNames.legal.rentas[index] ??
          buildSafeFileName("rentas", file, index),
      ),
    );

    return formData;
  };

  const getSubmitErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      if (error.message === "Failed to fetch") {
        return "No pudimos conectar con el servidor. Reintenta en unos minutos.";
      }
      return error.message;
    }
    return "Hubo un problema al enviar tu solicitud. Reintenta en unos minutos.";
  };

  const handleFinalSubmit = async () => {
    setErrorMessage(null);
    if (!acceptedTerms) {
      setErrorMessage(
        "Tenés que aceptar la declaración jurada y los términos para enviar la solicitud.",
      );
      return;
    }
    const missing = requiredDocumentsMissing();
    if (missing.length) {
      setErrorMessage(
        `Faltan adjuntar: ${missing
          .map((item) => item.toLowerCase())
          .join(", ")}`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const documentNames = buildDocumentNames();
      const payload = buildSubmissionPayload(documentNames);
      const body = buildFormData(payload, documentNames);
      const response = await fetch("/api/onboarding-submit", {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? "Error inesperado");
      }
      markComplete(payload);
    } catch (error) {
      console.error("Error enviando solicitud", error);
      setErrorMessage(getSubmitErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = () => {
    saveDraft();
    setSavedToast("Datos guardados en tu dispositivo");
    setTimeout(() => setSavedToast(null), 4000);
  };

  return (
    <div className="space-y-6">
      <Alert
        title="Subí estos documentos para que podamos activar tu cuenta en Zoco."
        description="Podes cargar archivos en cualquier formato. Si necesitas tiempo, guarda tu progreso y segui despues."
      />
      <StepLayout
        step={3}
        title="Documentación"
        description="Verificamos esta información para habilitar tus cobros."
        onBack={previousStep}
        primaryButton={{
          label: "Enviar solicitud de alta",
          type: "button",
          onClick: handleFinalSubmit,
          disabled: isSubmitting,
          loading: isSubmitting,
        }}
        onSaveDraft={handleSave}
        savedFeedback={savedFeedback}
      >
        <div className="space-y-6">
          {isNatural ? (
            <>
              <FileUploadItem
                title="DNI frente"
                description="Subí la cara frontal del DNI."
                accept={ACCEPT_ANY_FILE}
                files={naturalDocs.dniFront}
                onFilesChange={(files) => updateNaturalFiles("dniFront", files)}
              />
              <FileUploadItem
                title="DNI dorso"
                description="Subí la cara trasera del DNI."
                accept={ACCEPT_ANY_FILE}
                files={naturalDocs.dniBack}
                onFilesChange={(files) => updateNaturalFiles("dniBack", files)}
              />
              <FileUploadItem
                title="Constancia / captura de CBU"
                description="Debe verse claramente tu nombre y el CBU/CVU."
                accept={ACCEPT_ANY_FILE}
                files={naturalDocs.cbu}
                onFilesChange={(files) => updateNaturalFiles("cbu", files)}
              />
              <FileUploadItem
                title="Constancia AFIP / ARCA"
                description="Subi una constancia vigente emitida por AFIP o ARCA."
                accept={ACCEPT_ANY_FILE}
                files={naturalDocs.afip}
                onFilesChange={(files) => updateNaturalFiles("afip", files)}
              />
              <FileUploadItem
                title="Constancia de Rentas"
                description="Adjuntá la constancia provincial vigente del comercio."
                accept={ACCEPT_ANY_FILE}
                files={naturalDocs.rentas}
                onFilesChange={(files) => updateNaturalFiles("rentas", files)}
              />
            </>
          ) : (
            <>
              <FileUploadItem
                title="DNI (frente) del representante legal / persona autorizada"
                accept={ACCEPT_ANY_FILE}
                files={legalDocs.dniRepresentativeFront}
                onFilesChange={(files) =>
                  updateLegalFiles("dniRepresentativeFront", files)
                }
              />
              <FileUploadItem
                title="DNI (dorso) del representante legal / persona autorizada"
                accept={ACCEPT_ANY_FILE}
                files={legalDocs.dniRepresentativeBack}
                onFilesChange={(files) =>
                  updateLegalFiles("dniRepresentativeBack", files)
                }
              />
              <FileUploadItem
                title="Constancia de CUIT de la sociedad (ARCA)"
                accept={ACCEPT_ANY_FILE}
                files={legalDocs.companyCuit}
                onFilesChange={(files) => updateLegalFiles("companyCuit", files)}
              />
              <FileUploadItem
                title="Constancia / captura de CBU de la sociedad"
                accept={ACCEPT_ANY_FILE}
                files={legalDocs.companyCbu}
                onFilesChange={(files) => updateLegalFiles("companyCbu", files)}
              />
              <FileUploadItem
                title="Contrato social / estatuto"
                description="Podes subir uno o varios archivos."
                accept={ACCEPT_ANY_FILE}
                allowMultiple
                files={legalDocs.bylaws}
                onFilesChange={(files) => updateLegalFiles("bylaws", files)}
              />
              <FileUploadItem
                title="Constancia de Rentas de la sociedad"
                description="Subí la constancia provincial obligatoria."
                accept={ACCEPT_ANY_FILE}
                files={legalDocs.rentas}
                onFilesChange={(files) => updateLegalFiles("rentas", files)}
              />
              {/* TODO: En backend real se debería combinar todo el estatuto en un solo PDF para auditoría. */}
            </>
          )}
        </div>
        <div className="space-y-3 rounded-3xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Declaración jurada
          </h3>
          <p className="text-sm text-slate-600">
            El que suscribe, con poder suficiente para este acto, manifiesta en
            calidad de declaración jurada y asumiendo toda la responsabilidad
            civil, penal y administrativa por cualquier falsedad u omisión, que
            la información ingresada es veraz y exacta. Además acepta las bases
            y condiciones del contrato de ZOCO S.A.S. disponibles en{" "}
            <a
              href="https://zocoweb.com.ar/static/media/Terminos.fba6256b8d063a5f895d.pdf"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#B1C20E]"
            >
              este enlace
            </a>
            .
          </p>
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => {
                const checked = event.target.checked;
                setAcceptedTerms(checked);
                setAcceptedTermsAt(
                  checked ? formatLocalDateTime(new Date()) : null,
                );
              }}
              className="h-4 w-4 rounded border-slate-300 text-[#B1C20E] focus:ring-[#B1C20E]"
            />
            Acepto la declaración jurada y los términos y condiciones.
          </label>
        </div>
        {errorMessage && (
          <Alert
            title="Revisá los documentos"
            description={errorMessage}
            variant="error"
          />
        )}
      </StepLayout>
    </div>
  );
};




