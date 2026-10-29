import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitRealtime } from '@/lib/realtime-emitter'

// PATCH /api/feedback/[id] - central responde / actualiza estado
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
