import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH /api/couriers/[id] - actualizar posição GPS / disponibilidade
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { latitude, longitude, available, name, phone, vehicle, plate } = body

    const courier = await db.courier.findUnique({ where: { id } })
    if (!courier) {
      return NextResponse.json({ error: 'Motoboy não encontrado.' }, { status: 404 })
    }

    const updated = await db.courier.update({
      where: { id },
      data: {
        latitude: latitude ?? courier.latitude,
        longitude: longitude ?? courier.longitude,
        available: available ?? courier.available,
        name: name ?? courier.name,
        phone: phone ?? courier.phone,
        vehicle: vehicle ?? courier.vehicle,
        plate: plate ?? courier.plate,
      },
    })
    return NextResponse.json({ courier: updated })
  } catch (error) {
    console.error('[api/couriers/[id]] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
