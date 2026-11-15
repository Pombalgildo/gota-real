// Diagnóstico: verificar o que o dev server está realmente a servir
const BASE = 'http://localhost:3000'

async function main() {
  const html = await (await fetch(BASE + '/')).text()
  console.log('HTML bytes:', html.length)

  // extrai os chunks JS referenciados
  const chunks = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1])
  console.log('Chunks referenciados no HTML:', chunks.length)

  let novo = false
  let antigo = false
  let badge = false
  for (const c of chunks) {
    const js = await (await fetch(BASE + c)).text()
    if (js.includes('galeria do seu telem')) novo = true
    if (js.includes('Como funciona:')) antigo = true
    if (js.includes('controllerchange')) badge = true
  }
  console.log('Código NOVO (foto no topo):', novo ? 'SIM ✓' : 'NÃO ✗')
  console.log('Aviso ANTIGO ainda servido:', antigo ? 'SIM ✗ — PROBLEMA' : 'não ✓')
  console.log('Auto-reload do SW servido:', badge ? 'SIM ✓' : 'NÃO ✗')

  // o sw.js servido
  const sw = await (await fetch(BASE + '/sw.js')).text()
  console.log('SW versão servida:', sw.match(/VERSION = '([^']+)'/)?.[1])
}

main().catch((e) => console.error('ERRO:', e.message))
