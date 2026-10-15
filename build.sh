#!/bin/sh
# Assemble la page unique index.html (GitHub Pages) à partir de src/
set -e
cd "$(dirname "$0")"
{
  echo '<!doctype html>'
  echo '<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  echo '<style>[hidden]{display:none!important}body{margin:0}</style>'
  cat src/head.html
  echo '</head><body>'
  cat src/body.html
  echo '<script>'; cat src/engine.js src/gen.js src/app.js; echo '</script>'
  echo '</body></html>'
} > index.html
echo "index.html généré ($(wc -c < index.html) octets)"
