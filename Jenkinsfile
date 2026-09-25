pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 45, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  // Check GitHub for new commits every ~2 minutes (a webhook can't reach localhost)
  triggers {
    pollSCM('H/2 * * * *')
  }

  environment {
    APP_NAME        = 'incident-tracker'
    REGISTRY        = 'localhost:5050'
    IMAGE           = "${REGISTRY}/${APP_NAME}"
    VERSION         = "1.0.${BUILD_NUMBER}"
    SONAR_HOST      = 'http://sonarqube:9000'
    TRIVY_CACHE_DIR = '/var/jenkins_home/.trivy-cache'
  }

  stages {

    stage('Build') {
      steps {
        script {
          env.GIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          env.IMAGE_TAG = "${env.VERSION}-${env.GIT_SHORT}"
          currentBuild.displayName = "#${BUILD_NUMBER} v${env.VERSION}"
        }
        sh '''
          rm -rf dist reports && mkdir -p dist reports
          npm version "$VERSION" --no-git-tag-version --allow-same-version
          npm ci

          echo "Building Docker image $IMAGE:$IMAGE_TAG"
          docker build \
            --build-arg APP_VERSION="$VERSION" \
            --build-arg GIT_COMMIT="$GIT_SHORT" \
            -t "$IMAGE:$IMAGE_TAG" .

          docker push "$IMAGE:$IMAGE_TAG"

          npm pack --pack-destination dist
          jq -n --arg version "$VERSION" --arg commit "$GIT_SHORT" --arg image "$IMAGE:$IMAGE_TAG" \
                --arg build "$BUILD_NUMBER" --arg date "$(date -u +%FT%TZ)" \
                '{version:$version, commit:$commit, image:$image, build:$build, builtAt:$date}' > dist/build-info.json
          cat dist/build-info.json
        '''
      }
      post {
        success {
          archiveArtifacts artifacts: 'dist/*.tgz, dist/build-info.json', fingerprint: true
        }
      }
    }

    stage('Test') {
      steps {
        sh 'npm test -- --ci'
      }
      post {
        always {
          junit 'reports/junit.xml'
          recordCoverage(tools: [[parser: 'COBERTURA', pattern: 'coverage/cobertura-coverage.xml']],
                         sourceCodeRetention: 'EVERY_BUILD')
        }
      }
    }

    stage('Code Quality') {
      steps {
        sh 'npx eslint . --max-warnings 0'
        sh 'npx eslint . -f json -o reports/eslint.json || true'

        withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
          sh '''
            sonar-scanner \
              -Dsonar.host.url="$SONAR_HOST" \
              -Dsonar.token="$SONAR_TOKEN" \
              -Dsonar.projectVersion="$VERSION"
          '''
        }
      }
    }

    stage('Security') {
      steps {
        sh '''
          echo "===== 1. Dependency scan (npm audit, production dependencies) ====="
          npm audit --omit=dev --json > reports/npm-audit.json || true
          npm audit --omit=dev --audit-level=high

          echo "===== 2. Container image scan (Trivy) ====="
          trivy image --cache-dir "$TRIVY_CACHE_DIR" --scanners vuln \
            --format json --output reports/trivy-image.json "$IMAGE:$IMAGE_TAG"
          trivy convert --format table --output reports/trivy-image.txt reports/trivy-image.json
          echo "Summary of HIGH/CRITICAL findings:"
          trivy convert --format table --severity HIGH,CRITICAL reports/trivy-image.json

          echo "Gate: fail on any CRITICAL vulnerability that has a fix available"
          trivy image --cache-dir "$TRIVY_CACHE_DIR" --scanners vuln --skip-db-update \
            --severity CRITICAL --ignore-unfixed --ignorefile .trivyignore \
            --exit-code 1 "$IMAGE:$IMAGE_TAG"

          echo "===== 3. Secret + Dockerfile misconfiguration scan (Trivy) ====="
          trivy fs --cache-dir "$TRIVY_CACHE_DIR" --scanners secret,misconfig \
            --skip-dirs node_modules,coverage,dist,reports \
            --severity HIGH,CRITICAL --exit-code 1 .
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'reports/npm-audit.json, reports/trivy-*', allowEmptyArchive: true
        }
      }
    }

    stage('Deploy') {
      steps {
        withCredentials([string(credentialsId: 'jwt-secret-staging', variable: 'JWT_SECRET')]) {
          sh 'bash scripts/deploy.sh staging "$IMAGE_TAG" "$VERSION"'
        }
        sh 'bash scripts/smoke-test.sh http://incident-staging:3000 full'
      }
    }

    stage('Release') {
      steps {
        // Promote the SAME image that passed staging - tag it as a release
        sh '''
          docker tag "$IMAGE:$IMAGE_TAG" "$IMAGE:v$VERSION"
          docker tag "$IMAGE:$IMAGE_TAG" "$IMAGE:production"
          docker push "$IMAGE:v$VERSION"
          docker push "$IMAGE:production"
        '''

        withCredentials([string(credentialsId: 'jwt-secret-prod', variable: 'JWT_SECRET')]) {
          sh 'bash scripts/deploy.sh production "$IMAGE_TAG" "$VERSION"'
        }
        sh 'bash scripts/smoke-test.sh http://incident-prod:3000 readonly'

        withCredentials([usernamePassword(credentialsId: 'github-pat',
                                          usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
          sh '''
            git config user.name  "Jenkins CI"
            git config user.email "jenkins@localhost"
            git tag -a "v$VERSION" -m "Release v$VERSION (image $IMAGE:$IMAGE_TAG)"
            git push "https://${GH_USER}:${GH_TOKEN}@${GIT_URL#https://}" "v$VERSION"
          '''
        }

        sh '''
          {
            echo "Release v$VERSION"
            echo "Image: $IMAGE:v$VERSION ($IMAGE_TAG)"
            echo "Released: $(date -u +%FT%TZ)"
            echo ""
            echo "Changes:"
            git log --oneline -n 15
          } > dist/release-notes.txt
          cat dist/release-notes.txt
        '''
        archiveArtifacts artifacts: 'dist/release-notes.txt, dist/*-version.txt'
      }
    }

    stage('Monitoring') {
      steps {
        withCredentials([string(credentialsId: 'discord-webhook', variable: 'DISCORD_WEBHOOK_URL')]) {
          sh 'docker compose -f monitoring/docker-compose.monitoring.yml up -d --build'
        }
        sh 'bash scripts/verify-monitoring.sh'
      }
      post {
        always {
          archiveArtifacts artifacts: 'reports/monitoring-*.json', allowEmptyArchive: true
        }
      }
    }
  }

  post {
    success {
      withCredentials([string(credentialsId: 'discord-webhook', variable: 'DISCORD_WEBHOOK_URL')]) {
        sh 'bash scripts/notify.sh "✅ Incident Tracker v$VERSION released to production (build #$BUILD_NUMBER) - $BUILD_URL"'
      }
    }
    failure {
      withCredentials([string(credentialsId: 'discord-webhook', variable: 'DISCORD_WEBHOOK_URL')]) {
        sh 'bash scripts/notify.sh "❌ Pipeline FAILED for Incident Tracker build #$BUILD_NUMBER - $BUILD_URL"'
      }
    }
    cleanup {
      sh 'docker image prune -f || true'
    }
  }
}