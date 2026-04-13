import type { Address } from "@/types/onboarding";

export type OrganizerType = "human" | "legal_entity" | "nonprofit";
export type OnboardingStep = 1 | 2 | 3;

export interface OrganizerHumanData {
  fullName: string;
  documentType: string;
  documentNumber: string;
  cuitCuil: string;
  birthDate: string;
  nationality: string;
  maritalStatus: string;
  realAddress: Address;
  sameActivityAddress: boolean;
  activityAddress: Address;
  email: string;
  phone: string;
}

export interface OrganizerRepresentativeData {
  fullName: string;
  dni: string;
  cuitCuil: string;
  birthDate: string;
  role: string;
  address: Address;
  email: string;
  phone: string;
}

export interface OrganizerEntityData {
  businessName: string;
  cuit: string;
  constitutionDate: string;
  entityKind: string;
  legalAddress: Address;
  operationalAddress: Address;
  mainActivity: string;
  representative: OrganizerRepresentativeData;
}

export interface OrganizerDocuments {
  applicantDniFront: File[];
  applicantDniBack: File[];
  cuitProof: File[];
  bylaws: File[];
  representativePower: File[];
  realAddressProof: File[];
}

export interface OrganizerFormState {
  organizerType: OrganizerType;
  humanData: OrganizerHumanData;
  entityData: OrganizerEntityData;
  documents: OrganizerDocuments;
}

export interface DraftOrganizerState {
  organizerType: OrganizerType;
  humanData: OrganizerHumanData;
  entityData: OrganizerEntityData;
  step: OnboardingStep;
}

export interface OrganizerDocumentsMeta {
  applicantDniFront: string[];
  applicantDniBack: string[];
  cuitProof: string[];
  bylaws: string[];
  representativePower: string[];
  realAddressProof: string[];
}

export interface OrganizerSubmissionPayload {
  organizerType: OrganizerType;
  humanData: OrganizerHumanData;
  entityData: OrganizerEntityData;
  documentsMeta: OrganizerDocumentsMeta;
  termsAcceptedAt?: string;
}

export interface SubmittedOrganizerSummary {
  payload: OrganizerSubmissionPayload;
  submittedAt: Date;
}

export const ORGANIZER_TYPE_OPTIONS: Array<{
  label: string;
  value: OrganizerType;
  description: string;
}> = [
  {
    label: "Persona humana",
    value: "human",
    description: "Organizador individual",
  },
  {
    label: "Persona juridica",
    value: "legal_entity",
    description: "Sociedad o empresa",
  },
  {
    label: "Organizacion sin fines de lucro",
    value: "nonprofit",
    description: "Asociacion, fundacion u ONG",
  },
];

export const isEntityOrganizerType = (organizerType: OrganizerType) =>
  organizerType === "legal_entity" || organizerType === "nonprofit";

const emptyAddress = (): Address => ({
  street: "",
  number: "",
  floor: "",
  city: "",
  province: "",
  postalCode: "",
});

export const createEmptyOrganizerState = (): OrganizerFormState => ({
  organizerType: "human",
  humanData: {
    fullName: "",
    documentType: "",
    documentNumber: "",
    cuitCuil: "",
    birthDate: "",
    nationality: "",
    maritalStatus: "",
    realAddress: emptyAddress(),
    sameActivityAddress: true,
    activityAddress: emptyAddress(),
    email: "",
    phone: "",
  },
  entityData: {
    businessName: "",
    cuit: "",
    constitutionDate: "",
    entityKind: "",
    legalAddress: emptyAddress(),
    operationalAddress: emptyAddress(),
    mainActivity: "",
    representative: {
      fullName: "",
      dni: "",
      cuitCuil: "",
      birthDate: "",
      role: "",
      address: emptyAddress(),
      email: "",
      phone: "",
    },
  },
  documents: {
    applicantDniFront: [],
    applicantDniBack: [],
    cuitProof: [],
    bylaws: [],
    representativePower: [],
    realAddressProof: [],
  },
});
