"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccountWorkspace } from "@/components/account-workspace";
import { getClientRequestState } from "@/lib/client-request-state";

type SupportingItem = { question_key?: string; file_name?: string | null; link?: string | null };
type RequestView = {
  request_code: string;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  price_dzd?: number | null;
  cv_type: string;
  cv_language_count?: number | null;
  selected_cv_languages?: string[] | null;
  target_job_title?: string | null;
  target_role?: string | null;
  company_name?: string | null;
  professional_field?: string | null;
  created_at: string;
  updated_at?: string | null;
  current_cv_file_name?: string | null;
  job_description_file_name?: string | null;
  certifications_file_name?: string | null;
  cv_template_file_name?: string | null;
  supporting_materials?: SupportingItem[] | null;
};

const copy = {
  en: { title: "Request overview", loading: "Loading request…", error: "We couldn't load this request.", back: "Back to workspace", pending: "Action required", submitted: "Submitted", processing: "In progress", ready: "Ready", closed: "Closed", created: "Created", updated: "Last updated", request: "Request", type: "CV type", target: "Target role", company: "Company", field: "Professional field", languages: "CV languages", price: "Price", payment: "Payment", paymentRequired: "Payment required", paid: "Paid", notPaid: "Not paid", pay: "Complete payment", edit: "Review and edit", readOnly: "Editing is unavailable after processing starts.", files: "Attached files and links", emptyFiles: "No files or links were attached.", submittedInfo: "Your request has been submitted.", actionInfo: "Complete the next step to continue.", progressInfo: "Your CV is being prepared.", readyInfo: "Your request is complete.", createdInfo: "The request record includes its creation date only; no extra timeline events are available." },
  fr: { title: "Aperçu de la demande", loading: "Chargement de la demande…", error: "Impossible de charger cette demande.", back: "Retour à l’espace client", pending: "Action requise", submitted: "Envoyée", processing: "En cours", ready: "Prête", closed: "Clôturée", created: "Créée le", updated: "Dernière mise à jour", request: "Demande", type: "Type de CV", target: "Poste visé", company: "Entreprise", field: "Domaine professionnel", languages: "Langues du CV", price: "Prix", payment: "Paiement", paymentRequired: "Paiement requis", paid: "Payé", notPaid: "Non payé", pay: "Effectuer le paiement", edit: "Vérifier et modifier", readOnly: "La modification n’est plus disponible après le début du traitement.", files: "Fichiers et liens joints", emptyFiles: "Aucun fichier ou lien joint.", submittedInfo: "Votre demande a été envoyée.", actionInfo: "Terminez l’étape suivante pour continuer.", progressInfo: "Votre CV est en cours de préparation.", readyInfo: "Votre demande est terminée.", createdInfo: "La demande ne contient que sa date de création ; aucun autre événement de suivi n’est disponible." },
  ar: { title: "ملخص الطلب", loading: "جارٍ تحميل الطلب…", error: "تعذّر تحميل هذا الطلب.", back: "العودة إلى مساحة العميل", pending: "إجراء مطلوب", submitted: "تم الإرسال", processing: "قيد المعالجة", ready: "جاهز", closed: "مغلق", created: "تاريخ الإنشاء", updated: "آخر تحديث", request: "الطلب", type: "نوع السيرة الذاتية", target: "الوظيفة المستهدفة", company: "الشركة", field: "المجال المهني", languages: "لغات السيرة الذاتية", price: "السعر", payment: "الدفع", paymentRequired: "الدفع مطلوب", paid: "تم الدفع", notPaid: "لم يتم الدفع", pay: "إكمال الدفع", edit: "مراجعة وتعديل", readOnly: "لا يمكن تعديل الطلب بعد بدء معالجته.", files: "الملفات والروابط المرفقة", emptyFiles: "لم تتم إضافة ملفات أو روابط.", submittedInfo: "تم إرسال طلبك.", actionInfo: "أكمل الخطوة التالية للمتابعة.", progressInfo: "يجري إعداد سيرتك الذاتية.", readyInfo: "اكتمل طلبك.", createdInfo: "يتوفر تاريخ إنشاء الطلب فقط، ولا توجد أحداث أخرى لعرضها في سجل زمني." },
} as const;

