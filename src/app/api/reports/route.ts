import { NextRequest, NextResponse } from 'next/server'
import { db, withDbRetry } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { ORDER_MANAGER_ROLES } from '@/lib/types'

/**
 * RELATÓRIOS DE ACTIVIDADE — diário, semanal e mensal.
 *
 * GET /api/reports?period=daily|weekly|monthly&ref=YYYY-MM-DD
 * (só ADMIN e ATENDENTE — os gestores da actividade)
 *
 * Devolve, para o período pedido:
 *   - KPIs: pedidos por estado, faturação entregue, litros, tempo médio,
 *     novos clientes, mensagens, confirmações de recepção e disputas
 *   - série temporal (horas no dia / dias na semana / dias no mês)
 *   - topo de produtos vendidos
 *   - ranking de entregadores (entregas + tempo médio)
 *   - divisão por método de pagamento
 *
 * Os intervalos usam o fuso de Luanda (UTC+1, sem horário de Verão).
 */

// Angola/Luanda está fixa em UTC+1 (WAT) — sem DST
const LUANDA_OFFSET = '+01:00'

function startOfDayLocal(ref: string): Date {
  return new Date(`${ref}T00:00:00${LUANDA_OFFSET}`)
}

function isoDateLocal(d: Date): string {
  // converte para a data "local" de Luanda (UTC+1)
  const shifted = new Date(d.getTime() + 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 10)
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function addMonths(d: Date, months: number): Date {
  const next = new Date(d)
  next.setUTCMonth(next.getUTCMonth() + months)
  return next
}

/** Segunda-feira da semana do dia indicado. */
function startOfWeekLocal(ref: string): Date {
  const d = startOfDayLocal(ref)
  const dow = d.getUTCDay() // 0 = domingo
  const diff = dow === 0 ? -6 : 1 - dow
  return addDays(d, diff)
}

function periodRange(period: string, ref: string): { from: Date; to: Date } {
  if (period === 'weekly') {
    const from = startOfWeekLocal(ref)
    return { from, to: addDays(from, 7) }
  }
  if (period === 'monthly') {
    const base = startOfDayLocal(ref)
    const from = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1, 0, 0, 0)
    )
    // o mês começa à meia-noite de Luanda: recua 1h do UTC puro
    from.setUTCHours(from.getUTCHours() - 1)
    const to = addMonths(from, 1)
    return { from, to }
  }
  // diário (por omissão)
  const from = startOfDayLocal(ref)
  return { from, to: addDays(from, 1) }
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole(req, ORDER_MANAGER_ROLES)
    if (!user) {
      return NextResponse.json(
        { error: 'Sem permissão para ver relatórios.' },
        { status: 403 }
      )
    }

    const period = req.nextUrl.searchParams.get('period') ?? 'daily'
    const refParam = req.nextUrl.searchParams.get('ref')
    const ref = /^\d{4}-\d{2}-\d{2}$/.test(refParam ?? '')
      ? (refParam as string)
      : isoDateLocal(new Date())

    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })
    }

    const { from, to } = periodRange(period, ref)

    const [orders, feedbacks, newCustomers] = await withDbRetry(() =>
      Promise.all([
        db.order.findMany({
          where: { requestedAt: { gte: from, lt: to } },
          include: { items: true, courier: true },
          orderBy: { requestedAt: 'asc' },
        }),
        db.feedback.findMany({ where: { createdAt: { gte: from, lt: to } } }),
        db.customer.count({ where: { createdAt: { gte: from, lt: to } } }),
      ])
    )

    // ---------- KPIs ----------
    const delivered = orders.filter((o) => o.status === 'entregue')
    const cancelled = orders.filter((o) => o.status === 'cancelado')
    const pending = orders.filter((o) => o.status === 'pendente')
    const inTransit = orders.filter((o) => o.status === 'em_transito')
    const confirmed = orders.filter((o) => o.status === 'confirmado')

    const revenueKz = delivered.reduce((s, o) => s + o.totalKz, 0)
    const liters = delivered.reduce((s, o) => s + o.totalLiters, 0)

    const durations = delivered
      .filter((o) => o.deliveredAt)
      .map((o) => new Date(o.deliveredAt!).getTime() - new Date(o.requestedAt).getTime())
    const avgDeliveryMin = durations.length
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length / 60000)
      : null

    const receiptsConfirmed = orders.filter((o) => o.receiptStatus === 'confirmado').length
    const receiptsPending = orders.filter((o) => o.receiptStatus === 'pendente').length
    const disputesOpen = orders.filter(
      (o) => o.receiptStatus === 'disputado' && !o.disputeResolvedAt
    ).length
    const disputesResolved = orders.filter(
      (o) => o.receiptStatus === 'disputado' && o.disputeResolvedAt
    ).length

    // ---------- série temporal ----------
    const slots: { key: string; label: string }[] = []
    if (period === 'daily') {
      for (let h = 0; h < 24; h++) slots.push({ key: `h${h}`, label: `${String(h).padStart(2, '0')}h` })
    } else if (period === 'weekly') {
      for (let d = 0; d < 7; d++) slots.push({ key: `d${d}`, label: WEEKDAYS[d] })
    } else {
      const base = startOfDayLocal(ref)
      const daysInMonth = new Date(
        Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)
      ).getUTCDate()
      for (let d = 1; d <= daysInMonth; d++) slots.push({ key: `d${d}`, label: String(d) })
    }
    const slotIndex = (o: { requestedAt: Date }): number => {
      const t = new Date(o.requestedAt).getTime() + 60 * 60 * 1000 // Luanda
      const fromT = from.getTime()
      if (period === 'daily') {
        return Math.floor((t - fromT) / 3600000)
      }
      if (period === 'weekly') {
        return Math.floor((t - fromT) / 86400000)
      }
      return Math.floor((t - fromT) / 86400000) // dia do mês (from = dia 1)
    }

    const series = slots.map((s) => ({ ...s, orders: 0, delivered: 0, revenueKz: 0 }))
    for (const o of orders) {
      const idx = slotIndex(o)
      if (idx < 0 || idx >= series.length) continue
      series[idx].orders += 1
      if (o.status === 'entregue') {
        series[idx].delivered += 1
        series[idx].revenueKz += o.totalKz
      }
    }

    // ---------- topo de produtos ----------
    const productMap = new Map<string, { name: string; quantity: number; revenueKz: number }>()
    for (const o of orders) {
      if (o.status === 'cancelado') continue
      for (const item of o.items) {
        const current = productMap.get(item.productId) ?? {
          name: item.productName,
          quantity: 0,
          revenueKz: 0,
        }
        current.quantity += item.quantity
        current.revenueKz += item.unitPriceKz * item.quantity
        productMap.set(item.productId, current)
      }
    }
    const topProducts = [...productMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 6)

    // ---------- ranking de entregadores ----------
    const courierMap = new Map<string, { name: string; deliveries: number; totalMin: number }>()
    for (const o of delivered) {
      if (!o.courier) continue
      const current = courierMap.get(o.courier.id) ?? {
        name: o.courier.name,
        deliveries: 0,
        totalMin: 0,
      }
      current.deliveries += 1
      if (o.deliveredAt) {
        current.totalMin +=
          (new Date(o.deliveredAt).getTime() - new Date(o.requestedAt).getTime()) / 60000
      }
      courierMap.set(o.courier.id, current)
    }
    const couriers = [...courierMap.values()]
      .map((c) => ({
        name: c.name,
        deliveries: c.deliveries,
        avgMin: c.deliveries ? Math.round(c.totalMin / c.deliveries) : null,
      }))
      .sort((a, b) => b.deliveries - a.deliveries)

    // ---------- métodos de pagamento ----------
    const paymentMap = new Map<string, { count: number; revenueKz: number }>()
    for (const o of delivered) {
      const current = paymentMap.get(o.paymentMethod) ?? { count: 0, revenueKz: 0 }
      current.count += 1
      current.revenueKz += o.totalKz
      paymentMap.set(o.paymentMethod, current)
    }
    const payments = [...paymentMap.entries()].map(([method, v]) => ({ method, ...v }))

    // ---------- etiqueta do período ----------
    // (renderiza no fuso de Luanda: `from` é meia-noite local = 23h UTC do dia anterior)
    const label =
      period === 'daily'
        ? from.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Africa/Luanda' })
        : period === 'weekly'
          ? `${from.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', timeZone: 'Africa/Luanda' })} – ${addDays(from, 6).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Africa/Luanda' })}`
          : from.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric', timeZone: 'Africa/Luanda' })

    return NextResponse.json({
      period,
      ref,
      label,
      from: from.toISOString(),
      to: to.toISOString(),
      generatedAt: new Date().toISOString(),
      kpis: {
        ordersTotal: orders.length,
        delivered: delivered.length,
        cancelled: cancelled.length,
        pending: pending.length,
        confirmed: confirmed.length,
        inTransit: inTransit.length,
        revenueKz,
        liters,
        avgDeliveryMin,
        newCustomers,
        messages: feedbacks.length,
        messagesOpen: feedbacks.filter((f) => f.status === 'aberto').length,
        receiptsConfirmed,
        receiptsPending,
        disputesOpen,
        disputesResolved,
      },
      series,
      topProducts,
      couriers,
      payments,
    })
  } catch (error) {
    console.error('[api/reports] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
