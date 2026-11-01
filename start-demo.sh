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
PANES=("Groupe" "Cadeau" "Bonus")

# Native WSL (wt.exe/cmd.exe reached via Windows interop, no cygpath): wt.exe/cmd.exe are
# Windows-side apps and can't exec our WSL bash binary directly, so each pane goes through
# wsl.exe back into this same distro/directory instead of resolving a Windows-side bash path.
IS_NATIVE_WSL=0
if [ -n "$WSL_DISTRO_NAME" ] && command -v wsl.exe >/dev/null 2>&1; then
  IS_NATIVE_WSL=1
fi

if command -v wt.exe >/dev/null 2>&1; then
  # Windows Terminal: one new window, one pane per tag (split top/bottom).
  ARGS=(-w new)
  if [ "$IS_NATIVE_WSL" -eq 1 ]; then
    for i in "${!PANES[@]}"; do
      if [ "$i" -eq 0 ]; then
        ARGS+=(new-tab --title "${PANES[$i]}" wsl.exe -d "$WSL_DISTRO_NAME" --cd "$PWD" -- ./demo-logs.sh "${PANES[$i]}")
      else
        ARGS+=(";" split-pane -H --title "${PANES[$i]}" wsl.exe -d "$WSL_DISTRO_NAME" --cd "$PWD" -- ./demo-logs.sh "${PANES[$i]}")
      fi
    done
    wt.exe "${ARGS[@]}"
  else
    BASH_EXE="$(cygpath -w "$(command -v bash)")"
    DIR="$(cygpath -w "$PWD")"
    for i in "${!PANES[@]}"; do
      if [ "$i" -eq 0 ]; then
        ARGS+=(new-tab --title "${PANES[$i]}" -d "$DIR" "$BASH_EXE" ./demo-logs.sh "${PANES[$i]}")
      else
        ARGS+=(";" split-pane -H --title "${PANES[$i]}" -d "$DIR" "$BASH_EXE" ./demo-logs.sh "${PANES[$i]}")
      fi
    done
    MSYS_NO_PATHCONV=1 wt.exe "${ARGS[@]}"
  fi
else
  # No Windows Terminal: one separate window per tag.
  for tag in "${PANES[@]}"; do
    if [ "$IS_NATIVE_WSL" -eq 1 ]; then
      cmd.exe /c start "$tag" wsl.exe -d "$WSL_DISTRO_NAME" --cd "$PWD" -- ./demo-logs.sh "$tag"
    else
      cmd.exe /c start "$tag" "$(cygpath -w "$(command -v bash)")" ./demo-logs.sh "$tag"
    fi
  done
fi

echo "Démo prête : $(IFS=', '; echo "${PANES[*]}") suivis dans leurs terminaux."
