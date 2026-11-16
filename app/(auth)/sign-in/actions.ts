"use server";

import { redirect } from "next/navigation";
import { safeNextPath, signInTester, type SignInFailure } from "@/lib/auth";

type State = SignInFailure | null;

export async function signIn(_prev: State, formData: FormData): Promise<State> {
  const result = await signInTester({
    name: String(formData.get("name") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok) return result;

  redirect(safeNextPath(formData.get("next")));
}
