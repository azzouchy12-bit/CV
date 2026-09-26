"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { safeInternalRedirect } from "@/lib/auth-redirect";
import { getSavedClientLanguage } from "@/lib/client-preferences";

type Language = "ar" | "fr" | "en";
const copy = {
  en: { title: "Reset your password", email: "Email address", send: "Send recovery email", sending: "Sending…", sent: "If an account can receive recovery mail, instructions will be sent. Check Spam or Promotions too.", newPassword: "New password", save: "Update password", saved: "Password updated. You can sign in now.", error: "We couldn't complete this request. Check the link and try again.", back: "Back to sign in" },
  fr: { title: "Réinitialiser le mot de passe", email: "Adresse e-mail", send: "Envoyer l’e-mail de récupération", sending: "Envoi…", sent: "Si un compte peut recevoir l’e-mail de récupération, les instructions seront envoyées. Vérifiez aussi les courriers indésirables.", newPassword: "Nouveau mot de passe", save: "Mettre à jour le mot de passe", saved: "Mot de passe mis à jour. Vous pouvez vous connecter.", error: "Impossible de terminer cette opération. Vérifiez le lien et réessayez.", back: "Retour à la connexion" },
  ar: { title: "إعادة تعيين كلمة المرور", email: "البريد الإلكتروني", send: "إرسال رسالة الاستعادة", sending: "جارٍ الإرسال…", sent: "إذا كان الحساب يستقبل رسائل الاستعادة فستصلك التعليمات. تحقق أيضًا من الرسائل غير المرغوب فيها.", newPassword: "كلمة المرور الجديدة", save: "تحديث كلمة المرور", saved: "تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.", error: "تعذر إكمال الطلب. تحقق من الرابط وحاول مجددًا.", back: "العودة إلى تسجيل الدخول" },
} as const;

export default function RecoverAccountPage() {
  const [language, setLanguage] = useState<Language>("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [next, setNext] = useState("/account");
  const [recovering, setRecovering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stored = getSavedClientLanguage();
    queueMicrotask(() => {
      if (stored === "ar" || stored === "fr" || stored === "en") setLanguage(stored);
      setNext(safeInternalRedirect(params.get("next"), "/account", window.location.origin));
    });
    const recoveryRequested = params.get("recovery") === "1";
    getSupabaseBrowserClient().auth.getSession().then(({ data }) => {
      if (recoveryRequested && data.session) setRecovering(true);
      else if (recoveryRequested) setMessage(copy[stored === "ar" || stored === "fr" ? stored : "en"].error);
    });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    if (recovering) {
      const { error } = await getSupabaseBrowserClient().auth.updateUser({ password });
      if (error) setMessage(copy[language].error);
      else {
        setMessage(copy[language].saved);
        setPasswordSaved(true);
      }
      setBusy(false);
      return;
    }

    const recoveryNext = `/account/recover?recovery=1&next=${encodeURIComponent(next)}`;
    const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(recoveryNext)}`,
    });
    setMessage(error ? copy[language].error : copy[language].sent);
    setBusy(false);
  }

  const t = copy[language];
  return (
    <main lang={language} dir={language === "ar" ? "rtl" : "ltr"} className="grid min-h-screen place-items-center bg-[#f7f9f4] p-4 text-[#102019] md:p-6">
      <section className="w-full max-w-[520px] rounded-[28px] border border-[#dfe7df] bg-white p-6 shadow-sm md:p-10">
        <Link href={`/account/login?next=${encodeURIComponent(next)}`} className="text-sm font-semibold text-[#0d5f46]">{t.back}</Link>
        <h1 className="mt-7 text-3xl font-bold">{t.title}</h1>
        <form onSubmit={submit} className="mt-6 space-y-5">
          {!recovering ? <label className="block"><span className="mb-2 block text-sm font-semibold">{t.email}</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5" /></label> : <label className="block"><span className="mb-2 block text-sm font-semibold">{t.newPassword}</span><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5" /></label>}
          {message ? <p role="status" className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</p> : null}
          {(!recovering || !passwordSaved) ? <button disabled={busy} className="w-full rounded-full bg-[#102019] px-5 py-3.5 font-bold text-white disabled:opacity-60">{busy ? t.sending : recovering ? t.save : t.send}</button> : null}
          {recovering && passwordSaved ? <Link href={`/account/login?next=${encodeURIComponent(next)}`} className="block rounded-full bg-[#102019] px-5 py-3.5 text-center font-bold text-white">{t.back}</Link> : null}
        </form>
      </section>
    </main>
  );
}
