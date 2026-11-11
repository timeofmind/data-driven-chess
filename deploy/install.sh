#!/bin/sh
# Install or update Chess on this host (Debian + runit): two nodes, chess-n1 (:8110)
# and chess-n2 (:8111), served at https://holmgren.ca/chess by nginx (see
# deploy/nginx-chess.conf). Run as root from the repo root:  sudo deploy/install.sh
# Idempotent. Does NOT touch nginx.
set -eu
CADDY_MODULE=github.com/timeofmind/data-driven-framework-caddy2
CADDY_VERSION=${CADDY_VERSION:-v0.24.1}
FRAMEWORK_VERSION=${FRAMEWORK_VERSION:-v0.29.1}
BUILD_USER=${BUILD_USER:-aaron}

# 1. service user (no login, no home)
id chess >/dev/null 2>&1 || useradd --system --user-group --no-create-home --home-dir /var/lib/chess --shell /usr/sbin/nologin chess

# 2. binary: build as the unprivileged user, install root-owned
tmp=$(mktemp -d); chown "$BUILD_USER" "$tmp"
su "$BUILD_USER" -c "cd '$tmp' && GOBIN='$tmp' go install $CADDY_MODULE/cmd/caddy@$CADDY_VERSION"
install -o root -g root -m 755 "$tmp/caddy" /usr/local/bin/caddy-chess
rm -rf "$tmp"

# 3. the application and Caddyfile: root-owned, world-readable
install -d -o root -g root -m 755 /etc/chess
rm -rf /etc/chess/app.new && mkdir /etc/chess/app.new
cp -r app.yaml model pages routing theme /etc/chess/app.new/
chown -R root:root /etc/chess/app.new && chmod -R u=rwX,go=rX /etc/chess/app.new
rm -rf /etc/chess/app && mv /etc/chess/app.new /etc/chess/app
install -o root -g root -m 644 Caddyfile /etc/chess/Caddyfile
[ -f /etc/chess/admins ] || install -o root -g root -m 644 /dev/null /etc/chess/admins

# 4. data (the players' SQLite database, the change logs), logs, the token key, the cluster's certificates
install -d -o chess -g chess -m 750 /var/lib/chess /var/lib/chess/changelog /var/lib/chess/caddy
for n in n1 n2; do
  install -d -o chess -g chess -m 750 /var/lib/chess/changelog/$n /var/lib/chess/caddy/$n
  install -d -o root -g root -m 755 /var/log/runit/chess-$n
done
[ -f /etc/chess/token.key ] || { umask 027; openssl rand -hex 32 > /etc/chess/token.key; chown root:chess /etc/chess/token.key; }
if [ ! -f /etc/chess/cluster/ca.crt ]; then
  tmp=$(mktemp -d); chown "$BUILD_USER" "$tmp"
  su "$BUILD_USER" -c "cd '$tmp' && go run github.com/timeofmind/data-driven-framework-go/cmd/ddframework@$FRAMEWORK_VERSION cluster-certs --dir '$tmp/cluster' --node n1,n2 --host 127.0.0.1"
  install -d -o root -g chess -m 750 /etc/chess/cluster
  install -o root -g chess -m 640 "$tmp"/cluster/* /etc/chess/cluster/
  rm -rf "$tmp"
fi

# 5. runit services: two nodes behind nginx
port=8110; cport=9111
for n in n1 n2; do
  svc=chess-$n
  install -d -m 755 /etc/sv/$svc /etc/sv/$svc/log
  { printf '#!/bin/sh\nexport CHESS_NODE=%s CHESS_PORT=%s CHESS_CLUSTER_PORT=%s\n' "$n" "$port" "$cport"; grep -v '^#!' deploy/runit/run; } > /etc/sv/$svc/run
  chmod 755 /etc/sv/$svc/run
  sed "s|/var/log/runit/chess|/var/log/runit/$svc|" deploy/runit/log/run > /etc/sv/$svc/log/run; chmod 755 /etc/sv/$svc/log/run
  # validate exactly as the service runs: its user and the environment from the run script
  ( eval "$(grep '^export ' /etc/sv/$svc/run)"
    exec chpst -u chess:chess /usr/local/bin/caddy-chess validate --config /etc/chess/Caddyfile --adapter caddyfile ) >/dev/null 2>&1 || {
    echo "config does not validate for $n; services not (re)started" >&2; exit 1; }
  port=$((port + 1)); cport=$((cport + 1))
done
# the old single service, if present, gives way to n1
if [ -e /etc/service/chess ]; then sv down chess; rm -f /etc/service/chess; sleep 2; fi
port=8110
for n in n1 n2; do
  svc=chess-$n
  if [ -e /etc/service/$svc ]; then sv restart $svc; else ln -s /etc/sv/$svc /etc/service/; fi
  i=0; until curl -fsS -o /dev/null http://127.0.0.1:$port/chess/ 2>/dev/null || [ $i -ge 30 ]; do i=$((i+1)); sleep 1; done
  sv status $svc
  curl -fsS -o /dev/null -w "local check $n: HTTP %{http_code}\n" http://127.0.0.1:$port/chess/
  port=$((port + 1))
done
