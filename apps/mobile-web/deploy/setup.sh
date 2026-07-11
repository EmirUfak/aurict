#!/bin/bash
# mobile.aurict.com — sunucu kurulum scripti
# Gereksinimler: bun, pm2, apache2 (mod_proxy, mod_rewrite)

set -e

DOMAIN="mobile.aurict.com"
APP_DIR="/var/www/mobile-aurict-web"
REPO="https://github.com/aurict/aurict.git"

echo "==> Repo klonlanıyor..."
if [ -d "$APP_DIR" ]; then
  git -C "$APP_DIR" pull origin main
else
  git clone "$REPO" /tmp/aurict-clone
  mkdir -p "$APP_DIR"
  cp -r /tmp/aurict-clone/apps/mobile-web/. "$APP_DIR/"
  rm -rf /tmp/aurict-clone
fi

echo "==> Bağımlılıklar kuruluyor..."
cd "$APP_DIR"
bun install

echo "==> Build alınıyor..."
bun run build

echo "==> PM2 başlatılıyor..."
pm2 start "$APP_DIR/ecosystem.config.js" --env production
pm2 save

echo "==> Apache config kopyalanıyor..."
cp "$APP_DIR/deploy/apache.conf" /etc/apache2/sites-available/mobile-aurict.conf
a2ensite mobile-aurict.conf
a2enmod proxy proxy_http proxy_wstunnel rewrite
systemctl reload apache2

echo ""
echo "✓ Kurulum tamamlandı!"
echo "  SSL için: certbot --apache -d $DOMAIN"
echo "  Loglar  : pm2 logs mobile-aurict-web"
