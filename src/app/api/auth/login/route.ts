import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'
import { verifyPassword, createSession, publicUser } from '@/lib/auth'

/**
 * POST /api/auth/login — entrada por perfil (administrador, motoboy ou cliente).
 * Recebe { identifier, password } onde identifier é o e-mail OU o telefone.
 */
export async function POST(req: NextRequest) {
  try {
    await ensureSeed()
    const body = await req.json()
    const identifier = String(body?.identifier ?? '').trim()
    const password = String(body?.password ?? '')

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Introduza o e-mail (ou telefone) e a senha.' },
        { status: 400 }
      )
    }

    const user = await db.user.findFirst({
      where: {
        OR: [{ email: identifier.toLowerCase() }, { phone: identifier }],
      },
      include: { customer: true, courier: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Perfil não encontrado. Verifique o e-mail/telefone.' },
        { status: 404 }
      )
    }

    if (!verifyPassword(password, user.password)) {
      return NextResponse.json(
        { error: 'Senha incorrecta. Tente novamente.' },
        { status: 401 }
      )
    }

    if (!user.active) {
      return NextResponse.json(
        { error: 'Este perfil foi desactivado pelo administrador.' },
        { status: 403 }
      )
    }

    if (user.banned && user.role !== 'CLIENTE') {
      return NextResponse.json(
        { error: 'Este perfil foi banido pelo administrador.' },
        { status: 403 }
      )
    }

    const token = await createSession(user.id)

    return NextResponse.json({
      token,
      user: publicUser(user),
      customer: user.customer,
      courier: user.courier,
    })
  } catch (error) {
    console.error('[api/auth/login] erro:', error)
    return NextResponse.json({ error: 'Erro interno ao entrar.' }, { status: 500 })
  }
}
