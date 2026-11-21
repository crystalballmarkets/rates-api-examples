#!/bin/sh
# Checks the plugin and writes the zip to upload at https://wordpress.org/plugins/developers/add/
#
#   sh wordpress/tools/pack.sh
#
# The zip holds one folder, crystal-ball-markets-rates, and nothing but the plugin's own files.
set -e
cd "$(dirname "$0")/.."

php tests/run.php
node tests/core.test.cjs

mkdir -p dist
rm -f dist/crystal-ball-markets-rates.zip
zip -r -X -q dist/crystal-ball-markets-rates.zip crystal-ball-markets-rates -x '*/.*' -x '*~'
echo
unzip -l dist/crystal-ball-markets-rates.zip
