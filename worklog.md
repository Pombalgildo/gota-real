# Worklog — Projecto Gota REAL

---
Task ID: 1
Agent: main (Z.ai)
Task: Aplicação web completa "Gota REAL" para venda e entrega de água purificada (cliente, central e motoboy)

Work Log:
- Inicializado ambiente fullstack (Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui + Prisma/SQLite)
- Instalado socket.io + socket.io-client; copiados logos do cliente para /public (gota-real-logo.png, gota-real-logo-square.png)
- Criado schema Prisma: Customer, Product, Order, OrderItem, Courier, Feedback — aplicado com db:push
- Criado mini-serviço WebSocket (mini-services/realtime, porta 3003, path '/') com eventos relay/courier:move
- Criadas rotas API: /api/customers (POST/GET + [id] GET/PATCH), /api/products (CRUD), /api/orders (POST/GET + [id] GET/PATCH com acções confirm/assign/dispatch/deliver/cancel), /api/couriers (GET/POST + [id] PATCH), /api/feedback (GET/POST + [id] PATCH)
- Seed idempotente: 10 produtos (bidão 5L, garrafões 10/20L, garrafas 1.5L/500ml, pack 6x1.5L, copos, suporte, bomba, garrafa térmica) + 2 motoboys
- Tema visual azul royal + dourado baseado no logo (globals.css, layout.tsx com metadata PT)
- Front-end: store Zustand persistido, hooks com tempo real (useProducts/useCustomerOrders/useAllOrders/useCouriers/useFeedback/useCourierPosition), utilitários geo (Haversine, ETA, Google Maps)
- Componentes: Brand (logo/wordmark/gota com coroa), ProductArt (SVGs de bidão/garrafão/garrafa/pack/acessório), MiniMap (mapa GPS auto-contido com trajecto animado), OrderTimeline (gestão de tempos), Badges/Stepper, LocationPicker (GPS real + simulado)
- App do cliente: onboarding em 3 passos (dados → localização exacta/provisória com GPS), home com pedido rápido, loja com carrinho, checkout com TPA/Cash, pedidos com rastreio GPS ao vivo, sugestões/reclamações, perfil com actualização de localização
- Painel da Central: estatísticas, pedidos em tempo real com confirmação/atribuição de motoboy/cancelamento, respostas a feedback, gestão de produtos (CRUD), equipa (motoboys)
- Painel do Motoboy: entregas atribuídas em tempo real, iniciar/concluir entrega, GPS real do telemóvel ou simulação de trajecto, navegação Google Maps
- Correcções: autoincrement SQLite → número manual; setState em effects → useSyncExternalStore/estado derivado; URL do WebSocket com fallback localhost; botão "Ver loja" cortado no mobile (flex-wrap); mapa escondido após entrega
- Verificação e2e com agent-browser (2 sessões simultâneas cliente+motoboy): cadastro → pedido TPA/Cash → confirmação → atribuição → entrega com GPS animado → conclusão com tempos → feedback com resposta; VLM confirmou layouts mobile/desktop

Stage Summary:
- App 100% funcional e verificada no navegador, responsiva (mobile-first + desktop)
- Tempo real via WebSocket (pedidos, GPS do motoboy, feedback) funciona entre painéis
- Identidade visual azul/dourado fiel ao logo Gota REAL; preços em Kwanzas (Kz)
- Serviço realtime em mini-services/realtime (porta 3003), iniciado com bun run dev

---
Task ID: 2
Agent: main (Z.ai)
Task: Parte do ADMINISTRADOR (receber pedidos/compras), parte do MOTOBOY (pedido + dados do cliente + entrega GPS) e gestão da LOJA pelo admin (FOTO REAL dos artigos + alteração de preços visível ao cliente)

Work Log:
- Acesso directo da equipa: botões grandes "CENTRAL (Administrador)" e "MOTOBOY (Entregador)" no ecrã de boas-vindas; modo persistido entre recargas (GotaRealApp verifica mode antes do login do cliente)
- Schema Prisma: campo `image String?` (data URL base64 da FOTO REAL) em Product; db:push sem perda de dados
- APIs: POST/PATCH /api/products aceitam image (validação data:image/*, limite 1,5MB) e emitem evento realtime 'products:update' a todos os clientes ligados
- Upload de foto real no formulário da Central: TIRAR FOTO (câmara do telemóvel), GALERIA/PC, pré-visualização, remover foto; compressão client-side (canvas 900px, JPEG 0.82) em src/lib/image.ts
- Preço em destaque no formulário (caixa dourada "PREÇO DE VENDA (Kz) — visível na loja" com pré-visualização formatada); descrição editável; separador renomeado "Produtos" → "Loja"
- Componente ProductPhoto: mostra a foto real do artigo (base64) com fallback para a ilustração SVG; aplicado na Loja, Início (destaques + pedido rápido) e Checkout
- useProducts escuta 'products:update' → a loja do cliente actualiza preços/fotos sozinha; syncCartProducts actualiza o carrinho e remove artigos desactivados; servidor recalcula sempre o total com os preços da base de dados
- Painel do Motoboy confirmado: recebe pedido em tempo real com nome, telefone, endereço, GPS (distância + ETA), pagamento TPA/CASH a receber, itens, notas; GPS real do telemóvel ou simulação; botão Navegar (Google Maps); ligar ao cliente
- Reinício do servidor dev necessário para carregar o novo Prisma Client (erro 500 "Unknown argument image" resolvido)
- Verificação e2e com 3 sessões de navegador em paralelo (cliente + admin + motoboy): foto real do logo carregada pelo admin (66KB na base) → visível na loja do cliente; preço 600→650 Kz propagado em tempo real; pedido nº 1005 TPA → confirmado → atribuído a Domingos → entrega com GPS ao vivo (962m→394m→chegada) → concluído 12:31 com tempos (solicitado 12:29, total 2 min); VLM confirmou layouts mobile/desktop sem sobreposições

Stage Summary:
- Administrador: recebe pedidos e compras em tempo real, confirma, atribui motoboy, cancela, responde a feedback e gerencia a loja (fotos reais + preços + stock + activar/desactivar)
- Motoboy: recebe o pedido do cliente com todos os dados, entrega via GPS (real ou simulado) visível ao cliente no mapa ao vivo
- Loja: fotos reais e preços colocados pelo admin ficam imediatamente visíveis ao cliente (base de dados SQLite real + WebSocket)
- Nota: foto de teste (logo) no Bidão 5L; o admin pode substituir por fotos reais dos artigos na hora
