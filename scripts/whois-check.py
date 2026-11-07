#!/usr/bin/env python3
"""Verifica disponibilidade de dominios via WHOIS (porta 43)."""
import socket
import sys


def whois_query(server: str, query: str) -> str:
    try:
        s = socket.create_connection((server, 43), timeout=20)
        try:
            s.sendall((query + "\r\n").encode())
        finally:
            pass
        data = b""
        while True:
            chunk = s.recv(4096)
            if not chunk:
                break
            data += chunk
        s.close()
        return data.decode("utf-8", errors="replace")
    except Exception as e:  # noqa: BLE001
        return f"ERRO: {e}"


def summarise(text: str) -> str:
    """Classifica a resposta whois como LIVRE ou REGISTADO."""
    low = text.lower()
    if "erro" in low[:40]:
        return "INDETERMINADO"
    # marcadores comuns de dominio nao encontrado
    not_found_markers = [
        "no match", "not found", "no data found", "no entries found",
        "no object found", "domain not found", "nada encontrado",
        "nao encontrado", "não encontrado", "sem resultados",
        "no matches", "status: free", "available",
    ]
    if any(m in low for m in not_found_markers):
        return "LIVRE (sem registo)"
    if any(m in low for m in ["domain name:", "domain:", "registrant", "nome de dom", "titular", "status: active", "registrar:", "creation date", "created:"]):
        return "REGISTADO / resposta com dados"
    return "INDETERMINADO"


def main() -> None:
    # 1) descobrir o servidor whois de .ao via IANA
    iana = whois_query("whois.iana.org", "ao")
    ao_server = None
    for line in iiana_lines(iana):
        pass
    for line in iana.splitlines():
        if line.lower().startswith("whois:"):
            ao_server = line.split(":", 1)[1].strip()
            break
    print(f"[IANA] servidor whois de .ao: {ao_server}\n")

    checks = []
    if ao_server:
        checks += [
            (ao_server, "gotareal.ao"),
            (ao_server, "gota-real.ao"),
            (ao_server, "gotareal.co.ao"),
        ]
    checks += [
        ("whois.verisign-grs.com", "gotareal.com"),
        ("whois.verisign-grs.com", "gota-real.com"),
    ]

    for server, domain in checks:
        print("=" * 60)
        print(f"DOMINIO: {domain}  (servidor: {server})")
        resp = whois_query(server, domain if ".com" not in domain else f"domain {domain}")
        print(f"-> {summarise(resp)}")
        # mostra algumas linhas uteis
        shown = 0
        for line in resp.splitlines():
            l = line.strip()
            if not l:
                continue
            key = l.lower().split(":")[0] if ":" in l else ""
            if key in {
                "domain", "domain name", "status", "registrar", "creation date",
                "created", "created on", "updated date", "expiry date", "expires",
                "registrant", "titular", "nome de dom", "nome de dominio", "state",
            }:
                print(f"   {l}")
                shown += 1
                if shown >= 6:
                    break
        print()


def iiana_lines(text):  # placeholder para compat
    return []


if __name__ == "__main__":
    sys.exit(main())
