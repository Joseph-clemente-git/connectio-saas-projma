import type { InvoiceStatus, PaymentStatus } from '@/types/domain'

export function formatMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function invoiceStatusVariant(status: InvoiceStatus) {
  if (status === 'paid') return 'success' as const
  if (status === 'overdue') return 'destructive' as const
  if (status === 'open') return 'warning' as const
  return 'secondary' as const
}

export function paymentStatusVariant(status: PaymentStatus) {
  if (status === 'succeeded') return 'success' as const
  if (status === 'failed') return 'destructive' as const
  return 'warning' as const
}
