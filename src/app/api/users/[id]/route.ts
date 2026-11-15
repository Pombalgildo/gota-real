import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, hashPassword, WORKER_ROLES, DELIVERY_ROLES, isMainAdmin } from '@/lib/auth'
import { emitRealtime } from '@/lib/realtime-emitter'

// campos do cliente devolvidos em cada perfil (inclui o estado de
// APROVAÇÃO do cadastro para a lista da Central)
const CUSTOMER_SELECT = {
  id: true,
  name: true,
  phone: true,
  banned: true,
  photo: true,
  status: true,
  rejectReason: true,
  address: true,
  _count: { select: { orders: true } },
} as const

type Params = { params: Promise<{ id: string }> }

/**
 * PATCH /api/users/[id] — o administrador edita qualquer perfil:
 * dados, senha, tipo, activar/desactivar, BANIR cliente por má conduta e
 * APROVAR / RECUSAR o cadastro de clientes (apenas administrador principal).
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

    // ---------- APROVAÇÃO / RECUSA DO CADASTRO DO CLIENTE ----------
    // Poder EXCLUSIVO do ADMINISTRADOR PRINCIPAL (o primeiro ADMIN do
    // sistema): aprovar o cadastro (cliente passa a ACTIVO) ou recusar,
    // enviando uma mensagem com o motivo que o cliente vê na app.
    let approvalDecision: 'aprovado' | 'rejeitado' | null = null
    // registo do cliente já com a decisão aplicada (devolvido na resposta)
    let customer: {
      id: string
      name: string
      phone: string
      banned: boolean
      photo: string | null
      status: string
      rejectReason: string | null
      address: string
      _count: { orders: number }
    } | null = null
    if (body.approval != null) {
      const decision = String(body.approval)
      if (decision !== 'aprovado' && decision !== 'rejeitado') {
        return NextResponse.json(
          { error: 'Decisão inválida: aprovado ou rejeitado.' },
          { status: 400 }
        )
      }
      if (user.role !== 'CLIENTE' || !user.customerId) {
        return NextResponse.json(
          { error: 'A aprovação só se aplica a cadastros de clientes.' },
          { status: 400 }
        )
      }
      if (!(await isMainAdmin(admin.id))) {
        return NextResponse.json(
          {
            error:
              'Apenas o ADMINISTRADOR PRINCIPAL pode aprovar ou recusar cadastros de clientes.',
          },
          { status: 403 }
        )
      }

      const rejectReason = String(body.rejectReason ?? '').trim()
      if (decision === 'rejeitado' && rejectReason.length < 5) {
        return NextResponse.json(
          {
            error:
              'Escreva a mensagem que o cliente vai receber a explicar porqué não foi aceite (mínimo 5 caracteres).',
          },
          { status: 400 }
        )
      }

      approvalDecision = decision
      // o estado de aprovação vive no registo do CLIENTE (não no perfil)
      customer = await db.customer.update({
        where: { id: user.customerId },
        data: {
          status: decision,
          rejectReason: decision === 'rejeitado' ? rejectReason : null,
          reviewedAt: new Date(),
          reviewedByName: admin.name,
        },
        select: CUSTOMER_SELECT,
      })

      // avisa a app do cliente NA HORA: aprovado → entra na app;
      // recusado → passa a ver o ecrã com a mensagem do administrador
      await emitRealtime('auth:approval', {
        customerId: user.customerId,
        status: decision,
        rejectReason: decision === 'rejeitado' ? rejectReason : null,
      })
    }

    // mudança de tipo de perfil
    if (body.role != null) {
      const newRole = String(body.role).toUpperCase()
      const ALL_ROLES = [...WORKER_ROLES, 'CLIENTE']
      if (!ALL_ROLES.includes(newRole)) {
        return NextResponse.json({ error: 'Tipo de perfil inválido.' }, { status: 400 })
      }
      if (self && newRole !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Não pode retirar a sua própria administração.' },
          { status: 400 }
        )
      }
      data.role = newRole

      // virou perfil de entrega → cria o registo de entregador se não tiver
      const isDelivery = (DELIVERY_ROLES as readonly string[]).includes(newRole)
      if (isDelivery && !user.courier) {
        const courier = await db.courier.create({
          data: {
            name: String(data.name ?? user.name),
            phone: String(data.phone ?? user.phone ?? '') || '—',
            vehicle:
              String(body.vehicle ?? '').trim() ||
              (newRole === 'MOTORISTA' ? 'Carro ligeiro' : 'Mota'),
            plate: String(body.plate ?? '').trim() || '—',
            latitude: -8.847,
            longitude: 13.241,
          },
        })
        // liga o entregador a este perfil (a chave vive no Courier)
        await db.courier.update({ where: { id: courier.id }, data: { userId: user.id } })
      }
      // deixou de ser entregador → remove o registo de entregador
      if (!isDelivery && user.courier) {
        await db.courier.delete({ where: { id: user.courier.id } }).catch(() => undefined)
      }
    }

    // dados do veículo do entregador (mota ou carro)
    if (user.courier && (body.vehicle != null || body.plate != null)) {
      const cData: Record<string, string> = {}
      if (body.vehicle != null)
        cData.vehicle = String(body.vehicle).trim() || 'Mota'
      if (body.plate != null) cData.plate = String(body.plate).trim() || '—'
      if (data.name != null) cData.name = String(data.name)
      if (data.phone != null) cData.phone = String(data.phone)
      await db.courier.update({ where: { id: user.courier.id }, data: cData })
    }

    const updated = await db.user.update({
      where: { id },
      data,
      include: {
        customer: { select: CUSTOMER_SELECT },
        courier: { select: { id: true, name: true, vehicle: true, plate: true, available: true } },
      },
    })

    // registo do cliente devolvido: o actualizado pela decisão/banimento
    // ou o que vem já no perfil actualizado
    if (!customer) customer = updated.customer

    // banimento reflecte-se no registo do cliente (bloqueia pedidos)
    if (user.customerId && body.banned != null && !approvalDecision) {
      customer = await db.customer.update({
        where: { id: user.customerId },
        data: { banned: Boolean(body.banned), banReason: data.banReason as string | null },
        select: CUSTOMER_SELECT,
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

    // CLIENTE: o registo de cliente só fica se tiver histórico de pedidos
    // (faturação); sem pedidos é removido por completo — nada de contas
    // fantasma que possam ser reutilizadas
    if (user.role === 'CLIENTE' && user.customerId) {
      const ordersCount = await db.order
        .count({ where: { customerId: user.customerId } })
        .catch(() => 1)
      if (ordersCount === 0) {
        await db.customer.delete({ where: { id: user.customerId } }).catch(() => undefined)
      }
    }

    // avisa a app aberta da cliente NA HORA (sockets, quando disponíveis):
    // a conta foi encerrada — a app sai para o ecrã de boas-vindas.
    // Na Vercel (sem sockets) a validação de sessão aos 30s faz o mesmo.
    if (user.customerId) {
      await emitRealtime('auth:logout', { customerId: user.customerId })
    }

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
