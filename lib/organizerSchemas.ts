import { z } from "zod";

import { addressSchema, cuitSchema, phoneSchema } from "@/lib/schemas";
import type {
  OrganizerEntityData,
  OrganizerHumanData,
  OrganizerRepresentativeData,
  OrganizerType,
} from "@/types/organizerOnboarding";

const organizerTypeSchema = z.enum(["human", "legal_entity", "nonprofit"]);

const looseAddressSchema = z.object({
  street: z.string(),
  number: z.string(),
  floor: z.string().optional(),
  city: z.string(),
  province: z.string(),
  postalCode: z.string(),
});

const optionalCuitSchema = z
  .string()
  .trim()
  .refine((value) => !value || cuitSchema.safeParse(value).success, {
    message: "Ingresa un CUIT/CUIL valido",
  });

const pastDateSchema = (requiredMessage: string) =>
  z
    .string()
    .min(1, { message: requiredMessage })
    .refine((value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date <= new Date();
    }, "La fecha no puede ser futura");

const addNestedIssues = (
  ctx: z.RefinementCtx,
  prefix: string,
  result:
    | { success: true; data: unknown }
    | { success: false; error: z.ZodError<unknown> },
) => {
  if (result.success) return;

  result.error.issues.forEach((issue: z.ZodIssue) => {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: issue.message,
      path: [prefix, ...issue.path],
    });
  });
};

const humanIdentificationSchema = z.object({
  fullName: z.string().min(3, { message: "Ingresa el nombre completo" }),
  documentType: z.string().min(2, { message: "Ingresa el tipo de documento" }),
  documentNumber: z.string().min(7, { message: "Ingresa el numero de documento" }),
  cuitCuil: optionalCuitSchema,
  birthDate: pastDateSchema("Ingresa la fecha de nacimiento"),
  nationality: z.string().min(2, { message: "Ingresa la nacionalidad" }),
  maritalStatus: z.string().min(2, { message: "Ingresa el estado civil" }),
});

const entityIdentificationSchema = z.object({
  businessName: z.string().min(2, { message: "Ingresa la razon social" }),
  cuit: cuitSchema,
  constitutionDate: pastDateSchema("Ingresa la fecha de constitucion"),
  entityKind: z.string().min(2, { message: "Ingresa el tipo de entidad" }),
});

const humanContactSchema = z
  .object({
    realAddress: addressSchema,
    sameActivityAddress: z.boolean(),
    activityAddress: looseAddressSchema,
    email: z.string().email({ message: "Ingresa un email valido" }),
    phone: phoneSchema,
  })
  .superRefine((data, ctx) => {
    if (!data.sameActivityAddress) {
      addNestedIssues(ctx, "activityAddress", addressSchema.safeParse(data.activityAddress));
    }
  });

const representativeSchema = z.object({
  fullName: z.string().min(3, { message: "Ingresa el nombre y apellido" }),
  dni: z.string().min(7, { message: "Ingresa el DNI" }),
  cuitCuil: cuitSchema,
  birthDate: pastDateSchema("Ingresa la fecha de nacimiento"),
  role: z.string().min(2, { message: "Ingresa el cargo" }),
  address: addressSchema,
  email: z.string().email({ message: "Ingresa un email valido" }),
  phone: phoneSchema,
});

const entityDetailsSchema = z.object({
  legalAddress: addressSchema,
  operationalAddress: addressSchema,
  mainActivity: z.string().min(2, { message: "Ingresa la actividad principal" }),
  representative: representativeSchema,
});

const organizerHumanDataDraftSchema = z.object({
  fullName: z.string(),
  documentType: z.string(),
  documentNumber: z.string(),
  cuitCuil: z.string(),
  birthDate: z.string(),
  nationality: z.string(),
  maritalStatus: z.string(),
  realAddress: looseAddressSchema,
  sameActivityAddress: z.boolean(),
  activityAddress: looseAddressSchema,
  email: z.string(),
  phone: z.string(),
});

const organizerRepresentativeDraftSchema = z.object({
  fullName: z.string(),
  dni: z.string(),
  cuitCuil: z.string(),
  birthDate: z.string(),
  role: z.string(),
  address: looseAddressSchema,
  email: z.string(),
  phone: z.string(),
});

const organizerEntityDataDraftSchema = z.object({
  businessName: z.string(),
  cuit: z.string(),
  constitutionDate: z.string(),
  entityKind: z.string(),
  legalAddress: looseAddressSchema,
  operationalAddress: looseAddressSchema,
  mainActivity: z.string(),
  representative: organizerRepresentativeDraftSchema,
});

const organizerFormDraftSchema = z.object({
  organizerType: organizerTypeSchema,
  humanData: organizerHumanDataDraftSchema,
  entityData: organizerEntityDataDraftSchema,
});

export const organizerStepOneSchema = organizerFormDraftSchema.superRefine(
  (data, ctx) => {
    if (data.organizerType === "human") {
      addNestedIssues(ctx, "humanData", humanIdentificationSchema.safeParse(data.humanData));
      return;
    }

    addNestedIssues(ctx, "entityData", entityIdentificationSchema.safeParse(data.entityData));
  },
);

export const organizerStepTwoSchema = organizerFormDraftSchema.superRefine(
  (data, ctx) => {
    if (data.organizerType === "human") {
      addNestedIssues(ctx, "humanData", humanContactSchema.safeParse(data.humanData));
      return;
    }

    addNestedIssues(ctx, "entityData", entityDetailsSchema.safeParse(data.entityData));
  },
);

export type OrganizerStepOneValues = z.infer<typeof organizerStepOneSchema>;
export type OrganizerStepTwoValues = z.infer<typeof organizerStepTwoSchema>;

export const getOrganizerContactEmail = (
  organizerType: OrganizerType,
  humanData: OrganizerHumanData,
  entityData: OrganizerEntityData,
) =>
  organizerType === "human"
    ? humanData.email
    : entityData.representative.email;

export const getOrganizerContactPhone = (
  organizerType: OrganizerType,
  humanData: OrganizerHumanData,
  entityData: OrganizerEntityData,
) =>
  organizerType === "human"
    ? humanData.phone
    : entityData.representative.phone;

export const getOrganizerRepresentative = (
  entityData: OrganizerEntityData,
): OrganizerRepresentativeData => entityData.representative;
