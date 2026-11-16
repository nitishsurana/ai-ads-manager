"use client";

import { useActionState } from "react";
import { signIn } from "@/app/admin/sign-in/actions";
import { Field } from "@/components/auth/field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/messages";

export function AdminSignInForm() {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <form
      action={action}
      className="flex flex-col gap-4.5 rounded-xl border border-border bg-card p-7 shadow-xs"
    >
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-xl font-semibold tracking-tight">
          Admin sign in
        </h1>
        <p className="m-0 text-muted-foreground">For the test admin.</p>
      </div>
      <Field
        id="admin-pw"
        name="password"
        type="password"
        label="Admin password"
        autoComplete="current-password"
        placeholder="Admin password"
      />
      {state && !state.ok && (
        <Alert tone="error" message={messages[state.code]} />
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
