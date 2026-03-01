import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decrypt, type SessionPayload } from "./session";

export const verifySession = cache(async (): Promise<{
  userId: string;
  role: "ADMIN" | "SALES";
}> => {
  const cookieStore = await cookies();
  const session = await decrypt(cookieStore.get("session")?.value);

  if (!session?.userId) {
    redirect("/login");
  }

  return { userId: session.userId, role: session.role };
});

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies();
  return decrypt(cookieStore.get("session")?.value);
});
