import { NextResponse } from "next/server";
import { verifyRequestSubmissionToken } from "@/lib/request-submission-token";
import { getSupabaseServerClient } from "@/lib/supabase";
import { editableClientRequestStatuses, isClientRequestEditable } from "@/lib/client-request-editability";

type SupportingMaterial = {
  question_key: string;
  link?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  file_type?: string | null;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ requestCode: string }> }) {
  const { requestCode } = await params;
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const verified = await verifyRequestSubmissionToken(token);

  if (!verified || verified.requestCode !== requestCode) {
    return NextResponse.json({ error: "Invalid or expired request token." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { materials?: SupportingMaterial[] } | null;

  if (!Array.isArray(body?.materials)) {
    return NextResponse.json({ error: "Invalid supporting materials payload." }, { status: 400 });
  }

  const cleaned = body.materials
    .filter((item) => item && typeof item.question_key === "string")
    .slice(0, 100)
    .map((item) => {
      let link: string | null = null;
      if (typeof item.link === "string" && item.link.trim()) {
        try {
          const url = new URL(item.link.trim());
          if (url.protocol === "http:" || url.protocol === "https:") link = url.toString().slice(0, 2000);
        } catch {
          link = null;
        }
      }

      const questionKey = item.question_key.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
      const filePath = typeof item.file_path === "string" && item.file_path
        ? item.file_path.slice(0, 1000)
        : null;

      const expectedPrefix = `requests/${verified.requestId}/`;
      return {
        question_key: questionKey,
        link,
        file_path: filePath?.startsWith(expectedPrefix) ? filePath : null,
        file_name: typeof item.file_name === "string" && item.file_name ? item.file_name.slice(0, 255) : null,
        file_type: typeof item.file_type === "string" && item.file_type ? item.file_type.slice(0, 150) : null,
      };
    })
    .filter((item) => item.question_key);

  const supabase = getSupabaseServerClient();
  const { data: existing, error: readError } = await supabase
    .from("cv_requests")
    .select("id,status,payment_status,supporting_materials")
    .eq("id", verified.requestId)
    .eq("request_code", requestCode)
    .maybeSingle();

  if (readError || !existing || !isClientRequestEditable(existing)) {
    return NextResponse.json({ error: "Supporting files cannot be changed after payment or processing begins." }, { status: 409 });
  }

  // The edit form only submits newly entered links/files. Keep previously saved
  // files that were not replaced so editing text never silently drops evidence.
  const previous = Array.isArray(existing.supporting_materials) ? existing.supporting_materials as SupportingMaterial[] : [];
  const nextMaterials = [...cleaned];
  const incomingPaths = new Set(cleaned.map((item) => item.file_path).filter((path): path is string => Boolean(path)));
  const incomingLinks = new Set(cleaned.map((item) => item.link).filter((link): link is string => Boolean(link)));
  for (const item of previous) {
    if (!item || typeof item.question_key !== "string") continue;
    if (item.file_path && item.file_path.startsWith(`requests/${verified.requestId}/`) && !incomingPaths.has(item.file_path)) {
      nextMaterials.push({
        question_key: item.question_key,
        link: item.link || null,
        file_path: item.file_path,
        file_name: item.file_name || null,
        file_type: item.file_type || null,
      });
    } else if (item.link && !incomingLinks.has(item.link)) {
      nextMaterials.push({
        question_key: item.question_key,
        link: item.link,
        file_path: item.file_path || null,
        file_name: item.file_name || null,
        file_type: item.file_type || null,
      });
    }
  }

  const { data, error } = await supabase
    .from("cv_requests")
    .update({ supporting_materials: nextMaterials })
    .eq("id", verified.requestId)
    .eq("request_code", requestCode)
    .in("status", editableClientRequestStatuses())
    .or("payment_status.neq.PAID,payment_status.is.null")
    .select("supporting_materials")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "The request changed state; supporting materials were not saved." }, { status: 409 });
  }

  return NextResponse.json({ success: true, supporting_materials: data.supporting_materials });
}
