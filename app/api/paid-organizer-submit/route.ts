import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

import {
  MAX_EMAIL_ATTACHMENT_BYTES,
  MAX_TOTAL_UPLOAD_BYTES,
  MAX_TOTAL_UPLOAD_LABEL,
  getBase64Size,
} from "@/lib/onboardingUploadLimits";
import type { OnboardingSubmissionPayload } from "@/types/onboarding";

const buildAddress = (
  address: OnboardingSubmissionPayload["basicData"]["commercialAddress"],
) =>
  `${address.street} ${address.number}${
    address.floor ? `, ${address.floor}` : ""
  } - ${address.city}, ${address.province} (${address.postalCode})`;

interface SubmissionMeta {
  ipAddress: string;
  channel: string;
  termsAcceptedAt?: string;
  userAgent: string;
}

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("true-client-ip") ??
    "-"
  );
};

const getUserAgent = (request: Request) =>
  request.headers.get("user-agent") ?? "-";

const buildMetadataHtml = (
  payload: OnboardingSubmissionPayload,
  meta: SubmissionMeta,
) => `
  <h2>Metadatos de la solicitud</h2>
  <ul>
    <li>Email declarado por el organizador: ${payload.basicData.contactEmail || "-"}</li>
    ${
      meta.termsAcceptedAt
        ? `<li>Fecha y hora de aceptacion de TyC: ${meta.termsAcceptedAt}</li>`
        : ""
    }
    <li>IP de origen del formulario: ${meta.ipAddress || "-"}</li>
    <li>Canal de envio: ${meta.channel}</li>
    <li>User-Agent: ${meta.userAgent || "-"}</li>
  </ul>
`;

const buildMetadataText = (
  payload: OnboardingSubmissionPayload,
  meta: SubmissionMeta,
) => {
  const lines = [
    "Metadatos de la solicitud",
    `Email declarado por el organizador: ${payload.basicData.contactEmail || "-"}`,
  ];
  if (meta.termsAcceptedAt) {
    lines.push(`Fecha y hora de aceptacion de TyC: ${meta.termsAcceptedAt}`);
  }
  lines.push(`IP de origen del formulario: ${meta.ipAddress || "-"}`);
  lines.push(`Canal de envio: ${meta.channel}`);
  lines.push(`User-Agent: ${meta.userAgent || "-"}`);
  return lines.join("\n");
};

const buildHtml = (
  payload: OnboardingSubmissionPayload,
  meta: SubmissionMeta,
) => `
  <h1>Nueva solicitud de alta organizador - eventos pagos</h1>
  ${buildMetadataHtml(payload, meta)}
  <h2>Datos basicos</h2>
  <ul>
    <li>Tipo de persona: ${
      payload.personType === "PF" ? "Persona Fisica" : "Persona Juridica"
    }</li>
    <li>CUIT principal: ${payload.basicData.cuit}</li>
    <li>Nombre de fantasia: ${payload.basicData.fantasyName}</li>
    <li>Email: ${payload.basicData.contactEmail}</li>
    <li>Telefono: ${payload.basicData.phone}</li>
    <li>Domicilio operativo: ${buildAddress(payload.basicData.commercialAddress)}</li>
    <li>CBU / CVU o Alias: ${payload.basicData.bankIdentifier}</li>
  </ul>
  <h2>Datos legales / fiscales</h2>
  ${
    payload.personType === "PF"
      ? `<ul>
          <li>Nombre completo: ${payload.naturalPersonData.fullName}</li>
          <li>Domicilio real: ${buildAddress(payload.naturalPersonData.address)}</li>
          <li>Fecha de nacimiento: ${payload.naturalPersonData.birthDate}</li>
          <li>Nacionalidad: ${payload.naturalPersonData.nationality}</li>
          <li>Condicion fiscal: ${payload.naturalPersonData.taxCondition}</li>
          <li>PEP: ${payload.naturalPersonData.isPep ? `Si - ${payload.naturalPersonData.pepReason || "sin detalle"}` : "No"}</li>
        </ul>`
      : `<ul>
          <li>Razon social: ${payload.legalPersonData.businessName}</li>
          <li>CUIT de la sociedad: ${payload.legalPersonData.companyCuit}</li>
          <li>Domicilio de la razon social: ${buildAddress(payload.legalPersonData.businessAddress)}</li>
          <li>Domicilio del representante legal: ${buildAddress(payload.legalPersonData.address)}</li>
          <li>Condicion fiscal: ${payload.legalPersonData.taxCondition}</li>
          <li>Representante: ${payload.legalPersonData.representative.fullName} (${payload.legalPersonData.representative.dni})</li>
          <li>PEP representante: ${payload.legalPersonData.isPep ? `Si - ${payload.legalPersonData.pepReason || "sin detalle"}` : "No"}</li>
        </ul>`
  }
`;

