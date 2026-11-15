import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'
import { verifyPassword, createSession, hashPassword, fallbackEmail, publicUser } from '@/lib/auth'
import { emitRealtime } from '@/lib/realtime-emitter'

// POST /api/customers - registar novo cliente (cria também o PERFIL DE LOGIN
// e devolve a SESSÃO já aberta — o cliente entra na app sem passar pela
// entrada manual).
//
// APROVAÇÃO OBRIGATÓRIA (anti-malfeitor): todo o cadastro NOVO entra com
// status "pendente" — o cliente vê o ecrã de aguardo e só passa a usar a
// app (fazer pedidos, enviar mensagens) quando o ADMINISTRADOR PRINCIPAL
// o aprovar na Central. Se for recusado, recebe a mensagem do motivo.
export async function POST(req: NextRequest) {
  try {
    await ensureSeed()
    const body = await req.json()
    const {
      name,
      phone,
      email,
      password,
      address,
      latitude,
      longitude,
      locationSource,
      locationNote,
      photo,
    } = body

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Nome e telefone são obrigatórios.' },
        { status: 400 }
      )
    }

    const normalizedPhone = String(phone).trim()

    // FOTO DO CLIENTE enviada no cadastro (data URL base64, comprimida no
    // próprio aparelho) — ajuda o administrador a avaliar a aprovação
    const photoValue =
      typeof photo === 'string' && photo.startsWith('data:image/') ? photo : null

    const existing = await db.customer.findUnique({ where: { phone: normalizedPhone } })
    let customer
    if (existing) {
      customer = await db.customer.update({
        where: { phone: normalizedPhone },
        data: {
          name,
          email: email ?? existing.email,
          address: address ?? existing.address,
          latitude: latitude ?? existing.latitude,
          longitude: longitude ?? existing.longitude,
          locationSource: locationSource ?? existing.locationSource,
          locationNote: locationNote ?? existing.locationNote,
          // foto nova substitui a antiga; cadastro já aprovado mantém o
          // estado (não volta a "pendente") — recusado/pendente continuam
          // à espera da decisão do administrador principal
          ...(photoValue ? { photo: photoValue } : {}),
        },
      })
    } else {
      customer = await db.customer.create({
        data: {
          name,
          phone: normalizedPhone,
          email: email ?? null,
          address: address ?? '',
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          locationSource: locationSource ?? 'auto',
          locationNote: locationNote ?? null,
          ...(photoValue ? { photo: photoValue } : {}),
          // CADASTRO NOVO: fica À ESPERA da aprovação do administrador
          // principal antes de se tornar activo
          status: 'pendente',
        },
      })
    }

    // perfil de entrada (login) do cliente:
    // - ainda não existe (conta nova ou conta eliminada antes) → cria e
    //   abre já a sessão
    // - já existe → só avança quem souber a SENHA dessa conta (evita que
    //   alguém assuma a conta de outra pessoa ao “registar-se” com o
    //   telefone dela)
    const existingUser = await db.user.findUnique({ where: { customerId: customer.id } })
    let user = existingUser
    let token: string | null = null

    if (existingUser) {
      const pass = String(password ?? '') || normalizedPhone
      if (!verifyPassword(pass, existingUser.password)) {
        return NextResponse.json(
          {
            error:
              'Já existe uma conta com este telefone. Toque em «Já tenho conta — Entrar» e use a sua senha.',
          },
          { status: 409 }
        )
      }
      token = await createSession(existingUser.id)
      // foto enviada no cadastro actualiza também o perfil de entrada
      if (photoValue && photoValue !== existingUser.photo) {
        await db.user
          .update({ where: { id: existingUser.id }, data: { photo: photoValue } })
          .catch(() => undefined)
      }
    } else {
      const loginEmail =
        (typeof email === 'string' && email.trim()) || fallbackEmail(normalizedPhone)
      try {
        user = await db.user.create({
          data: {
            name: customer.name,
            email: loginEmail.toLowerCase(),
            phone: normalizedPhone,
            // sem senha definida, o telefone serve de senha inicial
            password: hashPassword(password || normalizedPhone),
            role: 'CLIENTE',
            customerId: customer.id,
            ...(photoValue ? { photo: photoValue } : {}),
          },
        })
      } catch {
        // e-mail já usado por outro perfil — usa o e-mail interno do telefone
        user = await db.user.create({
          data: {
            name: customer.name,
            email: fallbackEmail(normalizedPhone),
            phone: normalizedPhone,
            password: hashPassword(password || normalizedPhone),
            role: 'CLIENTE',
            customerId: customer.id,
            ...(photoValue ? { photo: photoValue } : {}),
          },
        })
      }
      token = await createSession(user.id)
    }

    // cadastro NOVO à espera de aprovação → avisa a central em tempo real
    // (o administrador principal ouve o alarme de novo cadastro pendente)
    if (customer.status === 'pendente' && !existing) {
      await emitRealtime('signup:new', {
        customerId: customer.id,
        name: customer.name,
        phone: customer.phone,
      }).catch(() => undefined)
    }

    return NextResponse.json({
      customer,
      token,
      user: user ? publicUser(user) : null,
      updatedExisting: !!existing,
      // o cadastro acabou de entrar e está À ESPERA de aprovação?
      pendingApproval: customer.status === 'pendente' && !existing,
    })
  } catch (error) {
    console.error('[api/customers] erro:', error)
    return NextResponse.json({ error: 'Erro interno ao registar cliente.' }, { status: 500 })
  }
}

// NOTA: o antigo GET /api/customers?phone=... (devolvia nome, morada e GPS
// de qualquer cliente só com o número de telefone) foi REMOVIDO por segurança.
// A entrada de clientes existentes faz-se por /api/auth/login com senha.
