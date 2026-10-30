import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

// GET /api/couriers - lista de motoboys (equipa)
export async function GET() {
  try {
    await ensureSeed()
    const couriers = await db.courier.findMany({
      include: {
        orders: {
          where: { status: { in: ['confirmado', 'em_transito'] } },
          select: { id: true, status: true },
        },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ couriers })
  } catch (error) {
    console.error('[api/couriers] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

// POST /api/couriers - adicionar motoboy (central)
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) {
      return NextResponse.json(
        { error: 'Apenas o administrador pode criar entregadores.' },
        { status: 403 }
      )
    }
    const body = await req.json()
    const { name, phone, vehicle, plate, latitude, longitude } = body
    if (!name) {
      return NextResponse.json({ error: 'O nome é obrigatório.' }, { status: 400 })
    }
    const courier = await db.courier.create({
      data: {
        name,
        phone: phone ?? '',
        vehicle: vehicle ?? 'Mota',
        plate: plate ?? '',
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      },
    })
    return NextResponse.json({ courier })
  } catch (error) {
    console.error('[api/couriers] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
