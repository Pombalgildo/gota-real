import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, DELIVERY_ROLES, ORDER_MANAGER_ROLES } from '@/lib/auth'

// PATCH /api/couriers/[id] - actualizar posição GPS / disponibilidade
//
// SEGURANÇA: a posição GPS deste registo é o que o cliente vê no mapa
// de rastreio — antes qualquer pessoa na internet podia falsificá-la.
// Agora só pode alterar:
//   • a própria sessão do entregador ligada a este veículo
//   • um entregador autenticado quando o registo ainda não tem dono
//     (fluxo “escolher o meu registo” no primeiro acesso)
//   • a gestão (ADMIN/ATENDENTE)
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

    const user = await getUserFromRequest(req)
    if (!user || !user.active || user.banned) {
      return NextResponse.json(
        { error: 'Sessão necessária. Entre novamente para actualizar a posição.' },
        { status: 401 }
      )
    }
    const isManager = (ORDER_MANAGER_ROLES as readonly string[]).includes(user.role)
    const isDelivery = (DELIVERY_ROLES as readonly string[]).includes(user.role)
    // o veículo deste entregador (relação 1:1 — a FK vive em Courier.userId)
    const isOwnVehicle = isDelivery && user.courier?.id === id
    const isUnclaimed = isDelivery && courier.userId == null
    if (!isManager && !isOwnVehicle && !isUnclaimed) {
      return NextResponse.json(
        { error: 'Sem permissão para alterar este motoboy.' },
        { status: 403 }
      )
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
