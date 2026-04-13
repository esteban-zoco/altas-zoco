"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  BasicData,
  DraftOnboardingState,
  LegalPersonData,
  LegalPersonDocuments,
  NaturalPersonData,
  NaturalPersonDocuments,
  OnboardingFormState,
  OnboardingSubmissionPayload,
  OnboardingStep,
  PersonType,
  SubmittedOnboardingSummary,
} from "@/types/onboarding";
import { createEmptyOnboardingState } from "@/types/onboarding";

const STORAGE_KEY = "zoco-paid-organizer-onboarding-draft";
export const SUBMISSION_STORAGE_KEY =
  "zoco-paid-organizer-last-submission";

interface StoredSubmissionSummary {
  payload: OnboardingSubmissionPayload;
  submittedAt: string;
}

export const readStoredPaidOrganizerSubmission =
  (): SubmittedOnboardingSummary | null => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(SUBMISSION_STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as StoredSubmissionSummary;
      return {
        payload: parsed.payload,
        submittedAt: new Date(parsed.submittedAt),
      };
    } catch (error) {
      console.error("No se pudo leer la solicitud enviada", error);
      return null;
    }
  };

export const persistPaidOrganizerSubmission = (
  summary: SubmittedOnboardingSummary | null,
) => {
  if (typeof window === "undefined") return;
  try {
    if (summary) {
      window.localStorage.setItem(
        SUBMISSION_STORAGE_KEY,
        JSON.stringify({
          payload: summary.payload,
          submittedAt: summary.submittedAt.toISOString(),
        }),
      );
    } else {
      window.localStorage.removeItem(SUBMISSION_STORAGE_KEY);
    }
  } catch (error) {
    console.error("No se pudo guardar la solicitud enviada", error);
  }
};

interface PaidOrganizerOnboardingContextValue {
  state: OnboardingFormState;
  currentStep: OnboardingStep;
  isComplete: boolean;
  lastDraftSavedAt: Date | null;
  showResumePrompt: boolean;
  lastSubmission: SubmittedOnboardingSummary | null;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: OnboardingStep) => void;
  updateBasicData: (data: Partial<BasicData>) => void;
  updateNaturalPersonData: (data: Partial<NaturalPersonData>) => void;
  updateLegalPersonData: (data: Partial<LegalPersonData>) => void;
  updateNaturalDocuments: (data: Partial<NaturalPersonDocuments>) => void;
  updateLegalDocuments: (data: Partial<LegalPersonDocuments>) => void;
  setPersonType: (type: PersonType) => void;
  saveDraft: () => void;
  resumeDraft: () => void;
  discardDraft: () => void;
  markComplete: (payload?: OnboardingSubmissionPayload) => void;
  resetAll: () => void;
  clearDraft: () => void;
}

const PaidOrganizerOnboardingFormContext = createContext<
  PaidOrganizerOnboardingContextValue | undefined
>(undefined);

export const PaidOrganizerOnboardingFormProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [state, setState] = useState<OnboardingFormState>(() =>
    createEmptyOnboardingState(),
  );
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [isComplete, setIsComplete] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const [pendingDraft, setPendingDraft] = useState<DraftOnboardingState | null>(
    null,
  );
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [lastSubmission, setLastSubmission] =
    useState<SubmittedOnboardingSummary | null>(() =>
      readStoredPaidOrganizerSubmission(),
    );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timeout = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setPendingDraft(JSON.parse(stored) as DraftOnboardingState);
          setShowResumePrompt(true);
        }
      } catch (error) {
        console.error("No se pudo leer el borrador guardado", error);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const goToStep = useCallback((step: OnboardingStep) => {
    setCurrentStep(() => Math.min(Math.max(step, 1), 3) as OnboardingStep);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => (Math.min(prev + 1, 3) as OnboardingStep));
  }, []);

  const previousStep = useCallback(() => {
    setCurrentStep((prev) => (Math.max(prev - 1, 1) as OnboardingStep));
  }, []);

  const setPersonType = useCallback((type: PersonType) => {
    setState((prev) => ({
      ...prev,
      personType: type,
    }));
  }, []);

  const updateBasicData = useCallback((data: Partial<BasicData>) => {
    setState((prev) => ({
      ...prev,
      basicData: {
        ...prev.basicData,
        ...data,
      },
    }));
  }, []);

  const updateNaturalPersonData = useCallback(
    (data: Partial<NaturalPersonData>) => {
      setState((prev) => ({
        ...prev,
        naturalPersonData: {
          ...prev.naturalPersonData,
          ...data,
          address: {
            ...prev.naturalPersonData.address,
            ...(data.address ?? {}),
          },
        },
      }));
    },
    [],
  );

  const updateLegalPersonData = useCallback(
    (data: Partial<LegalPersonData>) => {
      setState((prev) => ({
        ...prev,
        legalPersonData: {
          ...prev.legalPersonData,
          ...data,
          businessAddress: {
            ...prev.legalPersonData.businessAddress,
            ...(data.businessAddress ?? {}),
          },
          address: {
            ...prev.legalPersonData.address,
            ...(data.address ?? {}),
          },
          representative: {
            ...prev.legalPersonData.representative,
            ...(data.representative ?? {}),
          },
        },
      }));
    },
    [],
  );

  const updateNaturalDocuments = useCallback(
    (data: Partial<NaturalPersonDocuments>) => {
      setState((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          natural: {
            ...prev.documents.natural,
            ...data,
          },
        },
      }));
    },
    [],
  );

  const updateLegalDocuments = useCallback(
    (data: Partial<LegalPersonDocuments>) => {
      setState((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          legal: {
            ...prev.documents.legal,
            ...data,
          },
        },
      }));
    },
    [],
  );

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const saveDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    const draft: DraftOnboardingState = {
      personType: state.personType,
      basicData: state.basicData,
      naturalPersonData: state.naturalPersonData,
      legalPersonData: state.legalPersonData,
      step: currentStep,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setLastDraftSavedAt(new Date());
  }, [currentStep, state]);

  const resumeDraft = useCallback(() => {
    if (!pendingDraft) return;
    const emptyState = createEmptyOnboardingState();
    const emptyBeneficialOwner = emptyState.legalPersonData.beneficialOwners[0];
    const rawBeneficialOwners = (
      pendingDraft.legalPersonData as Partial<LegalPersonData> & {
        beneficialOwners?: unknown;
      }
    ).beneficialOwners;

    const normalizeBeneficialOwners = () => {
      if (!Array.isArray(rawBeneficialOwners)) {
        return emptyState.legalPersonData.beneficialOwners;
      }

      const owners = rawBeneficialOwners
        .map((owner) => {
          const rawOwner = owner as unknown as Record<string, unknown> | null;
          if (!rawOwner) return null;

          const address =
            typeof rawOwner.address === "string"
              ? rawOwner.address
              : (() => {
                  const legacy = rawOwner.realAddress as
                    | Record<string, unknown>
                    | undefined;
                  if (!legacy) return "";
                  const parts = [
                    legacy.street,
                    legacy.number,
                    legacy.floor ? `Piso/Depto ${legacy.floor}` : undefined,
                    legacy.city,
                    legacy.province,
                    legacy.postalCode ? `CP ${legacy.postalCode}` : undefined,
                  ]
                    .filter((part) => typeof part === "string" && part.trim())
                    .map((part) => (part as string).trim());
                  return parts.join(", ");
                })();

          const rest = { ...rawOwner };
          delete rest.realAddress;
          return {
            ...emptyBeneficialOwner,
            ...rest,
            address,
          } as LegalPersonData["beneficialOwners"][number];
        })
        .filter(Boolean) as LegalPersonData["beneficialOwners"];

      return owners.length
        ? owners
        : emptyState.legalPersonData.beneficialOwners;
    };

    const normalizedBeneficialOwners = normalizeBeneficialOwners();
    setState((prev) => ({
      ...prev,
      personType: pendingDraft.personType,
      basicData: pendingDraft.basicData,
      naturalPersonData: pendingDraft.naturalPersonData,
      legalPersonData: {
        ...emptyState.legalPersonData,
        ...pendingDraft.legalPersonData,
        businessAddress:
          (pendingDraft.legalPersonData as Partial<LegalPersonData>)
            .businessAddress ?? emptyState.legalPersonData.businessAddress,
        beneficialOwners: normalizedBeneficialOwners,
      },
    }));
    setCurrentStep(pendingDraft.step ?? 1);
    setPendingDraft(null);
    setShowResumePrompt(false);
  }, [pendingDraft]);

  const discardDraft = useCallback(() => {
    clearDraft();
    setPendingDraft(null);
    setShowResumePrompt(false);
  }, [clearDraft]);

  const markComplete = useCallback(
    (payload?: OnboardingSubmissionPayload) => {
      setIsComplete(true);
      const summary = payload ? { payload, submittedAt: new Date() } : null;
      setLastSubmission(summary);
      persistPaidOrganizerSubmission(summary);
      setState(createEmptyOnboardingState());
      setCurrentStep(1);
      setLastDraftSavedAt(null);
      clearDraft();
    },
    [clearDraft],
  );

  const resetAll = useCallback(() => {
    setIsComplete(false);
    setLastSubmission(null);
    persistPaidOrganizerSubmission(null);
    setState(createEmptyOnboardingState());
    setCurrentStep(1);
    setLastDraftSavedAt(null);
  }, []);

  const value = useMemo<PaidOrganizerOnboardingContextValue>(
    () => ({
      state,
      currentStep,
      isComplete,
      lastDraftSavedAt,
      showResumePrompt,
      lastSubmission,
      nextStep,
      previousStep,
      goToStep,
      updateBasicData,
      updateNaturalPersonData,
      updateLegalPersonData,
      updateNaturalDocuments,
      updateLegalDocuments,
      setPersonType,
      saveDraft,
      resumeDraft,
      discardDraft,
      markComplete,
      resetAll,
      clearDraft,
    }),
    [
      state,
      currentStep,
      isComplete,
      lastDraftSavedAt,
      showResumePrompt,
      lastSubmission,
      nextStep,
      previousStep,
      goToStep,
      updateBasicData,
      updateNaturalPersonData,
      updateLegalPersonData,
      updateNaturalDocuments,
      updateLegalDocuments,
      setPersonType,
      saveDraft,
      resumeDraft,
      discardDraft,
      markComplete,
      resetAll,
      clearDraft,
    ],
  );

  return (
    <PaidOrganizerOnboardingFormContext.Provider value={value}>
      {children}
    </PaidOrganizerOnboardingFormContext.Provider>
  );
};

export const usePaidOrganizerOnboardingForm = () => {
  const context = useContext(PaidOrganizerOnboardingFormContext);
  if (!context) {
    throw new Error(
      "usePaidOrganizerOnboardingForm debe usarse dentro de PaidOrganizerOnboardingFormProvider",
    );
  }
  return context;
};
