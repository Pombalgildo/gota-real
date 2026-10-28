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
- Dados de demonstração na base: pedidos #1001 (entregue, cash) e #1002 (pendente, TPA), 1 sugestão respondida
- Identidade visual azul/dourado fiel ao logo Gota REAL; preços em Kwanzas (Kz)
- Serviço realtime em mini-services/realtime (porta 3003), iniciado com bun run dev
