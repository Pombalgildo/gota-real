import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkCustomerAccess } from '@/lib/auth'

// GET /api/customers/[id] - perfil do cliente
// (apenas a própria sessão do cliente ou a equipa de gestão — sem isto a
// app de uma conta ELIMINADA continuava a ler o perfil com o id em cache)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await checkCustomerAccess(req, id)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }
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

// PATCH /api/customers/[id] - actualizar perfil / localização / FOTO
// (apenas a própria sessão do cliente ou a equipa de gestão)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await checkCustomerAccess(req, id)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }
    const body = await req.json()
    const { name, email, address, latitude, longitude, locationSource, locationNote, photo } = body

    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    // FOTO DE PERFIL: data URL base64 (enviada pelo cliente no Perfil)
    // ou null para remover — também propaga para o perfil de LOGIN (User)
    const photoValue =
      photo === undefined
        ? customer.photo
        : typeof photo === 'string' && photo.startsWith('data:image/')
          ? photo
          : null

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
        photo: photoValue,
      },
    })

    // mantém a foto sincronizada no perfil de entrada (User) do cliente
    if (photoValue !== customer.photo) {
      await db.user
        .updateMany({ where: { customerId: id }, data: { photo: photoValue } })
        .catch(() => undefined)
    }

    return NextResponse.json({ customer: updated })
  } catch (error) {
    console.error('[api/customers/[id]] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
