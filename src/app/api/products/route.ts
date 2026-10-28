import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed } from '@/lib/seed'

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

// POST /api/products - criar produto (central)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, description, category, kind, volumeL, priceKz, unitLabel, stock, sortOrder } = body

    if (!name || priceKz == null) {
      return NextResponse.json({ error: 'Nome e preço são obrigatórios.' }, { status: 400 })
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
      },
    })
    return NextResponse.json({ product })
  } catch (error) {
    console.error('[api/products] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
