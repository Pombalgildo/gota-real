import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'
import { requireAdmin } from '@/lib/auth'
import { emitRealtime } from '@/lib/realtime-emitter'

/** GET /api/store — dados públicos da loja (todos os perfis). */
export async function GET() {
  try {
    await ensureSeed()
    let store = await db.storeConfig.findUnique({ where: { id: 'main' } })
    if (!store) {
      store = await db.storeConfig.create({
        data: {
          id: 'main',
          name: 'Gota REAL',
          tagline: 'Água purificada entregue onde estiver',
        },
      })
    }
    return NextResponse.json({ store })
  } catch (error) {
    console.error('[api/store] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/**
 * PATCH /api/store — dados da loja (Ajustes). EXCLUSIVO do administrador:
 * os restantes perfis da equipa não têm acesso às configurações da app.
 */
export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireAdmin(req)
    if (!staff) {
      return NextResponse.json(
        { error: 'As configurações da app são exclusivas do administrador.' },
        { status: 403 }
      )
    }

    await ensureSeed()
    const body = await req.json()
    const data: Record<string, unknown> = {}

    const textFields = ['name', 'tagline', 'phone', 'whatsapp', 'address', 'hours', 'note'] as const
    for (const f of textFields) {
      if (body[f] != null) data[f] = String(body[f]).trim()
    }
    if (body.deliveryFeeKz != null) data.deliveryFeeKz = Number(body.deliveryFeeKz) || 0
    if (body.minOrderKz != null) data.minOrderKz = Number(body.minOrderKz) || 0

    // Localização GPS da base da empresa: coordenadas do ponto exacto
    // de onde sai a mercadoria (capturadas pelo administrador nos Ajustes)
    if (body.latitude != null && body.longitude != null) {
      const lat = Number(body.latitude)
      const lng = Number(body.longitude)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        data.latitude = lat
        data.longitude = lng
        data.locationSource = String(body.locationSource ?? 'gps')
        data.locationAccuracy =
          body.locationAccuracy != null && Number.isFinite(Number(body.locationAccuracy))
            ? Number(body.locationAccuracy)
            : null
        data.locationUpdatedAt = new Date()
      }
    } else if (body.clearLocation === true) {
      // limpar a localização da base
      data.latitude = null
      data.longitude = null
      data.locationSource = null
      data.locationAccuracy = null
      data.locationUpdatedAt = null
    }

    const store = await db.storeConfig.upsert({
      where: { id: 'main' },
      update: data,
      create: {
        id: 'main',
        name: String(data.name ?? 'Gota REAL'),
        ...data,
      },
    })

    // os dados ficam visíveis na app do cliente na hora
    await emitRealtime('store:update', { store })

    return NextResponse.json({ store })
  } catch (error) {
    console.error('[api/store] erro ao guardar:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno ao guardar dados da loja.' },
      { status: 500 }
    )
  }
}
