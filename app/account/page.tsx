"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isClientRequestEditable } from "@/lib/client-request-editability";
import { useAccountWorkspace, type WorkspaceRequest } from "@/components/account-workspace";
import { getClientRequestState, type ClientRequestState } from "@/lib/client-request-state";

type Req = WorkspaceRequest;

type Language = "ar" | "fr" | "en";
const labels = {
  en: {
    workspace: "Client workspace",
    welcome: "Welcome back",
    subtitle: "Your profile is saved and can be reused for future CV requests.",
    newCv: "Create a new CV",
    editPrevious: "Edit a previous request",
    language: "Language",
    appearance: "Appearance",
    light: "Light",
    dark: "Dark",
    system: "System",
    updated: "Updated request",
    languageVersions: "CV language versions",
    finalPrice: "Final price",
    targetedGift: "Personalized cover letter included free",
    editProfile: "Edit profile",
    requests: "My CV requests",
    requestsSub: "Track your requests and complete the next step when needed.",
    total: "Total requests",
    progress: "In progress",
    ready: "Ready",
    chooseTitle: "Edit a previous request",
    chooseSub: "Choose the request you want to review and update.",
    close: "Close",
    select: "Review & edit",
    locked: "This request can no longer be edited because processing has started.",
    empty: "You don't have any previous requests yet.",
    signOut: "Sign out",
    payment: "Waiting for payment",
    files: "Action required",
    processing: "In progress",
    done: "Ready",
    notePayment: "Payment is required before we can start your CV.",
    noteProcessing: "Your CV is currently being prepared.",
    noteDone: "Your CV is ready.",
    details: "Review request",
    reviewEdit: "Review & edit",
    viewStatus: "View status",
    pay: "Complete payment",
    continueDraft: "Continue your draft",
    draftSaved: "Your unfinished CV request is saved as a draft.",
    lastSaved: "Last saved",
    drafts: "Drafts", actionRequired: "Action required", submitted: "Submitted requests", noDrafts: "You don't have any unfinished CV requests.", noAction: "No requests need your attention right now.", noSubmitted: "No submitted requests yet.", noProgress: "No requests are in progress yet.", noReady: "No CVs are ready yet.", draftProgress: "Draft progress", continueRequest: "Continue request", completeRequest: "Complete request", paymentRequired: "Payment required", currentStep: "Current step", created: "Created", noResults: "No requests in this section yet.", settingsTitle: "Workspace settings", settingsText: "Choose the language and appearance used across your client workspace.", requestType: "Request type", status: "Status", nextStep: "Next step", submittedNote: "Your request has been submitted.", progressNote: "Your CV is being prepared.", actionNote: "Please complete the next step to continue.", draftNote: "Continue where you left off.", dashboardOverview: "Here is an overview of your requests.", recent: "Recent requests", viewAll: "View all", currentDraft: "Saved draft", cancelled: "Closed", cancelledNote: "This request is closed.",
  },
  fr: {
    workspace: "Espace client",
    welcome: "Bon retour",
    subtitle: "Votre profil est enregistré et peut être réutilisé pour vos prochaines demandes.",
    newCv: "Créer un nouveau CV",
    editPrevious: "Modifier une demande précédente",
    language: "Langue",
    appearance: "Apparence",
    light: "Clair",
    dark: "Sombre",
    system: "Système",
    updated: "Demande mise à jour",
    languageVersions: "Versions linguistiques du CV",
    finalPrice: "Prix final",
    targetedGift: "Lettre de motivation personnalisée offerte",
    editProfile: "Modifier le profil",
    requests: "Mes demandes de CV",
    requestsSub: "Suivez vos demandes et complétez l’étape suivante si nécessaire.",
    total: "Demandes",
    progress: "En cours",
    ready: "Prêtes",
    chooseTitle: "Modifier une demande précédente",
    chooseSub: "Choisissez la demande que vous souhaitez vérifier et modifier.",
    close: "Fermer",
    select: "Vérifier et modifier",
    locked: "Cette demande ne peut plus être modifiée car son traitement a commencé.",
    empty: "Vous n’avez encore aucune demande.",
    signOut: "Se déconnecter",
    payment: "Paiement requis",
    files: "Action requise",
    processing: "En cours",
    done: "Prêt",
    notePayment: "Le paiement est requis avant le démarrage de votre CV.",
    noteProcessing: "Votre CV est en cours de préparation.",
    noteDone: "Votre CV est prêt.",
    details: "Voir la demande",
    reviewEdit: "Vérifier et modifier",
    viewStatus: "Voir le statut",
    pay: "Payer",
    continueDraft: "Reprendre le brouillon",
    draftSaved: "Votre demande de CV inachevée est enregistrée comme brouillon.",
    lastSaved: "Dernier enregistrement",
    drafts: "Brouillons", actionRequired: "Action requise", submitted: "Demandes soumises", noDrafts: "Vous n’avez pas de demande de CV inachevée.", noAction: "Aucune demande ne nécessite votre attention.", noSubmitted: "Aucune demande soumise.", noProgress: "Aucune demande en cours.", noReady: "Aucun CV n’est encore prêt.", draftProgress: "Progression du brouillon", continueRequest: "Continuer la demande", completeRequest: "Compléter la demande", paymentRequired: "Paiement requis", currentStep: "Étape actuelle", created: "Créée le", noResults: "Aucune demande dans cette rubrique.", settingsTitle: "Paramètres de l’espace", settingsText: "Choisissez la langue et l’apparence de votre espace client.", requestType: "Type de demande", status: "Statut", nextStep: "Prochaine étape", submittedNote: "Votre demande a été envoyée.", progressNote: "Votre CV est en cours de préparation.", actionNote: "Veuillez terminer l’étape suivante.", draftNote: "Reprenez là où vous vous êtes arrêté.", dashboardOverview: "Voici un aperçu de vos demandes.", recent: "Demandes récentes", viewAll: "Tout afficher", currentDraft: "Brouillon enregistré", cancelled: "Clôturée", cancelledNote: "Cette demande est clôturée.",
  },
  ar: {
    workspace: "مساحة العميل",
    welcome: "مرحبًا بعودتك",
    subtitle: "معلوماتك محفوظة ويمكن إعادة استخدامها في طلبات السيرة الذاتية القادمة.",
    newCv: "إنشاء سيرة ذاتية جديدة",
    editPrevious: "تعديل طلب سابق",
    language: "اللغة",
    appearance: "المظهر",
    light: "فاتح",
    dark: "داكن",
    system: "حسب الجهاز",
    updated: "تم تحديث الطلب",
    languageVersions: "نسخ السيرة حسب اللغة",
    finalPrice: "السعر النهائي",
    targetedGift: "رسالة تحفيزية مخصصة هدية دون تكلفة إضافية",
    editProfile: "تعديل الملف الشخصي",
    requests: "طلبات السيرة الذاتية",
    requestsSub: "تابع طلباتك وأكمل الخطوة التالية عند الحاجة.",
    total: "إجمالي الطلبات",
    progress: "قيد المعالجة",
    ready: "جاهزة",
    chooseTitle: "تعديل طلب سابق",
    chooseSub: "اختر الطلب الذي تريد مراجعته وتعديل بياناته.",
    close: "إغلاق",
    select: "مراجعة وتعديل",
    locked: "لا يمكن تعديل هذا الطلب بعد بدء المعالجة.",
    empty: "لا توجد لديك طلبات سابقة بعد.",
    signOut: "تسجيل الخروج",
    payment: "في انتظار الدفع",
    files: "إجراء مطلوب",
    processing: "قيد المعالجة",
    done: "جاهز",
    notePayment: "يجب إتمام الدفع قبل بدء معالجة السيرة الذاتية.",
    noteProcessing: "يتم حاليًا إعداد سيرتك الذاتية.",
    noteDone: "سيرتك الذاتية جاهزة.",
    details: "مراجعة الطلب",
    reviewEdit: "مراجعة وتعديل",
    viewStatus: "عرض حالة الطلب",
    pay: "إكمال الدفع",
    continueDraft: "متابعة المسودة",
    draftSaved: "طلب السيرة غير المكتمل محفوظ كمسودة.",
    lastSaved: "آخر حفظ",
    drafts: "المسودات", actionRequired: "إجراء مطلوب", submitted: "الطلبات المرسلة", noDrafts: "لا توجد طلبات سيرة غير مكتملة.", noAction: "لا توجد طلبات تحتاج إلى إجراء الآن.", noSubmitted: "لا توجد طلبات مرسلة بعد.", noProgress: "لا توجد طلبات قيد المعالجة بعد.", noReady: "لا توجد سير ذاتية جاهزة بعد.", draftProgress: "تقدم المسودة", continueRequest: "متابعة الطلب", completeRequest: "إكمال الطلب", paymentRequired: "الدفع مطلوب", currentStep: "الخطوة الحالية", created: "تاريخ الإنشاء", noResults: "لا توجد طلبات في هذا القسم بعد.", settingsTitle: "إعدادات مساحة العميل", settingsText: "اختر لغة ومظهر مساحة حسابك.", requestType: "نوع الطلب", status: "الحالة", nextStep: "الخطوة التالية", submittedNote: "تم إرسال طلبك.", progressNote: "يجري إعداد سيرتك الذاتية.", actionNote: "أكمل الخطوة التالية للمتابعة.", draftNote: "تابع من حيث توقفت.", dashboardOverview: "هذه نظرة عامة على طلباتك.", recent: "أحدث الطلبات", viewAll: "عرض الكل", currentDraft: "المسودة المحفوظة", cancelled: "مغلق", cancelledNote: "تم إغلاق هذا الطلب.",
  },
} as const;

