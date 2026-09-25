# Jenkins controller with everything the pipeline needs baked in:
# Docker CLI + Compose, Node.js 22, Trivy, SonarScanner, jq
FROM jenkins/jenkins:lts-jdk21

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends jq unzip python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Docker CLI + Compose/Buildx plugins (talks to the host's Docker via the mounted socket)
COPY --from=docker:29-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker:29-cli /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins

# Node.js 22 LTS (same version as the app image)
COPY --from=node:22-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# Trivy security scanner - pinned to a release published AFTER the March 2026
# supply-chain incident (v0.69.4-0.69.6 were compromised; do not use those)
COPY --from=aquasec/trivy:0.74.0 /usr/local/bin/trivy /usr/local/bin/trivy

# SonarScanner CLI (generic build - uses this image's Java 21)
ARG SONAR_SCANNER_VERSION=8.1.0.6389
RUN curl -fsSL -o /tmp/sonar-scanner.zip \
      "https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SONAR_SCANNER_VERSION}.zip" \
    && unzip -q /tmp/sonar-scanner.zip -d /opt \
    && mv "/opt/sonar-scanner-${SONAR_SCANNER_VERSION}" /opt/sonar-scanner \
    && ln -s /opt/sonar-scanner/bin/sonar-scanner /usr/local/bin/sonar-scanner \
    && rm /tmp/sonar-scanner.zip

# Jenkins plugins used by the Jenkinsfile
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt

USER jenkins
