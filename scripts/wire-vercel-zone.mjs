#!/usr/bin/env node
/**
 * Prepara um dominio DigitalPlat (ex.: gotareal.qzz.io) na Vercel:
 *   1) associa ao projecto gota-real (v9)
 *   2) cria zona DNS Vercel com nameservers ns1/ns2.vercel-dns.com (v4)
 *   3) cria registos A @ -> 76.76.21.21 e CNAME www -> cname.vercel-dns.com
 *
 * Uso:
 *   VERCEL_TOKEN=xxx node scripts/wire-vercel-zone.mjs gotareal.qzz.io
 *   VERCEL_TOKEN=xxx node scripts/wire-vercel-zone.mjs gotareal.qzz.io --remove
 *
 * Depois disto, o utilizador só precisa de registar o dominio no
 * DigitalPlat (dash.domain.digitalplat.org) com os nameservers:
 *   ns1.vercel-dns.com
 *   ns2.vercel-dns.com
 */
const DOMAIN = process.argv[2];
const REMOVE = process.argv.includes("--remove");

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT = process.env.VERCEL_PROJECT || "prj_de06trwUunTpixhpRseFSM0TtCuR";
const TEAM = process.env.VERCEL_TEAM || "team_U3dnTZiV4Dex56TCg8bc1Afj";

if (!DOMAIN || !/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(DOMAIN)) {
  console.error("Uso: node scripts/wire-vercel-zone.mjs <dominio> [--remove]");
  process.exit(1);
}
if (!TOKEN) {
  console.error("Falta VERCEL_TOKEN na environment.");
  process.exit(1);
}

const QS = `?teamId=${TEAM}`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const api = async (path, opts = {}) => {
  const res = await fetch(`https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}${QS.slice(1)}`, { ...opts, headers: H });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
};

async function main() {
  if (REMOVE) {
    for (const path of [
      `/v9/projects/${PROJECT}/domains/${DOMAIN}`,
      `/v4/domains/${DOMAIN}`,
    ]) {
      const r = await api(path, { method: "DELETE" });
      console.log(`DELETE ${path.split("?")[0]}: HTTP ${r.status}`);
    }
    return;
  }

  // 1) associar ao projecto
  const add = await api(`/v9/projects/${PROJECT}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: DOMAIN }),
  });
  if (add.status === 409) console.log(`1) "${DOMAIN}" já está associado ao projecto.`);
  else if (add.status !== 200) {
    console.error(`1) ERRO HTTP ${add.status}:`, JSON.stringify(add.body));
    process.exit(1);
  } else console.log(`1) Domínio associado ao projecto gota-real.`);

  // 2) criar zona DNS Vercel (nameservers)
  const zone = await api(`/v4/domains`, {
    method: "POST",
    body: JSON.stringify({ name: DOMAIN }),
  });
  if (zone.status === 409) console.log(`2) Zona DNS já existe.`);
  else if (zone.status !== 200) {
    console.error(`2) ERRO HTTP ${zone.status}:`, JSON.stringify(zone.body));
    process.exit(1);
  } else console.log(`2) Zona DNS Vercel criada.`);

  // 3) registos DNS
  const recs = [
    { type: "A", name: "", value: "76.76.21.21", ttl: 60 },
    { type: "CNAME", name: "www", value: "cname.vercel-dns.com", ttl: 3600 },
  ];
  for (const r of recs) {
    const res = await api(`/v4/domains/${DOMAIN}/records`, {
      method: "POST",
      body: JSON.stringify(r),
    });
    const ok = res.status === 200 || res.status === 409;
    console.log(`3) ${r.type} ${r.name || "@"} -> ${r.value}: ${ok ? "OK" : `ERRO HTTP ${res.status} ${JSON.stringify(res.body)}`}`);
  }

  console.log(`
=== NAMESERVERS A INTRODUZIR NO DIGITALPLAT ===
  ns1.vercel-dns.com
  ns2.vercel-dns.com

Depois de registar em https://dash.domain.digitalplat.org com estes NS,
a propagação leva 5-30 min e o SSL é emitido automaticamente.`);
}

main().catch((e) => {
  console.error("Falhou:", e.message);
  process.exit(1);
});
