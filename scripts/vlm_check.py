#!/usr/bin/env python3
"""Analisa uma screenshot com o VLM e imprime apenas o texto da resposta."""
import json
import subprocess
import sys

PROMPT = (
    "Analisa esta screenshot de uma app móvel de entrega de água (Gota REAL). "
    "Procura problemas de layout: texto a sair dos cartões/quadros/caixas, texto cortado "
    "ou tapado, palavras partidas ao meio, sobreposições de elementos, botões ou texto "
    "desalinhados, números ou datas mal formatados. Lista cada problema concreto com a "
    "sua localização exacta na imagem (topo, meio, fundo, esquerda, direita). "
    "Se não houver problemas, responde apenas 'SEM PROBLEMAS'."
)

def main():
    if len(sys.argv) < 2:
        print("uso: vlm_check.py <imagem> [prompt_extra]")
        sys.exit(1)
    img = sys.argv[1]
    extra = sys.argv[2] if len(sys.argv) > 2 else ""
    prompt = PROMPT + (" " + extra if extra else "")
    out = subprocess.run(
        ["z-ai", "vision", "-i", img, "-p", prompt],
        capture_output=True, text=True, timeout=180
    )
    raw = out.stdout
    # extrai o primeiro bloco JSON {...}
    start = raw.find("{")
    if start == -1:
        print(raw)
        print(out.stderr)
        sys.exit(1)
    try:
        data = json.loads(raw[start:])
        print(data["choices"][0]["message"]["content"])
    except Exception:
        print(raw)

if __name__ == "__main__":
    main()
