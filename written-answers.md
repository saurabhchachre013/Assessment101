# DevOps Engineering Assessment — Written Answers
**Candidate:** Saurabh

---

## Q1. A server is responding slowly. You log in and run top. CPU is at 95%, but you cannot immediately tell which process is the culprit because several look similar. What do you do next?

- first i will sort all process by CPU using command Shift+P which will show the highest CPU consuming processes at the top. will use top -H which will show individual threads.
- will list top 10-15 process which are taking more CPU using command: ps aux --sort=-%cpu | head -15
- will check list of files or sockets opened by the specific process using command lsof -p <PID>. so we can ensure that the process is stuck or it is actually doing heavy operations.
- After confirming that the process is not doing any important will kill the process using kill -15 or kill -9 if it is stuck.

If it is a python data pipeline, will check which python functions in the process using the most CPU using following command : py-spy top --pid <PID>

---

## Q2. You find a file on a Linux server with permissions set to 777. What does that actually mean, and why is it a problem in a production environment?

777 means any user and group or other can perform read, write and execute that file which is really bad.

- If we have stored some credentials Ex : DB credentials with 777 permission, any user can access that file and get the credentials easily.
- If any script file has the same permission and if any user can edit that script and make changes in the code.
- if we give permission 777 to a .pem file, the terminal itself won't allow you to login into the server. It will ask you to change the permission.

solution:

- we can give 600 permission so only the user can perform read and write operations.
- likewise for scripts we can give 750 where user can execute this file and groups can. other dont get any permission here.
- for .pem key it asks to give 400 permission only and then only you can login to server.

---

## Q3. Your application is supposed to be listening on port 8080, but connections are being refused. The process appears to be running. How do you diagnose this?

- first check application is listening on port 8080 or not using command : ss -tulnp | grep 8080
- verify the process is running → ps -ef | grep <process-name>
- review application logs journalctl -u <service> or if docker then docker logs <dockercontainer>
- test locally → curl http://localhost:8080
- check if any other process is using the same port or what lsof -i :8080

---

## Q4. You need to find all log lines from /var/log/app.log that contain the word ERROR, occurred in the last 10 minutes, and do not include the string healthcheck. Write the command.

if the logline have standard timestamp

use command : awk -v since="$(date -d '10 minutes ago' '+%Y-%m-%d %H:%M:%S')" '$0 >= since' /var/log/app.log \
  | grep 'ERROR' | grep -v 'healthcheck'

this command will check for ERROR and will negate logline that have healthcheck
this depends on the logline.

---

## Q5. You have a Python script that automates a nightly infrastructure health check. It runs via cron at midnight but has silently stopped producing output. Nobody changed the script. Where do you look first?

- will check is that cron is there or not using command : crontab -last
- will try running that script manually to see any error.
- will check wether that cron executed or not desired time using comand: journalctl -u cron
- to check failure we can integrate slack webhook so if it fails it will ping us
    * 0 * * * /path/to/script.py >> /var/log/myscript.log 2>&1 || curl -X POST $SLACK_WEBHOOK -d '{"text":"nightly check failed"}'

---

## Q6. Draw and explain your VPC design for this platform.

- so if user uploads a video using browser,

    1. from backend will generate presigned URL
    2. that video will be uploaded to s3
    3. s3 will trigger the lambda function and that lambda will send the message to SQS.
    4. ECS fargate task that will proccesses the videos will read message from SQS.
    5. that tasks will process the video and will store output in s3.
    6. tasks will update processing status in PostgreSQL
    7. AI recommendation service will read processed data and will generate the recommendations.

---

## Q7. Your ECS tasks run in a private subnet and need to talk to S3 and SQS without going through a NAT Gateway. How do you set that up, and why does it matter?

- will use Gateway VPC endpoint for s3.
- create a Interface VPC Endpoint for SQS.

this matters because,

- the communication will happen internally so it is secure
- also it will reduce cost because this traffic doesn't go through NAT gateway.

---

## Q8. The platform needs to handle 500,000 concurrent users during a live event. Walk us through where you expect the system to break first, and what you do about it.

ECS Cluster

Effect:

- first it wiil affect the ECS tasks because sudden increase of users will increase CPU and Memory usage
- we can that using cloudwatch metrics like
    CPUUtilization
    MemoryUtilization

Action:

- we can create target tracking auto scaling which can increase number of task based on the CPU percentage
    example: if CPU is more then 75% then add more 10 tasks in service.

Database

Effect:

- it will increase DB connections before it takes CPU.

