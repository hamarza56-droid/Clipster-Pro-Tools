import requests
import tim

# ⚠️ CHANGE THIS TO YOUR RENDER URL
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


def run():
    tasks = get_tasks()

    if not tasks:
        print("No tasks found")
        return

    for task in tasks:
        task_id = task["task_id"]

        pages = task["pages"]

        # if pages stored as string in DB
        try:
            import ast
            pages = ast.literal_eval(pages)
        except:
            pages = []

        limit = task.get("limit_count", 10)

        print(f"Processing task: {task_id}")

        count = 0

        for page in pages:
            for i in range(limit):

                reel_url = f"{page}/reel/{i}"
                duration = 30 + (i % 10)

                print("Sending:", reel_url, duration)

                push_result(task_id, reel_url, duration)

                count += 1
                time.sleep(1)

                if count >= limit:
                    break


if __name__ == "__main__":
    run()
