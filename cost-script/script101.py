import os
import boto3
from botocore.exceptions import ClientError

ecs = boto3.client("ecs")
rds = boto3.client("rds")

PROJECT_NAME = os.environ.get("PROJECT_NAME", "videostream")
ENVIRONMENTS = os.environ.get("ENVIRONMENTS", "dev,stag").split(",")
ACTION = os.environ.get("SCHEDULE_ACTION", "shutdown")
STARTUP_COUNT = int(os.environ.get("STARTUP_DESIRED_COUNT", "2"))

# just in case someone adds prod to the env var by mistake
FORBIDDEN = ["prod", "production"]


def scale_ecs(cluster, service, count):
    try:
        ecs.update_service(cluster=cluster, service=service, desiredCount=count)
        print(f"scaled {service} to {count}")
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("ServiceNotFoundException", "ServiceNotActiveException", "ClusterNotFoundException"):
            print(f"skipping {service} - {code}")
        else:
            print(f"error scaling {service}: {e}")


def stop_rds(db_id):
    try:
        rds.stop_db_instance(DBInstanceIdentifier=db_id)
        print(f"stopping {db_id}")
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "InvalidDBInstanceState":
            # already stopped, nothing to do
            print(f"{db_id} already stopped")
        elif code == "DBInstanceNotFoundFault":
            print(f"{db_id} not found, skipping")
        else:
            print(f"error stopping {db_id}: {e}")


def start_rds(db_id):
    try:
        rds.start_db_instance(DBInstanceIdentifier=db_id)
        print(f"starting {db_id}")
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "InvalidDBInstanceState":
            print(f"{db_id} already running")
        elif code == "DBInstanceNotFoundFault":
            print(f"{db_id} not found, skipping")
        else:
            print(f"error starting {db_id}: {e}")


def handler(event, context):
    for env in ENVIRONMENTS:
        env = env.strip()

        if env in FORBIDDEN:
            print(f"not touching {env}, skipping")
            continue

        cluster = f"{PROJECT_NAME}-{env}"
        service = f"{PROJECT_NAME}-{env}"
        db_id = f"{PROJECT_NAME}-{env}-postgres-instance"

        if ACTION == "shutdown":
            scale_ecs(cluster, service, 0)
            stop_rds(db_id)
        elif ACTION == "startup":
            scale_ecs(cluster, service, STARTUP_COUNT)
            start_rds(db_id)
        else:
            raise ValueError(f"unknown action: {ACTION}")


# for testing locally: SCHEDULE_ACTION=shutdown python3 scheduled_scaling.py
if __name__ == "__main__":
    handler({}, None)