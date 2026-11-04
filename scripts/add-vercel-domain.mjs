#!/usr/bin/env node
/**
 * Adiciona (ou remove) um domínio personalizado no projecto gota-real (Vercel)
 * e imprime os registos DNS exactos necessários.
 *
 * Uso:
 *   VERCEL_TOKEN=xxx node scripts/add-vercel-domain.mjs gotareal.ao
 *   VERCEL_TOKEN=xxx node scripts/add-vercel-domain.mjs gotareal.ao --remove
 *
 * O token NUNCA é gravado no repositório (o repo é público).
 */
const DOMAIN = process.argv[2];
const REMOVE = process.argv.includes("--remove");

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT = process.env.VERCEL_PROJECT || "prj_de06trwUunTpixhpRseFSM0TtCuR";
const TEAM = process.env.VERCEL_TEAM || "team_U3dnTZiV4Dex56TCg8bc1Afj";

if (!DOMAIN || !/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(DOMAIN)) {
  console.error("Uso: node scripts/add-vercel-domain.mjs <dominio> [--remove]");
  process.exit(1);
}
if (!TOKEN) {
  console.error("Falta VERCEL_TOKEN na environment.");
  process.exit(1);
}

const BASE = `https://api.vercel.com/v9/projects/${PROJECT}/domains`;
const QS = `?teamId=${TEAM}`;
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function main() {
  if (REMOVE) {
    const res = await fetch(`${BASE}/${encodeURIComponent(DOMAIN)}${QS}`, {
      method: "DELETE",
      headers: HEADERS,
    });
    console.log(`DELETE ${DOMAIN}: HTTP ${res.status}`);
    return;
  }

  // 1) adiciona o dominio ao projecto
  const addRes = await fetch(`${BASE}${QS}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ name: DOMAIN }),
  });
  const body = await addRes.json().catch(() => ({}));

  if (addRes.status === 409) {
    console.log(`"${DOMAIN}" já está associado ao projecto — nada a fazer.`);
  } else if (!addRes.ok) {
    console.error(`ERRO HTTP ${addRes.status}:`, JSON.stringify(body, null, 2));
    process.exit(1);
  } else {
    console.log(`✅ Domínio "${DOMAIN}" adicionado ao projecto no Vercel.`);
  }

  // 2) instruções DNS conforme tipo de domínio
  const labels = DOMAIN.split(".");
  const isApex = labels.length <= 2; // ex.: gotareal.ao
  console.log("\n=== REGISTOS DNS A CRIAR NO REGISTADOR ===");
  if (isApex) {
    console.log(`A     @        76.76.21.21            (apex ${DOMAIN})`);
    console.log(`CNAME www      cname.vercel-dns.com   (www.${DOMAIN})`);
  } else {
    console.log(`CNAME ${labels.slice(0, -2).join(".").padEnd(9)} cname.vercel-dns.com   (para ${DOMAIN})`);
  }
  console.log(`
Depois de criar os registos, o Vercel emite certificado SSL automaticamente
(propagação DNS: normalmente 5 min – 24 h).
Verificar: https://${DOMAIN}`);

  // 3) estado actual do domínio no projecto
  const getRes = await fetch(`${BASE}/${encodeURIComponent(DOMAIN)}${QS}`, { headers: HEADERS });
  if (getRes.ok) {
    const info = await getRes.json();
    console.log("\n=== ESTADO NO VERCEL ===");
    console.log(`verified: ${info.verified ?? "?"}`);
    if (Array.isArray(info.verification)) console.log(`verificação pendente (normal antes do DNS apontar).`);
  }
}

main().catch((e) => {
  console.error("Falhou:", e.message);
  process.exit(1);
});
