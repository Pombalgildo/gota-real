import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

const globalForSeed = globalThis as unknown as {
  __gotaSeedDone?: boolean
}

/**
 * Garante que os dados base existem: produtos, motoboys, PERFIS DE LOGIN
 * (administrador, motoboy e cliente de demonstração) e dados da loja.
 * Idempotente: executa uma vez por processo.
 */
export async function ensureSeed(): Promise<void> {
  if (globalForSeed.__gotaSeedDone) return
  globalForSeed.__gotaSeedDone = true
  try {
    const productCount = await db.product.count()
    if (productCount === 0) {
      await db.product.createMany({
        data: [
          {
            name: 'Bidão Gota REAL 5L',
            description:
              'O nosso clássico bidão de 5 litros de água purificada, selado e pronto para beber. Ideal para o dia a dia da família.',
            category: 'agua',
            kind: 'bidon',
            volumeL: 5,
            priceKz: 600,
            unitLabel: 'bidão de 5L',
            stock: 200,
            sortOrder: 1,
          },
          {
            name: 'Garrafão 10L',
            description:
              'Garrafão de 10 litros de água purificada Gota REAL. Perfeito para pequenos escritórios e eventos.',
            category: 'agua',
            kind: 'garrafao',
            volumeL: 10,
            priceKz: 1100,
            unitLabel: 'garrafão de 10L',
            stock: 120,
            sortOrder: 2,
          },
          {
            name: 'Garrafão 20L',
            description:
              'Garrafão de 20 litros com água purificada de alta qualidade. A opção mais económica para grandes consumos.',
            category: 'agua',
            kind: 'garrafao',
            volumeL: 20,
            priceKz: 1900,
            unitLabel: 'garrafão de 20L',
            stock: 80,
            sortOrder: 3,
          },
          {
            name: 'Garrafa 1.5L',
            description:
              'Garrafa individual de 1,5 litro. Prática para levar para o trabalho, escola ou treino.',
            category: 'agua',
            kind: 'garrafa',
            volumeL: 1.5,
            priceKz: 250,
            unitLabel: 'garrafa de 1,5L',
            stock: 300,
            sortOrder: 4,
          },
          {
            name: 'Pack 6 x 1.5L',
            description:
              'Pack com 6 garrafas de 1,5 litro (9 litros no total). Económico e prático para a família.',
            category: 'agua',
            kind: 'pack',
            volumeL: 9,
            priceKz: 1350,
            unitLabel: 'pack de 6 garrafas',
            stock: 100,
            sortOrder: 5,
          },
          {
            name: 'Garrafa 500ml',
            description:
              'Garrafa de 500ml, ideal para reuniões, festas e para levar na bolsa ou no carro.',
            category: 'agua',
            kind: 'garrafa',
            volumeL: 0.5,
            priceKz: 120,
            unitLabel: 'garrafa de 500ml',
            stock: 400,
            sortOrder: 6,
          },
          {
            name: 'Copos 250ml (pack 100)',
            description:
              'Pack com 100 copos descartáveis de 250ml com o branding Gota REAL. Essencial para eventos.',
            category: 'acessorio',
            kind: 'acessorio',
            volumeL: 0,
            priceKz: 800,
            unitLabel: 'pack de 100 copos',
            stock: 60,
            sortOrder: 7,
          },
          {
            name: 'Suporte para Garrafão',
            description:
              'Suporte metálico resistente para garrafões de 10L e 20L. Mantém a água sempre estável e acessível.',
            category: 'acessorio',
            kind: 'acessorio',
            volumeL: 0,
            priceKz: 3500,
            unitLabel: 'unidade',
            stock: 25,
            sortOrder: 8,
          },
          {
            name: 'Bomba Manual p/ Garrafão',
            description:
              'Bomba manual de fácil instalação para garrafões de 20L. Torna o serviço muito mais prático.',
            category: 'acessorio',
            kind: 'acessorio',
            volumeL: 0,
            priceKz: 2500,
            unitLabel: 'unidade',
            stock: 30,
            sortOrder: 9,
          },
          {
            name: 'Garrafa Térmica 750ml',
            description:
              'Garrafa térmica reutilizável Gota REAL de 750ml. Mantém a água fresca durante horas.',
            category: 'acessorio',
            kind: 'acessorio',
            volumeL: 0,
            priceKz: 1800,
            unitLabel: 'unidade',
            stock: 40,
            sortOrder: 10,
          },
        ],
      })
    }

    const courierCount = await db.courier.count()
    if (courierCount === 0) {
      await db.courier.createMany({
        data: [
          {
            name: 'João Motoboy',
            phone: '+244 923 000 111',
            vehicle: 'Mota Honda',
            plate: 'LD-1234-AB',
            latitude: -8.847,
            longitude: 13.241,
            available: true,
          },
          {
            name: 'Domingos Caluando',
            phone: '+244 923 000 222',
            vehicle: 'Mota Yamaha',
            plate: 'LD-5678-CD',
            latitude: -8.839,
            longitude: 13.23,
            available: true,
          },
        ],
      })
    }

    // ---------- PERFIS DE LOGIN (contas de demonstração) ----------
    const userCount = await db.user.count()
    if (userCount === 0) {
      // ADMINISTRADOR — pode tudo: criar perfis, eliminar, banir, gerir a loja
      await db.user.create({
        data: {
          name: 'Administrador Gota REAL',
          email: 'admin@gotareal.ao',
          phone: '+244 923 000 000',
          password: hashPassword('admin123'),
          role: 'ADMIN',
        },
      })

      // MOTOBOY — recebe os pedidos para fazer entregas via GPS
      const joao = await db.courier.findFirst({ where: { name: 'João Motoboy' } })
      const motoboyUser = await db.user.create({
        data: {
          name: 'João Motoboy',
          email: 'motoboy@gotareal.ao',
          phone: '+244 923 000 111',
          password: hashPassword('motoboy123'),
          role: 'MOTOBOY',
        },
      })
      // liga o entregador existente a este perfil (a chave vive no Courier)
      if (joao) {
        await db.courier.update({ where: { id: joao.id }, data: { userId: motoboyUser.id } })
      }

      // CLIENTE de demonstração — com local exacto de entrega em Luanda
      const demoPhone = '923 111 222'
      let demoCustomer = await db.customer.findUnique({ where: { phone: demoPhone } })
      if (!demoCustomer) {
        demoCustomer = await db.customer.create({
          data: {
            name: 'Ana Paula Silva',
            phone: demoPhone,
            email: 'cliente@gotareal.ao',
            address: 'Rua Amílcar Cabral, Luanda (Ingombota)',
            latitude: -8.8147,
            longitude: 13.2302,
            locationSource: 'exata',
            locationNote: 'Local exacto de entrega confirmado no cadastro',
          },
        })
      } else {
        // normaliza os dados do cliente de demonstração
        demoCustomer = await db.customer.update({
          where: { phone: demoPhone },
          data: {
            name: 'Ana Paula Silva',
            email: 'cliente@gotareal.ao',
            address: 'Rua Amílcar Cabral, Luanda (Ingombota)',
            latitude: -8.8147,
            longitude: 13.2302,
            locationSource: 'exata',
            locationNote: 'Local exacto de entrega confirmado no cadastro',
            banned: false,
            banReason: null,
          },
        })
      }
      await db.user.create({
        data: {
          name: demoCustomer.name,
          email: 'cliente@gotareal.ao',
          phone: demoPhone,
          password: hashPassword('cliente123'),
          role: 'CLIENTE',
          customerId: demoCustomer.id,
        },
      })
    }

    // ---------- DADOS DA LOJA ----------
    const store = await db.storeConfig.findUnique({ where: { id: 'main' } })
    if (!store) {
      await db.storeConfig.create({
        data: {
          id: 'main',
          name: 'Gota REAL',
          tagline: 'Água purificada entregue onde estiver',
          phone: '+244 923 000 000',
          whatsapp: '+244 923 000 000',
          address: 'Rua da Independência, Luanda — Angola',
          hours: 'Segunda a Sábado: 7h00–19h00 · Domingo: 8h00–13h00',
          deliveryFeeKz: 0,
          minOrderKz: 0,
          note: 'Pagamento por TPA (cartão) ou dinheiro na entrega.',
        },
      })
    }
  } catch (error) {
    globalForSeed.__gotaSeedDone = false
    console.error('[seed] erro ao criar dados base:', error)
  }
}
