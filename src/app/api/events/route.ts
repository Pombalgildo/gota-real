import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, ORDER_MANAGER_ROLES, DELIVERY_ROLES } from '@/lib/auth'

/**
 * GET /api/events — alimentação do centro de alertas (sons fortes).
 *
 * Devolve, conforme o papel de quem pergunta, apenas os registos que
 * precisam de atenção AGORA — o front-end faz o "diff" entre sondagens
 * e dispara o alarme sonoro:
 *
 *   ADMIN / ATENDENTE (vendas) → pedidos pendentes + mensagens abertas
 *   MOTOBOY / MOTORISTA       → entregas atribuídas a ele (e canceladas)
 *   CLIENTE (?customerId=)    → estados dos seus pedidos + respostas
 *
 * A resposta é mínima (sem itens, sem fotos) para ser rápida e barata.
 */
export async function GET(req: NextRequest) {
  try {
    const courierIdParam = req.nextUrl.searchParams.get('courierId')
    const customerIdParam = req.nextUrl.searchParams.get('customerId')
    const user = await getUserFromRequest(req)
    const role = user?.role ?? null

    // ---------- Central: administrador e atendente (área de vendas) ----------
    if (role && (ORDER_MANAGER_ROLES as readonly string[]).includes(role)) {
      const [orders, feedbacks] = await Promise.all([
        db.order.findMany({
          where: { status: 'pendente' },
          orderBy: { requestedAt: 'desc' },
          take: 50,
          select: {
            id: true,
            number: true,
            status: true,
            totalKz: true,
            totalLiters: true,
            paymentMethod: true,
            requestedAt: true,
            updatedAt: true,
            customer: { select: { id: true, name: true, phone: true } },
          },
        }),
        db.feedback.findMany({
          where: { status: 'aberto' },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            type: true,
            subject: true,
            status: true,
            createdAt: true,
            respondedAt: true,
            customer: { select: { id: true, name: true, phone: true } },
          },
        }),
      ])
      return NextResponse.json({ serverTime: new Date().toISOString(), scope: 'staff', orders, feedbacks })
    }

    // ---------- Entregador: motoboy e motorista ----------
    if (role && (DELIVERY_ROLES as readonly string[]).includes(role)) {
      const courierId = user?.courier?.id ?? courierIdParam
      const orders = courierId
        ? await db.order.findMany({
            where: { courierId, status: { in: ['confirmado', 'em_transito', 'cancelado'] } },
            orderBy: { updatedAt: 'desc' },
            take: 40,
            select: {
              id: true,
              number: true,
              status: true,
              totalLiters: true,
              address: true,
              requestedAt: true,
              updatedAt: true,
              customer: { select: { id: true, name: true, phone: true } },
            },
          })
        : []
      return NextResponse.json({ serverTime: new Date().toISOString(), scope: 'courier', orders, feedbacks: [] })
    }

    // ---------- Cliente: acompanha os seus pedidos e respostas ----------
    if (customerIdParam) {
      const [orders, feedbacks] = await Promise.all([
        db.order.findMany({
          where: { customerId: customerIdParam },
          orderBy: { updatedAt: 'desc' },
          take: 30,
          select: {
            id: true,
            number: true,
            status: true,
            totalKz: true,
            totalLiters: true,
            requestedAt: true,
            updatedAt: true,
          },
        }),
        db.feedback.findMany({
          where: { customerId: customerIdParam },
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: {
            id: true,
            type: true,
            subject: true,
            status: true,
            createdAt: true,
            respondedAt: true,
          },
        }),
      ])
      return NextResponse.json({ serverTime: new Date().toISOString(), scope: 'customer', orders, feedbacks })
    }

    // sem sessão e sem cliente identificado → nada a vigiar
    return NextResponse.json({ serverTime: new Date().toISOString(), scope: 'none', orders: [], feedbacks: [] })
  } catch (error) {
    console.error('[api/events] erro:', error)
    return NextResponse.json(
      { error: 'Erro interno.', serverTime: new Date().toISOString(), orders: [], feedbacks: [] },
      { status: 500 }
    )
  }
}
