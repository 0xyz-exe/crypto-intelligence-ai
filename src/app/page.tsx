import { Suspense } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import AuthScreen from "./auth-screen";
import Workspace from "./workspace";
import { getAuthStore } from "@/lib/server/database";
import { SESSION_COOKIE_NAME } from "@/lib/server/session";

async function ProtectedHome() {
  await connection();
  const auth = getAuthStore();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!auth.verify(token, Date.now())) return <AuthScreen mode={auth.needsSetup() ? "setup" : "login"} />;
  return <Workspace />;
}

export default function Home() {
  return (
    <Suspense fallback={<main className="min-h-screen grid place-items-center bg-[#0b1014] text-[#83919a]" aria-busy="true">Loading local workspace…</main>}>
      <ProtectedHome />
    </Suspense>
  );
}
