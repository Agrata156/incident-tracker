FROM prom/prometheus:v3.13.0
# Config is baked into the image so Jenkins (running in Docker) doesn't need bind mounts
COPY prometheus.yml /etc/prometheus/prometheus.yml
COPY alert.rules.yml /etc/prometheus/alert.rules.yml
USER nobody
