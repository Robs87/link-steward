FROM php:7.4-apache

RUN apt-get update \
  && apt-get install -y --no-install-recommends libsqlite3-dev libcurl4-openssl-dev zlib1g-dev \
  && docker-php-ext-install pdo_sqlite curl \
  && a2enmod rewrite access_compat \
  && sed -ri 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

COPY . /var/www/html/
COPY docker/entrypoint.sh /usr/local/bin/link-steward-entrypoint

RUN chmod +x /usr/local/bin/link-steward-entrypoint \
  && rm -rf /var/www/html/docker /var/www/html/unraid /var/www/html/.dockerignore /var/www/html/.gitignore /var/www/html/AGENTS.md \
  && chown -R www-data:www-data /var/www/html/data /var/www/html/class/cache

VOLUME ["/var/www/html/data"]
EXPOSE 80

ENTRYPOINT ["link-steward-entrypoint"]
CMD ["apache2-foreground"]
