"use client";

import { useMemo, useState } from "react";

import { Alert } from "@/components/Alert";
import { StepLayout } from "@/components/StepLayout";
import { FileUploadItem } from "@/components/documents/FileUploadItem";
import { useOrganizerOnboardingForm } from "@/hooks/useOrganizerOnboardingForm";
import {
  MAX_EFFECTIVE_UPLOAD_BYTES,
  MAX_EFFECTIVE_UPLOAD_LABEL,
  formatBytes,
} from "@/lib/onboardingUploadLimits";
import { optimizeUploadFiles } from "@/lib/optimizeUploadFiles.client";
import {
  getOrganizerContactEmail,
  getOrganizerContactPhone,
} from "@/lib/organizerSchemas";
import {
  type OrganizerDocuments,
  type OrganizerSubmissionPayload,
  isEntityOrganizerType,
} from "@/types/organizerOnboarding";

const ACCEPT_ANY_FILE = "*/*";

const sumFiles = (files: File[]) =>
  files.reduce((total, file) => total + file.size, 0);

const getDocumentsTotalBytes = (documents: OrganizerDocuments) =>
  sumFiles(documents.applicantDniFront) +
  sumFiles(documents.applicantDniBack) +
  sumFiles(documents.cuitProof) +
  sumFiles(documents.bylaws) +
  sumFiles(documents.representativePower) +
  sumFiles(documents.realAddressProof);

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

const buildSafeFileName = (base: string, file: File, index: number) =>
  `${base}-${index + 1}.${getFileExtension(file)}`;

