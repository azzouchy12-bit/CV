"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CVUP_BASE_PRICE_DZD } from "@/lib/pricing";
import { getSavedClientLanguage } from "@/lib/client-preferences";

type Language = "ar" | "fr" | "en";
const copy = {
  en: {
    waiting: "Request saved · Awaiting payment", title: "Choose a payment method", subtitle: "Your request {code} is saved. AI processing begins after payment is verified.", amount: "Amount due", electronic: "Pay with SofizPay", electronicText: "Continue to the secure SofizPay payment page. Opening it does not confirm payment.", manual: "Pay with BaridiMob", manualText: "Contact us on WhatsApp for BaridiMob details. We will verify the receipt before processing your request.", unavailable: "SofizPay is not configured yet", processing: "Processing starts after payment is confirmed by our team.", targetedGift: "Personalized cover letter included free", noCover: "General CV requests do not include a cover letter.", languages: "CV language versions",
  },
  fr: {
    waiting: "Demande enregistrée · En attente de paiement", title: "Choisissez un moyen de paiement", subtitle: "Votre demande {code} est enregistrée. Le traitement par IA commencera après vérification du paiement.", amount: "Montant à payer", electronic: "Payer avec SofizPay", electronicText: "Continuez vers la page de paiement sécurisée SofizPay. Son ouverture ne confirme pas le paiement.", manual: "Payer avec BaridiMob", manualText: "Contactez-nous sur WhatsApp pour les coordonnées BaridiMob. Nous vérifierons le reçu avant le traitement.", unavailable: "SofizPay n’est pas encore configuré", processing: "Le traitement commence après confirmation du paiement par notre équipe.", targetedGift: "Lettre de motivation personnalisée offerte", noCover: "Une demande de CV général ne comprend pas de lettre de motivation.", languages: "Versions linguistiques du CV",
  },
  ar: {
    waiting: "تم حفظ الطلب · في انتظار التسديد", title: "اختر طريقة التسديد", subtitle: "تم حفظ طلبك {code}. تبدأ المعالجة بالذكاء الاصطناعي بعد التحقق من التسديد.", amount: "المبلغ المستحق", electronic: "التسديد عبر SofizPay", electronicText: "انتقل إلى صفحة الدفع الآمنة في SofizPay. فتح الصفحة لا يعني تأكيد التسديد.", manual: "التسديد عبر بريدي موب", manualText: "تواصل معنا عبر واتساب للحصول على معلومات بريدي موب. سنتحقق من الوصل قبل بدء المعالجة.", unavailable: "خدمة SofizPay غير مهيأة حاليًا", processing: "يبدأ إعداد الطلب بعد أن يؤكد فريقنا التسديد.", targetedGift: "رسالة تحفيزية مخصصة هدية دون تكلفة إضافية", noCover: "طلب السيرة الذاتية العامة لا يشمل رسالة تحفيزية.", languages: "نسخ السيرة حسب اللغة",
  },
} as const;

