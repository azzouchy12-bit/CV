import { getSupabaseBrowserClient } from "@/lib/supabase-client";

type PreferenceKey = "preferred_language" | "preferred_theme";
type PreferenceValue = string;

export type ClientLanguage = "ar" | "fr" | "en";

export function getSavedClientLanguage(): ClientLanguage {
  const stored = window.localStorage.getItem("cvup_language");
  if (stored === "ar" || stored === "fr" || stored === "en") return stored;
  const browserLanguage = window.navigator.languages?.[0] || window.navigator.language || "en";
  const normalized = browserLanguage.toLowerCase();
  return normalized.startsWith("ar") ? "ar" : normalized.startsWith("fr") ? "fr" : "en";
}

/** Keep local settings available offline while saving them to the user's existing JSON profile field. */
export async function saveClientPreference(key: PreferenceKey, value: PreferenceValue) {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error: readError } = await supabase.from("profiles").select("id,profile_data").eq("id", user.id).maybeSingle();
    if (readError) return;
    const profileData = data?.profile_data && typeof data.profile_data === "object" && !Array.isArray(data.profile_data)
      ? data.profile_data as Record<string, unknown>
      : {};
    const preferences = profileData.preferences && typeof profileData.preferences === "object" && !Array.isArray(profileData.preferences)
      ? profileData.preferences as Record<string, unknown>
      : {};

    const nextData = { ...profileData, preferences: { ...preferences, [key]: value } };
    if (data) {
      await supabase.from("profiles").update({ profile_data: nextData, updated_at: new Date().toISOString() }).eq("id", user.id);
    } else {
      await supabase.from("profiles").insert({ id: user.id, profile_data: nextData, updated_at: new Date().toISOString() });
    }
  } catch {
    // Local storage remains the source of truth on this device if profile sync is unavailable.
  }
}
