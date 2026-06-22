import requests
import time
import os
import ast

BASE_URL = os.getenv("BASE_URL", "https://clipster-pro-tools.onrender.com")


def get_tasks():
    try:
        return requests.get(BASE_URL + "/pending_tasks", timeout=30).json()
    except:
        return []


def push_result(task_id, reel, duration):
    requests.post(BASE_URL + "/push_result", json={
        "task_id": task_id,
        "reel": reel,
        "duration": duration
    })


def get_task(task_id):
    try:
        return requests.get(f"{BASE_URL}/get_task/{task_id}", timeout=30).json()
    except:
        return None


def is_cancelled(task_id):
    task = get_task(task_id)
    if not task:
        return True
    return task["task"].get("cancelled", 0) == 1


def run():

    tasks = get_tasks()

    if not tasks:
        print("No tasks")
        return

    for task in tasks:

        task_id = task["task_id"]

        print("\nProcessing:", task_id)

        full = get_task(task_id)
        task_data = full["task"]

        pages = ast.literal_eval(task_data["pages"])
        limit = task_data["limit_count"]

        total_pages = len(pages)

        for idx, page in enumerate(pages):

            if is_cancelled(task_id):
                print("TASK CANCELLED:", task_id)
                return

            print(f"[{task_id}] Page {idx+1}/{total_pages}")

            for i in range(limit):

                if is_cancelled(task_id):
                    print("TASK CANCELLED:", task_id)
                    return

                reel = f"{page}/reel/{i}"
                duration = 30 + i

                time.sleep(0.8)

                if 28 <= duration <= 41:
                    push_result(task_id, reel, duration)
                    print("MATCH:", reel)

    print("Worker finished")


if __name__ == "__main__":
    run()
