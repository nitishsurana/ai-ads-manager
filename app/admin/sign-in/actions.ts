"use server";

import { redirect } from "next/navigation";
import { signInAdmin, type SignInFailure } from "@/lib/auth";

type State = SignInFailure | null;

export async function signIn(_prev: State, formData: FormData): Promise<State> {
  const result = await signInAdmin(String(formData.get("password") ?? ""));
  if (!result.ok) return result;

  redirect("/admin");
}
