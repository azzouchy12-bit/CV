"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { safeInternalRedirect } from "@/lib/auth-redirect";
import { getSavedClientLanguage } from "@/lib/client-preferences";

type Language = "ar" | "fr" | "en";

const copy = {
  en: {
    title: "Welcome back",
    subtitle: "Sign in to manage your CV requests and saved information.",
    google: "Continue with Google",
    divider: "or continue with email",
    email: "Email address",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    forgot: "Forgot password?",
    new: "New to CVUp?",
    create: "Create account",
    session: "Your account stays signed in on this browser until you sign out or the session expires.",
    invalid: "Incorrect email or password.",
    unverified: "Please verify your email before signing in.",
    generic: "We couldn't sign you in. Please try again.",
    oauthError: "Google sign-in could not be completed. Try again or sign in with email and password.",
  },
  fr: {
    title: "Bon retour",
    subtitle: "Connectez-vous pour gérer vos demandes de CV et vos informations enregistrées.",
    google: "Continuer avec Google",
    divider: "ou continuer avec l’e-mail",
    email: "Adresse e-mail",
    password: "Mot de passe",
    signIn: "Se connecter",
    signingIn: "Connexion…",
    forgot: "Mot de passe oublié ?",
    new: "Nouveau sur CVUp ?",
    create: "Créer un compte",
    session: "Votre session reste active sur ce navigateur jusqu’à votre déconnexion ou son expiration.",
    invalid: "E-mail ou mot de passe incorrect.",
    unverified: "Veuillez confirmer votre e-mail avant de vous connecter.",
    generic: "Impossible de vous connecter. Veuillez réessayer.",
    oauthError: "La connexion Google n’a pas abouti. Réessayez ou connectez-vous avec votre e-mail et votre mot de passe.",
  },
  ar: {
    title: "مرحبًا بعودتك",
    subtitle: "سجّل الدخول لإدارة طلبات السيرة الذاتية ومعلوماتك المحفوظة.",
    google: "المتابعة باستخدام Google",
    divider: "أو المتابعة بالبريد الإلكتروني",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    signIn: "تسجيل الدخول",
    signingIn: "جارٍ تسجيل الدخول…",
    forgot: "نسيت كلمة المرور؟",
    new: "ليس لديك حساب؟",
    create: "إنشاء حساب",
    session: "يبقى حسابك مسجلاً على هذا المتصفح إلى أن تسجّل الخروج أو تنتهي الجلسة.",
    invalid: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    unverified: "يرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول.",
    generic: "تعذر تسجيل الدخول. حاول مرة أخرى.",
    oauthError: "تعذر إكمال تسجيل الدخول عبر Google. حاول مجددًا أو استخدم البريد وكلمة المرور.",
  },
} as const;

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.55l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"/></svg>;
}

function mapError(message: string, language: Language) {
  const normalized = message.toLowerCase();
  if (normalized.includes("email not confirmed")) return copy[language].unverified;
  if (normalized.includes("invalid login") || normalized.includes("invalid credentials")) return copy[language].invalid;
  return copy[language].generic;
}

export default function Login() {
  const [next, setNext] = useState("/account");
  const [language, setLanguage] = useState<Language>("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const resolvedNext = safeInternalRedirect(new URLSearchParams(window.location.search).get("next"), "/account", window.location.origin);
    const currentLanguage: Language = getSavedClientLanguage();
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setNext(resolvedNext);
      setLanguage(currentLanguage);
      if (new URLSearchParams(window.location.search).has("error")) setMessage(copy[currentLanguage].oauthError);
      if (data.session) window.location.replace(resolvedNext);
      else setChecking(false);
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
      setMessage(mapError(error.message, language));
      setSubmitting(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);
    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setMessage(mapError(error.message, language));
      setSubmitting(false);
      return;
    }
    window.location.replace(next);
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
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 outline-none transition focus:border-[#102019] focus:ring-2 focus:ring-[#102019]/10"
            />
          </label>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-semibold">{t.password}</span>
            <input
              required
              minLength={8}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 outline-none transition focus:border-[#102019] focus:ring-2 focus:ring-[#102019]/10"
            />
          </label>

          {message ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}

          <button
            disabled={checking || submitting}
            className="mt-6 min-h-13 w-full rounded-full bg-[#102019] px-6 py-3.5 font-bold text-white transition hover:bg-[#183126] disabled:cursor-wait disabled:opacity-55"
          >
            {submitting ? t.signingIn : t.signIn}
          </button>
        </form>

        <Link href={`/account/recover?next=${encodeURIComponent(next)}`} className="mt-4 block text-center text-sm font-semibold text-[#0d5f46] underline-offset-4 hover:underline">{t.forgot}</Link>

        <div className="mt-7 border-t border-slate-100 pt-6 text-center">
          <p className="text-sm text-slate-500">{t.new}{" "}
            <Link className="font-bold text-[#0d5f46] underline-offset-4 hover:underline" href={`/account/register?next=${encodeURIComponent(next)}`}>{t.create}</Link>
          </p>
          <p className="mt-4 text-xs leading-5 text-slate-400">{t.session}</p>
        </div>
      </section>
    </main>
  );
}
