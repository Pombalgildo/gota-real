import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'

/**
 * Autenticação por perfil com senha encriptada (scrypt) e sessões na base de dados.
 *
 * Perfis:
 *   ADMIN      — administrador: acesso total; ÚNICO com Ajustes e gestão de perfis
 *   ATENDENTE  — recebe e gere pedidos (confirmar, atribuir, cancelar) e responde mensagens
 *   EDITOR     — gere a loja: produtos, fotos, preços e stock
 *   MOTOBOY    — entregas de mota com GPS
 *   MOTORISTA  — entregas de carro ligeiro com GPS
 *   CLIENTE    — faz pedidos
 */

// ---------- Perfis e permissões ----------
export const WORKER_ROLES = ['ADMIN', 'ATENDENTE', 'EDITOR', 'MOTOBOY', 'MOTORISTA'] as const
export const CENTRAL_ROLES = ['ADMIN', 'ATENDENTE', 'EDITOR'] as const
export const ORDER_MANAGER_ROLES = ['ADMIN', 'ATENDENTE'] as const
export const CATALOG_ROLES = ['ADMIN', 'EDITOR'] as const
export const DELIVERY_ROLES = ['MOTOBOY', 'MOTORISTA'] as const

const SESSION_DAYS = 30

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const test = scryptSync(password, salt, 64)
    const orig = Buffer.from(hash, 'hex')
    return test.length === orig.length && timingSafeEqual(test, orig)
  } catch {
    return false
  }
}

/** Cria uma sessão na base de dados e devolve o token de entrada. */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await db.session.create({ data: { id: token, userId, expiresAt } })
  // limpeza: remove sessões expiradas deste utilizador
  await db.session
    .deleteMany({ where: { userId, expiresAt: { lt: new Date() } } })
    .catch(() => undefined)
  return token
}

type UserWithLinks = Awaited<ReturnType<typeof db.user.findFirst<{ include: { customer: true; courier: true } }>>>

/** Lê o utilizador a partir do cabeçalho Authorization: Bearer <token>. */
export async function getUserFromRequest(
  req: NextRequest
): Promise<UserWithLinks | null> {
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!token) return null
  const session = await db.session.findUnique({
    where: { id: token },
    include: { user: { include: { customer: true, courier: true } } },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: token } }).catch(() => undefined)
    return null
  }
  return session.user as UserWithLinks
}

/** Exige um administrador autenticado. */
export async function requireAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user || user.role !== 'ADMIN' || !user.active || user.banned) return null
  return user
}

/** Exige um trabalhador autenticado (administrador ou perfil criado por ele). */
export async function requireStaff(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user || !(WORKER_ROLES as readonly string[]).includes(user.role) || !user.active || user.banned) {
    return null
  }
  return user
}

/** Exige um perfil autenticado com um dos papéis indicados. */
export async function requireRole(req: NextRequest, roles: readonly string[]) {
  const user = await getUserFromRequest(req)
  if (!user || !roles.includes(user.role) || !user.active || user.banned) return null
  return user
}

// ---------- Autorização de dados do cliente ----------
// Antes, os endpoints do cliente (pedidos, perfil, mensagens…) aceitavam
// apenas o customerId — quem tivesse o id (ou a app com os dados em cache)
// continuava a usar a conta MESMO DEPOIS de o administrador a eliminar.
// Agora toda a actividade do cliente exige uma sessão válida do próprio.

export type CustomerAccess =
  | { ok: true; user: UserWithLinks }
  | { ok: false; status: 401 | 403; error: string }

/**
 * Autoriza o acesso a dados/acções de um cliente:
 * apenas a PRÓPRIA sessão do cliente (perfil CLIENTE ligado ao registo)
 * ou a equipa de gestão (ADMIN/ATENDENTE).
 * Clientes banidos continuam autorizados a LER o próprio perfil — o
 * bloqueio de pedidos tem mensagem própria (ecrã de suspensão).
 */
export async function checkCustomerAccess(
  req: NextRequest,
  customerId: string
): Promise<CustomerAccess> {
  const user = await getUserFromRequest(req)
  if (!user) {
    return {
      ok: false,
      status: 401,
      error: 'A sua sessão terminou. Saia da conta e entre novamente com o seu telefone e senha.',
    }
  }
  if (!user.active || (user.banned && user.role !== 'CLIENTE')) {
    return {
      ok: false,
      status: 401,
      error: 'A sua conta foi encerrada ou desactivada pelo administrador.',
    }
  }
  const isOwner = user.role === 'CLIENTE' && user.customerId === customerId
  const isManager = (ORDER_MANAGER_ROLES as readonly string[]).includes(user.role)
  if (!isOwner && !isManager) {
    return { ok: false, status: 403, error: 'Sem permissão para aceder a estes dados.' }
  }
  return { ok: true, user }
}

/** Remove a senha antes de enviar o utilizador para o front-end. */
export function publicUser<T extends { password?: string }>(user: T): Omit<T, 'password'> {
  const { password: _password, ...rest } = user
  return rest
}

/** E-mail interno para clientes que não fornecem e-mail (entra pelo telefone). */
export function fallbackEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '') || 'semtelefone'
  return `${digits}@clientes.gotareal.ao`
}
