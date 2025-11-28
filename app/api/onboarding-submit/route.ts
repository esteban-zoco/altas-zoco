import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

import type { OnboardingSubmissionPayload } from "@/types/onboarding";

const buildAddress = (
  address: OnboardingSubmissionPayload["basicData"]["commercialAddress"],
) =>
  `${address.street} ${address.number}${
    address.floor ? `, ${address.floor}` : ""
  } - ${address.city}, ${address.province} (${address.postalCode})`;

const buildHtml = (payload: OnboardingSubmissionPayload) => `
  <h1>Nueva solicitud de alta Zoco</h1>
  <h2>Datos básicos</h2>
  <ul>
    <li>Tipo de persona: ${
      payload.personType === "PF" ? "Persona Física" : "Persona Jurídica"
    }</li>
    <li>CUIT principal: ${payload.basicData.cuit}</li>
    <li>Nombre de fantasía: ${payload.basicData.fantasyName}</li>
    <li>Email: ${payload.basicData.contactEmail}</li>
    <li>Teléfono: ${payload.basicData.phone}</li>
    <li>Domicilio del comercio: ${buildAddress(payload.basicData.commercialAddress)}</li>
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
          <li>Condición fiscal: ${payload.naturalPersonData.taxCondition}</li>
          <li>PEP: ${payload.naturalPersonData.isPep ? `Sí - ${payload.naturalPersonData.pepReason || "sin detalle"}` : "No"}</li>
        </ul>`
      : `<ul>
          <li>Razón social: ${payload.legalPersonData.businessName}</li>
          <li>CUIT de la sociedad: ${payload.legalPersonData.companyCuit}</li>
          <li>Domicilio legal: ${buildAddress(payload.legalPersonData.address)}</li>
          <li>Condición fiscal: ${payload.legalPersonData.taxCondition}</li>
          <li>Representante: ${payload.legalPersonData.representative.fullName} (${payload.legalPersonData.representative.dni})</li>
          <li>PEP representante: ${payload.legalPersonData.isPep ? `Sí - ${payload.legalPersonData.pepReason || "sin detalle"}` : "No"}</li>
        </ul>`
  }
  <h2>Documentación adjunta</h2>
  <p>
    Persona Física:<br/>
    DNI frente: ${payload.documentsMeta.natural.dniFront.join(", ") || "sin archivos"}<br/>
    DNI dorso: ${payload.documentsMeta.natural.dniBack.join(", ") || "sin archivos"}<br/>
    Constancia CBU: ${payload.documentsMeta.natural.cbu.join(", ") || "sin archivos"}<br/>
    AFIP: ${payload.documentsMeta.natural.afip.join(", ") || "sin archivos"}<br/>
    Rentas: ${payload.documentsMeta.natural.rentas.join(", ") || "pendiente"}
  </p>
  <p>
    Persona Jurídica:<br/>
    DNI representante (frente): ${
      payload.documentsMeta.legal.dniRepresentativeFront.join(", ") ||
      "sin archivos"
    }<br/>
    DNI representante (dorso): ${
      payload.documentsMeta.legal.dniRepresentativeBack.join(", ") ||
      "sin archivos"
    }<br/>
    Constancia CUIT: ${
      payload.documentsMeta.legal.companyCuit.join(", ") || "sin archivos"
    }<br/>
    Constancia CBU: ${
      payload.documentsMeta.legal.companyCbu.join(", ") || "sin archivos"
    }<br/>
    Contrato / estatuto: ${
      payload.documentsMeta.legal.bylaws.join(", ") || "sin archivos"
    }<br/>
    Rentas: ${
      payload.documentsMeta.legal.rentas.join(", ") || "sin archivos"
    }
  </p>
`;

const buildText = (payload: OnboardingSubmissionPayload) => `
Nueva solicitud de alta Zoco

Tipo de persona: ${payload.personType === "PF" ? "Persona Física" : "Persona Jurídica"}
Nombre de fantasía: ${payload.basicData.fantasyName}
Email: ${payload.basicData.contactEmail}
Teléfono: ${payload.basicData.phone}
Domicilio del comercio: ${buildAddress(payload.basicData.commercialAddress)}

Datos legales:
${
  payload.personType === "PF"
    ? `Nombre completo: ${payload.naturalPersonData.fullName}
Domicilio real: ${buildAddress(payload.naturalPersonData.address)}
Nacionalidad: ${payload.naturalPersonData.nationality}
PEP: ${payload.naturalPersonData.isPep ? `Sí - ${payload.naturalPersonData.pepReason}` : "No"}`
    : `Razón social: ${payload.legalPersonData.businessName}
Domicilio legal: ${buildAddress(payload.legalPersonData.address)}
Representante: ${payload.legalPersonData.representative.fullName}
Representante PEP: ${payload.legalPersonData.isPep ? `Sí - ${payload.legalPersonData.pepReason}` : "No"}`
}
`;

const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB Brevo SMTP limit

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const payloadRaw = formData.get("payload");

    if (!payloadRaw || typeof payloadRaw !== "string") {
      return NextResponse.json(
        { success: false, error: "Payload inválido" },
        { status: 400 },
      );
    }

    const payload = JSON.parse(payloadRaw) as OnboardingSubmissionPayload;
    let totalAttachmentBytes = 0;
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
        totalAttachmentBytes += size;
        attachments.push({
          filename: value.name || `${key}.pdf`,
          content: buffer.toString("base64"),
          encoding: "base64",
        });
      }
    }
    if (totalAttachmentBytes > MAX_ATTACHMENT_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La documentación supera el tamaño máximo (20MB). Reducí los archivos e intentá nuevamente.",
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
          error: "Configuración SMTP incompleta (host/port/user/pass)",
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

    await transporter.sendMail({
      from: `Onboarding Zoco <${fromEmail}>`,
      to: "altas@zocoweb.com.ar",
      subject: `Alta - ${payload.basicData.fantasyName || "Nuevo comercio"}`,
      text: buildText(payload),
      html: buildHtml(payload),
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
