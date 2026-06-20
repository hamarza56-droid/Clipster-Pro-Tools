import requests
import time
import os
import ast

BASE_URL = os.getenv("BASE_URL", "https://clipster-pro-tools.onrender.com")


def get_tasks():
    try:
        r = requests.get(BASE_URL + "/pending_tasks")
        return r.json()
    except:
        return []


def push_result(task_id, reel, duration):
    requests.post(BASE_URL + "/push_result", json={
        "task_id": task_id,
        "reel": reel,
        "duration": duration
    })


def run():

    tasks = get_tasks()

    if not tasks:
        print("No tasks")
        return

    for task in tasks:

        task_id = task["task_id"]

        print("Processing:", task_id)

        full = requests.get(f"{BASE_URL}/get_task/{task_id}").json()
        task_data = full["task"]

        pages = ast.literal_eval(task_data[3])
        limit = task_data[4]

        # simulate scraping (replace with your selenium later)
        for page in pages:

            for i in range(limit):

                reel = f"{page}/reel/{i}"
                duration = 30 + i

                if 28 <= duration <= 41:
                    push_result(task_id, reel, duration)
                    print("MATCH:", reel)


if __name__ == "__main__":
    run()
