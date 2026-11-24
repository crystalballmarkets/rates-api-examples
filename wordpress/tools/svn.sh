#!/bin/sh
# Lays out a release for the plugin's SVN repository at WordPress.org
# (https://plugins.svn.wordpress.org/crystal-ball-markets-rates) and zips it:
#
#   dist/svn/trunk           the plugin's files, as in the zip pack.sh writes
#   dist/svn/tags/<version>  the same files, under the version that readme.txt's "Stable tag" names
#   dist/svn/assets          the directory's pictures from .wordpress-org (icon, banners, screenshots)
#   dist/crystal-ball-markets-rates-svn.zip   the three folders, to copy into an SVN checkout
#
#   sh wordpress/tools/svn.sh
#
# It stops when "Stable tag" and the plugin's "Version" differ: WordPress.org serves the tag that
# "Stable tag" names, so the two must agree.
set -e
cd "$(dirname "$0")/.."

sh tools/pack.sh > /dev/null

tag=$(sed -n 's/^Stable tag: *//p' crystal-ball-markets-rates/readme.txt | tr -d '\r ')
version=$(sed -n 's/^ \* Version: *//p' crystal-ball-markets-rates/crystal-ball-markets-rates.php | tr -d '\r ')
if [ "$tag" != "$version" ]; then
  echo "Stable tag ($tag) and Version ($version) differ: make them the same before a release" >&2
  exit 1
fi

rm -rf dist/svn dist/crystal-ball-markets-rates-svn.zip dist/unpacked
mkdir -p dist/svn/trunk "dist/svn/tags/$tag" dist/svn/assets dist/unpacked
unzip -q dist/crystal-ball-markets-rates.zip -d dist/unpacked
cp -R dist/unpacked/crystal-ball-markets-rates/. dist/svn/trunk/
cp -R dist/unpacked/crystal-ball-markets-rates/. "dist/svn/tags/$tag/"
rm -rf dist/unpacked
cp .wordpress-org/icon.svg .wordpress-org/icon-*.png .wordpress-org/banner-*.png .wordpress-org/screenshot-*.png dist/svn/assets/

(cd dist/svn && zip -r -X -q ../crystal-ball-markets-rates-svn.zip trunk tags assets)
echo "Version $tag laid out in wordpress/dist/svn and zipped in wordpress/dist/crystal-ball-markets-rates-svn.zip:"
(cd dist/svn && find . -type f | sort | sed 's|^\./|  |')
