#!/bin/bash
# renders the config from the environment, then runs asterisk in the foreground
set -euo pipefail

: "${DB_HOST:?DB_HOST is not set}"
: "${DB_NAME:?DB_NAME is not set}"
: "${DB_USER:?DB_USER is not set}"
: "${DB_PASSWORD:?DB_PASSWORD is not set}"
: "${PBX_EXTERNAL_IP:?PBX_EXTERNAL_IP is not set (put your machine IP in .env)}"
: "${AMI_USER:?AMI_USER is not set}"
: "${AMI_PASSWORD:?AMI_PASSWORD is not set}"

SRC=/opt/pbx-conf
ETC=/etc/asterisk

# files that never change
for f in modules.conf res_odbc.conf extconfig.conf sorcery.conf rtp.conf extensions.conf ari.conf; do
  cp "$SRC/$f" "$ETC/$f"
done

# files that depend on the environment
envsubst '${PBX_EXTERNAL_IP}' < "$SRC/pjsip.conf.template" > "$ETC/pjsip.conf"
envsubst '${AMI_USER} ${AMI_PASSWORD}' < "$SRC/manager.conf.template" > "$ETC/manager.conf"
envsubst '${DB_HOST} ${DB_NAME} ${DB_USER} ${DB_PASSWORD}' < "$SRC/odbc.ini.template" > /etc/odbc.ini

# odbc.ini holds the db password: asterisk (after dropping root) must read it, nobody else
chown root:asterisk /etc/odbc.ini
chmod 640 /etc/odbc.ini

mkdir -p /var/run/asterisk
chown -R asterisk:asterisk /etc/asterisk /var/lib/asterisk /var/spool/asterisk /var/log/asterisk /var/run/asterisk
chmod 640 "$ETC/manager.conf"

exec asterisk -f -vvv -U asterisk -G asterisk