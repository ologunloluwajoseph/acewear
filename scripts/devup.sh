#!/bin/bash
# Revive the ACE dev server if the sandbox reaped it (kills all children
# of each tool call). Idempotent — safe to source before every batch.
cd /home/z/my-project
if ! curl -s -o /dev/null --max-time 2 http://localhost:3000; then
  nohup npm run dev > /tmp/next-dev.log 2>&1 < /dev/null &
  for i in $(seq 1 90); do
    if curl -s -o /dev/null --max-time 2 http://localhost:3000; then break; fi
    sleep 1
  done
fi
curl -s -o /dev/null -w "dev-server:%{http_code}\n" http://localhost:3000
