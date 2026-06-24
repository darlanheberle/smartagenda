"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.agendasmart.com.br";

export function LogoutButton() {
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
      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={loading}
      onClick={() => void logout()}
      type="button"
    >
      <LogOut size={16} />
      {loading ? "Saindo..." : "Sair"}
    </button>
  );
}