const buildText = (
  payload: OnboardingSubmissionPayload,
  meta: SubmissionMeta,
) => `
Nueva solicitud de alta organizador - eventos pagos

${buildMetadataText(payload, meta)}

Tipo de persona: ${payload.personType === "PF" ? "Persona Fisica" : "Persona Juridica"}
Nombre de fantasia: ${payload.basicData.fantasyName}
Email: ${payload.basicData.contactEmail}
Telefono: ${payload.basicData.phone}
Domicilio operativo: ${buildAddress(payload.basicData.commercialAddress)}
`;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const payloadRaw = formData.get("payload");

    if (!payloadRaw || typeof payloadRaw !== "string") {
      return NextResponse.json(
        { success: false, error: "Payload invalido" },
        { status: 400 },
      );
    }

    const payload = JSON.parse(payloadRaw) as OnboardingSubmissionPayload;
    let totalAttachmentBytes = 0;
    let totalEncodedBytes = 0;
    const attachments: {
      filename: string;
      content: string;
      encoding: "base64";
    }[] = [];

    for (const [key, value] of formData.entries()) {
      if (key === "payload") continue;
      if (value instanceof File) {
        const buffer = Buffer.from(await value.arrayBuffer());
        const size = buffer.length;
        const base64Size = getBase64Size(size);
        totalAttachmentBytes += size;
        totalEncodedBytes += base64Size;
        attachments.push({
          filename: value.name || `${key}.pdf`,
          content: buffer.toString("base64"),
          encoding: "base64",
        });
      }
    }

    if (
      totalAttachmentBytes > MAX_TOTAL_UPLOAD_BYTES ||
      totalEncodedBytes > MAX_EMAIL_ATTACHMENT_BYTES
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `La documentacion supera el tamano maximo (${MAX_TOTAL_UPLOAD_LABEL}). Reduce los archivos e intenta nuevamente.`,
        },
        { status: 400 },
      );
    }

    const host = process.env.EMAIL_SMTP_HOST;
    const port = process.env.EMAIL_SMTP_PORT;
    const user = process.env.EMAIL_SMTP_USER;
    const pass = process.env.EMAIL_SMTP_PASS ?? process.env.BREVO_API_KEY;
    const fromEmail = process.env.EMAIL_FROM ?? "no-responder@zocoaltas.com.ar";

    if (!host || !port || !user || !pass) {
      return NextResponse.json(
        {
          success: false,
          error: "Configuracion SMTP incompleta (host/port/user/pass)",
        },
        { status: 500 },
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    });

    const submissionMeta: SubmissionMeta = {
      ipAddress: getClientIp(request),
      channel: "Formulario organizadores pagos - Brevo",
      termsAcceptedAt: payload.termsAcceptedAt,
      userAgent: getUserAgent(request),
    };

    await transporter.sendMail({
      from: `Onboarding Zoco <${fromEmail}>`,
      to: "altas@zocoweb.com.ar",
      subject: `Alta organizador pagos - ${payload.basicData.fantasyName || "Nuevo organizador"}`,
      text: buildText(payload, submissionMeta),
      html: buildHtml(payload, submissionMeta),
      attachments,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error enviando solicitud a Brevo", error);
    return NextResponse.json(
      { success: false, error: "Error al enviar el email" },
      { status: 500 },
    );
  }
}
