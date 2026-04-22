export function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
  }).format(new Date(value));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}