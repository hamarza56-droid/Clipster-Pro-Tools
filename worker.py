import os
import time
import json
import ast
import requests

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options

BASE_URL = os.getenv(
    "BASE_URL",
    "https://clipster-pro-tools.onrender.com"
)

# ================= LOG TO SERVER =================

def send_log(task_id, msg):
    try:
        requests.post(
            BASE_URL + "/log",
            json={
                "task_id": task_id,
                "msg": msg
            },
            timeout=10
        )
    except:
        pass


# ================= CHECK CANCEL =================

def is_cancelled(task_id):
    try:
        res = requests.get(f"{BASE_URL}/task_status/{task_id}")
        data = res.json()
        return data.get("cancelled", False)
    except:
        return False


# ================= FETCH TASKS =================

def get_tasks():
    try:
        res = requests.get(BASE_URL + "/pending_tasks", timeout=30)
        return res.json()
    except:
        return []


# ================= PUSH RESULT =================

def push_result(task_id, reel, duration):
    try:
        requests.post(
            BASE_URL + "/push_result",
            json={
                "task_id": task_id,
                "reel": reel,
                "duration": duration
            }
        )
    except:
        pass


# ================= DRIVER =================

def init_driver():
    options = Options()

    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")

    options.binary_location = "/usr/bin/chromium-browser"

    service = Service("/usr/bin/chromedriver")

    return webdriver.Chrome(service=service, options=options)


# ================= SCRAPE =================

def collect_reels(driver, page, limit, task_id):

    reels = set()

    send_log(task_id, f"Opening page {page}")

    driver.get(page + "/reels/")
    time.sleep(5)

    for i in range(8):

        if is_cancelled(task_id):
            send_log(task_id, "❌ Task cancelled")
            return []

        send_log(task_id, f"Scroll {i+1}")

        links = driver.find_elements("tag name", "a")

        for link in links:
            href = link.get_attribute("href")
            if href and "/reel/" in href:
                reels.add(href)

        send_log(task_id, f"Found {len(reels)} reels")

        if len(reels) >= limit:
            break

        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)

    return list(reels)


# ================= MAIN =================

def run():

    tasks = get_tasks()

    if not tasks:
        print("No tasks")
        return

    driver = init_driver()

    for task in tasks:

        task_id = task["task_id"]

        send_log(task_id, "🚀 Starting task")

        try:
            full = requests.get(f"{BASE_URL}/get_task/{task_id}").json()
            task_data = full.get("task", [])
        except:
            continue

        pages = ast.literal_eval(task_data[3])
        limit = task_data[4]

        total_pages = len(pages)
        done_pages = 0

        for page in pages:

            if is_cancelled(task_id):
                send_log(task_id, "❌ Cancelled before page")
                break

            send_log(task_id, f"Processing page {page}")

            reels = collect_reels(driver, page, limit, task_id)

            done_pages += 1

            send_log(
                task_id,
                f"Progress {int((done_pages/total_pages)*100)}%"
            )

            for reel in reels:

                if is_cancelled(task_id):
                    send_log(task_id, "❌ Cancelled mid-scrape")
                    break

                driver.get(reel)
                time.sleep(4)

                videos = driver.find_elements("tag name", "video")

                if not videos:
                    continue

                duration = driver.execute_script(
                    "return arguments[0].duration;",
                    videos[0]
                )

                if duration and 28 <= duration <= 41:

                    send_log(task_id, f"✔ Match {duration}s")

                    push_result(task_id, reel, round(duration, 2))

        send_log(task_id, "✅ Task completed")

    driver.quit()


if __name__ == "__main__":
    run()
