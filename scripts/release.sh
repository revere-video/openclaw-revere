#!/bin/sh
# Builds a release from a tagged commit: checks, tests, a tarball of exactly the files the package lists, and its checksum.
# Publishing is a separate, human step (see docs/release.md).
set -eu
cd "$(dirname "$0")/.."
[ -z "$(git status --porcelain)" ] || { echo "The working tree is not clean." >&2; exit 1; }
TAG=$(git describe --exact-match --tags HEAD 2>/dev/null) || { echo "HEAD is not a tag." >&2; exit 1; }
node scripts/check.mjs
npm test
npm pack --pack-destination dist >/dev/null
( cd dist && shasum -a 256 ./*.tgz | tee SHA256SUMS )
echo "Built $TAG. Next: docs/release.md."
