export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

export function formatDay(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

export function formatDuration(startsAt: string, endsAt?: string) {
  if (!endsAt) {
    return "";
  }

  const minutes = Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000));
  return minutes ? `${minutes} min` : "";
}

export function formatRelativeStart(value: string) {
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);

  if (minutes <= 0) {
    return "agora";
  }

  if (minutes < 60) {
    return `em ${minutes} min`;
  }

  const hours = Math.round(minutes / 60);
  return `em ${hours}h`;
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "profissional";
}

export function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "SA"
  );
}
