#!/bin/bash
# Spúšťaj na SERVERI po každom update kódu.
# Usage: bash /opt/lifeos/deploy/02-deploy.sh
set -e

APP_DIR=/opt/lifeos

echo "=== 1. Git pull (ako root) ==="
cd ${APP_DIR}
git pull
chown -R lifeos:lifeos ${APP_DIR}

echo "=== 2. Stavba Go binárky ==="
cd ${APP_DIR}/backend
/usr/local/bin/go build -o ${APP_DIR}/lifeos .
echo "Go build OK"

echo "=== 3. Stavba frontendu ==="
cd ${APP_DIR}/frontend
npm install --silent
npm run build
echo "Frontend build OK"

echo "=== 4. nginx reload ==="
cp ${APP_DIR}/deploy/nginx.conf /etc/nginx/sites-available/lifeos
nginx -t && systemctl reload nginx

echo "=== 5. Reštart service ==="
systemctl restart lifeos

echo ""
echo "=== Deploy hotový ==="
echo "http://178.105.173.48:8082"
systemctl status lifeos --no-pager -l | tail -10
