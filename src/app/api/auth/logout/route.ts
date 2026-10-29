import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/auth/logout — termina a sessão actual.
 * Recebe { token } (também aceita o cabeçalho Authorization: Bearer).
 */
export async function POST(req: NextRequest) {
  try {
    let token: string | null = null
    const auth = req.headers.get('authorization')
    if (auth?.startsWith('Bearer ')) token = auth.slice(7).trim()
    if (!token) {
      const body = await req.json().catch(() => ({}))
      if (body?.token) token = String(body.token)
    }
    if (token) {
      await db.session.delete({ where: { id: token } }).catch(() => undefined)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[api/auth/logout] erro:', error)
    return NextResponse.json({ error: 'Erro interno ao sair.' }, { status: 500 })
  }
}
