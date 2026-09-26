"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { categorizeClientRequests, getClientRequestState, isSavedClientDraft, type ClientRequestState } from "@/lib/client-request-state";
import { getSavedClientLanguage, saveClientPreference, type ClientLanguage } from "@/lib/client-preferences";
import { getThemePreference, setThemePreference, type ThemePreference } from "@/components/theme-provider";

export type WorkspaceRequest = {
  request_code: string;
  created_at: string;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  internal_status_updated_at?: string | null;
  target_job_title: string | null;
  company_name?: string | null;
  cv_type: string;
  selected_cv_languages?: string[] | null;
  cv_language_count?: number | null;
  price_dzd?: number | null;
};

type WorkspaceProfile = {
  full_name_latin?: string | null;
  full_name_arabic?: string | null;
  email?: string | null;
  profile_data?: Record<string, unknown> | null;
};

type WorkspaceContextValue = {
  user: User | null;
  profile: WorkspaceProfile | null;
  requests: WorkspaceRequest[];
  groups: Record<ClientRequestState, WorkspaceRequest[]>;
  draft: ReturnType<typeof getDraft>;
  language: ClientLanguage;
  theme: ThemePreference;
  setLanguage: (language: ClientLanguage) => void;
  setTheme: (theme: ThemePreference) => void;
  loading: boolean;
  error: boolean;
  reload: () => void;
};

function getDraft(profile: WorkspaceProfile | null) {
  const profileData = profile?.profile_data && typeof profile.profile_data === "object" ? profile.profile_data : {};
  const value = profileData.client_request_draft;
  return isSavedClientDraft(value) ? value : null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function useAccountWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useAccountWorkspace must be used inside AccountWorkspaceShell.");
  return context;
}

const navCopy = {
  en: { dashboard: "Dashboard", create: "Create new CV", draft: "Drafts", action: "Action required", submitted: "Submitted", progress: "In progress", ready: "Ready", profile: "Profile", settings: "Settings", signOut: "Sign out", menu: "Open account menu", close: "Close menu", workspace: "CLIENT WORKSPACE", overview: "Your CV requests, all in one place", loading: "Loading your workspace…", error: "We couldn't load your requests.", retry: "Try again", createShort: "Create CV", dashboardTitle: "Client workspace", appearance: "Appearance", language: "Language", light: "Light", dark: "Dark", system: "System", account: "Account", loadingProfile: "Loading account" },
  fr: { dashboard: "Tableau de bord", create: "Créer un CV", draft: "Brouillons", action: "Action requise", submitted: "Soumises", progress: "En cours", ready: "Prêtes", profile: "Profil", settings: "Paramètres", signOut: "Déconnexion", menu: "Ouvrir le menu du compte", close: "Fermer le menu", workspace: "ESPACE CLIENT", overview: "Vos demandes de CV au même endroit", loading: "Chargement de votre espace…", error: "Impossible de charger vos demandes.", retry: "Réessayer", createShort: "Créer un CV", dashboardTitle: "Espace client", appearance: "Apparence", language: "Langue", light: "Clair", dark: "Sombre", system: "Système", account: "Compte", loadingProfile: "Chargement du compte" },
  ar: { dashboard: "لوحة التحكم", create: "إنشاء سيرة ذاتية", draft: "المسودات", action: "إجراء مطلوب", submitted: "الطلبات المرسلة", progress: "قيد المعالجة", ready: "الجاهزة", profile: "الملف الشخصي", settings: "الإعدادات", signOut: "تسجيل الخروج", menu: "فتح قائمة الحساب", close: "إغلاق القائمة", workspace: "مساحة العميل", overview: "طلبات سيرتك الذاتية في مكان واحد", loading: "جارٍ تحميل مساحة حسابك…", error: "تعذّر تحميل الطلبات.", retry: "إعادة المحاولة", createShort: "إنشاء سيرة", dashboardTitle: "مساحة العميل", appearance: "المظهر", language: "اللغة", light: "فاتح", dark: "داكن", system: "حسب الجهاز", account: "الحساب", loadingProfile: "جارٍ تحميل الحساب" },
} as const;

const authRoutes = new Set(["/account/login", "/account/register", "/account/recover"]);

