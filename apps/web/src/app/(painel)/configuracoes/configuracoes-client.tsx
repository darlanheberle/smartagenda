"use client";

import { ImagePlus, NotebookTabs, RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import { Card, SectionTitle } from "../components/ui";
import type { AccountProfessional, ProfessionalBranding } from "../lib/types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.agendasmart.com.br";

type BrandingForm = ProfessionalBranding;

const defaultBranding: BrandingForm = {
  logoUrl: null,
  themePrimary: "#7c3aed",
  themePrimaryDark: "#6d28d9",
  themeAccent: "#4f46e5",
  themeBackground: "#f8fafc",
  themeSurface: "#ffffff",
  themeText: "#0f172a",
  themeSuccess: "#059669"
};

const colorFields = [
  { key: "themePrimary", label: "Marca", helper: "Botoes, menu ativo e acoes principais." },
  { key: "themePrimaryDark", label: "Marca escura", helper: "Hover, gradientes e destaques fortes." },
  { key: "themeAccent", label: "Destaque", helper: "Final de gradientes e detalhes de apoio." },
  { key: "themeBackground", label: "Fundo", helper: "Cor geral da area profissional." },
  { key: "themeSurface", label: "Cartoes", helper: "Cards, menu, barras e superficies." },
  { key: "themeText", label: "Texto", helper: "Titulos e textos principais." },
  { key: "themeSuccess", label: "Sucesso", helper: "WhatsApp, status ativo e confirmacoes." }
] as const;

const presets: Array<{ name: string; colors: Omit<BrandingForm, "logoUrl"> }> = [
  {
    name: "Agenda Smart",
    colors: {
      themePrimary: "#7c3aed",
      themePrimaryDark: "#6d28d9",
      themeAccent: "#4f46e5",
      themeBackground: "#f8fafc",
      themeSurface: "#ffffff",
      themeText: "#0f172a",
      themeSuccess: "#059669"
    }
  },
  {
    name: "Clinica clara",
    colors: {
      themePrimary: "#0891b2",
      themePrimaryDark: "#0e7490",
      themeAccent: "#2563eb",
      themeBackground: "#f0fdfa",
      themeSurface: "#ffffff",
      themeText: "#083344",
      themeSuccess: "#10b981"
    }
  },
  {
    name: "Studio premium",
    colors: {
      themePrimary: "#111827",
      themePrimaryDark: "#020617",
      themeAccent: "#be123c",
      themeBackground: "#f8fafc",
      themeSurface: "#ffffff",
      themeText: "#111827",
      themeSuccess: "#047857"
    }
  },
  {
    name: "Beleza soft",
    colors: {
      themePrimary: "#db2777",
      themePrimaryDark: "#be185d",
      themeAccent: "#f59e0b",
      themeBackground: "#fff7ed",
      themeSurface: "#ffffff",
      themeText: "#3f1d2b",
      themeSuccess: "#16a34a"
    }
  }
];

export function ConfiguracoesClient({ account }: { account: AccountProfessional }) {
  const [form, setForm] = useState<BrandingForm>({ ...defaultBranding, ...account.branding });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateColor(key: keyof BrandingForm, value: string) {
    setMessage("");
    setError("");
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyPreset(colors: Omit<BrandingForm, "logoUrl">) {
    setMessage("");
    setError("");
    setForm((current) => ({ ...current, ...colors }));
  }

  async function handleLogoFile(file?: File) {
    if (!file) {
      return;
    }

    setError("");
    setMessage("");

    if (!file.type.startsWith("image/")) {
      setError("Escolha um arquivo de imagem.");
      return;
    }

    if (file.size > 200 * 1024) {
      setError("Use uma imagem menor que 200 KB para este prototipo.");
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    setForm((current) => ({ ...current, logoUrl: dataUrl }));
  }

  async function saveBranding() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${apiUrl}/profile/branding`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const saved = (await response.json()) as BrandingForm;
      setForm({ ...defaultBranding, ...saved });
      setMessage("Identidade visual salva. Recarregue o painel para aplicar em todas as abas abertas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar a identidade visual.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-violet-700">Identidade do profissional</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950">Configuracoes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Personalize logo e cores para deixar o painel com a cara do profissional.
        </p>
      </header>

      {message ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
      ) : null}

      <Card className="overflow-hidden p-5">
        <SectionTitle
          subtitle="Veja como a marca aparece no topo do sistema antes de salvar."
          title="Preview da pagina profissional"
        />
        <div
          className="mt-5 overflow-hidden rounded-3xl border border-slate-100 shadow-sm"
          style={{ background: form.themeBackground, color: form.themeText }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-black/5 p-4" style={{ background: form.themeSurface }}>
            <div className="flex items-center gap-3">
              <PreviewLogo logoUrl={form.logoUrl} primary={form.themePrimary} />
              <div>
                <p className="font-display text-base font-bold">SmartAgenda</p>
                <p className="text-xs opacity-65">{account.name}</p>
              </div>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-bold text-white"
              style={{ background: form.themeSuccess }}
            >
              IA ativa
            </span>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-[1.2fr_0.8fr]">
            <div
              className="rounded-3xl p-5 text-white shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${form.themePrimary}, ${form.themePrimaryDark}, ${form.themeAccent})`
              }}
            >
              <p className="text-sm font-semibold opacity-80">Proximo atendimento</p>
              <p className="mt-3 font-display text-2xl font-bold">Cliente exemplo</p>
              <p className="mt-1 text-sm opacity-80">Servico personalizado - 60 min</p>
            </div>
            <div className="rounded-3xl p-5 shadow-sm" style={{ background: form.themeSurface }}>
              <p className="text-xs font-bold uppercase opacity-50">Hoje</p>
              <p className="mt-3 font-display text-3xl font-bold">R$ 520</p>
              <p className="mt-1 text-sm opacity-60">faturamento previsto</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle subtitle="Use uma URL ou envie um arquivo pequeno para substituir o icone padrao." title="Logo" />
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-4">
            <PreviewLogo logoUrl={form.logoUrl} primary={form.themePrimary} />
            <div className="min-w-0">
              <p className="font-semibold text-slate-950">Logo do profissional</p>
              <p className="text-sm text-slate-500">Sem logo, o sistema usa o icone de agenda/caderno.</p>
            </div>
          </div>

          <label className="block text-sm font-semibold text-slate-700" htmlFor="logo-url">
            URL da imagem
            <input
              className="app-input mt-2 min-h-14"
              id="logo-url"
              onChange={(event) => setForm({ ...form, logoUrl: event.target.value })}
              placeholder="https://..."
              value={form.logoUrl || ""}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="app-button-secondary cursor-pointer">
              <ImagePlus size={17} />
              Enviar imagem
              <input
                accept="image/*"
                className="sr-only"
                onChange={(event) => void handleLogoFile(event.target.files?.[0])}
                type="file"
              />
            </label>
            <button
              className="app-button-secondary"
              onClick={() => setForm((current) => ({ ...current, logoUrl: null }))}
              type="button"
            >
              <RotateCcw size={17} />
              Usar icone padrao
            </button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle subtitle="Escolha um ponto de partida e ajuste as 7 cores do painel." title="Paleta de cores" />
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {presets.map((preset) => (
            <button
              className="min-h-16 rounded-2xl border border-slate-100 bg-white p-2 text-left text-xs font-bold text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              key={preset.name}
              onClick={() => applyPreset(preset.colors)}
              type="button"
            >
              <span className="mb-2 grid grid-cols-4 gap-1">
                {Object.values(preset.colors)
                  .slice(0, 4)
                  .map((color) => (
                    <span className="h-5 rounded-lg" key={color} style={{ background: color }} />
                  ))}
              </span>
              {preset.name}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {colorFields.map((field) => (
            <label
              className="grid gap-3 rounded-3xl bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
              htmlFor={field.key}
              key={field.key}
            >
              <span>
                <span className="block font-semibold text-slate-950">{field.label}</span>
                <span className="mt-1 block text-sm text-slate-500">{field.helper}</span>
              </span>
              <span className="flex min-h-12 items-center gap-3">
                <input
                  aria-label={field.label}
                  className="h-12 w-16 cursor-pointer rounded-2xl border border-slate-100 bg-white p-1"
                  id={field.key}
                  onChange={(event) => updateColor(field.key, event.target.value)}
                  type="color"
                  value={form[field.key]}
                />
                <input
                  className="app-input h-12 w-32 font-semibold uppercase tabular"
                  onChange={(event) => updateColor(field.key, event.target.value)}
                  value={form[field.key]}
                />
              </span>
            </label>
          ))}
        </div>

        <button className="app-button-primary mt-5 w-full" disabled={saving} onClick={() => void saveBranding()} type="button">
          <Save size={17} />
          {saving ? "Salvando..." : "Salvar personalizacao"}
        </button>
      </Card>
    </div>
  );
}

function PreviewLogo({ logoUrl, primary }: { logoUrl?: string | null; primary: string }) {
  if (logoUrl) {
    return (
      <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <img alt="Logo do profissional" className="h-full w-full object-cover" src={logoUrl} />
      </span>
    );
  }

  return (
    <span className="grid size-14 shrink-0 place-items-center rounded-2xl text-white shadow-sm" style={{ background: primary }}>
      <NotebookTabs size={25} />
    </span>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    reader.readAsDataURL(file);
  });
}
