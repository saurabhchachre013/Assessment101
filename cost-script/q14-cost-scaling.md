# Q14 — Cost & Scaling Script

## Script

Deployed as a Lambda function (`videostream-cost-scheduling`), Python 3.14.
Scales ECS to 0 and stops RDS at shutdown, scales ECS back to 2 and starts
RDS at startup. Only touches dev/stag — never prod.
Handles both required edge cases:
- **RDS already stopped** → catches `InvalidDBInstanceState`, logs and moves on
- **ECS service doesn't exist** → catches `ServiceNotFoundException` /
  `ClusterNotFoundException`, logs and moves on


## Schedule Trigger — EventBridge

Two rules, both targeting the same Lambda, distinguished by the JSON
input each one sends.

**Shutdown — 8 PM IST daily**
```json
{
  "Name": "videostream-scheduled-shutdown",
  "Arn": "arn:aws:events:us-east-1:414772274895:rule/videostream-scheduled-shutdown",
  "ScheduleExpression": "cron(30 14 * * ? *)",
  "State": "ENABLED"
}
```
Target:
```json
{
  "Arn": "arn:aws:lambda:us-east-1:414772274895:function:videostream-cost-scheduling",
  "Input": "{\"SCHEDULE_ACTION\": \"shutdown\"}"
}
```

**Startup — 8 AM IST daily**
```json
{
  "Name": "videostream-scheduled-startup",
  "Arn": "arn:aws:events:us-east-1:414772274895:rule/videostream-scheduled-startup",
  "ScheduleExpression": "cron(30 2 * * ? *)",
  "State": "ENABLED"
}
```
Target:
```json
{
  "Arn": "arn:aws:lambda:us-east-1:414772274895:function:videostream-cost-scheduling",
  "Input": "{\"SCHEDULE_ACTION\": \"startup\"}"
}
```

EventBridge uses UTC, so 8 PM / 8 AM IST (UTC+5:30) become 2:30 PM and
2:30 AM UTC — that's why the cron expressions show 14:30 and 02:30.

## Other cost controls beyond this script

1. **AWS Budgets with a threshold action** — instead of just an email
   alert, attach an action that denies further `RunTask`/`CreateDBInstance`
   calls if spend crosses a set limit mid-month, so it stops the spend
   instead of just reporting it after the fact.
2. **ECR lifecycle policy** — every pipeline push creates a new tagged
   image; without cleanup, storage cost grows unnoticed every month.
