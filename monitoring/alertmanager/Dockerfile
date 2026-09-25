FROM prom/alertmanager:v0.33.0
COPY alertmanager.tmpl.yml /etc/alertmanager/alertmanager.tmpl.yml
COPY alertmanager.ui-only.yml /etc/alertmanager/alertmanager.ui-only.yml
COPY --chmod=755 entrypoint.sh /entrypoint.sh
USER nobody
ENTRYPOINT ["/entrypoint.sh"]
