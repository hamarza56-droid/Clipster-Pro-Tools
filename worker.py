import requests
import time
import ast

BASE_URL = "https://clipster-pro-tools.onrender.com"


def get_tasks():
    try:
        res = requests.get(BASE_URL + "/pending_tasks")
        return res.json()
    except Exception as e:
        print("Error fetching tasks:", e)
        return []


def push_result(task_id, reel, duration):
    try:
        requests.post(BASE_URL + "/push_result", json={
            "task_id": task_id,
            "reel": reel,
            "duration": duration
        })
    except Exception as e:
        print("Push error:", e)


def safe_parse_pages(pages):
    if isinstance(pages, list):
        return pages

    try:
        return ast.literal_eval(pages)
    except:
        return []


def run():
    tasks = get_tasks()

    if not tasks:
        print("No tasks found")
        return

    for task in tasks:
        task_id = task.get("task_id")
        status = task.get("status")

        print(f"\nProcessing task: {task_id} | status: {status}")

        # ⚠️ IMPORTANT: we need full task data (not just pending list)
        try:
            full_task = requests.get(f"{BASE_URL}/get_task/{task_id}").json()
            task_data = full_task.get("task", [])
        except:
            task_data = []

        if not task_data:
            print("No task data found")
            continue

        # DB row format:
        # (task_id, username, status, pages, limit_count, created_at)
        pages = safe_parse_pages(task_data[3])
        limit = task_data[4] if len(task_data) > 4 else 10

        count = 0

        for page in pages:
            for i in range(limit):

                # ⚠️ placeholder logic (still no real selenium here)
                reel_url = f"{page}/reel/{i}"
                duration = 25 + (i % 20)

                print("Sending:", reel_url, duration)

                push_result(task_id, reel_url, duration)

                count += 1
                time.sleep(1)

                if count >= limit:
                    break


if __name__ == "__main__":
    run()
