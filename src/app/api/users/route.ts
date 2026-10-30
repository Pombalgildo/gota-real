import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, hashPassword, WORKER_ROLES, DELIVERY_ROLES } from '@/lib/auth'
import { emitRealtime } from '@/lib/realtime-emitter'

/**
 * GET /api/users — lista de todos os perfis (apenas administrador).
 * Inclui o cliente ligado (com nº de pedidos) e o motoboy ligado.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) {
      return NextResponse.json(
        { error: 'Apenas o administrador pode ver os perfis.' },
        { status: 403 }
      )
    }

    const users = await db.user.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: {
        customer: { select: { id: true, name: true, phone: true, banned: true, photo: true, _count: { select: { orders: true } } } },
        courier: { select: { id: true, name: true, vehicle: true, plate: true, available: true } },
      },
    })

    return NextResponse.json({
      users: users.map(({ password: _password, ...u }) => u),
    })
  } catch (error) {
    console.error('[api/users] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/**
 * POST /api/users — o administrador cria perfis de trabalhadores
 * (administrador, atendente, editor, motoboy ou motorista,
 * com senha de entrada própria).
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) {
      return NextResponse.json(
        { error: 'Apenas o administrador pode criar perfis.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const name = String(body?.name ?? '').trim()
    const email = String(body?.email ?? '').trim().toLowerCase()
    const phone = String(body?.phone ?? '').trim()
    const password = String(body?.password ?? '')
    const role = String(body?.role ?? 'MOTOBOY').toUpperCase()
    const vehicle = String(body?.vehicle ?? '').trim()
    const plate = String(body?.plate ?? '').trim()
    // FOTO DE PERFIL (data URL base64, já comprimida no dispositivo)
    const photo =
      typeof body?.photo === 'string' && body.photo.startsWith('data:image/')
        ? body.photo
        : null

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nome, e-mail e senha são obrigatórios.' },
        { status: 400 }
      )
    }
    if (password.length < 4) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 4 caracteres.' },
        { status: 400 }
      )
    }
    if (!(WORKER_ROLES as readonly string[]).includes(role)) {
      return NextResponse.json(
        {
          error:
            'Escolha o tipo de perfil: Administrador, Atendente, Editor, Motoboy ou Motorista.',
        },
        { status: 400 }
      )
    }

    const emailTaken = await db.user.findUnique({ where: { email } })
    if (emailTaken) {
      return NextResponse.json(
        { error: 'Já existe um perfil com este e-mail.' },
        { status: 409 }
      )
    }

    // se for perfil de entrega (mota ou carro), cria também o registo de entregador ligado
    let courierId: string | null = null
    if ((DELIVERY_ROLES as readonly string[]).includes(role)) {
      const courier = await db.courier.create({
        data: {
          name,
          phone: phone || '—',
          vehicle: vehicle || (role === 'MOTORISTA' ? 'Carro ligeiro' : 'Mota'),
          plate: plate || '—',
          latitude: -8.847,
          longitude: 13.241,
          available: true,
        },
      })
      courierId = courier.id
    }

    const user = await db.user.create({
      data: {
        name,
        email,
        phone,
        password: hashPassword(password),
        role,
        ...(photo ? { photo } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, banned: true, photo: true, _count: { select: { orders: true } } } },
        courier: { select: { id: true, name: true, vehicle: true, plate: true, available: true } },
      },
    })

    // liga o entregador a este perfil (a chave vive no Courier)
    if (courierId) {
      await db.courier.update({ where: { id: courierId }, data: { userId: user.id } })
    }

    // re-carrega com as ligações actualizadas
    const userWithLinks = await db.user.findUnique({
      where: { id: user.id },
      include: {
        customer: { select: { id: true, name: true, phone: true, banned: true, photo: true, _count: { select: { orders: true } } } },
        courier: { select: { id: true, name: true, vehicle: true, plate: true, available: true } },
      },
    })

    await emitRealtime('users:update', { user: userWithLinks })

    return NextResponse.json({ user: userWithLinks })
  } catch (error) {
    console.error('[api/users] erro ao criar:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno ao criar perfil.' },
      { status: 500 }
    )
  }
}
