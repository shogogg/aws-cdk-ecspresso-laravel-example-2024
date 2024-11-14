#
# app-base
#
FROM php:8.3.12-fpm-bookworm AS app-base

ARG TIMEZONE="Asia/Tokyo"

ENV TZ=${TIMEZONE} \
    LANG=ja_JP.UTF-8 \
    LANGUAGE=ja_JP:jp \
    LC_ALL=ja_JP.UTF-8

RUN set -eux; \
    apt-get update; \
    ### Install Runtime Dependencies
    apt-get install -y --no-install-recommends \
        libfreetype6 \
        libjpeg62-turbo \
        libpng16-16 \
        libzip4 \
        locales \
        zlib1g \
        ; \
    ### Install Build Dependencies
    savedAptMark="$(apt-mark showmanual)"; \
    apt-get install -y --no-install-recommends \
        libfreetype6-dev \
        libjpeg-dev \
        libpng-dev \
        libzip-dev \
        zlib1g-dev \
        ; \
    ### Install PHP Extensions
    docker-php-ext-configure gd --with-freetype --with-jpeg; \
    docker-php-ext-install -j$(nproc) \
        gd \
        opcache \
        pcntl \
        pdo_mysql \
        zip \
        ; \
    yes "" | pecl install apcu; docker-php-ext-enable apcu; \
    ### Setup Locales
    locale-gen ja_JP.UTF-8; \
    localedef -f UTF-8 -i ja_JP ja_JP; \
    ### Cleanup
    apt-mark auto '.*' > /dev/null; \
    [ -z "$savedAptMark" ] || apt-mark manual $savedAptMark; \
    apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*; \
    rm -rf /usr/local/etc/php-fpm.d/zz-docker.conf

WORKDIR /app

#
# app-cli-base
#
FROM app-base AS app-cli-base

COPY infra/docker/app/assets/app-cli-base/app-cli.ini /usr/local/etc/php/conf.d/

ENTRYPOINT docker-php-entrypoint

CMD ["php"]

#
# app-server-base
#
FROM app-base AS app-server-base

COPY infra/docker/app/assets/app-server-base/app-server.ini /usr/local/etc/php/conf.d/
COPY infra/docker/app/assets/app-server-base/www.conf /usr/local/etc/php-fpm.d/

VOLUME /var/run/php-fpm

CMD ["php-fpm"]

#
# app-cli-dev
#
FROM app-cli-base AS app-cli-dev

COPY infra/docker/app/assets/app-cli-dev/app-cli-dev.ini /usr/local/etc/php/conf.d/

RUN set -eux; yes "" | pecl install xdebug; docker-php-ext-enable xdebug

#
# app-server-dev
#
FROM app-server-base AS app-server-dev

COPY infra/docker/app/assets/app-server-dev/app-server-dev.ini /usr/local/etc/php/conf.d/

RUN set -eux; yes "" | pecl install xdebug; docker-php-ext-enable xdebug

#
# app-cli-prod
#
FROM app-cli-base AS app-cli-prod

RUN mkdir -p /app
RUN mv /usr/local/etc/php/php.ini-production /usr/local/etc/php/php.ini

COPY --from=composer:latest /usr/bin/composer /usr/bin/
COPY composer.* /app/
RUN composer install --no-dev --no-autoloader --no-progress --no-scripts

COPY . /app
RUN composer dump-autoload --no-dev --optimize

RUN chown -R www-data:www-data /app

#
# app-server-prod
#
FROM app-server-base AS app-server-prod

RUN mkdir -p /app
RUN mv /usr/local/etc/php/php.ini-production /usr/local/etc/php/php.ini

COPY --from=composer:latest /usr/bin/composer /usr/bin/
COPY composer.* /app/
RUN composer install --no-dev --no-autoloader --no-progress --no-scripts

COPY . /app
RUN composer dump-autoload --no-dev --optimize

RUN chown -R www-data:www-data /app