export const OrganizerStepThree = () => {
  const {
    state,
    updateDocuments,
    previousStep,
    saveDraft,
    lastDraftSavedAt,
    markComplete,
  } = useOrganizerOnboardingForm();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [optimizingCount, setOptimizingCount] = useState(0);
  const [documentErrors, setDocumentErrors] = useState<Record<string, string>>(
    {},
  );
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedTermsAt, setAcceptedTermsAt] = useState<string | null>(null);

  const isEntity = isEntityOrganizerType(state.organizerType);
  const hasHumanCuit = Boolean(state.humanData.cuitCuil.trim());
  const dniTitle = isEntity
    ? "DNI (frente) del representante legal / apoderado"
    : "DNI (frente) del solicitante";
  const dniBackTitle = isEntity
    ? "DNI (dorso) del representante legal / apoderado"
    : "DNI (dorso) del solicitante";
  const addressProofTitle = isEntity
    ? "Constancia de domicilio del representante legal / apoderado"
    : "Constancia de domicilio real del solicitante";
  const totalBytes = useMemo(
    () => getDocumentsTotalBytes(state.documents),
    [state.documents],
  );
  const sizeLimitLabel = MAX_EFFECTIVE_UPLOAD_LABEL;
  const totalBytesLabel = formatBytes(totalBytes);

  const savedFeedback =
    savedToast ??
    (lastDraftSavedAt
      ? `Ultimo guardado: ${lastDraftSavedAt.toLocaleTimeString()}`
      : undefined);

  const formatLocalDateTime = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const setDocumentError = (key: string, message?: string | null) => {
    setDocumentErrors((prev) => {
      if (!message) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }

      if (prev[key] === message) return prev;
      return { ...prev, [key]: message };
    });
  };

  const clearSizeErrors = () => {
    setDocumentErrors((prev) => {
      const entries = Object.entries(prev);
      const hasAny = entries.some(([, value]) => value.includes("tamano"));
      if (!hasAny) return prev;

      const next = { ...prev };
      for (const [key, value] of entries) {
        if (value.includes("tamano")) {
          delete next[key];
        }
      }
      return next;
    });
  };

  const ensureWithinLimit = (nextDocuments: OrganizerDocuments) => {
    const nextTotal = getDocumentsTotalBytes(nextDocuments);
    if (nextTotal > MAX_EFFECTIVE_UPLOAD_BYTES) {
      setErrorMessage(
        `La documentacion supera el tamano maximo (${sizeLimitLabel}). Reduce los archivos e intenta nuevamente.`,
      );
      return false;
    }
    return true;
  };

  const withOptimizing = async <T,>(work: () => Promise<T>) => {
    setOptimizingCount((prev) => prev + 1);
    try {
      return await work();
    } finally {
      setOptimizingCount((prev) => Math.max(0, prev - 1));
    }
  };

  const updateFiles = async (key: keyof OrganizerDocuments, files: File[]) => {
    const optimizedFiles = await withOptimizing(() => optimizeUploadFiles(files));
    const nextDocuments: OrganizerDocuments = {
      ...state.documents,
      [key]: optimizedFiles,
    };
    if (!ensureWithinLimit(nextDocuments)) {
      setDocumentError(
        key,
        `Supera el tamano maximo total (${sizeLimitLabel}).`,
      );
      return;
    }
    setErrorMessage(null);
    setDocumentError(key, null);
    clearSizeErrors();
    updateDocuments({ [key]: optimizedFiles });
  };

  const requiredDocumentsMissing = () => {
    const missing: string[] = [];

    if (!state.documents.applicantDniFront.length) missing.push("DNI frente");
    if (!state.documents.applicantDniBack.length) missing.push("DNI dorso");
    if (!state.documents.realAddressProof.length) {
      missing.push("constancia de domicilio real");
    }
    if (isEntity || hasHumanCuit) {
      if (!state.documents.cuitProof.length) {
        missing.push("constancia de CUIT/CUIL");
      }
    }
    if (isEntity && !state.documents.bylaws.length) {
      missing.push("estatuto o contrato social");
    }

    return missing;
  };

  const buildMissingDocumentErrors = () => {
    const errors: Record<string, string> = {};
    if (!state.documents.applicantDniFront.length) {
      errors.applicantDniFront = "Requerido";
    }
    if (!state.documents.applicantDniBack.length) {
      errors.applicantDniBack = "Requerido";
    }
    if (!state.documents.realAddressProof.length) {
      errors.realAddressProof = "Requerido";
    }
    if ((isEntity || hasHumanCuit) && !state.documents.cuitProof.length) {
      errors.cuitProof = "Requerido";
    }
    if (isEntity && !state.documents.bylaws.length) {
      errors.bylaws = "Requerido";
    }
    return errors;
  };

  const getLargestDocumentKey = () => {
    const entries = Object.entries(state.documents) as Array<
      [keyof OrganizerDocuments, File[]]
    >;
    let largest: { key: keyof OrganizerDocuments; size: number } | null = null;

    for (const [key, files] of entries) {
      for (const file of files) {
        if (!largest || file.size > largest.size) {
          largest = { key, size: file.size };
        }
      }
    }

    return largest?.key ?? null;
  };

  const buildDocumentNames = (): OrganizerSubmissionPayload["documentsMeta"] => ({
    applicantDniFront: state.documents.applicantDniFront.map((file, index) =>
      buildSafeFileName("dni-frente", file, index),
    ),
    applicantDniBack: state.documents.applicantDniBack.map((file, index) =>
      buildSafeFileName("dni-dorso", file, index),
    ),
    cuitProof: state.documents.cuitProof.map((file, index) =>
      buildSafeFileName("cuit-cuil", file, index),
    ),
    bylaws: state.documents.bylaws.map((file, index) =>
      buildSafeFileName("estatuto", file, index),
    ),
    representativePower: state.documents.representativePower.map((file, index) =>
      buildSafeFileName("poder", file, index),
    ),
    realAddressProof: state.documents.realAddressProof.map((file, index) =>
      buildSafeFileName("domicilio", file, index),
    ),
  });

  const buildSubmissionPayload = (
    documentNames: OrganizerSubmissionPayload["documentsMeta"],
  ): OrganizerSubmissionPayload => ({
    organizerType: state.organizerType,
    humanData: state.humanData,
    entityData: state.entityData,
    documentsMeta: documentNames,
    termsAcceptedAt:
      acceptedTermsAt ??
      (acceptedTerms ? formatLocalDateTime(new Date()) : undefined),
  });

  const buildFormData = (
    payload: OrganizerSubmissionPayload,
    documentNames: OrganizerSubmissionPayload["documentsMeta"],
  ) => {
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));

    state.documents.applicantDniFront.forEach((file, index) =>
      formData.append(
        "applicant_dni_front",
        file,
        documentNames.applicantDniFront[index] ??
          buildSafeFileName("dni-frente", file, index),
      ),
    );
    state.documents.applicantDniBack.forEach((file, index) =>
      formData.append(
        "applicant_dni_back",
        file,
        documentNames.applicantDniBack[index] ??
          buildSafeFileName("dni-dorso", file, index),
      ),
    );
    state.documents.cuitProof.forEach((file, index) =>
      formData.append(
        "cuit_proof",
        file,
        documentNames.cuitProof[index] ??
          buildSafeFileName("cuit-cuil", file, index),
      ),
    );
    state.documents.bylaws.forEach((file, index) =>
      formData.append(
        "bylaws",
        file,
        documentNames.bylaws[index] ?? buildSafeFileName("estatuto", file, index),
      ),
    );
    state.documents.representativePower.forEach((file, index) =>
      formData.append(
        "representative_power",
        file,
        documentNames.representativePower[index] ??
          buildSafeFileName("poder", file, index),
      ),
    );
    state.documents.realAddressProof.forEach((file, index) =>
      formData.append(
        "real_address_proof",
        file,
        documentNames.realAddressProof[index] ??
          buildSafeFileName("domicilio", file, index),
      ),
    );

    return formData;
  };

  const getSubmitErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      if (error.message === "Failed to fetch") {
        return "No pudimos conectar con el servidor. Intenta nuevamente en unos minutos.";
      }
      return error.message;
    }

    return "Hubo un problema al enviar la solicitud. Intenta nuevamente en unos minutos.";
  };

  const handleFinalSubmit = async () => {
    setErrorMessage(null);

    if (!acceptedTerms) {
      setErrorMessage(
        "Debes aceptar la declaracion jurada y los terminos para enviar la solicitud.",
      );
      return;
    }

    const missing = requiredDocumentsMissing();
    if (missing.length) {
      const missingErrors = buildMissingDocumentErrors();
      setDocumentErrors((prev) => ({ ...prev, ...missingErrors }));
      setErrorMessage(`Faltan adjuntar: ${missing.join(", ")}`);
      return;
    }

    if (optimizingCount > 0) {
      setErrorMessage(
        "Estamos optimizando imagenes. Espera unos segundos y vuelve a intentar.",
      );
      return;
    }

    if (totalBytes > MAX_EFFECTIVE_UPLOAD_BYTES) {
      const largestKey = getLargestDocumentKey();
      if (largestKey) {
        setDocumentError(
          largestKey,
          "Este archivo es el mas pesado. Reduce su tamano o reemplazalo por una version mas liviana.",
        );
      }
      setErrorMessage(
        `La documentacion supera el tamano maximo (${sizeLimitLabel}). Reduce los archivos e intenta nuevamente.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const documentNames = buildDocumentNames();
      const payload = buildSubmissionPayload(documentNames);
      const body = buildFormData(payload, documentNames);
      const response = await fetch("/api/organizer-submit", {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";
        const isJson = contentType.includes("application/json");
        const error = isJson ? await response.json().catch(() => null) : null;
        const rawText = !isJson ? await response.text().catch(() => "") : "";
        throw new Error(error?.error ?? rawText?.trim() ?? "Error inesperado");
      }
      markComplete(payload);
    } catch (error) {
      console.error("Error enviando ficha de organizador", error);
      setErrorMessage(getSubmitErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = () => {
    saveDraft();
    setSavedToast("Datos guardados en este dispositivo");
    setTimeout(() => setSavedToast(null), 4000);
  };

  const contactEmail = getOrganizerContactEmail(
    state.organizerType,
    state.humanData,
    state.entityData,
  );
  const contactPhone = getOrganizerContactPhone(
    state.organizerType,
    state.humanData,
    state.entityData,
  );

  return (
    <div className="space-y-6">
      <Alert
        title="Adjunta la documentacion respaldatoria"
        description={`Puedes cargar archivos en cualquier formato. Limite total: ${sizeLimitLabel}. Si necesitas tiempo, guarda tu avance y sigue despues.`}
      />
      <StepLayout
        step={3}
        title="Documentacion de respaldo"
        description="Revisamos estos archivos para validar el alta del organizador."
        onBack={previousStep}
        primaryButton={{
          label: "Enviar ficha de alta",
          type: "button",
          onClick: handleFinalSubmit,
          disabled: isSubmitting || optimizingCount > 0,
          loading: isSubmitting || optimizingCount > 0,
        }}
        onSaveDraft={handleSave}
        savedFeedback={savedFeedback}
      >
        <div className="space-y-6">
          <Alert
            title="Contacto declarado"
            description={`${contactEmail || "-"}${contactPhone ? ` | ${contactPhone}` : ""}`}
          />
          <FileUploadItem
            title={dniTitle}
            accept={ACCEPT_ANY_FILE}
            error={documentErrors.applicantDniFront}
            files={state.documents.applicantDniFront}
            onFilesChange={(files) => updateFiles("applicantDniFront", files)}
          />
          <FileUploadItem
            title={dniBackTitle}
            accept={ACCEPT_ANY_FILE}
            error={documentErrors.applicantDniBack}
            files={state.documents.applicantDniBack}
            onFilesChange={(files) => updateFiles("applicantDniBack", files)}
          />
          {(isEntity || hasHumanCuit) && (
            <FileUploadItem
              title="Constancia de CUIT/CUIL"
              description={
                isEntity
                  ? "Obligatoria para la entidad."
                  : "Adjuntala segun el CUIT/CUIL declarado en la ficha."
              }
              optional={!isEntity}
              accept={ACCEPT_ANY_FILE}
              error={documentErrors.cuitProof}
              files={state.documents.cuitProof}
              onFilesChange={(files) => updateFiles("cuitProof", files)}
            />
          )}
          {isEntity && (
            <FileUploadItem
              title="Estatuto / contrato social"
              description="Puedes subir uno o varios archivos."
              accept={ACCEPT_ANY_FILE}
              allowMultiple
              error={documentErrors.bylaws}
              files={state.documents.bylaws}
              onFilesChange={(files) => updateFiles("bylaws", files)}
            />
          )}
          {isEntity && (
            <FileUploadItem
              title="Poder del representante"
              description="Adjuntalo solo cuando quien firma actue como apoderado."
              optional
              accept={ACCEPT_ANY_FILE}
              allowMultiple
              error={documentErrors.representativePower}
              files={state.documents.representativePower}
              onFilesChange={(files) => updateFiles("representativePower", files)}
            />
          )}
          <FileUploadItem
            title={addressProofTitle}
            accept={ACCEPT_ANY_FILE}
            error={documentErrors.realAddressProof}
            files={state.documents.realAddressProof}
            onFilesChange={(files) => updateFiles("realAddressProof", files)}
          />
        </div>
        <p className="text-xs text-slate-500">
          Tamano total actual: {totalBytesLabel} / {sizeLimitLabel}
          {optimizingCount > 0 ? " (optimizando imagenes...)" : ""}
        </p>
        <div className="space-y-3 rounded-3xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Declaracion jurada
          </h3>
          <p className="text-sm text-slate-600">
            El solicitante declara bajo juramento que la informacion aportada y
            la documentacion adjunta son veraces, completas y vigentes, y
            acepta los terminos y condiciones de Zoco.
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
            Acepto la declaracion jurada y los terminos y condiciones.
          </label>
        </div>
        {errorMessage && (
          <Alert
            title="Revisa la documentacion"
            description={errorMessage}
            variant="error"
          />
        )}
      </StepLayout>
    </div>
  );
};
