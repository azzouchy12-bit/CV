"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { safeInternalRedirect } from "@/lib/auth-redirect";
import { getSavedClientLanguage } from "@/lib/client-preferences";

type Language = "ar" | "fr" | "en";

const copy = {
  en: {
    title: "Create your account",
    subtitle: "Save your information once and manage every CV request from one place.",
    google: "Continue with Google",
    divider: "or continue with email",
    email: "Email address",
    password: "Password",
    passwordHint: "At least 8 characters",
    create: "Create account",
    creating: "Creating account…",
    existing: "Already have an account?",
    signIn: "Sign in",
    checkTitle: "Confirm your account",
    sentTo: "If confirmation is required, Supabase will send instructions to:",
    checkBody: "A successful signup response does not confirm email delivery. Delivery depends on the project's email settings. If you already have an account, sign in instead.",
    spam: "If you can’t find it, check Spam or Promotions.",
    resend: "Resend verification email",
    resending: "Sending…",
    resent: "If confirmation is required, Supabase accepted the resend request. This does not confirm delivery.",
    change: "Change email",
    generic: "We couldn't create your account. Please try again.",
    emailError: "We couldn't send the verification email. Please try again.",
  },
  fr: {
    title: "Créez votre compte",
    subtitle: "Enregistrez vos informations une seule fois et gérez toutes vos demandes de CV au même endroit.",
    google: "Continuer avec Google",
    divider: "ou continuer avec l’e-mail",
    email: "Adresse e-mail",
    password: "Mot de passe",
    passwordHint: "Au moins 8 caractères",
    create: "Créer le compte",
    creating: "Création du compte…",
    existing: "Vous avez déjà un compte ?",
    signIn: "Se connecter",
    checkTitle: "Confirmez votre compte",
    sentTo: "Si une confirmation est requise, Supabase enverra les instructions à :",
    checkBody: "Une réponse d’inscription réussie ne confirme pas la livraison de l’e-mail. Celle-ci dépend des paramètres e-mail du projet. Si vous avez déjà un compte, connectez-vous.",
    spam: "Si vous ne le trouvez pas, vérifiez les dossiers Spam ou Promotions.",
    resend: "Renvoyer l’e-mail de vérification",
    resending: "Envoi…",
    resent: "Si une confirmation est requise, Supabase a accepté la nouvelle demande. Cela ne confirme pas la livraison.",
    change: "Modifier l’e-mail",
    generic: "Impossible de créer votre compte. Veuillez réessayer.",
    emailError: "Impossible d’envoyer l’e-mail de vérification. Veuillez réessayer.",
  },
  ar: {
    title: "أنشئ حسابك",
    subtitle: "احفظ معلوماتك مرة واحدة وأدر كل طلبات السيرة الذاتية من مكان واحد.",
    google: "المتابعة باستخدام Google",
    divider: "أو المتابعة بالبريد الإلكتروني",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    passwordHint: "8 أحرف على الأقل",
    create: "إنشاء الحساب",
    creating: "جارٍ إنشاء الحساب…",
    existing: "لديك حساب بالفعل؟",
    signIn: "تسجيل الدخول",
    checkTitle: "تأكيد الحساب",
    sentTo: "إذا كان تأكيد البريد مطلوبًا، فسيحاول Supabase إرسال التعليمات إلى:",
    checkBody: "نجاح طلب التسجيل لا يؤكد وصول البريد الإلكتروني. يعتمد الإرسال على إعدادات البريد في المشروع. إذا كان لديك حساب بالفعل، فسجّل الدخول.",
    spam: "إذا لم تجده، تحقق من البريد غير المرغوب فيه أو تبويب العروض الترويجية.",
    resend: "إعادة إرسال رسالة التحقق",
    resending: "جارٍ الإرسال…",
    resent: "إذا كان التأكيد مطلوبًا، فقد قبل Supabase طلب إعادة الإرسال. هذا لا يؤكد وصول الرسالة.",
    change: "تغيير البريد الإلكتروني",
    generic: "تعذر إنشاء الحساب. حاول مرة أخرى.",
    emailError: "تعذر إرسال رسالة التحقق. حاول مرة أخرى.",
  },
} as const;

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.55l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"/></svg>;
}

