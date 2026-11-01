#!/bin/bash
# Starts the whole stack like start-all.sh, then opens one terminal pane per demo log
# (Groupe / Cadeau) of the dining service.
# Usage: ./start-demo.sh [--build]   (--build rebuilds the dining-service image first)

cd "$(dirname "$0")" || exit 1

if [ "$1" == "--build" ]; then
  (cd dining-service && ./build.sh)
fi

./start-all.sh || exit 1

# Panes to open: tag shown by demo-logs.sh. Add a line to follow another tag.
PANES=("Groupe" "Cadeau")

if command -v wt.exe >/dev/null 2>&1; then
  # Windows Terminal: one new window, one pane per tag (split top/bottom).
  BASH_EXE="$(cygpath -w "$(command -v bash)")"
  DIR="$(cygpath -w "$PWD")"
  ARGS=(-w new)
  for i in "${!PANES[@]}"; do
    if [ "$i" -eq 0 ]; then
      ARGS+=(new-tab --title "${PANES[$i]}" -d "$DIR" "$BASH_EXE" ./demo-logs.sh "${PANES[$i]}")
    else
      ARGS+=(";" split-pane -H --title "${PANES[$i]}" -d "$DIR" "$BASH_EXE" ./demo-logs.sh "${PANES[$i]}")
    fi
  done
  MSYS_NO_PATHCONV=1 wt.exe "${ARGS[@]}"
else
  # No Windows Terminal: one separate window per tag.
  for tag in "${PANES[@]}"; do
    cmd.exe /c start "$tag" "$(cygpath -w "$(command -v bash)")" ./demo-logs.sh "$tag"
  done
fi

echo "Démo prête : $(IFS=', '; echo "${PANES[*]}") suivis dans leurs terminaux."
