#!/usr/bin/env bash
#
# The local Postgres, and how anything reaches it.
#
# This dev container talks to Docker through a socket at
# /config/.docker/run/docker.sock, and the containers it starts live in another
# network namespace. Nothing here reaches them: a published port does not listen
# in this namespace, and the daemon's bridge happens to use the same 172.17.0.0/16
# this container is on, so even the container's own IP resolves to us.
#
# So a client cannot connect from the dev container — it has to run *inside* the
# database's network. That is what `run` below does, and it is why the db
# commands are wrapped instead of calling drizzle-kit directly.
#
# docs/ARCHITECTURE.md records the finding; this script is the workaround.

set -euo pipefail

CONTAINER=iron-squid-pg
IMAGE=postgres:17-alpine
DB=iron_squid
USER=dev
PASSWORD=dev
URL="postgres://${USER}:${PASSWORD}@127.0.0.1:5432/${DB}"
REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)

usage() {
  cat <<'EOF'
usage: local-db.sh <command>

  up        start the local Postgres and wait until it accepts connections
  down      remove it, and its data with it
  migrate   apply drizzle/*.sql to it, from inside its network
  psql      open a shell on it
  run …     run a command in a container that can see it, with DATABASE_URL set
EOF
}

start() {
  if [ -n "$(docker ps -q -f "name=^${CONTAINER}$")" ]; then
    echo "${CONTAINER} is already up."
  else
    docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
    docker run -d --name "${CONTAINER}" \
      -e POSTGRES_USER="${USER}" \
      -e POSTGRES_PASSWORD="${PASSWORD}" \
      -e POSTGRES_DB="${DB}" \
      "${IMAGE}" >/dev/null
    echo "starting ${CONTAINER}…"
  fi
  until docker exec "${CONTAINER}" pg_isready -U "${USER}" -d "${DB}" >/dev/null 2>&1; do
    sleep 1
  done
  echo "${CONTAINER} is ready."
}

# Runs a command in a throwaway container that shares the database's network
# stack, with the repository mounted and DATABASE_URL already pointing at it.
in_network() {
  docker run --rm -i \
    --network "container:${CONTAINER}" \
    -v "${REPO}:/repo" \
    -w /repo/apps/web \
    -e DATABASE_URL="${URL}" \
    node:22 "$@"
}

case "${1:-}" in
  up) start ;;
  down)
    docker rm -f "${CONTAINER}" >/dev/null 2>&1 && echo "${CONTAINER} removed." \
      || echo "${CONTAINER} was not running."
    ;;
  migrate)
    start
    in_network npx drizzle-kit migrate
    ;;
  psql)
    start
    docker exec -it "${CONTAINER}" psql -U "${USER}" -d "${DB}"
    ;;
  run)
    shift
    start
    in_network "$@"
    ;;
  *)
    usage
    exit 1
    ;;
esac
