"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../../utils/supabase/client";

function safeRedirectTarget(raw: string | null) {
  if (raw && raw.startsWith("/admin") && raw !== "/admin/login") return raw;
  return "/admin";
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectTarget(searchParams.get("redirectTo"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("Incorrect email or password.");
      setSubmitting(false);
      return;
    }

    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <form className="admin-box" onSubmit={handleSubmit}>
      <div className="admin-title">Leader Login</div>
      <div className="admin-subtitle">Anthem Students Hub</div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-field">
        <label className="admin-label" htmlFor="admin-email">
          Email
        </label>
        <input
          id="admin-email"
          className="admin-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          autoFocus
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          className="admin-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      <button className="btn primary" type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>

      <div className="admin-footnote">Forgot password</div>
    </form>
  );
}
