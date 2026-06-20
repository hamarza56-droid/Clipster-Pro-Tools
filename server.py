from database import *

from flask import Flask, request, jsonify, render_template

import time
import threading
import pickle
import os

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

app = Flask(__name__)


# ================= DRIVER =================

def init_driver_with_login():

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install())
    )

    driver.get("https://www.instagram.com/")
    time.sleep(5)

    if os.path.exists("cookies.pkl"):
        try:
            with open("cookies.pkl", "rb") as f:
                cookies = pickle.load(f)

            for cookie in cookies:
                cookie.pop("sameSite", None)
                try:
                    driver.add_cookie(cookie)
                except:
                    pass

            driver.refresh()
            time.sleep(5)

        except Exception as e:
            print("Cookie error:", e)

    return driver


# ================= SCRAPER =================

def collect_reels(driver, limit):

    reels = set()
    scroll_attempts = 0
    last_count = 0

    try:
        current_url = driver.current_url.rstrip("/")
        driver.get(current_url + "/reels/")
        time.sleep(5)
    except:
        pass

    while len(reels) < limit and scroll_attempts < 10:

        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(3)

        links = driver.find_elements("tag name", "a")

        for link in links:
            try:
                href = link.get_attribute("href")
                if href and ("/reel/" in href or "/reels/" in href):
                    reels.add(href)
            except:
                pass

        print(f"[SCRAPER] Reels found: {len(reels)}")

        if len(reels) == last_count:
            scroll_attempts += 1
        else:
            scroll_attempts = 0

        last_count = len(reels)

    return list(reels)


# ================= WORKER =================

def scraper_worker(task_id, pages, limit):

    driver = init_driver_with_login()
    results = []

    try:
        for page in pages:

            driver.get(page)
            time.sleep(5)

            reels = collect_reels(driver, limit)

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

                        results.append((task_id, reel, round(duration, 2)))

                        save_result(task_id, reel, round(duration, 2))

                except:
                    pass

        update_task_status(task_id, "done")

    except Exception as e:
        update_task_status(task_id, "error")

    driver.quit()


# ================= DASHBOARD =================

@app.route("/")
def dashboard():

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT task_id, status, created_at
        FROM tasks
        ORDER BY created_at DESC
    """)

    tasks = cur.fetchall()
    conn.close()

    return render_template("index.html", tasks=tasks)


# ================= HISTORY =================

@app.route("/history")
def history():

    tasks = get_all_tasks()
    return render_template("history.html", tasks=tasks)


# ================= CREATE TASK =================

@app.route("/create_task", methods=["POST"])
def create_task():

    data = request.json

    task_id = str(int(time.time()))

    pages = str(data.get("pages", []))
    limit = data.get("limit", 100)

    save_task(
        task_id,
        "running",
        pages,
        limit,
        time.strftime("%Y-%m-%d %H:%M:%S")
    )

    threading.Thread(
        target=scraper_worker,
        args=(task_id, data.get("pages", []), limit),
        daemon=True
    ).start()

    return jsonify({
        "message": "Scraping started",
        "task_id": task_id
    })


# ================= GET TASK =================

@app.route("/get_task/<task_id>")
def get_task(task_id):

    task = get_task_info(task_id)
    results = get_task_results(task_id)

    return jsonify({
        "task": task,
        "results": results
    })


# ================= RUN =================

if __name__ == "__main__":
    init_db()
    app.run(debug=True)
