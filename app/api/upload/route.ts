import { NextResponse } from "next/server";
import { verifyRequestSubmissionToken } from "@/lib/request-submission-token";
import { getSupabaseServerClient } from "@/lib/supabase";
import { isClientRequestEditable } from "@/lib/client-request-editability";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const primaryFileFields = {
  current_cv: {
    path: "current_cv_file_path",
    name: "current_cv_file_name",
    type: "current_cv_file_type",
  },
  job_description: {
    path: "job_description_file_path",
    name: "job_description_file_name",
    type: "job_description_file_type",
  },
  certifications: {
    path: "certifications_file_path",
    name: "certifications_file_name",
    type: "certifications_file_type",
  },
  template: {
    path: "cv_template_file_path",
    name: "cv_template_file_name",
    type: "cv_template_file_type",
  },
} as const;

type PrimaryKind = keyof typeof primaryFileFields;

type UploadDescriptor = {
  requestId?: string;
  kind?: string;
  token?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
};

type UploadCompletion = UploadDescriptor & {
  path?: string;
};

function safeFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 140) || "file";
}

function safeKindSegment(kind: string) {
  return kind.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80);
}

function resolveMimeType(fileName: string, suppliedType?: string) {
  const extension = fileName.toLowerCase().split(".").pop();
  const byExtension: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  const expectedType = extension ? byExtension[extension] : null;
  if (!expectedType || !allowedMimeTypes.has(expectedType)) return null;
  if (suppliedType && suppliedType !== "application/octet-stream" && suppliedType !== expectedType) return null;
  return expectedType;
}

function hasExpectedSignature(bytes: Uint8Array, contentType: string) {
  const startsWith = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (startsWith(0x4d, 0x5a) || startsWith(0x7f, 0x45, 0x4c, 0x46)) return false;
  switch (contentType) {
    case "application/pdf": return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": return startsWith(0x50, 0x4b, 0x03, 0x04);
    case "image/jpeg": return startsWith(0xff, 0xd8, 0xff);
    case "image/png": return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/webp": return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
    case "text/plain": return !bytes.slice(0, Math.min(bytes.length, 4096)).includes(0);
    default: return false;
  }
}

