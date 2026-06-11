export function money(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function dateInput(value?: string | Date) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}
