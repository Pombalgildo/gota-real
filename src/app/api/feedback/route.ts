import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitRealtime } from '@/lib/realtime-emitter'

// GET /api/feedback?customerId=... - sugestões e reclamações
// (sem customerId = todas, usado pela central)
export async function GET(req: NextRequest) {
  try {
    const customerId = req.nextUrl.searchParams.get('customerId')
    const feedbacks = await db.feedback.findMany({
      where: customerId ? { customerId } : undefined,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ feedbacks })
  } catch (error) {
    console.error('[api/feedback] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

// POST /api/feedback - cliente envia sugestão ou reclamação
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customerId, type, subject, message } = body

    if (!type || (type !== 'sugestao' && type !== 'reclamacao')) {
      return NextResponse.json({ error: 'Tipo inválido (sugestao ou reclamacao).' }, { status: 400 })
    }
    if (!subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Assunto e mensagem são obrigatórios.' }, { status: 400 })
    }

    const feedback = await db.feedback.create({
      data: {
        customerId: customerId ?? null,
        type,
        subject: subject.trim(),
        message: message.trim(),
        status: 'aberto',
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
      },
    })

    await emitRealtime('feedback:new', { feedback })

    return NextResponse.json({ feedback })
  } catch (error) {
    console.error('[api/feedback] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
