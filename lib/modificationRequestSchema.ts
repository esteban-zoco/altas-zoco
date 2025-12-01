import { z } from "zod";

import {
  addressSchema,
  bankIdentifierSchema,
  cuitSchema,
  phoneSchema,
} from "@/lib/schemas";

const modificationTypeValues = ["fantasyName", "paymentAccount", "address"] as const;

const softAddressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  floor: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
});

export const modificationRequestSchema = z
  .object({
    cuit: cuitSchema,
    fantasyName: z
      .string()
      .min(2, { message: "Ingres\u00e1 el nombre de fantas\u00eda del comercio" }),
    contactEmail: z
      .string()
      .email({ message: "Ingres\u00e1 un email v\u00e1lido" }),
    contactPhone: phoneSchema,
    changeTypes: z
      .array(z.enum(modificationTypeValues))
      .nonempty({ message: "Eleg\u00ed qu\u00e9 informaci\u00f3n quer\u00e9s modificar" }),
    fantasyNameCurrent: z.string().optional(),
    fantasyNameNew: z.string().optional(),
    paymentCurrentIdentifier: z.string().optional(),
    paymentNewIdentifier: z.string().optional(),
    paymentHolderDocument: z.string().optional(),
    paymentHolderName: z.string().optional(),
    paymentNotes: z.string().optional(),
    addressStoreReference: z.string().optional(),
    addressCurrent: softAddressSchema.default({}),
    addressNew: softAddressSchema.default({}),
  })
  .superRefine((data, ctx) => {
    if (data.changeTypes.includes("fantasyName")) {
      if (!data.fantasyNameCurrent || data.fantasyNameCurrent.trim().length < 2) {
        ctx.addIssue({
          path: ["fantasyNameCurrent"],
          code: z.ZodIssueCode.custom,
          message: "Ingres\u00e1 el nombre actual",
        });
      }
      if (!data.fantasyNameNew || data.fantasyNameNew.trim().length < 2) {
        ctx.addIssue({
          path: ["fantasyNameNew"],
          code: z.ZodIssueCode.custom,
          message: "Ingres\u00e1 el nuevo nombre de fantas\u00eda",
        });
      }
    }

    if (data.changeTypes.includes("paymentAccount")) {
      if (!data.paymentNewIdentifier || data.paymentNewIdentifier.trim().length < 4) {
        ctx.addIssue({
          path: ["paymentNewIdentifier"],
          code: z.ZodIssueCode.custom,
          message: "Compart\u00ed el nuevo alias o CBU/CVU",
        });
      } else if (!bankIdentifierSchema.safeParse(data.paymentNewIdentifier).success) {
        ctx.addIssue({
          path: ["paymentNewIdentifier"],
          code: z.ZodIssueCode.custom,
          message: "Si ingres\u00e1s un CBU/CVU debe tener 22 d\u00edgitos",
        });
      }
      if (!data.paymentHolderDocument || data.paymentHolderDocument.trim().length < 7) {
        ctx.addIssue({
          path: ["paymentHolderDocument"],
          code: z.ZodIssueCode.custom,
          message: "Indic\u00e1 el CUIT o DNI del titular",
        });
      }
      if (!data.paymentHolderName || data.paymentHolderName.trim().length < 3) {
        ctx.addIssue({
          path: ["paymentHolderName"],
          code: z.ZodIssueCode.custom,
          message: "Complet\u00e1 el nombre o raz\u00f3n social del titular",
        });
      }
    }

    if (data.changeTypes.includes("address")) {
      if (!data.addressStoreReference || data.addressStoreReference.trim().length < 3) {
        ctx.addIssue({
          path: ["addressStoreReference"],
          code: z.ZodIssueCode.custom,
          message: "Contanos qu\u00e9 sucursal o local est\u00e1s actualizando",
        });
      }
      const validateAddress = (
        address: z.infer<typeof softAddressSchema>,
        pathPrefix: "addressCurrent" | "addressNew",
      ) => {
        const parsed = addressSchema.safeParse({
          street: address.street ?? "",
          number: address.number ?? "",
          floor: address.floor ?? "",
          city: address.city ?? "",
          province: address.province ?? "",
          postalCode: address.postalCode ?? "",
        });
        if (!parsed.success) {
          parsed.error.issues.forEach((issue) =>
            ctx.addIssue({
              path: [pathPrefix, ...(issue.path as (string | number)[])],
              code: z.ZodIssueCode.custom,
              message: issue.message,
            }),
          );
        }
      };

      validateAddress(data.addressCurrent, "addressCurrent");
      validateAddress(data.addressNew, "addressNew");
    }
  });

export type ModificationRequestValues = z.infer<typeof modificationRequestSchema>;
export type ModificationType = (typeof modificationTypeValues)[number];
