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
  DraftOrganizerState,
  OnboardingStep,
  OrganizerDocuments,
  OrganizerEntityData,
  OrganizerFormState,
  OrganizerHumanData,
  OrganizerSubmissionPayload,
  OrganizerType,
  SubmittedOrganizerSummary,
} from "@/types/organizerOnboarding";
import { createEmptyOrganizerState } from "@/types/organizerOnboarding";

const STORAGE_KEY = "zoco-organizer-onboarding-draft";
const SUBMISSION_STORAGE_KEY = "zoco-organizer-last-submission";

interface StoredSubmissionSummary {
  payload: OrganizerSubmissionPayload;
  submittedAt: string;
}

export const readStoredOrganizerSubmission =
  (): SubmittedOrganizerSummary | null => {
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
      console.error("No se pudo leer la solicitud del organizador", error);
      return null;
    }
  };

const persistSubmission = (summary: SubmittedOrganizerSummary | null) => {
  if (typeof window === "undefined") return;
  try {
    if (!summary) {
      window.localStorage.removeItem(SUBMISSION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      SUBMISSION_STORAGE_KEY,
      JSON.stringify({
        payload: summary.payload,
        submittedAt: summary.submittedAt.toISOString(),
      }),
    );
  } catch (error) {
    console.error("No se pudo guardar la solicitud del organizador", error);
  }
};

interface OrganizerOnboardingContextValue {
  state: OrganizerFormState;
  currentStep: OnboardingStep;
  isComplete: boolean;
  lastDraftSavedAt: Date | null;
  showResumePrompt: boolean;
  lastSubmission: SubmittedOrganizerSummary | null;
  nextStep: () => void;
  previousStep: () => void;
  setOrganizerType: (type: OrganizerType) => void;
  updateHumanData: (data: Partial<OrganizerHumanData>) => void;
  updateEntityData: (data: Partial<OrganizerEntityData>) => void;
  updateDocuments: (data: Partial<OrganizerDocuments>) => void;
  saveDraft: () => void;
  resumeDraft: () => void;
  discardDraft: () => void;
  clearDraft: () => void;
  markComplete: (payload?: OrganizerSubmissionPayload) => void;
  resetAll: () => void;
}

const OrganizerOnboardingFormContext = createContext<
  OrganizerOnboardingContextValue | undefined
>(undefined);

export const OrganizerOnboardingFormProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [state, setState] = useState<OrganizerFormState>(() =>
    createEmptyOrganizerState(),
  );
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [isComplete, setIsComplete] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const [pendingDraft, setPendingDraft] = useState<DraftOrganizerState | null>(
    null,
  );
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [lastSubmission, setLastSubmission] =
    useState<SubmittedOrganizerSummary | null>(() =>
      readStoredOrganizerSubmission(),
    );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const timeout = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        setPendingDraft(JSON.parse(stored) as DraftOrganizerState);
        setShowResumePrompt(true);
      } catch (error) {
        console.error("No se pudo leer el borrador del organizador", error);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => (Math.min(prev + 1, 3) as OnboardingStep));
  }, []);

  const previousStep = useCallback(() => {
    setCurrentStep((prev) => (Math.max(prev - 1, 1) as OnboardingStep));
  }, []);

  const setOrganizerType = useCallback((type: OrganizerType) => {
    setState((prev) => ({
      ...prev,
      organizerType: type,
    }));
  }, []);

  const updateHumanData = useCallback((data: Partial<OrganizerHumanData>) => {
    setState((prev) => ({
      ...prev,
      humanData: {
        ...prev.humanData,
        ...data,
        realAddress: {
          ...prev.humanData.realAddress,
          ...(data.realAddress ?? {}),
        },
        activityAddress: {
          ...prev.humanData.activityAddress,
          ...(data.activityAddress ?? {}),
        },
      },
    }));
  }, []);

  const updateEntityData = useCallback((data: Partial<OrganizerEntityData>) => {
    setState((prev) => ({
      ...prev,
      entityData: {
        ...prev.entityData,
        ...data,
        legalAddress: {
          ...prev.entityData.legalAddress,
          ...(data.legalAddress ?? {}),
        },
        operationalAddress: {
          ...prev.entityData.operationalAddress,
          ...(data.operationalAddress ?? {}),
        },
        representative: {
          ...prev.entityData.representative,
          ...(data.representative ?? {}),
          address: {
            ...prev.entityData.representative.address,
            ...(data.representative?.address ?? {}),
          },
        },
      },
    }));
  }, []);

  const updateDocuments = useCallback((data: Partial<OrganizerDocuments>) => {
    setState((prev) => ({
      ...prev,
      documents: {
        ...prev.documents,
        ...data,
      },
    }));
  }, []);

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const saveDraft = useCallback(() => {
    if (typeof window === "undefined") return;

    const draft: DraftOrganizerState = {
      organizerType: state.organizerType,
      humanData: state.humanData,
      entityData: state.entityData,
      step: currentStep,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setLastDraftSavedAt(new Date());
  }, [currentStep, state]);

  const resumeDraft = useCallback(() => {
    if (!pendingDraft) return;

    const emptyState = createEmptyOrganizerState();
    setState({
      ...emptyState,
      organizerType: pendingDraft.organizerType,
      humanData: {
        ...emptyState.humanData,
        ...pendingDraft.humanData,
        realAddress: {
          ...emptyState.humanData.realAddress,
          ...(pendingDraft.humanData.realAddress ?? {}),
        },
        activityAddress: {
          ...emptyState.humanData.activityAddress,
          ...(pendingDraft.humanData.activityAddress ?? {}),
        },
      },
      entityData: {
        ...emptyState.entityData,
        ...pendingDraft.entityData,
        legalAddress: {
          ...emptyState.entityData.legalAddress,
          ...(pendingDraft.entityData.legalAddress ?? {}),
        },
        operationalAddress: {
          ...emptyState.entityData.operationalAddress,
          ...(pendingDraft.entityData.operationalAddress ?? {}),
        },
        representative: {
          ...emptyState.entityData.representative,
          ...(pendingDraft.entityData.representative ?? {}),
          address: {
            ...emptyState.entityData.representative.address,
            ...(pendingDraft.entityData.representative?.address ?? {}),
          },
        },
      },
    });
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
    (payload?: OrganizerSubmissionPayload) => {
      setIsComplete(true);
      const summary = payload ? { payload, submittedAt: new Date() } : null;
      setLastSubmission(summary);
      persistSubmission(summary);
      setState(createEmptyOrganizerState());
      setCurrentStep(1);
      setLastDraftSavedAt(null);
      clearDraft();
    },
    [clearDraft],
  );

  const resetAll = useCallback(() => {
    setIsComplete(false);
    setState(createEmptyOrganizerState());
    setCurrentStep(1);
    setLastDraftSavedAt(null);
    setLastSubmission(null);
    persistSubmission(null);
  }, []);

  const value = useMemo<OrganizerOnboardingContextValue>(
    () => ({
      state,
      currentStep,
      isComplete,
      lastDraftSavedAt,
      showResumePrompt,
      lastSubmission,
      nextStep,
      previousStep,
      setOrganizerType,
      updateHumanData,
      updateEntityData,
      updateDocuments,
      saveDraft,
      resumeDraft,
      discardDraft,
      clearDraft,
      markComplete,
      resetAll,
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
      setOrganizerType,
      updateHumanData,
      updateEntityData,
      updateDocuments,
      saveDraft,
      resumeDraft,
      discardDraft,
      clearDraft,
      markComplete,
      resetAll,
    ],
  );

  return (
    <OrganizerOnboardingFormContext.Provider value={value}>
      {children}
    </OrganizerOnboardingFormContext.Provider>
  );
};

export const useOrganizerOnboardingForm = () => {
  const context = useContext(OrganizerOnboardingFormContext);
  if (!context) {
    throw new Error(
      "useOrganizerOnboardingForm debe usarse dentro de OrganizerOnboardingFormProvider",
    );
  }
  return context;
};
