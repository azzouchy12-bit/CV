import { NextResponse } from "next/server";
import { getAuthenticatedAccountUser } from "@/lib/account-auth";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RecordValue = Record<string, unknown>;
const asRecord = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const stringValue = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 12_000) : "";

export async function GET() {
  const user = await getAuthenticatedAccountUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data, error } = await getSupabaseServerClient().from("profiles").select("full_name_latin,full_name_arabic,phone,email,current_country,nationality,professional_field,target_role,tools,spoken_languages,certifications_text,profile_data").eq("id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load your profile." }, { status: 500 });
  return NextResponse.json({ profile: data, email: user.email ?? "", providers: Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [user.app_metadata?.provider].filter(Boolean) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedAccountUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const body = asRecord(await request.json());
    const profile = asRecord(body.profile);
    const supabase = getSupabaseServerClient();
    const { data: existing, error: readError } = await supabase.from("profiles").select("profile_data").eq("id", user.id).maybeSingle();
    if (readError) return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
    const oldData = asRecord(existing?.profile_data);
    const oldProfessional = asRecord(oldData.professional_profile);
    const oldPersonal = asRecord(oldData.personal_profile);
    const professional = {
      ...oldProfessional,
      experience: stringValue(profile.professional_experience),
      education: stringValue(profile.education),
      projects: stringValue(profile.projects),
      skills: stringValue(profile.skills),
      achievements: stringValue(profile.achievements),
      tools_text: stringValue(profile.tools_text),
    };
    const personal = {
      ...oldPersonal,
      gender: stringValue(profile.gender),
      date_of_birth: stringValue(profile.date_of_birth),
      include_gender_in_cv: profile.include_gender_in_cv === true,
      include_date_of_birth_in_cv: profile.include_date_of_birth_in_cv === true,
    };
    const updates = {
      id: user.id,
      full_name_latin: stringValue(profile.full_name_latin),
      full_name_arabic: stringValue(profile.full_name_arabic),
      phone: stringValue(profile.phone),
      current_country: stringValue(profile.current_country),
      nationality: stringValue(profile.nationality),
      professional_field: stringValue(profile.professional_field),
      target_role: stringValue(profile.target_role),
      tools: stringValue(profile.tools_text).split(/[\n,،]+/).map((item) => item.trim()).filter(Boolean),
      certifications_text: stringValue(profile.certifications),
      spoken_languages: Array.isArray(profile.spoken_languages) ? profile.spoken_languages.slice(0, 20).map((entry) => {
        const item = asRecord(entry);
        return { language: stringValue(item.language).slice(0, 100), language_other: stringValue(item.language_other).slice(0, 100), level: stringValue(item.level).slice(0, 60), level_other: stringValue(item.level_other).slice(0, 60), professional_writing: item.professional_writing === true };
      }).filter((entry) => entry.language && entry.level) : [],
      profile_data: { ...oldData, professional_profile: professional, personal_profile: personal },
      updated_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabase.from("profiles").update(updates).eq("id", user.id)
      : await supabase.from("profiles").insert(updates);
    if (error) return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not save your profile." }, { status: 400 });
  }
}
