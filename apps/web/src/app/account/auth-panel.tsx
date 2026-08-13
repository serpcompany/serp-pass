"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/auth/client";

type Mode = "sign-in" | "sign-up";

export function AuthPanel() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") ?? "");
    const password = String(fields.get("password") ?? "");
    const name = String(fields.get("name") ?? "");

    const result = mode === "sign-up"
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password });

    if (result.error) {
      setMessage(result.error.message ?? "The request could not be completed.");
    } else {
      setMessage(mode === "sign-up" ? "Account created and signed in." : "Signed in.");
      router.refresh();
    }
    setSubmitting(false);
  }

  async function signOut() {
    setSubmitting(true);
    const result = await authClient.signOut();
    setMessage(result.error?.message ?? "Signed out.");
    setSubmitting(false);
    router.refresh();
  }

  if (isPending) {
    return <p className="muted">Checking the D1-backed human session…</p>;
  }

  if (session) {
    return (
      <section className="account-card">
        <span className="status active">Human session active</span>
        <h1>Welcome, {session.user.name}</h1>
        <p><strong>Email:</strong> {session.user.email}</p>
        <p className="muted">This browser cookie represents you as a human. It is deliberately separate from any extension App-session token.</p>
        <button type="button" onClick={signOut} disabled={submitting}>Sign out</button>
        {message && <p role="status">{message}</p>}
      </section>
    );
  }

  return (
    <section className="account-card">
      <span className="status">No human session</span>
      <h1>{mode === "sign-up" ? "Create a pilot account" : "Sign in"}</h1>
      <p className="muted">Email/password is the private-pilot sign-in method. No Stripe account is connected by this form.</p>
      <form onSubmit={submit}>
        {mode === "sign-up" && (
          <label>Name<input name="name" autoComplete="name" minLength={2} required /></label>
        )}
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={8} required /></label>
        <button type="submit" disabled={submitting}>{submitting ? "Working…" : mode === "sign-up" ? "Create account" : "Sign in"}</button>
      </form>
      <button className="text-button" type="button" onClick={() => { setMode(mode === "sign-up" ? "sign-in" : "sign-up"); setMessage(""); }}>
        {mode === "sign-up" ? "Already have an account? Sign in" : "Need a pilot account? Create one"}
      </button>
      {message && <p role="status" className="form-message">{message}</p>}
    </section>
  );
}
