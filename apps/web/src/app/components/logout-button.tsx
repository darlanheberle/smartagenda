"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.agendasmart.com.br";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);

    try {
      await fetch(`${apiUrl}/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      aria-label="Sair da conta"
      className={
        compact
          ? "grid size-9 shrink-0 place-items-center rounded-md text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink)] disabled:opacity-50"
          : "btn-secondary"
      }
      disabled={loading}
      onClick={() => void logout()}
      type="button"
    >
      <LogOut size={16} />
      {!compact ? (loading ? "Saindo..." : "Sair") : null}
    </button>
  );
}
