#!/bin/bash
# Spusti RAZ na Hetzner serveri ako root.
# Bezpečné spustiť aj keď tam už beží chirurgia.
# Usage: bash 01-server-setup.sh
set -e

APP_DIR=/opt/lifeos
APP_USER=lifeos
REPO_URL=git@github.com:AcceptCookies/LifeOS.git
GO_VERSION=1.24.3

echo "=== 1. Systémové balíky ==="
apt-get update -q
apt-get install -y -q postgresql postgresql-contrib

echo "=== 2. Go — overenie ==="
if command -v go &>/dev/null; then
  echo "Go: $(go version) — OK"
else
  curl -sL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" | tar -C /usr/local -xzf -
  ln -sf /usr/local/go/bin/go /usr/local/bin/go
  echo "Go: $(go version)"
fi

echo "=== 3. Node.js — overenie ==="
if command -v node &>/dev/null; then
  echo "Node: $(node --version) — OK"
else
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "=== 4. PostgreSQL DB a používateľ ==="
systemctl enable --now postgresql
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='lifeos'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER lifeos WITH PASSWORD 'lifeos_prod_pw';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='lifeos'" | grep -q 1 || \
  sudo -u postgres createdb -O lifeos lifeos
echo "PostgreSQL: databáza lifeos OK"

echo "=== 5. Používateľ ==="
id -u ${APP_USER} &>/dev/null || useradd -r -s /bin/bash -d ${APP_DIR} ${APP_USER}
mkdir -p ${APP_DIR}

echo "=== 6. Klonovanie repozitára (ako root) ==="
if [ ! -d ${APP_DIR}/backend ]; then
  git clone ${REPO_URL} /tmp/lifeos-clone
  cp -a /tmp/lifeos-clone/. ${APP_DIR}/
  rm -rf /tmp/lifeos-clone
else
  echo "Repozitár už existuje"
fi
chown -R ${APP_USER}:${APP_USER} ${APP_DIR}

echo "=== 7. .env súbor ==="
if [ ! -f ${APP_DIR}/.env ]; then
  cp ${APP_DIR}/deploy/env.example ${APP_DIR}/.env
  JWT=$(openssl rand -hex 32)
  sed -i "s/zmen_na_nahodny_retazec/${JWT}/" ${APP_DIR}/.env
  echo ""
  echo ">>> JWT_SECRET bol vygenerovaný automaticky."
  echo ">>> Skontroluj/uprav ${APP_DIR}/.env ak treba:"
  echo "    nano ${APP_DIR}/.env"
  echo ""
  read -p "Stlač Enter pre pokračovanie..."
else
  echo ".env už existuje"
fi

echo "=== 8. Firewall — pridanie portu 8000 ==="
ufw allow 8000/tcp
echo "Port 8000 otvorený"

echo "=== 9. systemd service ==="
cp ${APP_DIR}/deploy/services/lifeos.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable lifeos

echo "=== 10. nginx ==="
cp ${APP_DIR}/deploy/nginx.conf /etc/nginx/sites-available/lifeos
ln -sf /etc/nginx/sites-available/lifeos /etc/nginx/sites-enabled/lifeos
nginx -t && systemctl reload nginx

echo ""
echo "=== Setup hotový ==="
echo "Ďalší krok: bash ${APP_DIR}/deploy/02-deploy.sh"
