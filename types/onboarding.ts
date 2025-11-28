export type PersonType = "PF" | "PJ";

export type TaxCondition =
  | "monotributista"
  | "responsable_inscripto"
  | "exento"
  | "consumidor_final";

export interface BasicData {
  cuit: string;
  fantasyName: string;
  contactEmail: string;
  phone: string;
  bankIdentifier: string;
  commercialAddress: Address;
}

export interface Address {
  street: string;
  number: string;
  floor?: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface RentasStatus {
  inscripto: boolean;
  exento: boolean;
  convenioMultilateral: boolean;
}

export interface NaturalPersonData {
  fullName: string;
  address: Address;
  birthDate: string;
  nationality: string;
  taxCondition: TaxCondition;
  rentas: RentasStatus;
  isPep: boolean;
  pepReason: string;
}

export interface RepresentativeData {
  fullName: string;
  dni: string;
  email: string;
  phone: string;
  cuit: string;
}

export interface LegalPersonData {
  businessName: string;
  address: Address;
  companyCuit: string;
  taxCondition: TaxCondition;
  representative: RepresentativeData;
  rentas: RentasStatus;
  isPep: boolean;
  pepReason: string;
}

export interface NaturalPersonDocuments {
  dniFront: File[];
  dniBack: File[];
  cbu: File[];
  afip: File[];
  rentas: File[];
}

export interface LegalPersonDocuments {
  dniRepresentativeFront: File[];
  dniRepresentativeBack: File[];
  companyCuit: File[];
  companyCbu: File[];
  bylaws: File[];
  rentas: File[];
}

export interface DocumentState {
  natural: NaturalPersonDocuments;
  legal: LegalPersonDocuments;
}

export interface OnboardingFormState {
  personType: PersonType;
  basicData: BasicData;
  naturalPersonData: NaturalPersonData;
  legalPersonData: LegalPersonData;
  documents: DocumentState;
}

export type OnboardingStep = 1 | 2 | 3;

const emptyAddress: Address = {
  street: "",
  number: "",
  floor: "",
  city: "",
  province: "",
  postalCode: "",
};

export const TAX_CONDITIONS: { label: string; value: TaxCondition }[] = [
  { label: "Monotributista", value: "monotributista" },
  { label: "Responsable Inscripto", value: "responsable_inscripto" },
  { label: "Exento", value: "exento" },
  { label: "Consumidor Final", value: "consumidor_final" },
];

export const createEmptyOnboardingState = (): OnboardingFormState => ({
  personType: "PF",
  basicData: {
    cuit: "",
    fantasyName: "",
    contactEmail: "",
    phone: "",
    bankIdentifier: "",
    commercialAddress: { ...emptyAddress },
  },
  naturalPersonData: {
    fullName: "",
    address: { ...emptyAddress },
    birthDate: "",
    nationality: "",
    taxCondition: "monotributista",
    rentas: {
      inscripto: false,
      exento: false,
      convenioMultilateral: false,
    },
    isPep: false,
    pepReason: "",
  },
  legalPersonData: {
    businessName: "",
    address: { ...emptyAddress },
    companyCuit: "",
    taxCondition: "monotributista",
    representative: {
      fullName: "",
      dni: "",
      email: "",
      phone: "",
      cuit: "",
    },
    rentas: {
      inscripto: false,
      exento: false,
      convenioMultilateral: false,
    },
    isPep: false,
    pepReason: "",
  },
  documents: {
    natural: {
      dniFront: [],
      dniBack: [],
      cbu: [],
      afip: [],
      rentas: [],
    },
    legal: {
      dniRepresentativeFront: [],
      dniRepresentativeBack: [],
      companyCuit: [],
      companyCbu: [],
      bylaws: [],
      rentas: [],
    },
  },
});

export interface DraftOnboardingState {
  personType: PersonType;
  basicData: BasicData;
  naturalPersonData: NaturalPersonData;
  legalPersonData: LegalPersonData;
  step: OnboardingStep;
}

export interface SubmissionDocumentsMeta {
  natural: {
    dniFront: string[];
    dniBack: string[];
    cbu: string[];
    afip: string[];
    rentas: string[];
  };
  legal: {
    dniRepresentativeFront: string[];
    dniRepresentativeBack: string[];
    companyCuit: string[];
    companyCbu: string[];
    bylaws: string[];
    rentas: string[];
  };
}

export interface OnboardingSubmissionPayload {
  personType: PersonType;
  basicData: BasicData;
  naturalPersonData: NaturalPersonData;
  legalPersonData: LegalPersonData;
  documentsMeta: SubmissionDocumentsMeta;
}

export interface SubmittedOnboardingSummary {
  payload: OnboardingSubmissionPayload;
  submittedAt: Date;
}
