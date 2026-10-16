"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type AuthMode = "setup" | "login";

export default function AuthScreen({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isSetup = mode === "setup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(isSetup ? "/api/auth/setup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Sign-in could not be completed.");
        return;
      }
      setPassword("");
      router.refresh();
    } catch {
      setError("The local app could not be reached. Check that it is running and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#0b1014] text-[#e9eff1]">
      <section className="w-full max-w-md rounded-2xl border border-[#202b32] bg-[#11191f] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold tracking-tight">Cipher<span className="text-[#43d6a0]">Scope</span></div>
          <p className="mt-2 text-xs tracking-[0.18em] text-[#83919a]">LOCAL · SINGLE-USER WORKSPACE</p>
        </div>
        <h1 className="text-xl font-semibold">{isSetup ? "Set up your local account" : "Sign in to CipherScope"}</h1>
        <p className="mt-3 text-sm leading-6 text-[#a7b4ba]">
          {isSetup
            ? "Choose a password to protect this app on this PC. Your app data stays in a local SQLite database; this does not connect an exchange account."
            : "Enter the local password you created for this PC."}
        </p>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          <label htmlFor="local-password" className="grid gap-2 text-sm font-medium">
            Local password
            <input
              id="local-password"
              name="password"
              type="password"
              autoComplete={isSetup ? "new-password" : "current-password"}
              minLength={isSetup ? 12 : undefined}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-[#334149] bg-[#0b1014] px-3 py-3 text-[#e9eff1] outline-none focus:border-[#43d6a0] focus:ring-2 focus:ring-[#43d6a0]/20"
            />
          </label>
          {error && <p role="alert" className="rounded-lg border border-[#fa7185]/30 bg-[#fa7185]/10 p-3 text-sm text-[#ff9aa9]">{error}</p>}
          <button
            type="submit"
            disabled={busy || (isSetup && [...password].length < 12)}
            className="rounded-lg bg-[#43d6a0] px-4 py-3 font-semibold text-[#07140f] transition hover:bg-[#63e5b7] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Please wait…" : isSetup ? "Create local account" : "Sign in"}
          </button>
        </form>
        {isSetup && <p className="mt-5 text-xs leading-5 text-[#83919a]">Use a password you can keep safely. There is no online account or cloud password recovery.</p>}
      </section>
    </main>
  );
}
