"use server";

import { redirect } from "next/navigation";
import { clearAdminSession, setAdminSession, validAdminPassword } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!validAdminPassword(password)) redirect("/login?error=invalid");
  await setAdminSession();
  redirect("/studio");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/login");
}
