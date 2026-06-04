#!/bin/sh
set -eu

mkdir -p /var/www/html/data /var/www/html/class/cache
if [ ! -f /var/www/html/data/.htaccess ]; then
  printf 'order allow,deny\ndeny from all\n' > /var/www/html/data/.htaccess
fi
if [ ! -f /var/www/html/data/index.html ]; then
  printf '' > /var/www/html/data/index.html
fi
chown -R www-data:www-data /var/www/html/data /var/www/html/class/cache

exec "$@"
