import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitRealtime } from '@/lib/realtime-emitter'
import { getOrderFull } from '@/lib/orders'
import {
  ORDER_MANAGER_ROLES,
  DELIVERY_ROLES,
  requireRole,
  getUserFromRequest,
} from '@/lib/auth'

// GET /api/orders/[id] - detalhe do pedido (com motoboy, para tracking GPS)
// Apenas o PRÓPRIO cliente do pedido (sessão), a equipa de gestão ou um
// entregador autenticado.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const order = await getOrderFull(id)
    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }
    const user = await getUserFromRequest(req)
    const isOwner =
      !!user && user.active && user.role === 'CLIENTE' && user.customerId === order.customerId
    const isStaff =
      !!user &&
      user.active &&
      ([...ORDER_MANAGER_ROLES, ...DELIVERY_ROLES] as string[]).includes(user.role)
    if (!isOwner && !isStaff) {
      return NextResponse.json(
        { error: 'Sem permissão para ver este pedido.' },
        { status: user ? 403 : 401 }
      )
    }
    return NextResponse.json({ order })
  } catch (error) {
    console.error('[api/orders/[id]] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

// PATCH /api/orders/[id] - acções da central e do entregador
// body: { action: "confirm" | "assign" | "dispatch" | "deliver" | "cancel", courierId? }
// Permissões: confirmar/atribuir/cancelar → administrador ou atendente;
// despachar/concluir → também o próprio entregador (motoboy ou motorista).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { action, courierId } = await req.json()

    const manager = await requireRole(req, ORDER_MANAGER_ROLES)
    const courierUser = manager ? null : await requireRole(req, DELIVERY_ROLES)
    if (!manager && !courierUser) {
      return NextResponse.json(
        { error: 'Sem permissão para gerir pedidos.' },
        { status: 403 }
      )
    }
    // o entregador só pode despachar e concluir as SUAS entregas
    if (courierUser && action !== 'dispatch' && action !== 'deliver') {
      return NextResponse.json(
        { error: 'O entregador só pode iniciar e concluir as suas entregas.' },
        { status: 403 }
      )
    }

    const order = await db.order.findUnique({ where: { id }, include: { items: true } })
    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }
    if (courierUser && order.courierId !== courierUser.courier?.id) {
      return NextResponse.json(
        { error: 'Esta entrega não está atribuída a você.' },
        { status: 403 }
      )
    }

    const now = new Date()

    if (action === 'confirm') {
      if (order.status !== 'pendente') {
        return NextResponse.json({ error: 'O pedido já foi confirmado.' }, { status: 400 })
      }
      await db.order.update({ where: { id }, data: { status: 'confirmado', confirmedAt: now } })
    } else if (action === 'assign') {
      if (order.status !== 'confirmado' && order.status !== 'pendente') {
        return NextResponse.json({ error: 'O pedido não pode receber motoboy neste estado.' }, { status: 400 })
      }
      if (!courierId) {
        return NextResponse.json({ error: 'Selecione um motoboy.' }, { status: 400 })
      }
      const courier = await db.courier.findUnique({ where: { id: courierId } })
      if (!courier) {
        return NextResponse.json({ error: 'Motoboy não encontrado.' }, { status: 404 })
      }
      await db.order.update({
        where: { id },
        data: {
          courierId,
          status: order.status === 'pendente' ? 'confirmado' : order.status,
          confirmedAt: order.confirmedAt ?? now,
        },
      })
      await db.courier.update({ where: { id: courierId }, data: { available: false } })
    } else if (action === 'dispatch') {
      if (order.status !== 'confirmado') {
        return NextResponse.json({ error: 'O pedido precisa estar confirmado.' }, { status: 400 })
      }
      if (!order.courierId) {
        return NextResponse.json({ error: 'Atribua um motoboy primeiro.' }, { status: 400 })
      }
      await db.order.update({
        where: { id },
        data: { status: 'em_transito', dispatchedAt: now },
      })
    } else if (action === 'deliver') {
      if (order.status !== 'em_transito') {
        return NextResponse.json({ error: 'A entrega precisa estar em trânsito.' }, { status: 400 })
      }
      // ANTI-BURLA: ao concluir, o pedido entra em “confirmação de recepção” —
      // o cliente é alertado com som forte até CONFIRMAR que recebeu (ou reclamar)
      await db.order.update({
        where: { id },
        data: { status: 'entregue', deliveredAt: now, receiptStatus: 'pendente' },
      })
      if (order.courierId) {
        await db.courier.update({ where: { id: order.courierId }, data: { available: true } })
      }
    } else if (action === 'cancel') {
      if (order.status === 'entregue' || order.status === 'cancelado') {
        return NextResponse.json({ error: 'O pedido já foi finalizado.' }, { status: 400 })
      }
      await db.order.update({ where: { id }, data: { status: 'cancelado', cancelledAt: now } })
      // repõe o stock
      for (const item of order.items) {
        await db.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        })
      }
      if (order.courierId) {
        await db.courier.update({ where: { id: order.courierId }, data: { available: true } })
      }
    } else {
      return NextResponse.json({ error: 'Acção inválida.' }, { status: 400 })
    }

    const updated = await getOrderFull(id)
    await emitRealtime('order:update', { order: updated })

    return NextResponse.json({ order: updated })
  } catch (error) {
    console.error('[api/orders/[id]] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
