#!/usr/bin/env bash
# Verifies the monitoring stack is up and actually watching production.
set -euo pipefail

PROM=http://prometheus:9090
AM=http://alertmanager:9093
GRAFANA=http://grafana:3000
mkdir -p reports

wait_for() { # url name
  for _ in $(seq 1 30); do
    if curl -fsS "$1" >/dev/null 2>&1; then echo "✅ $2 is up"; return 0; fi
    sleep 2
  done
  echo "❌ $2 is not reachable at $1"; return 1
}

wait_for "$PROM/-/ready" "Prometheus"
wait_for "$AM/-/ready" "Alertmanager"
wait_for "$GRAFANA/api/health" "Grafana"

echo "Checking Prometheus is scraping the production app..."
for i in $(seq 1 12); do
  UP=$(curl -fsS --get "$PROM/api/v1/query" --data-urlencode 'query=up{job="incident-tracker-prod"}' \
       | jq -r '.data.result[0].value[1] // "0"')
  if [ "$UP" = "1" ]; then echo "✅ Production target is UP"; break; fi
  if [ "$i" = "12" ]; then echo "❌ Production target is not being scraped"; exit 1; fi
  sleep 5
done

RULES=$(curl -fsS "$PROM/api/v1/rules" | jq '[.data.groups[].rules[]] | length')
echo "✅ ${RULES} alert rules loaded"
[ "$RULES" -ge 5 ] || { echo "❌ Expected at least 5 alert rules"; exit 1; }

echo "Alert status right now:"
curl -fsS "$PROM/api/v1/rules" \
  | jq -r '.data.groups[].rules[] | "  - \(.name): \(.state)"'

curl -fsS "$PROM/api/v1/targets" > reports/monitoring-targets.json
curl -fsS "$PROM/api/v1/rules"   > reports/monitoring-rules.json
echo "Dashboards: Grafana http://localhost:3030  |  Prometheus http://localhost:9090  |  Alertmanager http://localhost:9093"