export default function Register() {
  const [next, setNext] = useState("/account");
  const [language, setLanguage] = useState<Language>("en");
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [verifiedState, setVerifiedState] = useState(false);

  useEffect(() => {
    const resolvedNext = safeInternalRedirect(new URLSearchParams(window.location.search).get("next"), "/account", window.location.origin);
    const currentLanguage: Language = getSavedClientLanguage();
    getSupabaseBrowserClient().auth.getSession().then(({ data }) => {
      setNext(resolvedNext);
      if (data.session) window.location.replace(resolvedNext);
      else { setLanguage(currentLanguage); setChecking(false); }
    });
  }, []);

  function changeLanguage(value: Language) {
    setLanguage(value);
    window.localStorage.setItem("cvup_language", value);
  }

  async function continueWithGoogle() {
    setMessage("");
    setSubmitting(true);
    const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    });
    if (error) {
      setMessage(copy[language].generic);
      setSubmitting(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { data, error } = await getSupabaseBrowserClient().auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setMessage(copy[language].generic);
      setSubmitting(false);
      return;
    }

    if (data.session) {
      window.location.replace(next);
      return;
    }

    setPendingEmail(normalizedEmail);
    setPassword("");
    setVerifiedState(true);
    setSubmitting(false);
  }

  async function resend() {
    if (!pendingEmail) return;
    setMessage("");
    setSubmitting(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await getSupabaseBrowserClient().auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: redirectTo },
    });
    setSubmitting(false);
    setMessage(error ? copy[language].emailError : copy[language].resent);
  }

  const t = copy[language];
  const rtl = language === "ar";

  return (
    <main lang={language} dir={rtl ? "rtl" : "ltr"} className="grid min-h-screen place-items-center bg-[#f7f9f4] p-4 text-[#102019] md:p-6">
      <section className="w-full max-w-[520px] rounded-[28px] border border-[#dfe7df] bg-white p-6 shadow-[0_18px_55px_rgba(16,32,25,.06)] md:p-10">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">CVUp</Link>
          <select
            aria-label="Language"
            value={language}
            onChange={(event) => changeLanguage(event.target.value as Language)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-[#102019]"
          >
            <option value="ar">العربية</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>

        {verifiedState ? (
          <div className="mt-10">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xl text-emerald-700">✓</div>
            <h1 className="mt-5 text-4xl font-bold tracking-tight">{t.checkTitle}</h1>
            <p className="mt-4 text-sm text-slate-500">{t.sentTo}</p>
            <p dir="ltr" className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold">{pendingEmail}</p>
            <p className="mt-5 leading-7 text-slate-600">{t.checkBody}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{t.spam}</p>
            {message ? <p role="status" className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</p> : null}
            <button
              type="button"
              onClick={resend}
              disabled={submitting}
              className="mt-6 min-h-12 w-full rounded-full border border-[#102019] px-5 py-3 font-semibold transition hover:bg-slate-50 disabled:opacity-50"
            >
              {submitting ? t.resending : t.resend}
            </button>
            <button
              type="button"
              onClick={() => { setVerifiedState(false); setMessage(""); setEmail(pendingEmail); }}
              className="mt-3 w-full px-5 py-2 text-sm font-semibold text-[#0d5f46] underline-offset-4 hover:underline"
            >
              {t.change}
            </button>
            <p className="mt-6 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">
              {t.existing} <Link className="font-bold text-[#0d5f46] hover:underline" href={`/account/login?next=${encodeURIComponent(next)}`}>{t.signIn}</Link>
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-10 text-4xl font-bold tracking-tight">{t.title}</h1>
            <p className="mt-3 max-w-md text-base leading-7 text-slate-500">{t.subtitle}</p>

            <button
              type="button"
              disabled={checking || submitting}
              onClick={continueWithGoogle}
              className="mt-8 flex min-h-13 w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-white px-5 py-3.5 font-semibold transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-55"
            >
              <GoogleIcon /> {t.google}
            </button>

            <div className="my-7 flex items-center gap-3 text-xs uppercase tracking-[.14em] text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              <span>{t.divider}</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={submit}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">{t.email}</span>
                <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-slate-300 px-4 py-3.5 outline-none transition focus:border-[#102019] focus:ring-2 focus:ring-[#102019]/10" />
              </label>
              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-semibold">{t.password}</span>
                <input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-slate-300 px-4 py-3.5 outline-none transition focus:border-[#102019] focus:ring-2 focus:ring-[#102019]/10" />
                <span className="mt-2 block text-xs text-slate-400">{t.passwordHint}</span>
              </label>
              {message ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}
              <button disabled={checking || submitting} className="mt-6 min-h-13 w-full rounded-full bg-[#102019] px-6 py-3.5 font-bold text-white transition hover:bg-[#183126] disabled:cursor-wait disabled:opacity-55">
                {submitting ? t.creating : t.create}
              </button>
            </form>

            <p className="mt-7 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">
              {t.existing} <Link className="font-bold text-[#0d5f46] underline-offset-4 hover:underline" href={`/account/login?next=${encodeURIComponent(next)}`}>{t.signIn}</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
