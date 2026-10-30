import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitRealtime } from '@/lib/realtime-emitter'
import { listOrders, nextOrderNumber } from '@/lib/orders'
import { ORDER_MANAGER_ROLES, DELIVERY_ROLES, requireRole } from '@/lib/auth'

// POST /api/orders - cliente solicita a mercadoria
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customerId, items, paymentMethod, notes, latitude, longitude, address } = body

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Cliente e pelo menos um item são obrigatórios.' },
        { status: 400 }
      )
    }
    if (paymentMethod !== 'TPA' && paymentMethod !== 'CASH') {
      return NextResponse.json({ error: 'Modo de pagamento inválido (TPA ou CASH).' }, { status: 400 })
    }

    const customer = await db.customer.findUnique({ where: { id: customerId } })
    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    // cliente banido por má conduta não pode fazer pedidos
    if (customer.banned) {
      return NextResponse.json(
        {
          error: `A sua conta foi suspensa${customer.banReason ? ` (${customer.banReason})` : ''}. Contacte a Gota REAL para regularizar a situação.`,
        },
        { status: 403 }
      )
    }

    // valida produtos e stock
    const productIds = items.map((i: { productId: string }) => i.productId)
    const products = await db.product.findMany({ where: { id: { in: productIds }, active: true } })
    const productMap = new Map(products.map((p) => [p.id, p]))

    for (const item of items) {
      const product = productMap.get(item.productId)
      if (!product) {
        return NextResponse.json({ error: 'Produto inválido no pedido.' }, { status: 400 })
      }
      const qty = Number(item.quantity)
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        return NextResponse.json({ error: `Quantidade inválida para ${product.name}.` }, { status: 400 })
      }
      if (product.stock < qty) {
        return NextResponse.json(
          { error: `Stock insuficiente de ${product.name} (disponível: ${product.stock}).` },
          { status: 400 }
        )
      }
    }

    let totalKz = 0
    let totalLiters = 0
    const itemData = items.map((item: { productId: string; quantity: number }) => {
      const product = productMap.get(item.productId)!
      const qty = Number(item.quantity)
      totalKz += product.priceKz * qty
      totalLiters += (product.volumeL ?? 0) * qty
      return {
        productId: product.id,
        productName: product.name,
        unitLabel: product.unitLabel,
        unitPriceKz: product.priceKz,
        quantity: qty,
        volumeL: (product.volumeL ?? 0) * qty,
      }
    })

    const number = await nextOrderNumber()

    const order = await db.$transaction(async (tx) => {
      for (const item of itemData) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })
      }
      return tx.order.create({
        data: {
          number,
          customerId,
          items: { create: itemData },
          totalKz,
          totalLiters,
          paymentMethod,
          notes: notes ?? null,
          address: address ?? customer.address,
          latitude: latitude ?? customer.latitude,
          longitude: longitude ?? customer.longitude,
          status: 'pendente',
        },
        include: {
          items: true,
          customer: {
            select: {
              id: true, name: true, phone: true, email: true,
              address: true, latitude: true, longitude: true, locationSource: true,
            },
          },
          courier: true,
        },
      })
    })

    await emitRealtime('order:new', { order })

    return NextResponse.json({ order })
  } catch (error) {
    console.error('[api/orders] erro:', error)
    return NextResponse.json({ error: 'Erro interno ao criar pedido.' }, { status: 500 })
  }
}

// GET /api/orders?customerId=... - pedidos do cliente
// GET /api/orders?all=1 - todos os pedidos (central: admin/atendente e entregadores)
export async function GET(req: NextRequest) {
  try {
    const customerId = req.nextUrl.searchParams.get('customerId')
    const all = req.nextUrl.searchParams.get('all')
    if (!customerId && !all) {
      return NextResponse.json({ error: 'Informe customerId ou all=1.' }, { status: 400 })
    }
    if (all) {
      const staff = await requireRole(req, [...ORDER_MANAGER_ROLES, ...DELIVERY_ROLES])
      if (!staff) {
        return NextResponse.json(
          { error: 'Apenas a equipa de pedidos e entregas pode ver todos os pedidos.' },
          { status: 403 }
        )
      }
    }
    const orders = await listOrders(customerId ? { customerId } : undefined)
    return NextResponse.json({ orders })
  } catch (error) {
    console.error('[api/orders] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
