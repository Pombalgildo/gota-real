# 💧 Gota REAL — Água Purificada com Entrega

Aplicação completa de venda de água tratada (bidões de 5L, garrafões, garrafas e acessórios) com entrega por motoboy em Luanda. Funciona no navegador e no telemóvel (mobile-first), em português, com pagamento por **TPA (cartão)** ou **dinheiro** na entrega.

## Funcionalidades

| Perfil | O que pode fazer |
|---|---|
| **Cliente** | Loja com fotos e preços, carrinho, registo com GPS no local exacto, pagamento TPA/cash, rastreio da entrega por GPS, histórico de pedidos, sugestões/reclamações, foto de perfil |
| **Administrador** | Painel operativo ao vivo: pedidos em tempo real, confirmação e atribuição de entregas, gestão da loja (produtos, fotos, preços, stock), criação/desactivação de perfis, banimento de clientes por má conduta, motoboys e respostas a reclamações |
| **Motoboy** | Entregas atribuídas com todos os dados do cliente, navegação GPS, envio da própria posição em tempo real, confirmação de entrega com registo de horas |

Actualização em tempo real por **WebSockets** quando disponível, com **polling automático de reserva** (5–60s conforme o dado) em plataformas serverless — funciona em qualquer alojamento.

## Tecnologias

- **Next.js 16** (App Router, React 19, TypeScript)
- **Prisma ORM** — PostgreSQL em produção / SQLite em desenvolvimento
- **Tailwind CSS 4** + shadcn/ui
- **Zustand** (estado), **socket.io** (tempo real opcional)
- Senhas guardadas com **hash scrypt** + sessões com token na base de dados

## Estrutura

```
src/app/               páginas e rotas de API (Next.js)
src/components/app/    vistas da app (loja, pedidos, central, motoboy…)
src/lib/               cliente HTTP, sockets, tipos, utilitários
prisma/schema.prisma         esquema de PRODUÇÃO (PostgreSQL)
prisma/schema.local.prisma   esquema de DESENVOLVIMENTO (SQLite)
prisma/migrations/     migrações da base Postgres
prisma/seed.mjs        seed inicial (loja, contas, produtos)
prisma/seed-data.json  dados exportados da loja real
mini-services/realtime serviço opcional de WebSockets
scripts/               build/postinstall multi-ambiente + seed
```

## Desenvolvimento local

```bash
# 1. instalar dependências
npm install            # ou: bun install

# 2. criar o .env a partir do exemplo
cp .env.example .env   # DATABASE_URL="file:./db/custom.db" já serve

# 3. criar a base local e os dados iniciais
npm run db:push
npm run db:seed

# 4. arrancar
npm run dev            # http://localhost:3000
```

O seed cria as contas da equipa e a loja (11 produtos). **Em produção, troque todas as senhas no primeiro acesso.**

## Colocar online (Vercel + Postgres)

1. **Criar a base PostgreSQL** — na Vercel: *Storage → Create Database (Postgres)*, ou uma conta gratuita no [Neon](https://neon.tech) / Supabase. Copie a *connection string* (`postgresql://…`).

2. **Importar o repositório na Vercel** — [vercel.com/new](https://vercel.com/new) → escolha o repo do GitHub. A Vercel detecta o Next.js sozinha (não precisa de mexer em build command).

3. **Definir a variável de ambiente** — nas *Settings → Environment Variables* do projecto:
   - `DATABASE_URL` = a connection string do passo 1 (marque *Production*, *Preview* e *Development*)

4. **Deploy.** Durante o build acontece tudo automaticamente:
   - `prisma migrate deploy` cria as tabelas no Postgres
   - `prisma/seed.mjs` cria a loja inicial (só se a base estiver vazia — nunca sobrescreve dados)
   - `next build` compila a app

5. **Testar** — abra o domínio `xxx.vercel.app`, entre com a conta de administrador e troque as senhas.

> Dica: escolha a região da base de dados na Europa (ex.: `fra1` / `eu-central-1`) — é a mais próxima de Angola.

## Tempo real (WebSockets) — opcional

Na Vercel a app funciona com polling automático (pedidos novos chegam à central em ~6s, posição do motoboy em ~5s). Se um dia quiser actualização instantânea, faça deploy do serviço `mini-services/realtime` (Railway, Render, Fly.io…) e defina:
- `NEXT_PUBLIC_REALTIME_URL` = endereço público desse serviço
- `REALTIME_URL` = o mesmo endereço (variável de servidor)

## Segurança

- `.env` e `db/` **nunca** vão para o repositório (já estão no `.gitignore`)
- As senhas viajam no `prisma/seed-data.json` apenas como **hash scrypt**
- Sessões expiram e são guardadas na base de dados — revogáveis
