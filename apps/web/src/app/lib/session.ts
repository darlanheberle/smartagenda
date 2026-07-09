import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AccountProfessional = {
  id: string;
  name: string;
  specialty?: string;
  gmail: string;
  whatsappNumber: string;
};

export function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
}

export async function requireAccount(redirectTo: string) {
  const apiUrl = getApiUrl();
  const cookieHeader = (await cookies()).toString();
  const sessionResponse = await fetch(`${apiUrl}/auth/me`, {
    cache: "no-store",
    headers: { cookie: cookieHeader }
  }).catch(() => undefined);

  if (!sessionResponse?.ok) {
    redirect(`/login?next=${encodeURIComponent(redirectTo)}`);
  }

  const account = (await sessionResponse.json()) as { professional: AccountProfessional };
  return { account: account.professional, cookieHeader, apiUrl };
}

export async function fetchJson<T>(path: string, fallback: T, cookieHeader: string): Promise<T> {
  const apiUrl = getApiUrl();

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      cache: "no-store",
      headers: { cookie: cookieHeader }
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}
