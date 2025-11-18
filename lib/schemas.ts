import { z } from "zod";

import { isValidCuit, sanitizeCuitInput } from "@/lib/cuit";
import type { TaxCondition } from "@/types/onboarding";
import { TAX_CONDITIONS } from "@/types/onboarding";

const taxConditionValues = TAX_CONDITIONS.map(
  (item) => item.value,
) as [TaxCondition, ...TaxCondition[]];

const taxConditionSchema = z.enum(taxConditionValues);

const cuitSchema = z
  .string()
  .min(1, { message: "El CUIT es obligatorio" })
  .refine((value) => sanitizeCuitInput(value).length === 11, {
    message: "Debe tener 11 dígitos",
  })
  .refine((value) => isValidCuit(value), {
    message: "El CUIT no es válido",
  });

const phoneSchema = z
  .string()
  .min(1, { message: "El celular es obligatorio" })
  .refine((value) => value.replace(/\D/g, "").length >= 8, {
    message: "Ingresá un número válido",
  });

const bankIdentifierSchema = z
  .string()
  .min(4, { message: "Ingresá tu CBU, CVU o alias" })
  .refine((value) => {
    const numericOnly = value.replace(/\D/g, "");
    if (!numericOnly) return true;
    return numericOnly.length === 22;
  }, "Si ingresás un CBU/CVU debe tener 22 dígitos");

const addressSchema = z.object({
  street: z.string().min(2, { message: "Ingresá la calle" }),
  number: z.string().min(1, { message: "Ingresá la altura" }),
  floor: z.string().optional(),
  city: z.string().min(2, { message: "Ingresá la localidad" }),
  province: z.string().min(2, { message: "Ingresá la provincia" }),
  postalCode: z.string().min(3, { message: "Ingresá el código postal" }),
});

const checkboxBoolean = z.boolean().catch(false);

const rentasSchema = z.object({
  inscripto: checkboxBoolean,
  exento: checkboxBoolean,
  convenioMultilateral: checkboxBoolean,
});

export const basicStepSchema = z.object({
  personType: z.enum(["PF", "PJ"]),
  cuit: cuitSchema,
  fantasyName: z
    .string()
    .min(2, { message: "Ingresá al menos 2 caracteres" }),
  contactEmail: z
    .string()
    .email({ message: "Ingresá un email válido" }),
  phone: phoneSchema,
  bankIdentifier: bankIdentifierSchema,
  commercialAddress: addressSchema,
});

export const naturalPersonSchema = z.object({
  fullName: z
    .string()
    .min(3, { message: "Ingresá tu nombre completo" }),
  address: addressSchema,
  birthDate: z
    .string()
    .min(1, { message: "Ingresá la fecha de nacimiento" })
    .refine((value) => Boolean(value), {
      message: "Ingresá la fecha de nacimiento",
    })
    .refine((value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return false;
      return date <= new Date();
    }, "La fecha no puede ser futura"),
  nationality: z.string().min(3, { message: "Ingresá tu nacionalidad" }),
  taxCondition: taxConditionSchema,
  rentas: rentasSchema,
  isPep: checkboxBoolean,
  pepReason: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.isPep && (!data.pepReason || data.pepReason.trim().length < 5)) {
    ctx.addIssue({
      path: ["pepReason"],
      code: z.ZodIssueCode.custom,
      message: "Indicá el motivo si sos PEP",
    });
  }
});

export const legalPersonSchema = z.object({
  businessName: z
    .string()
    .min(2, { message: "Ingresá la razón social" }),
  address: addressSchema,
  companyCuit: cuitSchema,
  taxCondition: taxConditionSchema,
  representative: z.object({
    fullName: z
      .string()
      .min(3, { message: "Ingresá el nombre completo" }),
    dni: z.string().min(7, { message: "Ingresá el DNI" }),
    email: z.string().email({ message: "Ingresá un email válido" }),
    phone: phoneSchema,
    cuit: cuitSchema,
  }),
  rentas: rentasSchema,
  isPep: checkboxBoolean,
  pepReason: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.isPep && (!data.pepReason || data.pepReason.trim().length < 5)) {
    ctx.addIssue({
      path: ["pepReason"],
      code: z.ZodIssueCode.custom,
      message: "Indicá el motivo si el representante es PEP",
    });
  }
});

export type BasicStepValues = z.infer<typeof basicStepSchema>;
export type NaturalStepValues = z.infer<typeof naturalPersonSchema>;
export type LegalStepValues = z.infer<typeof legalPersonSchema>;