function validateKind(kind: string) {
  const isPrimary = kind in primaryFileFields;
  const isSupporting = kind.startsWith("supporting:");
  if (!isPrimary && !isSupporting) return null;

  const rawSegment = isSupporting ? kind.slice("supporting:".length) : kind;
  if (!rawSegment || !/^[a-zA-Z0-9_-]+$/.test(rawSegment)) return null;

  return { isPrimary, rawSegment };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UploadDescriptor;
    const requestId = String(body.requestId || "");
    const kind = String(body.kind || "");
    const submissionToken = String(body.token || "");
    const fileName = String(body.fileName || "");
    const fileSize = Number(body.fileSize || 0);

    if (!requestId || !kind || !submissionToken || !fileName) {
      return NextResponse.json({ error: "Missing upload information." }, { status: 400 });
    }

    const verified = await verifyRequestSubmissionToken(submissionToken);
    if (!verified || verified.requestId !== requestId) {
      return NextResponse.json({ error: "Invalid or expired upload token." }, { status: 401 });
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: `File must be between 1 byte and ${MAX_UPLOAD_SIZE_MB} MB.` }, { status: 400 });
    }

    const contentType = resolveMimeType(fileName, body.fileType);
    if (!contentType) {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
    }

    const kindInfo = validateKind(kind);
    if (!kindInfo) {
      return NextResponse.json({ error: "Invalid upload kind." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: requestRow } = await supabase.from("cv_requests")
      .select("status,payment_status")
      .eq("id", requestId)
      .eq("request_code", verified.requestCode)
      .maybeSingle();
    if (!requestRow || !isClientRequestEditable(requestRow)) {
      return NextResponse.json({ error: "Files cannot be changed after payment or processing begins." }, { status: 409 });
    }

    const storagePath = `requests/${requestId}/${safeKindSegment(kindInfo.rawSegment)}/${Date.now()}-${safeFileName(fileName)}`;

    const { data, error } = await supabase.storage
      .from("cvup-requests")
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (error || !data?.token) {
      return NextResponse.json({ error: "Could not prepare secure upload." }, { status: 500 });
    }

    return NextResponse.json(
      {
        path: storagePath,
        upload_token: data.token,
        content_type: contentType,
        file_name: fileName,
        is_primary: kindInfo.isPrimary,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Upload preparation error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Could not prepare upload." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as UploadCompletion;
    const requestId = String(body.requestId || "");
    const kind = String(body.kind || "");
    const submissionToken = String(body.token || "");
    const path = String(body.path || "");
    const fileName = String(body.fileName || "");

    if (!requestId || !kind || !submissionToken || !path || !fileName) {
      return NextResponse.json({ error: "Missing upload completion information." }, { status: 400 });
    }

    const verified = await verifyRequestSubmissionToken(submissionToken);
    if (!verified || verified.requestId !== requestId) {
      return NextResponse.json({ error: "Invalid or expired upload token." }, { status: 401 });
    }

    const kindInfo = validateKind(kind);
    if (!kindInfo) {
      return NextResponse.json({ error: "Invalid upload kind." }, { status: 400 });
    }

    const expectedPrefix = `requests/${requestId}/${safeKindSegment(kindInfo.rawSegment)}/`;
    if (!path.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: "Invalid storage path." }, { status: 400 });
    }

    const contentType = resolveMimeType(fileName, body.fileType);
    if (!contentType) {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: requestRow } = await supabase.from("cv_requests")
      .select("id,status,payment_status")
      .eq("id", requestId)
      .eq("request_code", verified.requestCode)
      .maybeSingle();
    if (!requestRow || !isClientRequestEditable(requestRow)) {
      return NextResponse.json({ error: "Files cannot be changed after payment or processing begins." }, { status: 409 });
    }
    const lastSlash = path.lastIndexOf("/");
    const folder = path.slice(0, lastSlash);
    const objectName = path.slice(lastSlash + 1);
    const { data: objectRows, error: listError } = await supabase.storage
      .from("cvup-requests")
      .list(folder, { search: objectName, limit: 10 });

    if (listError || !objectRows?.some((item) => item.name === objectName)) {
      return NextResponse.json({ error: "Uploaded file could not be verified." }, { status: 409 });
    }

    const uploadedObject = objectRows.find((item) => item.name === objectName);
    const objectSize = Number(uploadedObject?.metadata?.size);
    if (Number.isFinite(objectSize) && objectSize > MAX_UPLOAD_SIZE_BYTES) {
      await supabase.storage.from("cvup-requests").remove([path]);
      return NextResponse.json({ error: `File must not exceed ${MAX_UPLOAD_SIZE_MB} MB.` }, { status: 413 });
    }
    const { data: uploadedFile, error: downloadError } = await supabase.storage.from("cvup-requests").download(path);
    if (downloadError || !uploadedFile) {
      return NextResponse.json({ error: "Uploaded file could not be verified." }, { status: 409 });
    }
    if (uploadedFile.size > MAX_UPLOAD_SIZE_BYTES || !hasExpectedSignature(new Uint8Array(await uploadedFile.slice(0, 4096).arrayBuffer()), contentType)) {
      await supabase.storage.from("cvup-requests").remove([path]);
      return NextResponse.json({ error: uploadedFile.size > MAX_UPLOAD_SIZE_BYTES ? `File must not exceed ${MAX_UPLOAD_SIZE_MB} MB.` : "The file contents do not match the selected file type." }, { status: 415 });
    }

    if (!kindInfo.isPrimary) {
      return NextResponse.json({ success: true, path, file_name: fileName, file_type: contentType });
    }

    const fields = primaryFileFields[kind as PrimaryKind];
    const { data: updateData, error: updateError } = await supabase
      .from("cv_requests")
      .update({
        [fields.path]: path,
        [fields.name]: fileName.slice(0, 255),
        [fields.type]: contentType,
      })
      .eq("id", requestId)
      .eq("request_code", verified.requestCode)
      .in("status", ["NEW", "DRAFT", "PENDING"])
      .or("payment_status.neq.PAID,payment_status.is.null")
      .select("id")
      .maybeSingle();

    if (updateError || !updateData) {
      return NextResponse.json({ error: "The request changed state; file metadata was not saved." }, { status: 409 });
    }

    return NextResponse.json({ success: true, path, file_name: fileName, file_type: contentType });
  } catch (error) {
    console.error("Upload completion error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Could not finalize upload." }, { status: 500 });
  }
}
