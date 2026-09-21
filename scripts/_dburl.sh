# Pin the managed-Postgres host IP into DATABASE_URL.
#
# DNS on this machine intermittently times out, which kills long-running export
# scripts mid-flight even though the database is perfectly reachable. This
# resolves the host once, caches the answer in .db-host-ip (gitignored), and
# reuses it. The connection still uses sslmode=require, which does not verify
# the hostname, so pinning the address is safe.
#
#   . scripts/_dburl.sh && npx tsx scripts/export-krio-dataset.ts ...
RAW=$(grep -m1 '^DATABASE_URL' .env | sed -E 's/^DATABASE_URL[[:space:]]*=[[:space:]]*//; s/^"//; s/"$//')
HOST=$(printf '%s' "$RAW" | sed -E 's#^.*@([^:/]+):.*#\1#')
PORT=$(printf '%s' "$RAW" | sed -E 's#^.*@[^:/]+:([0-9]+).*#\1#')
CACHE=.db-host-ip

_reachable() { timeout 10 bash -c "cat < /dev/null > /dev/tcp/$1/$PORT" 2>/dev/null; }

IP=""
if [ -f "$CACHE" ]; then
  CACHED=$(cat "$CACHE")
  _reachable "$CACHED" && IP="$CACHED"
fi

if [ -z "$IP" ]; then
  for candidate in $(nslookup "$HOST" 2>/dev/null | awk '/^Address: /{print $2}'); do
    case "$candidate" in
      10.*|127.*|169.254.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*|192.168.*) continue ;;
    esac
    if _reachable "$candidate"; then
      IP="$candidate"
      printf '%s' "$IP" > "$CACHE"
      break
    fi
  done
fi

if [ -n "$IP" ]; then
  export DATABASE_URL=$(printf '%s' "$RAW" | sed -E "s#@${HOST}:#@${IP}:#")
  echo "db: pinned $HOST -> $IP" >&2
else
  export DATABASE_URL="$RAW"
  echo "db: could not resolve $HOST to a reachable address, using hostname" >&2
fi
