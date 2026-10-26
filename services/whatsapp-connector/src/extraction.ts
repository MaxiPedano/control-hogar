export interface Extraction {
  detected_type: 'EXPENSE' | 'INCOME' | 'DEBT_PAYMENT' | 'OBLIGATION' | 'TASK' | 'QUERY' | 'NON_FINANCIAL' | 'AMBIGUOUS'
  amount: number | null
  currency: 'ARS' | 'USD' | null
  description: string
  transaction_date: string
  confidence: number
  notes: string
}

const DATE_RE = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/
const AMOUNT_RE = /(?:\b(?:ars|usd)\b|\$)\s*([0-9][0-9.,]*)|\b([0-9]{3,}(?:[.,][0-9]{1,2})?)\b/gi

export function extractMessage(text: string, timestamp: Date): Extraction {
  const normalized = text.toLocaleLowerCase('es-AR')
  const amountMatch = [...text.matchAll(AMOUNT_RE)].at(0)
  const rawAmount = amountMatch?.[1] ?? amountMatch?.[2] ?? null
  const amount = rawAmount ? parseAmount(rawAmount) : null
  const currency = /\busd\b|u\$s/i.test(text) ? 'USD' : /\bars\b|\$/i.test(text) ? 'ARS' : null
  const explicitDate = text.match(DATE_RE)
  const transactionDate = explicitDate ? parseDate(explicitDate) : isoDate(timestamp)
  const notes = explicitDate ? '' : 'Fecha inferida a partir de la fecha del mensaje.'

  let detectedType: Extraction['detected_type'] = 'AMBIGUOUS'
  let confidence = 0.35

  if (/\b(consulta|cu[aá]nto|pregunta|puedo)\b/.test(normalized)) {
    detectedType = 'QUERY'
    confidence = 0.75
  } else if (/\b(comprar|coordinar|revisar|colocar|hacer|arreglar)\b/.test(normalized)) {
    detectedType = 'TASK'
    confidence = 0.72
  } else if (/\b(hay que|tengo que|debo|pendiente|vencimiento)\b/.test(normalized)) {
    detectedType = 'OBLIGATION'
    confidence = 0.78
  } else if (/\b(cobr[eé]|ingreso|me pagaron|sueldo|recib[ií])\b/.test(normalized)) {
    detectedType = 'INCOME'
    confidence = 0.76
  } else if (/\b(deuda|debo)\b/.test(normalized) && /\b(pagu[eé]|pago)\b/.test(normalized)) {
    detectedType = 'DEBT_PAYMENT'
    confidence = 0.78
  } else if (/\b(pagu[eé]|gasto|compr[eé]|supermercado|nafta|internet)\b/.test(normalized)) {
    detectedType = 'EXPENSE'
    confidence = 0.72
  } else if (amount === null) {
    detectedType = 'NON_FINANCIAL'
    confidence = 0.45
  }

  if (amount === null) confidence = Math.min(confidence, 0.55)

  return {
    detected_type: detectedType,
    amount,
    currency,
    description: text.trim(),
    transaction_date: transactionDate,
    confidence,
    notes,
  }
}

function parseAmount(value: string): number | null {
  const normalized = value.replace(/\s/g, '')
  const lastComma = normalized.lastIndexOf(',')
  const lastDot = normalized.lastIndexOf('.')
  let decimalSeparator: ',' | '.' | null = null

  if (lastComma >= 0 && lastDot >= 0) decimalSeparator = lastComma > lastDot ? ',' : '.'
  else if (lastComma >= 0 && normalized.length - lastComma - 1 <= 2) decimalSeparator = ','
  else if (lastDot >= 0 && normalized.length - lastDot - 1 <= 2) decimalSeparator = '.'

  const canonical = decimalSeparator
    ? normalized.replace(decimalSeparator === ',' ? /\./g : /,/g, '').replace(decimalSeparator, '.')
    : normalized.replace(/[.,]/g, '')
  const amount = Number(canonical)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function parseDate(match: RegExpMatchArray): string {
  const day = Number(match[1])
  const month = Number(match[2])
  const yearValue = Number(match[3] ?? new Date().getFullYear())
  const year = yearValue < 100 ? 2000 + yearValue : yearValue
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
