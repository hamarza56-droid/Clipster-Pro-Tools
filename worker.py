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


# ================= FETCH TASKS =================

def get_tasks():
    try:
        res = requests.get(BASE_URL + "/pending_tasks", timeout=30)

        print("Pending tasks response:", res.status_code)

        return res.json()

    except Exception as e:
        print("Error fetching tasks:", e)
        return []


# ================= PUSH RESULT =================

def push_result(task_id, reel, duration):
    try:
        r = requests.post(
            BASE_URL + "/push_result",
            json={
                "task_id": task_id,
                "reel": reel,
                "duration": duration
            },
            timeout=30
        )

        print(
            f"Result pushed -> {task_id} | {duration}s | {r.status_code}"
        )

    except Exception as e:
        print("Push error:", e)


# ================= CHROME DRIVER =================

def init_driver():

    options = Options()

    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")

    # GitHub Actions paths
    options.binary_location = "/usr/bin/chromium-browser"

    service = Service("/usr/bin/chromedriver")

    driver = webdriver.Chrome(
        service=service,
        options=options
    )

    return driver


# ================= LOGIN WITH COOKIES =================

def load_instagram_cookies(driver):

    if not os.path.exists("cookies.json"):
        print("cookies.json not found")
        return

    try:

        driver.get("https://www.instagram.com/")
        time.sleep(5)

        with open("cookies.json", "r", encoding="utf-8") as f:
            cookies = json.load(f)

        for cookie in cookies:

            try:
                driver.add_cookie(cookie)
            except Exception as e:
                print("Cookie skipped:", e)

        driver.refresh()
        time.sleep(5)

        print("Instagram cookies loaded")

    except Exception as e:
        print("Cookie load error:", e)


# ================= SCRAPE REELS =================

def collect_reels(driver, page, limit=10):

    reels = set()

    try:

        print("Opening page:", page)

        driver.get(page + "/reels/")
        time.sleep(8)

        for scroll in range(10):

            print(f"Scroll {scroll + 1}")

            links = driver.find_elements("tag name", "a")

            print("Links found:", len(links))

            for link in links:

                try:
                    href = link.get_attribute("href")

                    if href and "/reel/" in href:
                        reels.add(href)

                except:
                    pass

            print("Current reels:", len(reels))

            if len(reels) >= limit:
                break

            driver.execute_script(
                "window.scrollTo(0, document.body.scrollHeight);"
            )

            time.sleep(3)

    except Exception as e:
        print("Scrape error:", e)

    return list(reels)


# ================= MAIN WORKER =================

def run():

    tasks = get_tasks()

    if not tasks:
        print("No tasks found")
        return

    print("Tasks received:", len(tasks))

    driver = init_driver()

    load_instagram_cookies(driver)

    for task in tasks:

        task_id = task["task_id"]

        print("\n==============================")
        print("Processing task:", task_id)
        print("==============================")

        try:

            full = requests.get(
                f"{BASE_URL}/get_task/{task_id}",
                timeout=30
            ).json()

            task_data = full.get("task", [])

        except Exception as e:
            print("Task fetch error:", e)
            continue

        if not task_data:
            print("Task data missing")
            continue

        pages = task_data[3]
        limit = task_data[4]

        try:
            pages = ast.literal_eval(pages)
        except Exception as e:
            print("Pages parse error:", e)
            pages = []

        print("Pages:", pages)
        print("Limit:", limit)

        for page in pages:

            reels = collect_reels(
                driver,
                page,
                limit
            )

            print("Total reels collected:", len(reels))

            for reel in reels:

                try:

                    print("Checking reel:", reel)

                    driver.get(reel)
                    time.sleep(5)

                    videos = driver.find_elements(
                        "tag name",
                        "video"
                    )

                    print(
                        "Videos found:",
                        len(videos)
                    )

                    if not videos:
                        continue

                    duration = driver.execute_script(
                        "return arguments[0].duration;",
                        videos[0]
                    )

                    print(
                        "Duration:",
                        duration
                    )

                    if duration and 28 <= duration <= 41:

                        print(
                            "MATCH FOUND:",
                            reel,
                            duration
                        )

                        push_result(
                            task_id,
                            reel,
                            round(duration, 2)
                        )

                except Exception as e:
                    print("Reel error:", e)

    driver.quit()

    print("Worker completed")


if __name__ == "__main__":
    run()
