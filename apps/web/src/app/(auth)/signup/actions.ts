"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignupActionState = { error: string | null; checkEmail: boolean };

export async function signup(_prevState: SignupActionState, formData: FormData): Promise<SignupActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message, checkEmail: false };
  }

  // With email confirmations disabled (local dev default), signUp already
  // returns an active session. With confirmations required, it won't.
  if (data.session) {
    redirect("/dashboard");
  }

  return { error: null, checkEmail: true };
}
