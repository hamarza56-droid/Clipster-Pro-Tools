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
        full = requests.get(f"{BASE_URL}/get_task/{task_id}").json()
        t = full["task"]

        pages = ast.literal_eval(t["pages"])
        limit = int(t["limit_count"])

        total = len(pages)

        done = 0

        for page in pages:

            for i in range(limit):

                reel = f"{page}/reel/{i}"
                duration = 30 + i

                time.sleep(0.2)

                push(task_id, reel, duration)

            done += 1

            progress = int((done / total) * 100)

            requests.post(BASE_URL + "/update_progress", json={
                "task_id": task_id,
                "progress": progress
            })

        print("DONE:", task_id)


if __name__ == "__main__":
    run()
