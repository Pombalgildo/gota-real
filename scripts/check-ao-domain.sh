#!/usr/bin/env bash
# Verifica disponibilidade de dominio .ao na Cloudspace (com captcha lido por VLM)
set -u
DOM="$1"
cd /home/z/my-project/scripts

for attempt in 1 2 3; do
  echo "===== tentativa $attempt ====="
  rm -f cs2-cookies.txt
  # 1) sessao + token
  curl -sL -c cs2-cookies.txt "https://cloudspace.ao/domain?domain=$DOM" -o cs2-session.html
  TOKEN=$(python3 - <<'PY'
import re
html = open('cs2-session.html', encoding='utf-8', errors='replace').read()
m = re.search(r'name="token" value="([^"]+)"', html)
print(m.group(1) if m else '')
PY
)
  if [ -z "$TOKEN" ]; then echo "sem token"; continue; fi
  # 2) captcha fresco
  curl -s -b cs2-cookies.txt -c cs2-cookies.txt "https://cloudspace.ao/captcha" -o captcha2.png
  # 3) leitura VLM (so o texto)
  CODE=$(z-ai vision -i captcha2.png -p "This is a captcha image. Reply with ONLY the exact characters visible, uppercase, no spaces, no explanation." 2>/dev/null | python3 -c "
import json, sys
raw = sys.stdin.read()
i = raw.find('{')
try:
    d = json.loads(raw[i:raw.rfind('}')+1])
    print(d['choices'][0]['message']['content'].strip())
except Exception:
    print('')
")
  echo "captcha lido: [$CODE]"
  [ -z "$CODE" ] && continue
  # 4) submissao
  RESP=$(curl -s -b cs2-cookies.txt -X POST "https://cloudspace.ao/domain" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -H "X-Requested-With: XMLHttpRequest" \
    --data-urlencode "token=$TOKEN" \
    --data-urlencode "operation=check" \
    --data-urlencode "type=domain" \
    --data-urlencode "domain=$DOM" \
    --data-urlencode "captcha_value=$CODE")
  echo "resposta: ${RESP:0:500}"
  # se nao for erro de captcha, termina
  if ! echo "$RESP" | grep -q "robô"; then
    echo ">>> RESULTADO OBTIDO (tentativa $attempt)"
    break
  fi
done
