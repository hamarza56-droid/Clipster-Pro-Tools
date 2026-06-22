import redis
import json
import time
import requests

BASE_URL = "https://clipster-pro-tools.onrender.com"

rdb = redis.Redis(
    host="YOUR_REDIS_HOST",
    port=6379,
    password="YOUR_REDIS_PASSWORD",
    decode_responses=True
)


def check_cancel(task_id):
    return rdb.get(f"cancel:{task_id}") == "1"


def push_result(task_id, reel, duration):
    requests.post(BASE_URL + "/push_result", json={
        "task_id": task_id,
        "reel": reel,
        "duration": duration
    })


def run_worker():

    while True:

        task_json = rdb.brpop("task_queue", timeout=10)

        if not task_json:
            continue

        task = json.loads(task_json[1])

        task_id = task["task_id"]

        pages = task["pages"]
        limit = task["limit"]

        total = len(pages)
        done = 0

        for page in pages:

            if check_cancel(task_id):
                print("Cancelled:", task_id)
                break

            for i in range(limit):

                if check_cancel(task_id):
                    print("Cancelled mid-task:", task_id)
                    break

                reel = f"{page}/reel/{i}"
                duration = 30 + i

                time.sleep(1)

                if 28 <= duration <= 41:
                    push_result(task_id, reel, duration)

            done += 1
            progress = int((done / total) * 100)

            requests.post(BASE_URL + "/push_progress", json={
                "task_id": task_id,
                "progress": progress
            })

        print("Task finished:", task_id)


if __name__ == "__main__":
    run_worker()
