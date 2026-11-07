#!/usr/bin/env node
/**
 * Migra o domínio personalizado do projecto gota-real (Vercel):
 *   1) mostra o estado actual (domínios do projecto + zonas do team)
 *   2) remove o domínio antigo (gotareal.qzz.io) do projecto e a zona DNS do team
 *   3) adiciona o novo domínio gotareal.eu.cc (apex) + www (com redirect 308 p/ apex)
 *   4) imprime os registos DNS exactos a criar no painel da GNAME
 *
 * Uso:
 *   VERCEL_TOKEN=xxx node scripts/switch-domain-eucc.mjs
 *
 * O token NUNCA é gravado no ficheiro (repo público).
 */
const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT = process.env.VERCEL_PROJECT || "prj_de06trwUunTpixhpRseFSM0TtCuR";
const TEAM = process.env.VERCEL_TEAM || "team_U3dnTZiV4Dex56TCg8bc1Afj";

const OLD_DOMAIN = "gotareal.qzz.io";
const NEW_DOMAIN = "gotareal.eu.cc";
const NEW_WWW = `www.${NEW_DOMAIN}`;

if (!TOKEN) {
  console.error("Falta VERCEL_TOKEN na environment.");
  process.exit(1);
}

const QS = `teamId=${TEAM}`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function api(path, method = "GET", body = null) {
  const res = await fetch(`https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}${QS}`, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  // ---------- 0) estado actual ----------
  let cur = await api(`/v9/projects/${PROJECT}/domains`);
  if (cur.status === 200 && Array.isArray(cur.json.domains)) {
    console.log("=== DOMÍNIOS ACTUAIS NO PROJECTO ===");
    for (const d of cur.json.domains) console.log(`  - ${d.name}`);
  } else {
    console.log(`(aviso) listagem v9: HTTP ${cur.status}`);
  }

  // ---------- 1) remover domínio antigo ----------
  console.log(`\n=== REMOVER ${OLD_DOMAIN} ===`);
  for (const dom of [OLD_DOMAIN, `www.${OLD_DOMAIN}`]) {
    const r = await api(`/v9/projects/${PROJECT}/domains/${encodeURIComponent(dom)}`, "DELETE");
    console.log(`  projecto ${dom}: HTTP ${r.status} ${r.status === 200 || r.status === 404 ? "OK" : "(!)"}`);
  }
  // zona DNS do team (v4) — os registos são removidos junto
  const z = await api(`/v4/domains/${encodeURIComponent(OLD_DOMAIN)}`, "DELETE");
  console.log(`  zona DNS team ${OLD_DOMAIN}: HTTP ${z.status} ${z.status === 200 || z.status === 404 ? "OK" : "(!)"}`);
  if (z.status >= 400 && z.status !== 404) {
    console.log(`  detalhe: ${JSON.stringify(z.json).slice(0, 300)}`);
  }

  // ---------- 2) adicionar novo domínio ----------
  console.log(`\n=== ADICIONAR ${NEW_DOMAIN} ===`);
  const add = await api(`/v9/projects/${PROJECT}/domains`, "POST", { name: NEW_DOMAIN });
  if (add.status === 409) console.log(`  ${NEW_DOMAIN}: já estava associado.`);
  else if (add.status !== 200) {
    console.error(`  ERRO HTTP ${add.status}: ${JSON.stringify(add.json)}`);
    process.exit(1);
  } else console.log(`  ${NEW_DOMAIN}: adicionado ao projecto gota-real.`);

  const addWww = await api(`/v9/projects/${PROJECT}/domains`, "POST", {
    name: NEW_WWW,
    redirect: NEW_DOMAIN,
    redirectStatusCode: 308,
  });
  if (addWww.status === 409) {
    // já existe — tenta apenas actualizar o redirect
    const upd = await api(`/v9/projects/${PROJECT}/domains/${encodeURIComponent(NEW_WWW)}`, "PATCH", {
      redirect: NEW_DOMAIN,
      redirectStatusCode: 308,
    });
    console.log(`  ${NEW_WWW}: já existia; redirect actualizado (HTTP ${upd.status}).`);
  } else if (addWww.status !== 200) {
    console.error(`  ERRO www HTTP ${addWww.status}: ${JSON.stringify(addWww.json)}`);
  } else {
    console.log(`  ${NEW_WWW}: adicionado com redirect 308 -> ${NEW_DOMAIN}`);
  }

  // ---------- 3) estado final ----------
  cur = await api(`/v9/projects/${PROJECT}/domains`);
  if (cur.status === 200 && Array.isArray(cur.json.domains)) {
    console.log("\n=== ESTADO FINAL DO PROJECTO ===");
    for (const d of cur.json.domains) {
      const red = d.redirect ? ` -> redirect ${d.redirect}` : "";
      console.log(`  - ${d.name}${red} (verified: ${d.verified ?? "?"})`);
    }
  }

  console.log(`
=== REGISTOS DNS A CRIAR NO PAINEL GNAME (zona ${NEW_DOMAIN}) ===
  Tipo   Nome   Valor / Apontar para
  A      @      76.76.21.21
  CNAME  www    cname.vercel-dns.com

Depois de registar e criar os registos, o Vercel emite o SSL
automaticamente (propagação: 5 min - 24 h). Verificar: https://${NEW_DOMAIN}`);
}

main().catch((e) => {
  console.error("Falhou:", e.message);
  process.exit(1);
});
