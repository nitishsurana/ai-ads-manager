"use client";

import { useActionState } from "react";
import { signIn } from "@/app/(auth)/sign-in/actions";
import { Field } from "@/components/auth/field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/messages";

export function TesterSignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <form
      action={action}
      className="flex flex-col gap-4.5 rounded-xl border border-border bg-card p-7 shadow-xs"
    >
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-xl font-semibold tracking-tight">
          Sign in to test
        </h1>
        <p className="m-0 text-muted-foreground">For the internal test team.</p>
      </div>
      <Field
        id="name"
        name="name"
        label="Your name"
        autoComplete="name"
        placeholder="e.g. Priya"
        hint="Shown on your rounds so the team knows who rated what."
      />
      <Field
        id="pw"
        name="password"
        type="password"
        label="Tester password"
        autoComplete="current-password"
        placeholder="Shared tester password"
      />
      {state && !state.ok && (
        <Alert tone="error" message={messages[state.code]} />
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <Alert
        tone="info"
        message="Work is saved in this browser only. Clearing browser data starts fresh."
      />
    </form>
  );
}
