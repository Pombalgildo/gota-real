import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, publicUser } from '@/lib/auth'

/**
 * GET /api/auth/me — valida a sessão actual ao arrancar a app.
 *
 * Devolve o perfil (e o cliente/entregador ligado) de quem tem o token
 * aberto, ou 401 se a sessão já não valer (conta eliminada, desactivada
 * ou sessão expirada). É o que impede uma conta eliminada de continuar
 * "operacional" com os dados guardados no aparelho.
 *
 * Nota: clientes banidos recebem 200 — a app mostra o ecrã de suspensão
 * e o bloqueio de pedidos tem mensagem própria.
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user || !user.active || (user.banned && user.role !== 'CLIENTE')) {
    return NextResponse.json(
      { error: 'Sessão terminada. Entre novamente com o seu telefone e senha.' },
      { status: 401 }
    )
  }
  return NextResponse.json({
    user: publicUser(user),
    customer: user.customer ?? null,
    courier: user.courier ?? null,
  })
}
