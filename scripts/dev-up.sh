#!/bin/bash
# Garante que o dev server está a correr (não reinicia se já estiver vivo).
code=$(curl -s -m 3 -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
if [ "$code" = "200" ]; then echo "server already up"; exit 0; fi
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null
sleep 1
./node_modules/.bin/next dev -p 3000 > dev.log 2>&1 &
for i in $(seq 1 40); do
  code=$(curl -s -m 3 -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then echo "server ready"; exit 0; fi
  sleep 1
done
echo "server FAILED to start"; tail -10 dev.log; exit 1
