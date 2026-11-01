#!/bin/bash
# Usage: ./demo-logs.sh <Groupe|Cadeau> [service-name]

TAG="${1:?Usage: ./demo-logs.sh <Groupe|Cadeau> [service-name]}"
SERVICE="${2:-dining-service}"

CONTAINER=$(docker ps --filter "name=$SERVICE" --format '{{.Names}}' | head -n 1)
if [ -z "$CONTAINER" ]; then
  echo "Container '$SERVICE' introuvable : la stack est-elle démarrée ?"
  read -rp "Entrée pour fermer"
  exit 1
fi

echo "=== [$TAG] logs de $CONTAINER ==="

docker logs -f --tail 0 "$CONTAINER" 2>&1 \
  | sed -u -E 's/\x1b\[[0-9;]*m//g' \
  | grep --line-buffered -F "[$TAG]" \
  | sed -u -E 's/^\[Nest\] [0-9]+ +- +[0-9\/]+, ([0-9:]+ [AP]M) +([A-Z]+) +\[[^]]+\] +/\1  \2  /'

echo
read -rp "Flux terminé, Entrée pour fermer"
