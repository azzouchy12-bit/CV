"use client";

import { useAccountWorkspace } from "@/components/account-workspace";
import Link from "next/link";

const labels={
  ar:{title:"الإعدادات",intro:"خصص طريقة استخدام مساحة العميل.",general:"عام",language:"لغة الواجهة",appearance:"المظهر",light:"فاتح",dark:"داكن",system:"حسب إعداد الجهاز",account:"الحساب والأمان",email:"البريد الإلكتروني",provider:"طريقة تسجيل الدخول",google:"Google",emailLogin:"البريد الإلكتروني",securityNote:"يتم التحقق من البريد الإلكتروني عبر حسابك، ولا يمكن تغييره من هذه الصفحة.",changePassword:"تغيير كلمة المرور"},
  fr:{title:"Paramètres",intro:"Personnalisez votre espace client.",general:"Général",language:"Langue de l’interface",appearance:"Apparence",light:"Clair",dark:"Sombre",system:"Selon l’appareil",account:"Compte et sécurité",email:"E-mail",provider:"Connexion utilisée",google:"Google",emailLogin:"E-mail",securityNote:"Votre adresse est vérifiée par votre compte et ne peut pas être modifiée ici.",changePassword:"Changer le mot de passe"},
  en:{title:"Settings",intro:"Choose how your client workspace behaves.",general:"General",language:"Interface language",appearance:"Appearance",light:"Light",dark:"Dark",system:"System",account:"Account and security",email:"Email",provider:"Sign-in method",google:"Google",emailLogin:"Email",securityNote:"Your email is verified by your account and cannot be changed here.",changePassword:"Change password"},
} as const;

export default function AccountSettingsPage(){
  const {language,setLanguage,theme,setTheme,user}=useAccountWorkspace(); const t=labels[language];
  const providers=Array.isArray(user?.app_metadata?.providers)?user.app_metadata.providers:[user?.app_metadata?.provider].filter((value):value is string=>typeof value==="string");
  const provider=providers.includes("google")?t.google:t.emailLogin;
  const choices=[{id:"ar" as const,label:"العربية"},{id:"fr" as const,label:"Français"},{id:"en" as const,label:"English"}];
  const themes=[{id:"light" as const,label:t.light},{id:"dark" as const,label:t.dark},{id:"system" as const,label:t.system}];
  return <main className="account-settings-page" lang={language} dir={language==="ar"?"rtl":"ltr"}>
    <header><h1>{t.title}</h1><p>{t.intro}</p></header>
    <section className="account-panel account-settings-section"><h2>{t.general}</h2>
      <fieldset><legend>{t.language}</legend><div className="account-settings-options" role="group" aria-label={t.language}>{choices.map(choice=><button key={choice.id} type="button" aria-pressed={language===choice.id} className={language===choice.id?"is-selected":""} onClick={()=>setLanguage(choice.id)}>{choice.label}</button>)}</div></fieldset>
      <fieldset><legend>{t.appearance}</legend><div className="account-settings-options" role="group" aria-label={t.appearance}>{themes.map(choice=><button key={choice.id} type="button" aria-pressed={theme===choice.id} className={theme===choice.id?"is-selected":""} onClick={()=>setTheme(choice.id)}>{choice.label}</button>)}</div></fieldset>
    </section>
    <section className="account-panel account-settings-section"><h2>{t.account}</h2><dl><div><dt>{t.email}</dt><dd dir="ltr">{user?.email||"—"}</dd></div><div><dt>{t.provider}</dt><dd>{provider}</dd></div></dl><p>{t.securityNote}</p>{!providers.includes("google")?<Link className="account-profile-button" href="/account/recover">{t.changePassword}</Link>:null}</section>
  </main>;
}
