import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'
import { hashPassword, fallbackEmail } from '@/lib/auth'

// POST /api/customers - registar novo cliente (cria também o PERFIL DE LOGIN)
export async function POST(req: NextRequest) {
  try {
    await ensureSeed()
    const body = await req.json()
    const {
      name,
      phone,
      email,
      password,
      address,
      latitude,
      longitude,
      locationSource,
      locationNote,
    } = body

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Nome e telefone são obrigatórios.' },
        { status: 400 }
      )
    }

    const normalizedPhone = String(phone).trim()

    const existing = await db.customer.findUnique({ where: { phone: normalizedPhone } })
    let customer
    if (existing) {
      customer = await db.customer.update({
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
    } else {
      customer = await db.customer.create({
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
    }

    // cria o perfil de entrada (login) do cliente, se ainda não existir
    const existingUser = await db.user.findUnique({ where: { customerId: customer.id } })
    if (!existingUser) {
      const loginEmail =
        (typeof email === 'string' && email.trim()) || fallbackEmail(normalizedPhone)
      try {
        await db.user.create({
          data: {
            name: customer.name,
            email: loginEmail.toLowerCase(),
            phone: normalizedPhone,
            // sem senha definida, o telefone serve de senha inicial
            password: hashPassword(password || normalizedPhone),
            role: 'CLIENTE',
            customerId: customer.id,
          },
        })
      } catch {
        // e-mail já usado por outro perfil — usa o e-mail interno do telefone
        await db.user.create({
          data: {
            name: customer.name,
            email: fallbackEmail(normalizedPhone),
            phone: normalizedPhone,
            password: hashPassword(password || normalizedPhone),
            role: 'CLIENTE',
            customerId: customer.id,
          },
        })
      }
    }

    return NextResponse.json({ customer, updatedExisting: !!existing })
  } catch (error) {
    console.error('[api/customers] erro:', error)
    return NextResponse.json({ error: 'Erro interno ao registar cliente.' }, { status: 500 })
  }
}

// GET /api/customers?phone=... - entrada de cliente existente
export async function GET(req: NextRequest) {
  try {
    await ensureSeed()
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
