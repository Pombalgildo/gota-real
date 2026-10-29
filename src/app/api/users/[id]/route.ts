import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, hashPassword } from '@/lib/auth'
import { emitRealtime } from '@/lib/realtime-emitter'

type Params = { params: Promise<{ id: string }> }

/**
 * PATCH /api/users/[id] — o administrador edita qualquer perfil:
 * dados, senha, tipo, activar/desactivar, BANIR cliente por má conduta.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) {
      return NextResponse.json(
        { error: 'Apenas o administrador pode editar perfis.' },
        { status: 403 }
      )
    }
    const { id } = await params

    const user = await db.user.findUnique({
      where: { id },
      include: { customer: true, courier: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })
    }

    const body = await req.json()
    const data: Record<string, unknown> = {}

    if (body.name != null) data.name = String(body.name).trim()
    if (body.email != null) data.email = String(body.email).trim().toLowerCase()
    if (body.phone != null) data.phone = String(body.phone).trim()
    // FOTO DE PERFIL: data URL base64 ou null para remover
    if (body.photo !== undefined) {
      const p = body.photo
      data.photo = typeof p === 'string' && p.startsWith('data:image/') ? p : null
    }
    if (body.password) {
      if (String(body.password).length < 4) {
        return NextResponse.json(
          { error: 'A nova senha deve ter pelo menos 4 caracteres.' },
          { status: 400 }
        )
      }
      data.password = hashPassword(String(body.password))
    }

    // o administrador não se pode banir/desactivar/eliminar a si próprio
    const self = admin.id === user.id
    if (body.active != null) {
      if (self && body.active === false) {
        return NextResponse.json(
          { error: 'Não pode desactivar o seu próprio perfil.' },
          { status: 400 }
        )
      }
      data.active = Boolean(body.active)
    }
    if (body.banned != null) {
      if (self && body.banned === true) {
        return NextResponse.json(
          { error: 'Não pode banir o seu próprio perfil.' },
          { status: 400 }
        )
      }
      data.banned = Boolean(body.banned)
      data.banReason = body.banned ? String(body.banReason ?? 'Má conduta') : null
    }

    // mudança de tipo de perfil
    if (body.role != null) {
      const newRole = String(body.role).toUpperCase()
      if (!['ADMIN', 'MOTOBOY', 'CLIENTE'].includes(newRole)) {
        return NextResponse.json({ error: 'Tipo de perfil inválido.' }, { status: 400 })
      }
      if (self && newRole !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Não pode retirar a sua própria administração.' },
          { status: 400 }
        )
      }
      data.role = newRole

      // virou motoboy → cria o registo de entregador se não tiver
      if (newRole === 'MOTOBOY' && !user.courier) {
        const courier = await db.courier.create({
          data: {
            name: String(data.name ?? user.name),
            phone: String(data.phone ?? user.phone ?? '') || '—',
            vehicle: String(body.vehicle ?? '').trim() || 'Mota',
            plate: String(body.plate ?? '').trim() || '—',
            latitude: -8.847,
            longitude: 13.241,
          },
        })
        // liga o entregador a este perfil (a chave vive no Courier)
        await db.courier.update({ where: { id: courier.id }, data: { userId: user.id } })
      }
      // deixou de ser motoboy → remove o registo de entregador
      if (newRole !== 'MOTOBOY' && user.courier) {
        await db.courier.delete({ where: { id: user.courier.id } }).catch(() => undefined)
      }
    }

    // dados do veículo do motoboy
    if (user.courier && (body.vehicle != null || body.plate != null)) {
      const cData: Record<string, string> = {}
      if (body.vehicle != null) cData.vehicle = String(body.vehicle).trim() || 'Mota'
      if (body.plate != null) cData.plate = String(body.plate).trim() || '—'
      if (data.name != null) cData.name = String(data.name)
      if (data.phone != null) cData.phone = String(data.phone)
      await db.courier.update({ where: { id: user.courier.id }, data: cData })
    }

    const updated = await db.user.update({
      where: { id },
      data,
      include: {
        customer: { select: { id: true, name: true, phone: true, banned: true, photo: true, _count: { select: { orders: true } } } },
        courier: { select: { id: true, name: true, vehicle: true, plate: true, available: true } },
      },
    })

    // banimento reflecte-se no registo do cliente (bloqueia pedidos)
    let customer = updated.customer
    if (user.customerId && body.banned != null) {
      customer = await db.customer.update({
        where: { id: user.customerId },
        data: { banned: Boolean(body.banned), banReason: data.banReason as string | null },
        select: {
          id: true,
          name: true,
          phone: true,
          banned: true,
          photo: true,
          _count: { select: { orders: true } },
        },
      })
      // avisa o cliente em tempo real (a app dele mostra o bloqueio na hora)
      await emitRealtime('auth:banned', {
        customerId: user.customerId,
        banned: Boolean(body.banned),
        banReason: data.banReason ?? null,
      })
    }

    await emitRealtime('users:update', { user: { ...updated, password: undefined } })

    // se a FOTO de um perfil de CLIENTE mudou, propaga para o registo
    // do cliente (usado na app do cliente e na listagem da Central)
    if (user.customerId && data.photo !== undefined) {
      await db.customer
        .update({ where: { id: user.customerId }, data: { photo: data.photo as string | null } })
        .catch(() => undefined)
    }

    return NextResponse.json({ user: { ...updated, password: undefined }, customer })
  } catch (error) {
    console.error('[api/users/[id]] erro ao editar:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno ao editar perfil.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[id] — o administrador ELIMINA qualquer perfil.
 * (O histórico de pedidos dos clientes fica guardado para a faturação.)
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) {
      return NextResponse.json(
        { error: 'Apenas o administrador pode eliminar perfis.' },
        { status: 403 }
      )
    }
    const { id } = await params

    if (admin.id === id) {
      return NextResponse.json(
        { error: 'Não pode eliminar o seu próprio perfil enquanto estiver com ele aberto.' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id }, include: { courier: true } })
    if (!user) {
      return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })
    }

    // remove o entregador ligado (os pedidos ficam sem courier atribuído)
    if (user.courier) {
      await db.courier.delete({ where: { id: user.courier.id } }).catch(() => undefined)
    }

    // termina todas as sessões abertas deste perfil
    await db.session.deleteMany({ where: { userId: id } })

    await db.user.delete({ where: { id } })

    await emitRealtime('users:update', { deleted: id })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[api/users/[id]] erro ao eliminar:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno ao eliminar perfil.' },
      { status: 500 }
    )
  }
}
