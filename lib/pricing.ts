export const CVUP_BASE_PRICE_DZD = 800;
export const CVUP_ADDITIONAL_LANGUAGE_PRICE_DZD = 200;

export function calculateRequestPrice(languageCount: number) {
  const safeCount = Number.isFinite(languageCount) ? Math.max(1, Math.floor(languageCount)) : 1;
  return CVUP_BASE_PRICE_DZD + (safeCount - 1) * CVUP_ADDITIONAL_LANGUAGE_PRICE_DZD;
}
