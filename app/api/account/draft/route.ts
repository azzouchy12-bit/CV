import { NextResponse } from "next/server";
import { getAuthenticatedAccountUser } from "@/lib/account-auth";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function GET() {
  const user = await getAuthenticatedAccountUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("profiles").select("profile_data").eq("id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load your draft." }, { status: 500 });
  const profileData = objectRecord(data?.profile_data);
  return NextResponse.json({ draft: profileData.client_request_draft || null }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedAccountUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const body = await request.json() as { draft?: unknown };
    const draft = objectRecord(body.draft);
    const draftForm = objectRecord(draft.form);
    const size = JSON.stringify(draft).length;
    if (size > 300_000 || !body.draft || Array.isArray(body.draft) || !Object.keys(draftForm).length || !Number.isInteger(draft.step) || Number(draft.step) < 1 || Number(draft.step) > 7) {
      return NextResponse.json({ error: "Draft data is invalid or too large." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: existing, error: readError } = await supabase.from("profiles").select("profile_data").eq("id", user.id).maybeSingle();
    if (readError) return NextResponse.json({ error: "Could not save your draft." }, { status: 500 });
    const profileData = existing ? objectRecord(existing.profile_data) : {};
    const savedDraft = { ...draft, saved_at: new Date().toISOString() };
    const write = existing ? supabase.from("profiles").update({
      profile_data: { ...profileData, client_request_draft: savedDraft },
      updated_at: new Date().toISOString(),
    }).eq("id", user.id) : supabase.from("profiles").upsert({ id: user.id, profile_data: { client_request_draft: savedDraft }, updated_at: new Date().toISOString() });
    const { error: writeError } = await write;
    if (writeError) return NextResponse.json({ error: "Could not save your draft." }, { status: 500 });
    return NextResponse.json({ success: true, saved_at: savedDraft.saved_at }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Draft data could not be saved." }, { status: 400 });
  }
}

export async function DELETE() {
  const user = await getAuthenticatedAccountUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const supabase = getSupabaseServerClient();
  const { data: existing, error: readError } = await supabase.from("profiles").select("profile_data").eq("id", user.id).maybeSingle();
  if (readError || !existing) return NextResponse.json({ error: "Could not clear your draft." }, { status: 500 });
  const profileData = objectRecord(existing.profile_data);
  const rest = { ...profileData };
  delete rest.client_request_draft;
  const { error } = await supabase.from("profiles").update({ profile_data: rest, updated_at: new Date().toISOString() }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Could not clear your draft." }, { status: 500 });
  return NextResponse.json({ success: true });
}
