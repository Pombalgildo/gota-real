import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitRealtime } from '@/lib/realtime-emitter'
import { getOrderFull } from '@/lib/orders'
import { getUserFromRequest, ORDER_MANAGER_ROLES } from '@/lib/auth'

/**
 * CONFIRMAÇÃO DE RECEPÇÃO (anti-burla).
 *
 * Quando o motoboy toca em “Concluir entrega”, o pedido entra em
 * receiptStatus = "pendente" e o CLIENTE recebe um alerta com som forte
 * até responder. Este endpoint trata das três respostas:
 *
 *   POST  { action: "confirm" }              → o cliente RECEBEU ✅
 *   POST  { action: "dispute", reason? }     → o cliente NÃO recebeu ❌
 *         (a central é alertada de imediato com alarme próprio)
 *   PATCH { action: "resolve", resolution }  → a administração responde
 *         à reclamação e fecha o caso (só ADMIN/ATENDENTE)
 *
 * O cliente autentica-se pelo token da sessão (perfil CLIENTE) ou, como
 * no resto da app, pela posse do pedido (customerId igual ao do pedido).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const action = body?.action

    if (action !== 'confirm' && action !== 'dispute') {
      return NextResponse.json(
        { error: 'Acção inválida (confirm ou dispute).' },
        { status: 400 }
      )
    }

    // quem é o cliente? token de sessão (se houver) ou customerId do corpo
    let customerId: string | null = typeof body?.customerId === 'string' ? body.customerId : null
    try {
      const user = await getUserFromRequest(req)
      if (user && user.role === 'CLIENTE' && user.customerId) {
        customerId = user.customerId
      }
    } catch {
      // sem sessão — segue com o customerId do corpo
    }
    if (!customerId) {
      return NextResponse.json({ error: 'Identifique-se para confirmar a recepção.' }, { status: 401 })
    }

    const order = await db.order.findUnique({ where: { id }, include: { items: true } })
    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }
    if (order.customerId !== customerId) {
      return NextResponse.json({ error: 'Este pedido não é seu.' }, { status: 403 })
    }
    if (order.status !== 'entregue') {
      return NextResponse.json(
        { error: 'Só pode confirmar pedidos marcados como entregues.' },
        { status: 400 }
      )
    }
    if (order.receiptStatus === 'confirmado') {
      return NextResponse.json({ error: 'Você já confirmou a recepção deste pedido. Obrigado!' }, { status: 400 })
    }
    if (order.receiptStatus === 'disputado' && order.disputeResolvedAt) {
      return NextResponse.json(
        { error: 'A sua reclamação já foi respondida pela administração.' },
        { status: 400 }
      )
    }

    const now = new Date()

    if (action === 'confirm') {
      await db.order.update({
        where: { id },
        data: { receiptStatus: 'confirmado', receiptConfirmedAt: now },
      })
    } else {
      const reason =
        typeof body?.reason === 'string' && body.reason.trim().length > 0
          ? body.reason.trim().slice(0, 500)
          : 'O cliente indica que não recebeu a mercadoria.'
      await db.order.update({
        where: { id },
        data: {
          receiptStatus: 'disputado',
          receiptDisputedAt: now,
          disputeReason: reason,
          // novo reclamo reabre o caso com a administração
          disputeResolution: null,
          disputeResolvedAt: null,
        },
      })
    }

    const updated = await getOrderFull(id)
    await emitRealtime('order:update', { order: updated })

    return NextResponse.json({ order: updated })
  } catch (error) {
    console.error('[api/orders/[id]/receipt] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

// PATCH — a administração responde à reclamação e fecha o caso
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(req)
    if (!user || !(ORDER_MANAGER_ROLES as readonly string[]).includes(user.role)) {
      return NextResponse.json(
        { error: 'Apenas a administração pode responder a reclamações.' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    if (body?.action !== 'resolve') {
      return NextResponse.json({ error: 'Acção inválida (resolve).' }, { status: 400 })
    }
    const resolution =
      typeof body?.resolution === 'string' && body.resolution.trim().length > 0
        ? body.resolution.trim().slice(0, 500)
        : 'Caso analisado pela administração.'

    const order = await db.order.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }
    if (order.receiptStatus !== 'disputado') {
      return NextResponse.json({ error: 'Este pedido não tem reclamação aberta.' }, { status: 400 })
    }

    await db.order.update({
      where: { id },
      data: { disputeResolution: resolution, disputeResolvedAt: new Date() },
    })

    const updated = await getOrderFull(id)
    await emitRealtime('order:update', { order: updated })

    return NextResponse.json({ order: updated })
  } catch (error) {
    console.error('[api/orders/[id]/receipt PATCH] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
