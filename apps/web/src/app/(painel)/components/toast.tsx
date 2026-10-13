"use client";

import { Check, Trash2, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

type ToastVariant = "success" | "danger";
type ToastItem = { id: number; message: string; variant: ToastVariant };

type ToastApi = {
  /** Verde. Padrao: "Cadastrado com sucesso". */
  created: (message?: string) => void;
  /** Verde. Padrao: "Alterações gravadas". */
  saved: (message?: string) => void;
  /** Vermelho. Padrao: "Deletado com sucesso". */
  deleted: (message?: string) => void;
  /** Verde com texto livre. */
  success: (message: string) => void;
  /** Vermelho com texto livre (erros). */
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast precisa estar dentro de <ToastProvider>.");
  }

  return context;
}

let toastCounter = 0;
const TOAST_DURATION_MS = 3400;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((message: string, variant: ToastVariant) => {
    const id = ++toastCounter;
    setToasts((current) => [...current, { id, message, variant }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      created: (message) => push(message ?? "Cadastrado com sucesso", "success"),
      saved: (message) => push(message ?? "Alterações gravadas", "success"),
      deleted: (message) => push(message ?? "Deletado com sucesso", "danger"),
      success: (message) => push(message, "success"),
      error: (message) => push(message, "danger")
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-label="Notificações"
        className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]"
        role="region"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} onDismiss={() => dismiss(toast.id)} toast={toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  const isSuccess = toast.variant === "success";

  return (
    <div
      className={`toast-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${
        isSuccess ? "bg-emerald-600 shadow-emerald-200" : "bg-rose-600 shadow-rose-200"
      }`}
      role={isSuccess ? "status" : "alert"}
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/20">
        {isSuccess ? <Check size={15} strokeWidth={3} /> : <Trash2 size={14} />}
      </span>
      <span className="min-w-0 flex-1">{toast.message}</span>
      <button
        aria-label="Fechar"
        className="grid size-7 shrink-0 place-items-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        onClick={onDismiss}
        type="button"
      >
        <X size={16} />
      </button>
    </div>
  );
}
