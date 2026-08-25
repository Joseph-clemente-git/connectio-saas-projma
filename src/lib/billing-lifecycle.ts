import { db } from '@/db/schema'
import type { BillingLifecycleEvent, Payment, PaymentStatus } from '@/types/domain'

type NewBillingEvent = Omit<BillingLifecycleEvent, 'id' | 'createdAt' | 'correlationId'> & {
  correlationId?: string
  createdAt?: string
}

/** Records only identifiers and display-safe messages; never pass card, token, or password data. */
export async function recordBillingEvent(input: NewBillingEvent): Promise<BillingLifecycleEvent> {
  const event: BillingLifecycleEvent = {
    ...input,
    id: crypto.randomUUID(),
    correlationId: input.correlationId ?? crypto.randomUUID(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
  await db.billingEvents.add(event)
  return event
}

/** Connects pre-organization registration events to the tenant created during onboarding. */
export async function linkRegistrationEventsToOrganization(userId: string, orgId: string): Promise<void> {
  await db.billingEvents.where('userId').equals(userId).filter((event) => !event.orgId).modify({ orgId })
}

export async function startPaymentAttempt(input: {
  invoiceId: string
  methodBrand: Payment['methodBrand']
  methodLast4: string
  correlationId?: string
}): Promise<Payment> {
  if (!/^\d{4}$/.test(input.methodLast4)) throw new Error('Payment method last four digits are invalid.')
  const invoice = await db.invoices.get(input.invoiceId)
  if (!invoice || invoice.status === 'void' || invoice.status === 'paid') throw new Error('This invoice cannot be paid.')
  const now = new Date().toISOString()
  const correlationId = input.correlationId ?? crypto.randomUUID()
  const payment: Payment = {
    id: crypto.randomUUID(),
    orgId: invoice.orgId,
    invoiceId: invoice.id,
    amount: invoice.amount,
    currency: invoice.currency,
    status: 'pending',
    methodBrand: input.methodBrand,
    methodLast4: input.methodLast4,
    createdAt: now,
  }
  await db.transaction('rw', [db.payments, db.billingEvents], async () => {
    await db.payments.add(payment)
    await db.billingEvents.add({
      id: crypto.randomUUID(), correlationId, orgId: invoice.orgId, invoiceId: invoice.id,
      paymentId: payment.id, event: 'payment.attempt_started', status: 'pending',
      message: `Payment attempt started for ${invoice.number}.`, createdAt: now,
    })
  })
  return payment
}

export async function settlePaymentAttempt(paymentId: string, status: Extract<PaymentStatus, 'succeeded' | 'failed'>, correlationId = crypto.randomUUID()): Promise<void> {
  const payment = await db.payments.get(paymentId)
  if (!payment || payment.status !== 'pending') throw new Error('This payment attempt cannot be updated.')
  const invoice = await db.invoices.get(payment.invoiceId)
  if (!invoice) throw new Error('The invoice for this payment no longer exists.')
  const now = new Date().toISOString()
  await db.transaction('rw', [db.payments, db.invoices, db.billingEvents, db.auditLogs], async () => {
    await db.payments.update(payment.id, { status, paidAt: status === 'succeeded' ? now : undefined })
    await db.invoices.update(invoice.id, { status: status === 'succeeded' ? 'paid' : 'open' })
    await db.billingEvents.add({
      id: crypto.randomUUID(), correlationId, orgId: payment.orgId, invoiceId: invoice.id,
      paymentId: payment.id, event: status === 'succeeded' ? 'payment.succeeded' : 'payment.failed', status,
      message: status === 'succeeded' ? `Payment succeeded for ${invoice.number}.` : `Payment failed for ${invoice.number}.`, createdAt: now,
    })
    await db.auditLogs.add({
      id: crypto.randomUUID(), orgId: payment.orgId, actorName: 'Billing system',
      action: status === 'succeeded' ? 'recorded successful payment' : 'recorded failed payment',
      target: invoice.number, createdAt: now,
    })
  })
}
