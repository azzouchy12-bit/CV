type SpokenLanguageValue = {
  language?: unknown;
  language_other?: unknown;
  level?: unknown;
  level_other?: unknown;
};

export function hasAtLeastThreeDistinctSpokenLanguages(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 3) return false;

  const normalized = value.map((item) => {
    if (!item || typeof item !== "object") return null;
    const entry = item as SpokenLanguageValue;
    const language = typeof entry.language === "string" ? entry.language.trim() : "";
    const level = typeof entry.level === "string" ? entry.level.trim() : "";
    const customLanguage = typeof entry.language_other === "string" ? entry.language_other.trim() : "";
    const customLevel = typeof entry.level_other === "string" ? entry.level_other.trim() : "";
    if (!language || !level || (language === "Other" && !customLanguage) || (level === "Other" && !customLevel)) return null;
    return (language === "Other" ? customLanguage : language).toLocaleLowerCase();
  });

  const languages = normalized.filter((language): language is string => Boolean(language));
  return languages.length === value.length && new Set(languages).size >= 3;
}
