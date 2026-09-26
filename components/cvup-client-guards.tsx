"use client";

import { useEffect } from "react";

type LanguageCode = "ar" | "fr" | "en";

const latinNamePattern = /^[A-Za-zÀ-ÖØ-öø-ÿ' .-]{2,160}$/;
const arabicNamePattern = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF' .-]{2,160}$/;

const messages = {
  ar: {
    latinLabel: "الاسم واللقب بالأحرف اللاتينية",
    latinPlaceholder: "مثال: Seif Eddine Charef",
    latinHint: "اكتب الاسم واللقب بالأحرف اللاتينية كما تريد أن يظهرا في السيرة الذاتية. هذا الحقل إجباري.",
    latinError: "يرجى كتابة الاسم واللقب بالأحرف اللاتينية فقط.",
    arabicLabel: "الاسم واللقب باللغة العربية",
    arabicPlaceholder: "مثال: سيف الدين شارف",
    arabicHint: "اكتب اسمك ولقبك بالعربية كما تريد أن يظهر في ملفك عند الحاجة. هذا الحقل إجباري.",
    arabicError: "يرجى كتابة الاسم واللقب باللغة العربية فقط.",
    editPolicy:
      "ملاحظة مهمة: بعد إرسال الطلب، أي تعديل على البيانات أو الملفات خلال أول 24 ساعة يُحسب بنسبة 50% من السعر الأصلي. يرجى مراجعة كل المعلومات والملفات بعناية قبل التأكيد والإرسال.",
  },
  fr: {
    latinLabel: "Nom complet en caractères latins",
    latinPlaceholder: "Exemple : Seif Eddine Charef",
    latinHint:
      "Obligatoire : écrivez votre nom et prénom en caractères latins, exactement comme vous souhaitez les voir apparaître sur votre CV.",
    latinError: "Veuillez saisir le nom et le prénom uniquement en caractères latins.",
    arabicLabel: "Nom complet en arabe",
    arabicPlaceholder: "Exemple : سيف الدين شارف",
    arabicHint: "Obligatoire : ajoutez aussi votre nom et prénom en arabe pour éviter toute erreur d’identification.",
    arabicError: "Veuillez saisir le nom et le prénom en arabe.",
    editPolicy:
      "Note importante : après l’envoi de la demande, toute modification des informations ou des fichiers pendant les premières 24 heures sera facturée à 50 % du prix initial. Merci de vérifier soigneusement vos données avant la confirmation.",
  },
  en: {
    latinLabel: "Full name in Latin characters",
    latinPlaceholder: "Example: Seif Eddine Charef",
    latinHint:
      "Required: enter your first and last name in Latin characters, exactly as they should appear on the CV.",
    latinError: "Please enter your first and last name using Latin characters only.",
    arabicLabel: "Full name in Arabic",
    arabicPlaceholder: "Example: سيف الدين شارف",
    arabicHint: "Required: add your first and last name in Arabic as well to avoid identification mistakes.",
    arabicError: "Please enter your first and last name in Arabic.",
    editPolicy:
      "Important note: after submitting the request, any change to the information or files during the first 24 hours will be billed at 50% of the original price. Please review everything carefully before confirming and submitting.",
  },
};

function getCurrentLanguage(): LanguageCode {
  const active = document.querySelector(".language-button--active")?.textContent?.trim().toLowerCase() || "";
  if (active.includes("العربية")) return "ar";
  if (active.includes("english")) return "en";
  return "fr";
}

function findFullNameInput(): HTMLInputElement | null {
  const labelMarkers = ["الاسم الكامل", "nom", "full name"];
  const labels = Array.from(document.querySelectorAll("label"));

  for (const label of labels) {
    if (label.querySelector("[data-cvup-arabic-name]")) continue;
    const text = label.textContent?.trim().toLowerCase() || "";
    if (labelMarkers.some((marker) => text.includes(marker))) {
      const input = label.querySelector("input");
      if (input instanceof HTMLInputElement) return input;
    }
  }

  const firstVisibleRequired = Array.from(document.querySelectorAll("input[required]")).find((input) => {
    if (!(input instanceof HTMLInputElement)) return false;
    return input.offsetParent !== null && input.type !== "tel" && input.type !== "email";
  });

  return firstVisibleRequired instanceof HTMLInputElement ? firstVisibleRequired : null;
}

function updateLabelTitle(label: HTMLLabelElement | null, title: string) {
  if (!label) return;
  const titleElement = label.querySelector("span");
  if (titleElement) titleElement.textContent = title;
}

function ensureFullNameLatinRequirement(language: LanguageCode) {
  const input = findFullNameInput();
  if (!input) return;

  input.required = true;
  input.autocomplete = "name";
  input.setAttribute("inputmode", "text");
  input.setAttribute("data-cvup-latin-name", "true");
  input.placeholder = messages[language].latinPlaceholder;

  const validate = () => {
    const value = input.value.trim();
    window.sessionStorage.setItem("cvup_last_full_name", value);
    input.setCustomValidity(value && !latinNamePattern.test(value) ? messages[language].latinError : "");
  };

  input.oninput = validate;
  validate();

  const label = input.closest("label");
  updateLabelTitle(label, messages[language].latinLabel);

  if (label && !label.querySelector("[data-cvup-latin-hint]")) {
    const hint = document.createElement("p");
    hint.dataset.cvupLatinHint = "true";
    hint.className = "mt-2 text-xs leading-5 text-slate-500";
    hint.textContent = messages[language].latinHint;
    label.appendChild(hint);
  } else {
    const hint = label?.querySelector<HTMLElement>("[data-cvup-latin-hint]");
    if (hint) hint.textContent = messages[language].latinHint;
  }
}

function ensureArabicNameField(language: LanguageCode) {
  const latinInput = findFullNameInput();
  const latinLabel = latinInput?.closest("label");
  const latinParent = latinLabel?.parentElement;
  if (!latinLabel || !latinParent) return;

  let wrapper = document.querySelector<HTMLLabelElement>("[data-cvup-arabic-name-wrapper]");
  if (!wrapper) {
    wrapper = document.createElement("label");
    wrapper.dataset.cvupArabicNameWrapper = "true";
    wrapper.className = "block";
    wrapper.innerHTML = `
      <span class="mb-2 block text-sm font-medium text-slate-700" data-cvup-arabic-name-label></span>
      <input data-cvup-arabic-name name="full_name_arabic" type="text" required dir="rtl" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500" />
      <p class="mt-2 text-xs leading-5 text-slate-500" data-cvup-arabic-name-hint></p>
    `;
    latinParent.insertBefore(wrapper, latinLabel.nextSibling);
  }

  const title = wrapper.querySelector<HTMLElement>("[data-cvup-arabic-name-label]");
  const input = wrapper.querySelector<HTMLInputElement>("[data-cvup-arabic-name]");
  const hint = wrapper.querySelector<HTMLElement>("[data-cvup-arabic-name-hint]");
  if (!input) return;

  if (title) title.textContent = messages[language].arabicLabel;
  if (hint) hint.textContent = messages[language].arabicHint;
  input.placeholder = messages[language].arabicPlaceholder;
  input.required = true;
  input.autocomplete = "name";

  const saved = window.sessionStorage.getItem("cvup_last_full_name_arabic") || "";
  if (!input.value && saved) input.value = saved;

  const validate = () => {
    const value = input.value.trim();
    window.sessionStorage.setItem("cvup_last_full_name_arabic", value);
    input.setCustomValidity(value && !arabicNamePattern.test(value) ? messages[language].arabicError : "");
  };

  input.oninput = validate;
  validate();
}

function validationMessage(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, language: LanguageCode) {
  if (field.validity.customError) return field.validationMessage;
  if (field.validity.valueMissing) return language === "ar" ? "هذا الحقل إجباري. يرجى إكماله للمتابعة." : language === "fr" ? "Ce champ est obligatoire. Veuillez le compléter pour continuer." : "This field is required. Please complete it to continue.";
  if (field.validity.typeMismatch) return language === "ar" ? "القيمة المدخلة غير صحيحة. يرجى التحقق من الصيغة." : language === "fr" ? "La valeur saisie n’est pas valide. Vérifiez le format." : "The value entered is not valid. Please check the format.";
  if (field.validity.tooShort) return language === "ar" ? "القيمة قصيرة جدا. يرجى إضافة معلومات أكثر." : language === "fr" ? "La valeur saisie est trop courte." : "The value entered is too short.";
  if (field.validity.tooLong) return language === "ar" ? "القيمة طويلة جدا. يرجى تقصيرها." : language === "fr" ? "La valeur saisie est trop longue." : "The value entered is too long.";
  if (field.validity.patternMismatch) return language === "ar" ? "صيغة هذه الخانة غير صحيحة. يرجى مراجعة البيانات." : language === "fr" ? "Le format de ce champ est incorrect. Vérifiez les données." : "This field has an invalid format. Please check the data.";
  return language === "ar" ? "يرجى التحقق من هذه الخانة." : language === "fr" ? "Veuillez vérifier ce champ." : "Please check this field.";
}

function errorHost(field: HTMLElement): HTMLElement {
  return field.closest("label") || field.parentElement || field;
}

function ensureInlineValidation(language: LanguageCode) {
  const form = document.querySelector<HTMLFormElement>(".wizard-form");
  if (!form) return;

  const fields = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"))
    .filter((field) => field.type !== "hidden" && field.type !== "button" && field.type !== "submit");

  const render = (field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, force = false) => {
    if (!force && !field.dataset.cvupTouched) return;
    const host = errorHost(field);
    let error = host.querySelector<HTMLElement>("[data-cvup-field-error]");
    const invalid = !field.checkValidity();

    field.setAttribute("aria-invalid", invalid ? "true" : "false");
    field.classList.toggle("border-red-500", invalid);
    field.classList.toggle("focus:border-red-500", invalid);

    if (!invalid) {
      error?.remove();
      return;
    }

    if (!error) {
      error = document.createElement("p");
      error.dataset.cvupFieldError = "true";
      error.className = "mt-2 text-sm font-medium leading-5 text-red-600";
      error.setAttribute("role", "alert");
      host.appendChild(error);
    }
    error.textContent = validationMessage(field, language);
  };

  fields.forEach((field) => {
    if (field.dataset.cvupValidationBound) return;
    field.dataset.cvupValidationBound = "true";
    field.addEventListener("blur", () => {
      field.dataset.cvupTouched = "true";
      render(field, true);
    });
    field.addEventListener("input", () => {
      if (field.dataset.cvupTouched) render(field, true);
    });
    field.addEventListener("change", () => {
      if (field.dataset.cvupTouched) render(field, true);
    });
    field.addEventListener("invalid", (event) => {
      event.preventDefault();
      field.dataset.cvupTouched = "true";
      render(field, true);
      field.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

function ensureEditPolicyNote(language: LanguageCode) {
  const stepSeven = document.querySelector('[data-wizard-step="7"]');
  if (!stepSeven) return;

  let note = stepSeven.querySelector<HTMLElement>("[data-cvup-edit-policy]");
  if (!note) {
    note = document.createElement("div");
    note.dataset.cvupEditPolicy = "true";
    note.className = "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900";
    const priceBox = stepSeven.querySelector(".review-price");
    if (priceBox?.parentElement === stepSeven) {
      stepSeven.insertBefore(note, priceBox);
    } else {
      stepSeven.prepend(note);
    }
  }

  note.textContent = messages[language].editPolicy;
}

function rememberNamesBeforeSubmit() {
  const latinInput = findFullNameInput();
  const arabicInput = document.querySelector<HTMLInputElement>("[data-cvup-arabic-name]");
  if (latinInput?.value.trim()) window.sessionStorage.setItem("cvup_last_full_name", latinInput.value.trim());
  if (arabicInput?.value.trim()) window.sessionStorage.setItem("cvup_last_full_name_arabic", arabicInput.value.trim());
}

function patchRequestPayloadFetch() {
  if ((window as typeof window & { __cvupFetchPatched?: boolean }).__cvupFetchPatched) return;
  (window as typeof window & { __cvupFetchPatched?: boolean }).__cvupFetchPatched = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method?.toUpperCase();

    if (url.includes("/api/requests") && method === "POST" && typeof init?.body === "string") {
      try {
        const payload = JSON.parse(init.body) as Record<string, unknown>;
        const arabicName = document.querySelector<HTMLInputElement>("[data-cvup-arabic-name]")?.value.trim() ||
          window.sessionStorage.getItem("cvup_last_full_name_arabic") || "";
        payload.full_name_arabic = arabicName.trim();
        init = { ...init, body: JSON.stringify(payload) };
      } catch {
        // Keep the original request if the payload is not JSON.
      }
    }

    return originalFetch(input, init);
  };
}

export function CvupClientGuards() {
  useEffect(() => {
    let frame = 0;

    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const language = getCurrentLanguage();
        ensureInlineValidation(language);
        ensureFullNameLatinRequirement(language);
        ensureArabicNameField(language);
        ensureEditPolicyNote(language);
        patchRequestPayloadFetch();
      });
    };

    const handleSubmit = () => rememberNamesBeforeSubmit();
    document.addEventListener("submit", handleSubmit, true);

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  return null;
}
