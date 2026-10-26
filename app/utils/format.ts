export function formatMoney(n: number | null | undefined): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(n ?? 0)
}

export function formatHours(n: number | null | undefined): string {
  const v = Math.round((n ?? 0) * 100) / 100
  return `${v.toLocaleString('es-AR')} h`
}

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function monthName(m: number): string {
  return MONTHS_ES[m - 1] ?? ''
}

export function monthOptions(): Array<{ label: string; value: number }> {
  return MONTHS_ES.map((label, i) => ({ label, value: i + 1 }))
}

export function yearOptions(): number[] {
  const now = new Date().getFullYear()
  const years: number[] = []
  for (let y = now + 1; y >= now - 3; y--) years.push(y)
  return years
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