function SuccessContent() {
  const params = useSearchParams();
  const requestCode = params.get("request_code") || "";
  const [language, setLanguage] = useState<Language>("fr");
  const [clientName, setClientName] = useState("");
  const [price, setPrice] = useState(CVUP_BASE_PRICE_DZD);
  const [languageCount, setLanguageCount] = useState(1);
  const [targeted, setTargeted] = useState(false);
  const sofizpayUrl = process.env.NEXT_PUBLIC_SOFIZPAY_PAYMENT_URL?.trim();

  useEffect(() => {
    queueMicrotask(() => {
      const storedLanguage = requestCode ? window.sessionStorage.getItem(`cvup_language_${requestCode}`) : null;
      const savedLanguage = storedLanguage || getSavedClientLanguage();
      if (savedLanguage === "ar" || savedLanguage === "fr" || savedLanguage === "en") setLanguage(savedLanguage);
      if (!requestCode) return;
      const savedPrice = Number(window.sessionStorage.getItem(`cvup_price_${requestCode}`));
      const savedCount = Number(window.sessionStorage.getItem(`cvup_language_count_${requestCode}`));
      setPrice(Number.isFinite(savedPrice) && savedPrice >= CVUP_BASE_PRICE_DZD ? savedPrice : CVUP_BASE_PRICE_DZD);
      setLanguageCount(Number.isFinite(savedCount) && savedCount >= 1 ? savedCount : 1);
      setTargeted(window.sessionStorage.getItem(`cvup_cover_letter_${requestCode}`) === "true");
      setClientName(window.sessionStorage.getItem(`cvup_name_ar_${requestCode}`)?.trim() || window.sessionStorage.getItem(`cvup_name_${requestCode}`)?.trim() || "");
    });
  }, [requestCode]);

  const whatsappUrl = useMemo(() => {
    const text = language === "ar"
      ? `السلام عليكم، أريد إتمام تسديد طلب CVUp رقم ${requestCode} عبر بريدي موب.`
      : language === "fr"
        ? `Bonjour, je souhaite régler la demande CVUp ${requestCode} via BaridiMob.`
        : `Hello, I would like to pay CVUp request ${requestCode} with BaridiMob.`;
    return `https://wa.me/213794851081?text=${encodeURIComponent(text)}`;
  }, [language, requestCode]);

  async function rememberMethod(method: "SOFIZPAY" | "BARIDIMOB_MANUAL") {
    if (!requestCode) return;
    try {
      await fetch(`/api/requests/${encodeURIComponent(requestCode)}/payment-choice`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method: method }),
      });
    } catch { /* Keep payment contact available if status tracking is temporarily unavailable. */ }
  }

  async function openSofizPay() {
    await rememberMethod("SOFIZPAY");
    if (sofizpayUrl) window.location.assign(sofizpayUrl);
  }
  async function openWhatsApp() {
    await rememberMethod("BARIDIMOB_MANUAL");
    window.location.assign(whatsappUrl);
  }

  const t = copy[language];
  return (
    <main lang={language} dir={language === "ar" ? "rtl" : "ltr"} className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-900">
      <div className="w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.10)] md:p-12">
        <div className="mb-7 inline-flex rounded-full bg-amber-100 px-5 py-2 text-sm font-bold text-amber-800">{t.waiting}</div>
        <h1 className="text-3xl font-black leading-[1.25] md:text-5xl">{clientName ? `${clientName}, ` : ""}{t.title}</h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">{t.subtitle.replace("{code}", requestCode ? `#${requestCode}` : "")}</p>
        <div className="mt-8 rounded-2xl bg-slate-50 p-5">
          <span className="text-sm text-slate-500">{t.amount}</span>
          <strong className="mt-1 block text-3xl">{price} {language === "ar" ? "دج" : "DZD"}</strong>
          <p className="mt-2 text-sm text-slate-600">{t.languages}: {languageCount}</p>
          <p className="mt-2 text-sm text-slate-600">{targeted ? t.targetedGift : t.noCover}</p>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 p-5">
            <h2 className="text-xl font-black">{t.electronic}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{t.electronicText}</p>
            <button type="button" onClick={openSofizPay} disabled={!sofizpayUrl} className="mt-5 w-full rounded-full bg-slate-950 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{sofizpayUrl ? t.electronic : t.unavailable}</button>
          </section>
          <section className="rounded-2xl border border-slate-200 p-5">
            <h2 className="text-xl font-black">{t.manual}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{t.manualText}</p>
            <button type="button" onClick={openWhatsApp} className="mt-5 w-full rounded-full border border-slate-900 px-5 py-3 font-bold text-slate-950">{t.manual}</button>
          </section>
        </div>
        <p className="mt-7 text-sm leading-7 text-slate-500">{t.processing}</p>
      </div>
    </main>
  );
}

export default function SuccessPage() {
  return <Suspense><SuccessContent /></Suspense>;
}