export function AccountWorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const publicAuthPage = authRoutes.has(pathname);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);
  const [requests, setRequests] = useState<WorkspaceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [language, setLanguageState] = useState<ClientLanguage>("en");
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          router.replace(`/account/login?next=${encodeURIComponent(next || "/account")}`);
          return;
        }
        setUser(authUser);
        const [{ data: profileData }, requestResult] = await Promise.all([
          supabase.from("profiles").select("full_name_latin,full_name_arabic,email,profile_data").eq("id", authUser.id).maybeSingle(),
          supabase.from("cv_requests").select("request_code,created_at,internal_status_updated_at,status,payment_status,payment_method,target_job_title,company_name,cv_type,selected_cv_languages,cv_language_count,price_dzd").eq("user_id", authUser.id).order("created_at", { ascending: false }),
        ]);
        if (requestResult.error) throw requestResult.error;
        setProfile((profileData || null) as WorkspaceProfile | null);
        setRequests((requestResult.data || []) as WorkspaceRequest[]);
        const data = profileData?.profile_data && typeof profileData.profile_data === "object" ? profileData.profile_data as Record<string, unknown> : {};
        const preferences = data.preferences && typeof data.preferences === "object" ? data.preferences as Record<string, unknown> : {};
        const preferredLanguage = preferences.preferred_language;
        const nextLanguage = preferredLanguage === "ar" || preferredLanguage === "fr" || preferredLanguage === "en" ? preferredLanguage : getSavedClientLanguage();
        const preferredTheme = preferences.preferred_theme;
        const nextTheme = preferredTheme === "light" || preferredTheme === "dark" || preferredTheme === "system" ? preferredTheme : getThemePreference();
        setLanguageState(nextLanguage);
        window.localStorage.setItem("cvup_language", nextLanguage);
        setThemeState(nextTheme);
        setThemePreference(nextTheme);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (publicAuthPage) return;
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
  }, [publicAuthPage, reload]);

  const groups = useMemo(() => categorizeClientRequests(requests), [requests]);
  const draft = getDraft(profile);
  const t = navCopy[language];
  const setLanguage = (next: ClientLanguage) => {
    setLanguageState(next);
    window.localStorage.setItem("cvup_language", next);
    void saveClientPreference("preferred_language", next);
  };
  const setTheme = (next: ThemePreference) => {
    setThemeState(next);
    setThemePreference(next);
    void saveClientPreference("preferred_theme", next);
  };

  useEffect(() => {
    if (!drawerOpen) return;
    drawerRef.current?.querySelector<HTMLElement>("button, a[href], select")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
      if (event.key === "Tab" && drawerRef.current) {
        const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>("button, a[href], select")).filter((item) => !item.hasAttribute("disabled"));
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  if (publicAuthPage) return <>{children}</>;
  if (loading) return <main className="account-loading" aria-busy="true"><div className="account-loading__card"><span /><span /><span /></div></main>;
  if (error) return <main lang={language} dir={language === "ar" ? "rtl" : "ltr"} className="account-load-error"><section><h1>{t.error}</h1><button type="button" onClick={reload}>{t.retry}</button></section></main>;

  const initials = (profile?.full_name_latin || user?.email || "CV").trim().split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  const name = language === "ar" ? profile?.full_name_arabic || profile?.full_name_latin || user?.email : profile?.full_name_latin || user?.email;
  const activeView = searchParams.get("view") || "dashboard";
  const detailCode = pathname.startsWith("/account/requests/") ? pathname.split("/").at(-1) || "" : "";
  const detailRequest = detailCode ? requests.find((item) => item.request_code === detailCode) : null;
  const detailState = detailRequest ? getClientRequestState(detailRequest) : null;
  const badgeCount = (state: ClientRequestState) => groups[state].length + (state === "draft" && draft ? 1 : 0);

  const nav = <nav aria-label={language === "ar" ? "التنقل الرئيسي" : language === "fr" ? "Navigation principale" : "Main navigation"} className="account-nav">
    <p className="account-nav__section">{language === "ar" ? "عام" : language === "fr" ? "Général" : "General"}</p>
    <Link href="/account" aria-current={pathname === "/account" && activeView === "dashboard" ? "page" : undefined} onClick={() => setDrawerOpen(false)} className={`account-nav__link ${pathname === "/account" && activeView === "dashboard" ? "is-active" : ""}`}><span aria-hidden="true">⌂</span>{t.dashboard}</Link>
    <Link href="/?new=1#form" onClick={() => setDrawerOpen(false)} className="account-nav__link"><span aria-hidden="true">＋</span>{t.create}</Link>
    <p className="account-nav__section">{language === "ar" ? "طلباتي" : language === "fr" ? "Mes demandes" : "My requests"}</p>
    {(["draft", "action_required", "submitted", "in_progress", "ready"] as ClientRequestState[]).map((state) => {
      const label = state === "draft" ? t.draft : state === "action_required" ? t.action : state === "submitted" ? t.submitted : state === "in_progress" ? t.progress : t.ready;
      const active = (pathname === "/account" && activeView === state) || (Boolean(detailCode) && detailState === state);
      return <Link key={state} href={`/account?view=${state}`} aria-current={active ? "page" : undefined} onClick={() => setDrawerOpen(false)} className={`account-nav__link ${active ? "is-active" : ""}`}><span aria-hidden="true">{state === "ready" ? "✓" : state === "draft" ? "◷" : state === "action_required" ? "!" : state === "in_progress" ? "↻" : "▤"}</span>{label}<small>{badgeCount(state)}</small></Link>;
    })}
    <p className="account-nav__section">{language === "ar" ? "الحساب" : language === "fr" ? "Compte" : "Account"}</p>
    <Link href="/account/profile" aria-current={pathname === "/account/profile" ? "page" : undefined} onClick={() => setDrawerOpen(false)} className={`account-nav__link ${pathname === "/account/profile" ? "is-active" : ""}`}><span aria-hidden="true">◉</span>{t.profile}</Link>
    <Link href="/account/settings" aria-current={pathname === "/account/settings" || (pathname === "/account" && activeView === "settings") ? "page" : undefined} onClick={() => setDrawerOpen(false)} className={`account-nav__link ${pathname === "/account/settings" || (pathname === "/account" && activeView === "settings") ? "is-active" : ""}`}><span aria-hidden="true">⚙</span>{t.settings}</Link>
    <button type="button" className="account-nav__link account-nav__signout" onClick={async () => { setDrawerOpen(false); await getSupabaseBrowserClient().auth.signOut(); router.replace("/"); }}><span aria-hidden="true">↪</span>{t.signOut}</button>
  </nav>;

  const context: WorkspaceContextValue = { user, profile, requests, groups, draft, language, theme, setLanguage, setTheme, loading, error, reload };
  return <WorkspaceContext.Provider value={context}>
    <div lang={language} dir={language === "ar" ? "rtl" : "ltr"} className="account-workspace">
      <header className="account-mobile-topbar">
        <button ref={menuButtonRef} type="button" className="account-menu-trigger" aria-label={t.menu} aria-expanded={drawerOpen} aria-controls="account-navigation" onClick={() => setDrawerOpen(true)}>☰</button>
        <Link href="/account" className="account-brand"><span>CV</span> CVUp</Link>
        <Link href="/?new=1#form" className="account-mobile-create">＋</Link>
      </header>
      <div className="account-workspace__layout">
        <aside className="account-sidebar" aria-label={t.dashboardTitle}>
          <AccountIdentity initials={initials} name={name || t.loadingProfile} email={user?.email || ""} href="/account/profile" />
          {nav}
        </aside>
        {drawerOpen ? <div className="account-drawer-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) { setDrawerOpen(false); menuButtonRef.current?.focus(); } }}>
          <aside ref={drawerRef} id="account-navigation" role="dialog" aria-modal="true" aria-label={t.menu} className="account-drawer">
            <div className="account-drawer__top"><AccountIdentity initials={initials} name={name || t.loadingProfile} email={user?.email || ""} href="/account/profile" /><button type="button" aria-label={t.close} onClick={() => { setDrawerOpen(false); menuButtonRef.current?.focus(); }}>×</button></div>
            {nav}
          </aside>
        </div> : null}
        <main className="account-workspace__main">
          <div className="account-topbar"><div><p>{t.workspace}</p><span>{t.overview}</span></div><Link href="/?new=1#form" className="account-topbar__create">＋ {t.createShort}</Link></div>
          {children}
        </main>
      </div>
    </div>
  </WorkspaceContext.Provider>;
}

function AccountIdentity({ initials, name, email, href }: { initials: string; name: string; email: string; href: string }) {
  return <Link href={href} className="account-identity"><span className="account-avatar">{initials}</span><span className="account-identity__text"><strong>{name}</strong><small dir="ltr">{email}</small></span></Link>;
}
