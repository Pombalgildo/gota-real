import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'
import { emitRealtime } from '@/lib/realtime-emitter'
import { CATALOG_ROLES, requireRole } from '@/lib/auth'

// limite do data URL da foto (~1,4 MB em base64 ≈ foto de 900px já comprimida)
const MAX_IMAGE_LENGTH = 1_500_000

function validateImage(image: unknown): string | null | undefined {
  if (image === null) return null
  if (image === undefined) return undefined
  if (typeof image !== 'string') return undefined
  if (image === '') return null
  if (!image.startsWith('data:image/')) return undefined
  if (image.length > MAX_IMAGE_LENGTH) {
    throw new Error('Foto demasiado grande — escolha uma imagem mais leve.')
  }
  return image
}

// GET /api/products - lista de produtos à venda
export async function GET() {
  try {
    await ensureSeed()
    const products = await db.product.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json({ products })
  } catch (error) {
    console.error('[api/products] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

// POST /api/products - criar produto (administrador ou editor da loja)
export async function POST(req: NextRequest) {
  try {
    const staff = await requireRole(req, CATALOG_ROLES)
    if (!staff) {
      return NextResponse.json(
        { error: 'Apenas o administrador ou o editor podem gerir a loja.' },
        { status: 403 }
      )
    }
    const body = await req.json()
    const {
      name,
      description,
      category,
      kind,
      volumeL,
      priceKz,
      unitLabel,
      stock,
      sortOrder,
      image,
    } = body

    if (!name || priceKz == null) {
      return NextResponse.json(
        { error: 'Nome e preço são obrigatórios.' },
        { status: 400 }
      )
    }

    const maxSort = await db.product.aggregate({ _max: { sortOrder: true } })

    const product = await db.product.create({
      data: {
        name,
        description: description ?? '',
        category: category ?? 'agua',
        kind: kind ?? 'bidon',
        volumeL: volumeL ?? 0,
        priceKz: Number(priceKz),
        unitLabel: unitLabel ?? 'unidade',
        stock: stock ?? 50,
        sortOrder: sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
        image: validateImage(image) ?? null,
      },
    })

    // avisa a loja de todos os clientes ligados: novo artigo disponível
    await emitRealtime('products:update', { product })

    return NextResponse.json({ product })
  } catch (error) {
    console.error('[api/products] erro:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno.' },
      { status: 500 }
    )
  }
}
