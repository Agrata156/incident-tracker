#!/bin/sh
# Injects the Discord webhook (from Jenkins credentials) into the config at start-up,
# so the secret never has to be committed to Git.
set -e
CONFIG=/alertmanager/alertmanager.yml
case "$DISCORD_WEBHOOK_URL" in
  https://*)
    sed "s|__DISCORD_WEBHOOK_URL__|${DISCORD_WEBHOOK_URL}|" /etc/alertmanager/alertmanager.tmpl.yml > "$CONFIG"
    echo "Alertmanager: sending alerts to Discord"
    ;;
  *)
    cp /etc/alertmanager/alertmanager.ui-only.yml "$CONFIG"
    echo "Alertmanager: no Discord webhook set - alerts visible in the UI only"
    ;;
esac
exec /bin/alertmanager --config.file="$CONFIG" --storage.path=/alertmanager
