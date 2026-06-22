import requests
import time
import os
import ast

BASE_URL = os.getenv("BASE_URL", "https://clipster-pro-tools.onrender.com")


# ================= FETCH TASKS =================

def get_tasks():
    try:
        r = requests.get(BASE_URL + "/pending_tasks", timeout=30)
        return r.json()
    except Exception as e:
        print("Task fetch error:", e)
        return []


# ================= PUSH RESULT =================

def push_result(task_id, reel, duration):
    try:
        requests.post(BASE_URL + "/push_result", json={
            "task_id": task_id,
            "reel": reel,
            "duration": duration
        }, timeout=30)
    except Exception as e:
        print("Push error:", e)


# ================= CHECK TASK STATUS =================

def get_task(task_id):
    try:
        r = requests.get(f"{BASE_URL}/get_task/{task_id}", timeout=30)
        return r.json()
    except:
        return None


# ================= SIMULATED SCRAPER =================

def scrape_page(task_id, page, limit):

    for i in range(limit):

        # ---- CHECK CANCEL EVERY STEP ----
        task = get_task(task_id)

        if not task or task["task"]["cancelled"]:
            print("Task cancelled:", task_id)
            return

        reel = f"{page}/reel/{i}"
        duration = 30 + i

        print(f"[{task_id}] Processing reel:", reel)

        # simulate processing time
        time.sleep(1)

        if 28 <= duration <= 41:
            push_result(task_id, reel, duration)
            print("MATCH:", reel)


# ================= MAIN RUNNER =================

def run():

    tasks = get_tasks()

    if not tasks:
        print("No tasks found")
        return

    print(f"Found {len(tasks)} tasks")

    for task in tasks:

        task_id = task["task_id"]

        print("\n==========================")
        print("Processing task:", task_id)
        print("==========================")

        full = get_task(task_id)

        if not full or not full.get("task"):
            continue

        task_data = full["task"]

        try:
            pages = ast.literal_eval(task_data["pages"])
        except:
            pages = []

        limit = task_data["limit_count"]

        total_pages = len(pages)
        done_pages = 0

        for page in pages:

            scrape_page(task_id, page, limit)

            done_pages += 1

            # optional progress update (DB-based later via server upgrades)
            progress = int((done_pages / total_pages) * 100)

            print(f"[{task_id}] Progress:", progress, "%")

    print("Worker finished")


if __name__ == "__main__":
    run()
