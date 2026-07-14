#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

git pull --ff-only
docker compose up -d --force-recreate --remove-orphans
docker compose ps
