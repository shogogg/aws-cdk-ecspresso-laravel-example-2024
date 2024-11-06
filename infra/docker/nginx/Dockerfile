#
# nginx-resources
#
FROM nginxinc/nginx-unprivileged:1.27-bookworm AS nginx-resources

ARG TIMEZONE="Asia/Tokyo"

USER root

RUN mkdir -p /opt/var/cache/nginx && \
    cp -a --parents /usr/lib/nginx /opt && \
    cp -a --parents /usr/share/nginx /opt && \
    cp -a --parents /var/log/nginx /opt && \
    cp -aL --parents /var/run /opt && \
    cp -a --parents /etc/nginx /opt && \
    cp -a --parents /etc/passwd /opt && \
    cp -a --parents /etc/group /opt && \
    cp -a --parents /usr/sbin/nginx /opt && \
    cp -a --parents /usr/sbin/nginx-debug /opt && \
    cp -a --parents /lib/$(uname -m)-linux-gnu/ld-* /opt && \
    cp -a --parents /lib/$(uname -m)-linux-gnu/libz.so.* /opt && \
    cp -a --parents /lib/$(uname -m)-linux-gnu/libc* /opt && \
    cp -a --parents /lib/$(uname -m)-linux-gnu/libdl* /opt && \
    cp -a --parents /lib/$(uname -m)-linux-gnu/libpthread* /opt && \
    cp -a --parents /lib/$(uname -m)-linux-gnu/libcrypt* /opt && \
    cp -a --parents /usr/lib/$(uname -m)-linux-gnu/libssl.so.* /opt && \
    cp -a --parents /usr/lib/$(uname -m)-linux-gnu/libcrypto.so.* /opt && \
    cp -a --parents /usr/lib/$(uname -m)-linux-gnu/libpcre2-8.so.* /opt && \
    cp -a /etc/passwd /opt/etc/passwd && \
    cp -a /etc/group /opt/etc/group && \
    cp -a /usr/share/zoneinfo/${TIMEZONE} /opt/etc/localtime && \
    rm -rf /opt/etc/nginx/*.conf && \
    rm -rf /opt/etc/nginx/conf.d/*.conf

#
# nginx-config
#
FROM nginx-resources AS nginx-config

ARG APP_DOMAIN_NAME="localhost"

COPY infra/docker/nginx/assets/app.conf.template /tmp/

RUN echo "$APP_DOMAIN_NAME" && \
    envsubst '$APP_DOMAIN_NAME' < /tmp/app.conf.template > /opt/etc/nginx/conf.d/app.conf

#
# nginx-base
#
FROM gcr.io/distroless/base-debian12:nonroot AS nginx-base

COPY --from=nginx-resources /opt /
COPY infra/docker/nginx/assets/*.conf /etc/nginx/

USER www-data

EXPOSE 8080 8443

CMD ["nginx"]

#
# nginx-dev
#
FROM nginx-base AS nginx-dev

COPY --from=nginx-config /opt/etc/nginx/conf.d/ /etc/nginx/conf.d/

#
# nginx-prod
#
FROM nginx-base AS nginx-prod

COPY --from=nginx-config /opt/etc/nginx/conf.d/ /etc/nginx/conf.d/

COPY public/ /app/public/
