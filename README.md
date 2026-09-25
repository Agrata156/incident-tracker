# Security Incident Tracker: Jenkins DevOps Pipeline

SIT223/SIT753 Professional Practice in IT, Task 7.3HD. Agrata Singh.

A REST API for logging and tracking security incidents, delivered through a fully automated
7-stage Jenkins pipeline: **Build, Test, Code Quality, Security, Deploy, Release, Monitoring**.

## The application

- Registration and login with bcrypt password hashing and JWT tokens
- Role based access control (the first account is admin, the rest are analysts; only admins can delete)
- Incident CRUD with severity (Low, Medium, High, Critical) and status (Open, Investigating, Resolved), filtering and stats
- Security hardening: input validation, Helmet headers, rate limiting on auth endpoints, non-root container
- `/health` for health checks and `/metrics` for Prometheus (including an `incidents_open` business metric)

Stack: Node.js 22, Express 5, SQLite (better-sqlite3), Jest and Supertest (37 tests, about 98% coverage).

## Pipeline stages

| Stage | What it does | Tools |
|---|---|---|
| Build | Versions the build (`1.0.<build>`), builds a multi-stage Docker image tagged with version and commit, pushes it to a local registry, archives an npm package and `build-info.json` | Docker, npm, local registry |
| Test | Runs unit and integration tests; fails on any failing test or coverage below the thresholds in `jest.config.js` | Jest, Supertest, JUnit and Coverage plugins |
| Code Quality | ESLint with complexity rules and zero warnings, then SonarQube analysis with a custom quality gate the build waits for | ESLint, SonarQube |
| Security | `npm audit` on production dependencies, Trivy image scan (fails on fixable CRITICAL), Trivy secret and Dockerfile misconfiguration scan | npm audit, Trivy 0.74.0 |
| Deploy | Deploys to staging (port 3001) with Docker Compose, health checks, automatic rollback and 8 smoke tests | Docker Compose, bash |
| Release | Promotes the same image to production (port 3000) with production config, read-only smoke tests, Git tag `v1.0.N` and release notes | Docker Compose, Git |
| Monitoring | Deploys Prometheus, Alertmanager and Grafana, then verifies production is scraped and 5 alert rules are loaded; alerts go to Discord | Prometheus, Alertmanager, Grafana |

## Repository layout

```
src/                  application code (routes, services, middleware, metrics)
tests/                unit and integration tests
Jenkinsfile           the pipeline
Dockerfile            multi-stage app image
docker-compose.*.yml  staging and production environments
env/                  non-secret, environment-specific settings
scripts/              deploy (with rollback), smoke tests, monitoring checks, notifications
monitoring/           Prometheus, Alertmanager and Grafana config (built into images)
jenkins/              Jenkins image with Docker CLI, Node.js, Trivy and SonarScanner
```

## Running the tests locally

```bash
npm install
npm test        # 37 tests with coverage
npx eslint .    # lint
npm start       # http://localhost:3000/health
```

## Setting up the pipeline

### Prerequisites
Docker Desktop (6 GB or more memory), Git, a GitHub account and a Discord server (optional, for alerts).

### 1. Clone the repository
```bash
git clone https://github.com/Agrata156/incident-tracker.git
cd incident-tracker
```

### 2. Start the supporting containers
Run each command on one line (PowerShell on Windows):
```bash
docker network create devops-net
docker run -d --name registry --restart unless-stopped --network devops-net -p 5050:5000 -v registry_data:/var/lib/registry registry:2
docker run -d --name sonarqube --restart unless-stopped --network devops-net -p 9000:9000 -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true -v sonarqube_data:/opt/sonarqube/data -v sonarqube_extensions:/opt/sonarqube/extensions -v sonarqube_logs:/opt/sonarqube/logs sonarqube:community
docker build -t jenkins-devops ./jenkins
docker run -d --name jenkins --restart unless-stopped -u root --network devops-net -p 8080:8080 -p 50000:50000 -v jenkins_devops_home:/var/jenkins_home -v /var/run/docker.sock:/var/run/docker.sock jenkins-devops
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

### 3. Configure SonarQube (http://localhost:9000)
1. Log in as `admin` / `admin` and change the password.
2. Create a local project with key `incident-tracker` and main branch `main`.
3. Generate a Global Analysis Token (My Account, Security).
4. Create a quality gate with coverage at least 80%, duplication at most 3%, and A ratings for maintainability, reliability and security, then assign it to the project.

### 4. Configure Jenkins (http://localhost:8080)
Unlock Jenkins, install the suggested plugins and create an admin user. Then add these credentials (Manage Jenkins, Credentials, Global):

| ID | Kind | Value |
|---|---|---|
| `github-pat` | Username with password | GitHub username and a fine-grained token with Contents read and write |
| `sonar-token` | Secret text | SonarQube token |
| `jwt-secret-staging` | Secret text | Random string |
| `jwt-secret-prod` | Secret text | A different random string |
| `discord-webhook` | Secret text | Discord webhook URL, or `none` |

Create a **Pipeline** job: Pipeline script from SCM, Git, this repository URL, credentials `github-pat`,
branch `*/main`, script path `Jenkinsfile`. Click **Build Now**. After the first run, Jenkins polls GitHub
every 2 minutes and builds every push automatically.

## Services and ports

| Service | URL |
|---|---|
| Production app | http://localhost:3000/health |
| Staging app | http://localhost:3001/health |
| Jenkins | http://localhost:8080 |
| SonarQube | http://localhost:9000 |
| Grafana (admin / admin) | http://localhost:3030 |
| Prometheus | http://localhost:9090 |
| Alertmanager | http://localhost:9093 |
| Docker registry | http://localhost:5050/v2/incident-tracker/tags/list |

## Alert rules

| Alert | Fires when |
|---|---|
| IncidentTrackerDown | production cannot be scraped for 30 seconds |
| HighErrorRate | more than 5% of requests return 5xx for 1 minute |
| HighLatencyP95 | p95 response time above 500 ms for 2 minutes |
| PossibleBruteForceLogin | more than 10 failed or rate-limited logins in 1 minute |
| CriticalIncidentBacklog | more than 3 unresolved critical incidents |

## Notes and trade-offs

This is a local lab setup. Jenkins runs as root with access to the Docker socket and SonarQube uses its
embedded database; a real deployment would use dedicated build agents and PostgreSQL. Secrets are never
stored in Git: they are injected from Jenkins credentials at deploy time.
