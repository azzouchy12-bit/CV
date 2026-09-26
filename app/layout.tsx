import type { Metadata } from "next";
import { Cairo, Geist, Geist_Mono, Lateef, Tajawal } from "next/font/google";
import "./globals.css";
import "./hero-ux.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const lateef = Lateef({
  variable: "--font-lateef",
  subsets: ["arabic"],
  weight: "400",
});

const cairo = Cairo({ variable: "--font-arabic-heading", subsets: ["arabic"], weight: ["600", "700"] });
const tajawal = Tajawal({ variable: "--font-arabic-body", subsets: ["arabic"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "CVUp | Votre expérience, mieux présentée",
  description: "CVUp helps job seekers create professional, ATS-friendly CVs and Cover Letters based on their real experience and goals.",
  icons: { icon: "/brand/cvup-logo.png", apple: "/brand/cvup-logo.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${lateef.variable} ${cairo.variable} ${tajawal.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('cvup_theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light';var p=new URLSearchParams(location.search);if(p.has('new')||p.has('edit'))document.documentElement.dataset.clientFlow='true'}catch(e){}` }} />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
