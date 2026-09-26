import { Suspense } from "react";
import { AccountWorkspaceShell } from "@/components/account-workspace";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main className="account-loading" aria-busy="true"><div className="account-loading__card"><span /><span /><span /></div></main>}><AccountWorkspaceShell>{children}</AccountWorkspaceShell></Suspense>;
}
