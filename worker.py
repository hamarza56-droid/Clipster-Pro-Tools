import requests, time, ast, os

BASE_URL = os.getenv("BASE_URL", "https://clipster-pro-tools.onrender.com/")


def get_tasks():
    return requests.get(BASE_URL + "/pending_tasks").json()


def push(task_id, reel, duration):
    requests.post(BASE_URL + "/push_result", json={
        "task_id": task_id,
        "reel": reel,
        "duration": duration
    })


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

        # mark running + progress 0
        requests.post(BASE_URL + "/push_result", json={
            "task_id": task_id,
            "reel": "STARTED",
            "duration": 0
        })

        done = 0

        for page in pages:

            if check_cancel(task_id):
                print("Cancelled:", task_id)
                return

            for i in range(limit):

                reel = f"{page}/reel/{i}"
                duration = 30 + i

                time.sleep(0.2)

                push_result(task_id, reel, duration)

            done += 1
            progress = int((done / total) * 100)

            requests.post(BASE_URL + "/update_progress", json={
                "task_id": task_id,
                "progress": progress
            })

        print("Done:", task_id)


if __name__ == "__main__":
    run()
