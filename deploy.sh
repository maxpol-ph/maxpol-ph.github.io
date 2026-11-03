#!/bin/bash
set -e
cd "$(dirname "$0")"
REPO=${REPO:-maxpol-ph/portfolio}
git add -A
git commit -m "Портфолио-лендинг: три кейса" || true
git branch -M main
if ! gh repo view "$REPO" >/dev/null 2>&1; then
  gh repo create "$REPO" --public --source=. --remote=origin --push
else
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$REPO.git"
  git push -u origin main
fi
gh api -X POST "repos/$REPO/pages" -f 'source[branch]=main' -f 'source[path]=/' >/dev/null 2>&1 || true
echo "Готово: https://${REPO%%/*}.github.io/${REPO##*/}/"
