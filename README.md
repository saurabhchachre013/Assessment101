# Video Streaming Platform — Infrastructure & CI/CD

DevOps assessment submission. Covers infrastructure (CloudFormation), containerization,
CI/CD pipeline, cost automation, and written answers.

---

## Repository structure

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml               # CI/CD pipeline — build, scan, push, deploy
├── cost-script/
│   ├── configfiles/                  # EventBridge rule / target definitions
│   ├── q14-cost-scaling.md           # Q14 write-up — script + trigger
│   └── script101.py                  # Lambda — scales ECS/RDS on a schedule
├── infracode/
│   ├── dev.json                      # Parameter values — development
│   ├── prod.json                     # Parameter values — production
│   ├── stag.json                     # Parameter values — staging
│   └── stack.yml                     # Main CloudFormation template
├── videostream-frontend/
│   ├── node_modules/                  # (git-ignored)
│   ├── src/                           # React app source
│   ├── .dockerignore
│   ├── Dockerfile                     # Multi-stage build, non-root, <150MB
│   ├── index.html
│   ├── nginx.conf                     # Serves the app + /health endpoint
│   ├── package-lock.json
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── VPC.svg                            # Architecture diagram
├── cost-flowdiagram.drawio.svg        # Cost & scaling flow diagram
├── written-answers.md                 # Q1–Q9, Q12, Q15, Q16
└── README.md
```

---

## 1. Architecture diagram

![VPC Architecture](./VPC.svg)

Browser traffic enters through the Internet Gateway into a VPC spanning two
Availability Zones. The public subnets hold the Application Load Balancer and NAT
Gateway; the private subnets hold ECS Fargate, RDS, ElastiCache, and Lambda — none of
it reachable directly from the internet. S3 and SQS are reached through VPC endpoints
rather than through the NAT Gateway. Full reasoning for this design is in
`written-answers.md`, Q6 and Q7.

---

## 2. Infrastructure (CloudFormation)

`infracode/stack.yml` provisions, per environment:

- VPC across 2 AZs — 2 public subnets, 2 private subnets
- ECS Fargate cluster, task definition, and service behind an Application Load Balancer
- RDS Postgres — password generated and stored in Secrets Manager, no hardcoded credentials
- CloudWatch Log Group, alarms on ALB 5xx, ECS CPU, and RDS connections
- IAM roles scoped to least privilege (task role can only read its own secret)
- VPC Gateway Endpoint for S3 — see Q7 for the full reasoning

**Deploy manually:**
```bash
aws cloudformation deploy \
  --stack-name videostream-dev \
  --template-file infracode/stack.yml \
  --parameter-overrides file://infracode/dev.json \
  --capabilities CAPABILITY_NAMED_IAM
```
Swap `dev` → `stag` / `prod` and the matching parameter file for other environments.

---

## 3. Docker image

Multi-stage build — Node for the build stage, `nginx:alpine` for the runtime stage.
Runs as a non-root user, final image is under 150MB. Full reasoning (ENTRYPOINT vs
CMD, what was excluded to hit the size target) is documented in the comment block at
the top of `videostream-frontend/Dockerfile`.

---

## 4. CI/CD pipeline

**Trigger:** every push to `main` runs `.github/workflows/deploy.yml` automatically —
no manual step needed.

**What it does, in order:**

| Stage | Job | What happens |
|---|---|---|
| 1 | `build-and-push` | Builds the image, tags it with the git commit SHA, runs Trivy (fails the build on any HIGH/CRITICAL finding), pushes to ECR |
| 2 | `deploy-dev` | Deploys automatically — no approval needed |
| 3 | `deploy-staging` | Waits for manual approval before deploying |

**Manual approval for staging:** set up via GitHub Environments (Settings →
Environments → `staging` → Required reviewers). The `deploy-staging` job pauses with
a "Review deployments" button until approved.

**Credentials:** the pipeline authenticates to AWS via OIDC (`role-to-assume` in
`configure-aws-credentials`) — no long-lived access keys stored anywhere in GitHub
Secrets or the workflow file.

**Image tagging:** every image is tagged with `${{ github.sha }}`, never `latest` —
every deployed artifact traces back to exactly one commit.

---

## 5. Cost & scaling automation (Q14)

![Cost scaling flow](./cost-flowdiagram.drawio.svg)

`cost-script/script101.py` runs as a Lambda function on two EventBridge schedules:

| Rule | Cron (UTC) | Local time (IST) | Action |
|---|---|---|---|
| Shutdown | `cron(30 14 * * ? *)` | 8:00 PM | ECS → 0 tasks, RDS stopped |
| Startup | `cron(30 2 * * ? *)` | 8:00 AM | ECS → 2 tasks, RDS started |

The script reads the target environment from an environment variable and skips
straight to shutdown/startup logic based on that — the flow diagram above shows the
decision path, including the two required edge cases: an already-stopped RDS instance
and a missing ECS service both get skipped rather than raising an error. Only `dev`
and `stag` are ever touched — there's a hard-coded check that refuses to act on `prod`
regardless of what the environment variable is set to. Full detail and the
`put-rule`/`put-targets` commands are in `cost-script/q14-cost-scaling.md`.

---

## 6. Written answers

`written-answers.md` — Q1–Q9, Q12, Q15, Q16, in full.

---

## Assumptions & scope notes

- **Single NAT Gateway**, not one per AZ — a deliberate cost/simplicity tradeoff for
  this environment size, not an oversight. A production deployment at higher scale
  would use one NAT Gateway per AZ for availability.
- **Secret rotation**: `AWS::SecretsManager::RotationSchedule` was implemented; the
  AWS-hosted rotation Lambda (via the `AWS::SecretsManager-2024-09-16` transform)
  hit a nested-stack deployment issue unrelated to the application resources.
  [CONFIRM CURRENT STATUS]
- **Health checks** use `wget` inside the container check (not `curl`, which isn't
  present in `nginx:alpine`) — keeps the image smaller than adding a package just for
  health checks.
- **Environment naming**: `dev` / `stag` / `prod` throughout, to match the parameter
  file naming already in place.