Action:

- can create alarm and trigger to add more replicas
    example if connections are increased to 200 then add one replica instance to handle heavy read operation
    we should use RDS proxy here to use poolling which uses same connection to serve multiple queries
    example if we have 1000 connection and if we are not using RDS proxy then it will create 1000 connection
    and if we have RDS proxy in-front of then it will only use 250-500 connection to serve 1000 queries

---

## Q9. List three concrete security controls you would implement inside the ECS or EKS environment — and for each one, explain what attack or mistake it prevents.

**1. IAM Task Roles with least privilege**

- Assign dedicated IAM role to each ECS task or service with only permissions it needed.
- it wont allow you to access other resources other then mentioned.

Without this, an attacker could access S3 buckets, SQS queues, or databases that the application was never intended to use.

**2. Security groups**

- create service in private subnet and creating security group with bounded rules
- will allow only source security group and not CIDR or 0.0.0.0
- even if your application is public facing and have cloudfront in front of ALB then use cloudfront prefix list where they have mentioned their cluster IPs or range which is get updated

Without this, an attacker could directly connect to databases or other internal services that should never be publicly or broadly accessible.

**3. Container Image Scanning in the CI/CD Pipeline**

- scan docker image because we install packages and take base images which can come with vulnerabilities
- in our infra CI we have used Trivy to scan the Image so it will fail if anything is wrong.

Without this, an attacker could exploit known vulnerabilities in the container image and gain unauthorized access or execute malicious code.

---

## Q12. After you submit your CloudFormation or Terraform template, your colleague points out that the ECS task role you wrote gives the service read access to every secret in the account. Fix it.

before

```
{
  "Effect": "Allow",
  "Action": [
    "secretsmanager:GetSecretValue"
  ],
  "Resource": "*"
}
```

After

```
{
  "Effect": "Allow",
  "Action": [
    "secretsmanager:GetSecretValue"
  ],
  "Resource": [
    "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/db-password-*",
    "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/api-key-*"
  ]
}
```

I would use Checkov to scan Terraform or CloudFormation templates before deployment.

in codepipeline we can add

pip install checkov
checkov -d .

in Github action we can add steps

- name: Run Checkov
  run: checkov -d .

---

## Q15. It is 11 PM. The on-call alert fires: the video upload service is throwing 500 errors. You cannot SSH in because it is Fargate. Walk us through your first five minutes.

will check cloudwatch logs first

fields @timestamp, @message
| filter @message like /ERROR/ or @message like /500/
| sort @timestamp desc
| limit 50

at the same time will check ECS service healthcheck and will verify,
    - Running task count
    - Desired task count
    - Recent service events
    - Task restarts

check ALB healthcheck

Target Healthy/Unhealthy
5XX ERROR request count
TargetresponseTime

check RDS metrics

will check databaseconnections or maxconnections
along with that check CPUUtilization, FreeableMemory, read/write latency

this is how we can determine root cause

using all these metrics we can build cloudwatch dashboard

ECS
CPUUtilization
MemoryUtilization
Running Task Count
ALB
Request Count
TargetResponseTime
HTTP 5XX Errors
RDS
CPU
DatabaseConnections
FreeableMemory
Read/Write Latency
SQS
ApproximateNumberOfMessagesVisible
AgeOfOldestMessage

---

## Q16. Your AWS bill has increased by 40% month-over-month with no new features shipped. Walk us through how you identify the source, fix it, and build guardrails so it cannot happen silently again.

1. check cost explorer
- check cost by service and compare it with month wise, so we can check which services cost is increased
- Drill down by usage-type and Tag

2. Drill Down to the Resource
- S3: Check bucket size, request counts, and lifecycle policies
- CloudFront: Review data transfer and cache hit ratio

Top 3 cost fixes specific to this kind of workload:

1. Use cloudfront in front of s3. so everytime request wont come to s3 bucket because it increase transfer rates, cloudfront will cache that content so it wont hit the origin bucket.
2. S3 lifecycle policy : so we can use s3 bucket tiers where the videos which are nobody watching will be stored in intelligent tier bucket and the videos which are very common and watched on high count will be in standard tier
3. ECR lifecycle policy : we can create policy to delete old ECR images after certain time

we can set alarms on monthly budget so if cost is increased it can indicate usage

CI/CD Guardrails

During deployment, enforce checks such as:

Require approval before increasing ECS desired task counts or Fargate CPU/memory
Review Terraform/CloudFormation changes that create large RDS instances or expensive resources
