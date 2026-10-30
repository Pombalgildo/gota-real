import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitRealtime } from '@/lib/realtime-emitter'
import { ORDER_MANAGER_ROLES, requireRole } from '@/lib/auth'

// PATCH /api/feedback/[id] - central responde / actualiza estado
// (administrador ou atendente)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await requireRole(req, ORDER_MANAGER_ROLES)
    if (!staff) {
      return NextResponse.json(
        { error: 'Apenas o administrador ou a atendente podem responder mensagens.' },
        { status: 403 }
      )
    }
    const { id } = await params
    const { response, status } = await req.json()

    const feedback = await db.feedback.findUnique({ where: { id } })
    if (!feedback) {
      return NextResponse.json({ error: 'Registo não encontrado.' }, { status: 404 })
    }

    const updated = await db.feedback.update({
      where: { id },
      data: {
        response: response?.trim() ? response.trim() : feedback.response,
        status: response?.trim() ? 'respondido' : (status ?? feedback.status),
        respondedAt: response?.trim() ? new Date() : feedback.respondedAt,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
      },
    })

    await emitRealtime('feedback:update', { feedback: updated })

    return NextResponse.json({ feedback: updated })
  } catch (error) {
    console.error('[api/feedback/[id]] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
