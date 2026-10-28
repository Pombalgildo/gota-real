import { db } from '@/lib/db'

export const ORDER_INCLUDE = {
  items: true,
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      latitude: true,
      longitude: true,
      locationSource: true,
    },
  },
  courier: true,
} as const

export async function getOrderFull(id: string) {
  const order = await db.order.findUnique({
    where: { id },
    include: ORDER_INCLUDE,
  })
  return order
}

export async function listOrders(where?: { customerId?: string }) {
  const orders = await db.order.findMany({
    where,
    include: ORDER_INCLUDE,
    orderBy: { requestedAt: 'desc' },
    take: 100,
  })
  return orders
}

export async function nextOrderNumber(): Promise<number> {
  const agg = await db.order.aggregate({ _max: { number: true } })
  return (agg._max.number ?? 1000) + 1
}
