import os
import time
import requests
import ast

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options


BASE_URL = os.getenv("BASE_URL", "https://clipster-pro-tools.onrender.com")


# ================= FETCH TASKS =================

def get_tasks():
    try:
        res = requests.get(BASE_URL + "/pending_tasks")
        return res.json()
    except Exception as e:
        print("Error fetching tasks:", e)
        return []


# ================= PUSH RESULT =================

def push_result(task_id, reel, duration):
    try:
        requests.post(BASE_URL + "/push_result", json={
            "task_id": task_id,
            "reel": reel,
            "duration": duration
        })
    except Exception as e:
        print("Push error:", e)


# ================= CHROME DRIVER =================

def init_driver():
    options = Options()

    # CRITICAL FOR GITHUB ACTIONS
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")

    # Chromium binary path (GitHub Actions)
    options.binary_location = "/usr/bin/chromium-browser"

    service = Service("/usr/bin/chromedriver")

    driver = webdriver.Chrome(service=service, options=options)
    return driver


# ================= SCRAPE REELS =================

def collect_reels(driver, page, limit=10):

    reels = set()

    try:
        driver.get(page)
        time.sleep(5)

        driver.get(page + "/reels/")
        time.sleep(5)

        for _ in range(5):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)

            links = driver.find_elements("tag name", "a")

            for link in links:
                href = link.get_attribute("href")
                if href and "/reel/" in href:
                    reels.add(href)

            if len(reels) >= limit:
                break

    except Exception as e:
        print("Scrape error:", e)

    return list(reels)


# ================= MAIN WORKER =================

def run():

    tasks = get_tasks()

    if not tasks:
        print("No tasks found")
        return

    driver = init_driver()

    for task in tasks:

        task_id = task["task_id"]

        print(f"\nProcessing task: {task_id}")

        try:
            full = requests.get(f"{BASE_URL}/get_task/{task_id}").json()
            task_data = full.get("task", [])
        except:
            continue

        if not task_data:
            continue

        pages = task_data[3]
        limit = task_data[4] if len(task_data) > 4 else 10

        try:
            pages = ast.literal_eval(pages)
        except:
            pages = []

        for page in pages:

            reels = collect_reels(driver, page, limit)

            for reel in reels:

                try:
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
                        print("Found:", reel, duration)
                        push_result(task_id, reel, round(duration, 2))

                except Exception as e:
                    print("Reel error:", e)

    driver.quit()


if __name__ == "__main__":
    run()
