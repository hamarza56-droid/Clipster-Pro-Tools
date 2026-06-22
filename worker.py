import requests
import time
import os
import ast

BASE_URL = os.getenv("BASE_URL", "https://clipster-pro-tools.onrender.com")


def get_tasks():
    try:
        r = requests.get(BASE_URL + "/pending_tasks", timeout=30)
        return r.json()
    except:
        return []


def push_result(task_id, reel, duration):
    try:
        requests.post(BASE_URL + "/push_result", json={
            "task_id": task_id,
            "reel": reel,
            "duration": duration
        }, timeout=30)
    except:
        pass


def check_cancel(task_id):
    try:
        r = requests.get(f"{BASE_URL}/get_task/{task_id}")
        data = r.json()
        return data["task"]["cancelled"] == 1
    except:
        return False


def run():

    tasks = get_tasks()

    for task in tasks:

        task_id = task["task_id"]
        print("Processing:", task_id)

        full = requests.get(f"{BASE_URL}/get_task/{task_id}").json()
        task_data = full["task"]

        pages = ast.literal_eval(task_data["pages"])
        limit = task_data["limit_count"]

        total = len(pages)
        done_pages = 0

        # mark running
        requests.post(BASE_URL + "/push_result", json={
            "task_id": task_id,
            "reel": "STARTED",
            "duration": 0
        })

        for page in pages:

            if check_cancel(task_id):
                print("Cancelled:", task_id)
                return

            for i in range(limit):

                if check_cancel(task_id):
                    print("Cancelled:", task_id)
                    return

                reel = f"{page}/reel/{i}"
                duration = 30 + i

                time.sleep(0.5)

                if 28 <= duration <= 41:
                    push_result(task_id, reel, duration)

            done_pages += 1

            progress = int((done_pages / total) * 100)

            # update progress via fake log (simple DB approach later)
            requests.get(f"{BASE_URL}/get_task/{task_id}")

        # mark done
        print("Done:", task_id)


if __name__ == "__main__":
    run()
