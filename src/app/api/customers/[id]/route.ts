import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/customers/[id] - perfil do cliente
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }
    const ordersCount = await db.order.count({ where: { customerId: id } })
    return NextResponse.json({ customer, ordersCount })
  } catch (error) {
    console.error('[api/customers/[id]] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

// PATCH /api/customers/[id] - actualizar perfil / localização
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, email, address, latitude, longitude, locationSource, locationNote } = body

    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    const updated = await db.customer.update({
      where: { id },
      data: {
        name: name ?? customer.name,
        email: email ?? customer.email,
        address: address ?? customer.address,
        latitude: latitude ?? customer.latitude,
        longitude: longitude ?? customer.longitude,
        locationSource: locationSource ?? customer.locationSource,
        locationNote: locationNote ?? customer.locationNote,
      },
    })
    return NextResponse.json({ customer: updated })
  } catch (error) {
    console.error('[api/customers/[id]] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
