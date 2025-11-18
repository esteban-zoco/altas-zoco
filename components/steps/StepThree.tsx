"use client";

import { useState } from "react";

import { Alert } from "@/components/Alert";
import { StepLayout } from "@/components/StepLayout";
import { FileUploadItem } from "@/components/documents/FileUploadItem";
import { useOnboardingForm } from "@/hooks/useOnboardingForm";
import type {
  LegalPersonDocuments,
  NaturalPersonDocuments,
} from "@/types/onboarding";

const ACCEPT_IMAGES_AND_PDF =
  "image/png,image/jpeg,image/jpg,application/pdf";

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

  const naturalDocs = state.documents.natural;
  const legalDocs = state.documents.legal;
  const isNatural = state.personType === "PF";

  const savedFeedback =
    savedToast ??
    (lastDraftSavedAt
      ? `Último guardado: ${lastDraftSavedAt.toLocaleTimeString()}`
      : undefined);

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

  const buildFormData = () => {
    const formData = new FormData();
    const payload = {
      personType: state.personType,
      basicData: state.basicData,
      naturalPersonData: state.naturalPersonData,
      legalPersonData: state.legalPersonData,
      documentsMeta: {
        natural: {
          dniFront: naturalDocs.dniFront.map((file) => file.name),
          dniBack: naturalDocs.dniBack.map((file) => file.name),
          cbu: naturalDocs.cbu.map((file) => file.name),
          afip: naturalDocs.afip.map((file) => file.name),
          rentas: naturalDocs.rentas.map((file) => file.name),
        },
        legal: {
          dniRepresentativeFront: legalDocs.dniRepresentativeFront.map(
            (file) => file.name,
          ),
          dniRepresentativeBack: legalDocs.dniRepresentativeBack.map(
            (file) => file.name,
          ),
          companyCuit: legalDocs.companyCuit.map((file) => file.name),
          companyCbu: legalDocs.companyCbu.map((file) => file.name),
          bylaws: legalDocs.bylaws.map((file) => file.name),
          rentas: legalDocs.rentas.map((file) => file.name),
        },
      },
    };
    formData.append("payload", JSON.stringify(payload));

    naturalDocs.dniFront.forEach((file, index) =>
      formData.append("pf_dni_front", file, file.name || `dni-frente-${index}.pdf`),
    );
    naturalDocs.dniBack.forEach((file, index) =>
      formData.append("pf_dni_back", file, file.name || `dni-dorso-${index}.pdf`),
    );
    naturalDocs.cbu.forEach((file, index) =>
      formData.append("pf_cbu", file, file.name || `cbu-${index}.pdf`),
    );
    naturalDocs.afip.forEach((file, index) =>
      formData.append("pf_afip", file, file.name || `afip-${index}.pdf`),
    );
    naturalDocs.rentas.forEach((file, index) =>
      formData.append("pf_rentas", file, file.name || `rentas-${index}.pdf`),
    );

    legalDocs.dniRepresentativeFront.forEach((file, index) =>
      formData.append(
        "pj_dni_representante_front",
        file,
        file.name || `dni-representante-frente-${index}.pdf`,
      ),
    );
    legalDocs.dniRepresentativeBack.forEach((file, index) =>
      formData.append(
        "pj_dni_representante_back",
        file,
        file.name || `dni-representante-dorso-${index}.pdf`,
      ),
    );
    legalDocs.companyCuit.forEach((file, index) =>
      formData.append(
        "pj_cuit",
        file,
        file.name || `cuit-${index}.pdf`,
      ),
    );
    legalDocs.companyCbu.forEach((file, index) =>
      formData.append(
        "pj_cbu",
        file,
        file.name || `cbu-${index}.pdf`,
      ),
    );
    legalDocs.bylaws.forEach((file, index) =>
      formData.append(
        "pj_contrato",
        file,
        file.name || `contrato-${index}.pdf`,
      ),
    );
    legalDocs.rentas.forEach((file, index) =>
      formData.append(
        "pj_rentas",
        file,
        file.name || `rentas-${index}.pdf`,
      ),
    );

    return formData;
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
      const body = buildFormData();
      const response = await fetch("/api/onboarding-submit", {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? "Error inesperado");
      }
      markComplete();
    } catch (error) {
      console.error("Error enviando solicitud", error);
      if (
        error instanceof Error &&
        error.message.includes("tamaño máximo (20MB)")
      ) {
        setErrorMessage(
          "La documentación supera el tamaño máximo (20MB). Reducí los archivos y volvé a intentar.",
        );
      } else {
        setErrorMessage(
          "Hubo un problema al enviar tu solicitud. Por favor volvé a intentar en unos minutos.",
        );
      }
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
        description="Podés cargar imágenes o PDFs. Si necesitás tiempo, guardá tu progreso y seguí después."
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
                accept={ACCEPT_IMAGES_AND_PDF}
                files={naturalDocs.dniFront}
                onFilesChange={(files) => updateNaturalFiles("dniFront", files)}
              />
              <FileUploadItem
                title="DNI dorso"
                description="Subí la cara trasera del DNI."
                accept={ACCEPT_IMAGES_AND_PDF}
                files={naturalDocs.dniBack}
                onFilesChange={(files) => updateNaturalFiles("dniBack", files)}
              />
              <FileUploadItem
                title="Constancia / captura de CBU"
                description="Debe verse claramente tu nombre y el CBU/CVU."
                accept={ACCEPT_IMAGES_AND_PDF}
                files={naturalDocs.cbu}
                onFilesChange={(files) => updateNaturalFiles("cbu", files)}
              />
              <FileUploadItem
                title="Constancia AFIP (opcional)"
                optional
                accept={ACCEPT_IMAGES_AND_PDF}
                files={naturalDocs.afip}
                onFilesChange={(files) => updateNaturalFiles("afip", files)}
              />
              <FileUploadItem
                title="Constancia de Rentas"
                description="Adjuntá la constancia provincial vigente del comercio."
                accept={ACCEPT_IMAGES_AND_PDF}
                files={naturalDocs.rentas}
                onFilesChange={(files) => updateNaturalFiles("rentas", files)}
              />
            </>
          ) : (
            <>
              <FileUploadItem
                title="DNI (frente) del representante legal / persona autorizada"
                accept={ACCEPT_IMAGES_AND_PDF}
                files={legalDocs.dniRepresentativeFront}
                onFilesChange={(files) =>
                  updateLegalFiles("dniRepresentativeFront", files)
                }
              />
              <FileUploadItem
                title="DNI (dorso) del representante legal / persona autorizada"
                accept={ACCEPT_IMAGES_AND_PDF}
                files={legalDocs.dniRepresentativeBack}
                onFilesChange={(files) =>
                  updateLegalFiles("dniRepresentativeBack", files)
                }
              />
              <FileUploadItem
                title="Constancia de CUIT de la sociedad (AFIP)"
                accept={ACCEPT_IMAGES_AND_PDF}
                files={legalDocs.companyCuit}
                onFilesChange={(files) => updateLegalFiles("companyCuit", files)}
              />
              <FileUploadItem
                title="Constancia / captura de CBU de la sociedad"
                accept={ACCEPT_IMAGES_AND_PDF}
                files={legalDocs.companyCbu}
                onFilesChange={(files) => updateLegalFiles("companyCbu", files)}
              />
              <FileUploadItem
                title="Contrato social / estatuto"
                description="Podés subir uno o varios archivos (PDF o imágenes)."
                accept={ACCEPT_IMAGES_AND_PDF}
                allowMultiple
                files={legalDocs.bylaws}
                onFilesChange={(files) => updateLegalFiles("bylaws", files)}
              />
              <FileUploadItem
                title="Constancia de Rentas de la sociedad"
                description="Subí la constancia provincial obligatoria."
                accept={ACCEPT_IMAGES_AND_PDF}
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
              onChange={(event) => setAcceptedTerms(event.target.checked)}
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
