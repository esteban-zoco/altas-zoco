import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

import {
  MAX_EMAIL_ATTACHMENT_BYTES,
  MAX_TOTAL_UPLOAD_BYTES,
  MAX_TOTAL_UPLOAD_LABEL,
  getBase64Size,
} from "@/lib/onboardingUploadLimits";
import {
  getOrganizerContactEmail,
  getOrganizerContactPhone,
} from "@/lib/organizerSchemas";
import type { OrganizerSubmissionPayload } from "@/types/organizerOnboarding";

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

const buildAddress = (address: OrganizerSubmissionPayload["humanData"]["realAddress"]) =>
  `${address.street} ${address.number}${
    address.floor ? `, ${address.floor}` : ""
  } - ${address.city}, ${address.province} (${address.postalCode})`;

const getOrganizerTypeLabel = (
  organizerType: OrganizerSubmissionPayload["organizerType"],
) => {
  if (organizerType === "human") return "Persona humana";
  if (organizerType === "nonprofit") return "Organizacion sin fines de lucro";
  return "Persona juridica";
};

const getRequestTitle = (payload: OrganizerSubmissionPayload) =>
  payload.organizerType === "human"
    ? payload.humanData.fullName || "Organizador"
    : payload.entityData.businessName || "Entidad organizadora";

const buildMetadataHtml = (
  payload: OrganizerSubmissionPayload,
  meta: SubmissionMeta,
) => {
  const email = getOrganizerContactEmail(
    payload.organizerType,
    payload.humanData,
    payload.entityData,
  );
  const phone = getOrganizerContactPhone(
    payload.organizerType,
    payload.humanData,
    payload.entityData,
  );

  return `
    <h2>Metadatos de la solicitud</h2>
    <ul>
      <li>Email de contacto: ${email || "-"}</li>
      <li>Telefono de contacto: ${phone || "-"}</li>
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
};

const buildHtml = (
  payload: OrganizerSubmissionPayload,
  meta: SubmissionMeta,
) => `
  <h1>Nueva ficha de alta de organizador</h1>
  ${buildMetadataHtml(payload, meta)}
  <h2>Tipo de organizador</h2>
  <p>${getOrganizerTypeLabel(payload.organizerType)}</p>
  ${
    payload.organizerType === "human"
      ? `
        <h2>Datos de identificacion</h2>
        <ul>
          <li>Nombre y apellido: ${payload.humanData.fullName}</li>
          <li>Documento: ${payload.humanData.documentType} ${payload.humanData.documentNumber}</li>
          <li>CUIT/CUIL: ${payload.humanData.cuitCuil || "-"}</li>
          <li>Fecha de nacimiento: ${payload.humanData.birthDate}</li>
          <li>Nacionalidad: ${payload.humanData.nationality}</li>
          <li>Estado civil: ${payload.humanData.maritalStatus}</li>
          <li>Domicilio real: ${buildAddress(payload.humanData.realAddress)}</li>
          <li>Domicilio declarado para la actividad: ${
            payload.humanData.sameActivityAddress
              ? "Igual al domicilio real"
              : buildAddress(payload.humanData.activityAddress)
          }</li>
          <li>Email: ${payload.humanData.email}</li>
          <li>Telefono: ${payload.humanData.phone}</li>
        </ul>
      `
      : `
        <h2>Datos de la entidad</h2>
        <ul>
          <li>Razon social: ${payload.entityData.businessName}</li>
          <li>CUIT: ${payload.entityData.cuit}</li>
          <li>Fecha de constitucion: ${payload.entityData.constitutionDate}</li>
          <li>Tipo de entidad: ${payload.entityData.entityKind}</li>
          <li>Domicilio legal: ${buildAddress(payload.entityData.legalAddress)}</li>
          <li>Domicilio operativo: ${buildAddress(payload.entityData.operationalAddress)}</li>
          <li>Actividad principal: ${payload.entityData.mainActivity}</li>
        </ul>
        <h2>Representante legal / apoderado</h2>
        <ul>
          <li>Nombre y apellido: ${payload.entityData.representative.fullName}</li>
          <li>DNI: ${payload.entityData.representative.dni}</li>
          <li>CUIT/CUIL: ${payload.entityData.representative.cuitCuil}</li>
          <li>Fecha de nacimiento: ${payload.entityData.representative.birthDate}</li>
          <li>Cargo: ${payload.entityData.representative.role}</li>
          <li>Domicilio: ${buildAddress(payload.entityData.representative.address)}</li>
          <li>Email: ${payload.entityData.representative.email}</li>
          <li>Telefono: ${payload.entityData.representative.phone}</li>
        </ul>
      `
  }
  <h2>Documentacion adjunta</h2>
  <ul>
    <li>DNI frente: ${payload.documentsMeta.applicantDniFront.join(", ") || "sin archivos"}</li>
    <li>DNI dorso: ${payload.documentsMeta.applicantDniBack.join(", ") || "sin archivos"}</li>
    <li>Constancia CUIT/CUIL: ${payload.documentsMeta.cuitProof.join(", ") || "sin archivos"}</li>
    <li>Estatuto / contrato social: ${payload.documentsMeta.bylaws.join(", ") || "sin archivos"}</li>
    <li>Poder del representante: ${payload.documentsMeta.representativePower.join(", ") || "sin archivos"}</li>
    <li>Constancia de domicilio real: ${payload.documentsMeta.realAddressProof.join(", ") || "sin archivos"}</li>
  </ul>
`;

const buildText = (
  payload: OrganizerSubmissionPayload,
  meta: SubmissionMeta,
) => {
  const email = getOrganizerContactEmail(
    payload.organizerType,
    payload.humanData,
    payload.entityData,
  );
  const phone = getOrganizerContactPhone(
    payload.organizerType,
    payload.humanData,
    payload.entityData,
  );

  return `
Nueva ficha de alta de organizador

Tipo de organizador: ${getOrganizerTypeLabel(payload.organizerType)}
Nombre de referencia: ${getRequestTitle(payload)}
Email de contacto: ${email || "-"}
Telefono de contacto: ${phone || "-"}
Fecha de aceptacion de TyC: ${meta.termsAcceptedAt || "-"}
IP: ${meta.ipAddress || "-"}
Canal: ${meta.channel}
User-Agent: ${meta.userAgent || "-"}
`;
};

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

    const payload = JSON.parse(payloadRaw) as OrganizerSubmissionPayload;
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
      channel: "Formulario organizadores - Brevo",
      termsAcceptedAt: payload.termsAcceptedAt,
      userAgent: getUserAgent(request),
    };

    await transporter.sendMail({
      from: `Onboarding Zoco <${fromEmail}>`,
      to: "altas@zocoweb.com.ar",
      subject: `Alta organizador - ${getRequestTitle(payload)}`,
      text: buildText(payload, submissionMeta),
      html: buildHtml(payload, submissionMeta),
      attachments,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error enviando ficha de organizador", error);
    return NextResponse.json(
      { success: false, error: "Error al enviar el email" },
      { status: 500 },
    );
  }
}