export default function AccountRequestStatusPage() {
  const params = useParams<{ requestCode: string }>();
  const router = useRouter();
  const { language } = useAccountWorkspace();
  const [request, setRequest] = useState<RequestView | null>(null);
  const [editable, setEditable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const t = copy[language];

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
    }, 0);
    fetch(`/api/account/requests/${encodeURIComponent(params.requestCode)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.request) throw new Error("Request unavailable");
        if (!cancelled) {
          setRequest(result.request as RequestView);
          setEditable(result.editable === true);
        }
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [params.requestCode]);

  const state = request ? getClientRequestState(request) : null;
  const status = !request ? "" : request.status === "CANCELLED" ? t.closed : state === "ready" ? t.ready : state === "in_progress" ? t.processing : state === "action_required" ? t.pending : state === "draft" ? t.pending : t.submitted;
  const statusDescription = request?.status === "CANCELLED" ? t.closed : state === "ready" ? t.readyInfo : state === "in_progress" ? t.progressInfo : state === "action_required" ? t.actionInfo : t.submittedInfo;
  const date = (value?: string | null) => value ? new Intl.DateTimeFormat(language === "ar" ? "ar-DZ" : language === "fr" ? "fr-FR" : "en-US", { dateStyle: "medium" }).format(new Date(value)) : "—";
  const files = request ? [request.current_cv_file_name, request.job_description_file_name, request.certifications_file_name, request.cv_template_file_name, ...(request.supporting_materials || []).flatMap((item) => [item.file_name, item.link])].filter((item): item is string => Boolean(item)) : [];

  return <section className="account-panel mx-auto max-w-4xl rounded-[28px] border border-[#dfe7df] bg-white p-6 md:p-8">
    <Link href="/account" className="text-sm font-bold text-[#0d5f46]">← {t.back}</Link>
    <div className="mt-6 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#628000]">{t.request}</p><h1 className="mt-2 text-3xl font-bold">{t.title}</h1></div>{request ? <span className={`account-status-badge rounded-full px-3 py-1 text-xs font-bold ${state === "action_required" ? "is-action" : state === "ready" ? "is-ready" : state === "in_progress" ? "is-progress" : ""}`}>{status}</span> : null}</div>
    {loading ? <p role="status" className="mt-6 text-slate-500">{t.loading}</p> : error || !request ? <div role="alert" className="mt-6 rounded-xl bg-amber-50 p-4 text-amber-900">{t.error}</div> : <>
      <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">{statusDescription}</p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {[[t.type, request.cv_type], ...(request.target_job_title ? [[t.target, request.target_job_title]] : []), ...(request.company_name ? [[t.company, request.company_name]] : []), ...(request.target_role ? [[t.target, request.target_role]] : []), ...(request.professional_field ? [[t.field, request.professional_field]] : []), [t.languages, request.selected_cv_languages?.join(" + ") || String(request.cv_language_count || 1)], [t.created, date(request.created_at)], ...(request.updated_at ? [[t.updated, date(request.updated_at)]] : []), [t.payment, request.payment_status === "PAID" ? t.paid : request.payment_status === "PENDING" ? t.paymentRequired : t.notPaid], ...(Number(request.price_dzd) > 0 ? [[t.price, `${request.price_dzd} DZD`]] : [])].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-100 p-4"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}
      </dl>
      <section className="mt-6 rounded-2xl border border-slate-100 p-5"><h2 className="font-bold">{t.files}</h2>{files.length ? <ul className="mt-3 space-y-2">{files.map((item, index) => <li key={`${item}-${index}`} dir="auto" className="break-all rounded-xl bg-slate-50 px-3 py-2 text-sm">{item.startsWith("http") ? <a href={item} target="_blank" rel="noreferrer" className="text-[#0d5f46] underline">{item}</a> : item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">{t.emptyFiles}</p>}</section>
      <p className="mt-4 text-xs text-slate-500">{t.createdInfo}</p>
      <div className="mt-6 flex flex-wrap gap-3">{request.payment_status === "PENDING" ? <button type="button" onClick={() => router.push(`/success?request_code=${encodeURIComponent(request.request_code)}`)} className="rounded-full bg-[#102019] px-6 py-3 font-bold text-white">{t.pay}</button> : null}{editable ? <Link href={`/?edit=${encodeURIComponent(request.request_code)}#form`} className="rounded-full border border-slate-300 px-6 py-3 font-bold">{t.edit}</Link> : state !== "ready" ? <p className="self-center text-sm text-slate-500">{t.readOnly}</p> : null}</div>
    </>}
  </section>;
}
