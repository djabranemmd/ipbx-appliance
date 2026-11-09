FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# asterisk pulls the english core sounds by itself
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      asterisk \
      asterisk-modules \
      asterisk-moh-opsound-gsm \
      unixodbc \
      odbc-postgresql \
      gettext-base \
 && rm -rf /var/lib/apt/lists/* \
 # fail the build early if the postgres odbc driver did not register
 && odbcinst -q -d | grep -q "PostgreSQL Unicode"

COPY conf/ /opt/pbx-conf/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5060/udp
ENTRYPOINT ["/entrypoint.sh"]