function isEditable(request: Req) {
  return isClientRequestEditable(request);
}

function requestState(request: Req, language: Language) {
  const t = labels[language];
  const kind = getClientRequestState(request);
  if (request.status === "CANCELLED") return { badge: t.cancelled, note: t.cancelledNote, kind };
  if (kind === "ready") return { badge: t.done, note: t.noteDone, kind };
  if (kind === "in_progress") return { badge: t.processing, note: t.noteProcessing, kind };
  if (kind === "action_required") return { badge: request.payment_status === "PENDING" ? t.payment : t.files, note: request.payment_status === "PENDING" ? t.notePayment : t.actionNote, kind };
  if (kind === "draft") return { badge: t.drafts, note: t.draftNote, kind };
  return { badge: t.submitted, note: t.submittedNote, kind };
}

export default function AccountPage() {
  const searchParams = useSearchParams();
  const { user, profile, requests, groups, draft, language, theme, setLanguage, setTheme } = useAccountWorkspace();
  const view = searchParams.get("view") || "dashboard";
  const [showPrevious, setShowPrevious] = useState(false);
  const previousDialogRef = useRef<HTMLElement>(null);
  const previousTriggerRef = useRef<HTMLButtonElement>(null);
  const [updatedSummary, setUpdatedSummary] = useState<{ price: number; languages: number; targeted: boolean } | null>(null);

  useEffect(() => {
    const updatedPrice = Number(window.sessionStorage.getItem("cvup_updated_price_dzd"));
    if (Number.isFinite(updatedPrice) && updatedPrice > 0) {
      const summary = { price: updatedPrice, languages: Math.max(1, Number(window.sessionStorage.getItem("cvup_updated_language_count")) || 1), targeted: window.sessionStorage.getItem("cvup_updated_targeted") === "true" };
      queueMicrotask(() => setUpdatedSummary(summary));
      window.sessionStorage.removeItem("cvup_updated_price_dzd");
      window.sessionStorage.removeItem("cvup_updated_language_count");
      window.sessionStorage.removeItem("cvup_updated_targeted");
    }
  }, []);

  useEffect(() => {
    if (!showPrevious) return;
    const dialog = previousDialogRef.current;
    const focusableSelector = "button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])";
    dialog?.querySelector<HTMLElement>(focusableSelector)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowPrevious(false);
        previousTriggerRef.current?.focus();
      }
      if (event.key === "Tab" && dialog) {
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter((item) => !item.hasAttribute("disabled"));
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPrevious]);

  const t = labels[language];
  const rtl = language === "ar";
  const savedDraftAt = draft?.saved_at || "";
  const stats = { total: requests.length, draft: groups.draft.length + (draft ? 1 : 0), action: groups.action_required.length, submitted: groups.submitted.length, progress: groups.in_progress.length, ready: groups.ready.length };
  const stateViews: ClientRequestState[] = ["draft", "action_required", "submitted", "in_progress", "ready"];
  const selectedState = stateViews.includes(view as ClientRequestState) ? view as ClientRequestState : null;
  const title = view === "settings" ? t.settingsTitle : selectedState ? ({ draft: t.drafts, action_required: t.actionRequired, submitted: t.submitted, in_progress: t.progress, ready: t.ready } as const)[selectedState] : t.workspace;
  const dateLabel = (value: string) => new Intl.DateTimeFormat(language === "ar" ? "ar-DZ" : language === "fr" ? "fr-FR" : "en-US", { dateStyle: "medium" }).format(new Date(value));
  const stateLabel = (request: Req) => requestState(request, language);
  const emptyState = selectedState === "draft" ? t.noDrafts : selectedState === "action_required" ? t.noAction : selectedState === "submitted" ? t.noSubmitted : selectedState === "in_progress" ? t.noProgress : t.noReady;
  const visibleRequests = selectedState ? groups[selectedState] : requests.slice(0, 4);
  const draftForm = draft?.form || {};
  const savedDraftTitle = String(draftForm.target_job_title || draftForm.cv_type || t.currentDraft);
  const draftStep = Math.max(1, Math.min(7, Number(draft?.step) || 1));
  const draftProgress = Math.round((draftStep / 7) * 100);

  function renderRequestCard(request: Req) {
    const state = stateLabel(request);
    const editable = isEditable(request);
    return <article key={request.request_code} className="account-request-card rounded-[22px] border border-[#dfe7df] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-bold">{request.target_job_title || request.cv_type}</h3>
          {request.company_name ? <p className="mt-1 text-sm text-slate-500">{request.company_name}</p> : null}
          <p className="mt-2 text-xs text-slate-500">{request.cv_type}{request.selected_cv_languages?.length ? ` · ${request.selected_cv_languages.join(" + ")}` : ""}</p>
          <p dir="ltr" className={`mt-1 text-xs text-slate-400 ${rtl ? "text-right" : "text-left"}`}>#{request.request_code}</p>
          <time className="mt-1 block text-xs text-slate-400" dateTime={request.created_at}>{t.created}: {dateLabel(request.created_at)}</time>
        </div>
        <span className={`account-status-badge rounded-full px-3 py-1 text-xs font-bold ${state.kind === "action_required" ? "is-action" : state.kind === "ready" ? "is-ready" : state.kind === "in_progress" ? "is-progress" : ""}`}>{state.badge}</span>
      </div>
      <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-sm leading-6 text-slate-600">{state.note}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {editable ? <Link href={`/?edit=${encodeURIComponent(request.request_code)}#form`} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold">{selectedState === "action_required" ? t.completeRequest : t.reviewEdit}</Link> : null}
          {request.payment_status === "PENDING" ? <Link href={`/success?request_code=${encodeURIComponent(request.request_code)}`} className="rounded-full bg-[#102019] px-4 py-2 text-sm font-bold text-white">{t.pay}</Link> : null}
          <Link href={`/account/requests/${encodeURIComponent(request.request_code)}`} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold">{t.details}</Link>
        </div>
      </div>
    </article>;
  }

  return (
    <>
    <div className="account-page-content">
      {view === "settings" ? <section className="account-panel rounded-[28px] border border-[#dfe7df] bg-white p-6 md:p-8">
        <h1 className="text-2xl font-bold">{t.settingsTitle}</h1><p className="mt-2 text-slate-500">{t.settingsText}</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">{t.language}<select value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="rounded-xl border border-slate-300 bg-white p-3 font-normal"><option value="ar">العربية</option><option value="fr">Français</option><option value="en">English</option></select></label>
          <label className="grid gap-2 text-sm font-semibold">{t.appearance}<select value={theme} onChange={(event) => setTheme(event.target.value as "light" | "dark" | "system")} className="rounded-xl border border-slate-300 bg-white p-3 font-normal"><option value="light">{t.light}</option><option value="dark">{t.dark}</option><option value="system">{t.system}</option></select></label>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4"><div><p className="font-bold">{t.editProfile}</p><p dir="ltr" className="mt-1 text-sm text-slate-500">{user?.email}</p></div><Link href="/account/profile" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold">{t.editProfile}</Link></div>
      </section> : view === "dashboard" ? <>
        <section className="account-panel rounded-[28px] border border-[#dfe7df] bg-white p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#628000]">{t.workspace}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{t.welcome}{profile?.full_name_latin ? `, ${profile.full_name_latin.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 text-sm text-slate-500">{t.dashboardOverview}</p>
          {updatedSummary ? <div role="status" className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-bold">{t.updated} · {updatedSummary.languages} {t.languageVersions}</p><p className="mt-1">{t.finalPrice}: <strong>{updatedSummary.price} DZD</strong></p>{updatedSummary.targeted ? <p className="mt-1">🎁 {t.targetedGift}</p> : null}</div> : null}
          <div className="mt-6 flex flex-wrap gap-3"><Link href="/?new=1#form" className="rounded-full bg-[#102019] px-6 py-3 text-sm font-bold text-white">{t.newCv}</Link><button ref={previousTriggerRef} type="button" onClick={() => setShowPrevious(true)} className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold transition hover:bg-slate-50">{t.editPrevious}</button></div>
          {draft ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-bold">{t.currentDraft}: {savedDraftTitle}</p><p className="mt-1 text-sm text-slate-600">{t.draftProgress} · {draftProgress}%{savedDraftAt ? ` · ${dateLabel(savedDraftAt)}` : ""}</p></div><Link href="/?new=1#form" className="rounded-full bg-[#102019] px-5 py-2.5 text-sm font-bold text-white">{t.continueDraft}</Link></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${draftProgress}%` }} /></div></div> : null}
        </section>
        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([[t.drafts, stats.draft, "draft"], [t.actionRequired, stats.action, "action_required"], [t.submitted, stats.submitted, "submitted"], [t.progress, stats.progress, "in_progress"], [t.ready, stats.ready, "ready"]] as const).map(([label, count, key]) => <Link key={key} href={`/account?view=${key}`} className="account-panel rounded-2xl border border-[#dfe7df] bg-white px-5 py-4 text-inherit no-underline transition hover:-translate-y-0.5 hover:shadow-sm"><span className="text-sm text-slate-500">{label}</span><strong className="mt-1 block text-2xl">{count}</strong></Link>)}
        </section>
        <section className="mt-8"><div className="flex items-end justify-between gap-4"><div><h2 className="text-2xl font-bold">{t.recent}</h2><p className="mt-1 text-sm text-slate-500">{t.requestsSub}</p></div><Link href="/account?view=submitted" className="text-sm font-bold text-[#0d5f46]">{t.viewAll}</Link></div>
          {visibleRequests.length ? <div className="mt-5 grid gap-4 lg:grid-cols-2">{visibleRequests.map(renderRequestCard)}</div> : <div className="account-panel mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">{t.empty}</div>}
        </section>
      </> : <section className="account-panel rounded-[28px] border border-[#dfe7df] bg-white p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-bold">{title}</h1><p className="mt-2 text-slate-500">{selectedState === "action_required" ? t.actionNote : selectedState === "in_progress" ? t.progressNote : t.requestsSub}</p></div>{selectedState !== "draft" ? <Link href="/?new=1#form" className="rounded-full bg-[#102019] px-5 py-2.5 text-sm font-bold text-white">{t.newCv}</Link> : null}</div>
        {selectedState === "draft" && draft ? <article className="account-draft-card mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-bold">{savedDraftTitle}</h2>{draftForm.company_name ? <p className="mt-1 text-sm text-slate-500">{String(draftForm.company_name)}</p> : null}<p className="mt-2 text-sm text-slate-600">{String(draftForm.cv_type || "")}{Array.isArray(draftForm.selected_cv_languages) ? ` · ${(draftForm.selected_cv_languages as string[]).join(" + ")}` : ""}</p>{savedDraftAt ? <p className="mt-2 text-xs text-slate-500">{t.lastSaved}: {dateLabel(savedDraftAt)}</p> : null}</div><Link href="/?new=1#form" className="rounded-full bg-[#102019] px-5 py-2.5 text-sm font-bold text-white">{t.continueRequest}</Link></div><p className="mt-4 text-xs text-slate-500">{t.currentStep}: {draftStep} / 7</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${draftProgress}%` }} /></div></article> : null}
        {visibleRequests.length ? <div className="mt-5 grid gap-4 lg:grid-cols-2">{visibleRequests.map(renderRequestCard)}</div> : !draft || selectedState !== "draft" ? <div className="account-empty-state mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><h2 className="font-bold">{emptyState}</h2><p className="mt-2 text-sm text-slate-500">{selectedState === "draft" ? t.noDrafts : t.noResults}</p>{selectedState === "draft" || selectedState === "ready" ? <Link href="/?new=1#form" className="mt-5 inline-flex rounded-full bg-[#102019] px-5 py-2.5 text-sm font-bold text-white">{t.newCv}</Link> : null}</div> : null}
      </section>}
    </div>
      {showPrevious ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 backdrop-blur-[2px] md:items-center md:p-6" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowPrevious(false); }}>
          <section ref={previousDialogRef} role="dialog" aria-modal="true" aria-labelledby="previous-request-title" className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:rounded-[28px]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
              <div>
                <h2 id="previous-request-title" className="text-2xl font-bold">{t.chooseTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">{t.chooseSub}</p>
              </div>
              <button type="button" onClick={() => setShowPrevious(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-xl" aria-label={t.close}>×</button>
            </div>
            <div className="max-h-[65vh] space-y-3 overflow-y-auto p-4 md:p-6">
              {requests.length ? requests.map((request) => {
                const editable = isEditable(request);
                const state = requestState(request, language);
                return (
                  <article key={request.request_code} className="rounded-2xl border border-slate-200 p-4 transition hover:border-slate-400">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold">{request.target_job_title || request.cv_type}</h3>
                        {request.company_name ? <p className="text-sm text-slate-500">{request.company_name}</p> : null}
                        <p dir="ltr" className={`mt-1 text-xs text-slate-400 ${rtl ? "text-right" : "text-left"}`}>{request.request_code}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{state.badge}</span>
                    </div>
                    {editable ? (
                      <Link href={`/?edit=${encodeURIComponent(request.request_code)}#form`} className="mt-4 inline-flex rounded-full bg-[#102019] px-5 py-2.5 text-sm font-bold text-white">{t.select}</Link>
                    ) : (
                      <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">{t.locked}</p>
                    )}
                  </article>
                );
              }) : <p className="p-6 text-center text-slate-500">{t.empty}</p>}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
