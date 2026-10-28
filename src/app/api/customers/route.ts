import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/customers - registar novo cliente
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, email, address, latitude, longitude, locationSource, locationNote } = body

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Nome e telefone são obrigatórios.' },
        { status: 400 }
      )
    }

    const normalizedPhone = String(phone).trim()

    const existing = await db.customer.findUnique({ where: { phone: normalizedPhone } })
    if (existing) {
      const updated = await db.customer.update({
        where: { phone: normalizedPhone },
        data: {
          name,
          email: email ?? existing.email,
          address: address ?? existing.address,
          latitude: latitude ?? existing.latitude,
          longitude: longitude ?? existing.longitude,
          locationSource: locationSource ?? existing.locationSource,
          locationNote: locationNote ?? existing.locationNote,
        },
      })
      return NextResponse.json({ customer: updated, updatedExisting: true })
    }

    const customer = await db.customer.create({
      data: {
        name,
        phone: normalizedPhone,
        email: email ?? null,
        address: address ?? '',
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        locationSource: locationSource ?? 'auto',
        locationNote: locationNote ?? null,
      },
    })
    return NextResponse.json({ customer })
  } catch (error) {
    console.error('[api/customers] erro:', error)
    return NextResponse.json({ error: 'Erro interno ao registar cliente.' }, { status: 500 })
  }
}

// GET /api/customers?phone=... - entrada de cliente existente
export async function GET(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get('phone')
    if (!phone) {
      return NextResponse.json({ error: 'Parâmetro phone é obrigatório.' }, { status: 400 })
    }
    const customer = await db.customer.findUnique({ where: { phone: phone.trim() } })
    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado. Crie a sua conta.' }, { status: 404 })
    }
    return NextResponse.json({ customer })
  } catch (error) {
    console.error('[api/customers] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
