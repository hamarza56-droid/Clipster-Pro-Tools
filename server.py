from database import *
from flask import Flask, request, jsonify, render_template, session, redirect
import time
import threading
import pickle
import os
import hashlib
import random

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

app = Flask(__name__)
app.secret_key = "clipster_secret_key_123"


# ================= AUTH HELPERS =================

def hash_password(p):
    return hashlib.sha256(p.encode()).hexdigest()


def generate_api_key():
    return str(random.randint(100000, 999999)) + str(int(time.time()))


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

        if len(reels) == last_count:
            scroll_attempts += 1
        else:
            scroll_attempts = 0

        last_count = len(reels)

    return list(reels)


# ================= WORKER =================

def scraper_worker(task_id, username, pages, limit):

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
                        results.append((reel, round(duration, 2)))
                        save_result(task_id, reel, round(duration, 2))

                except:
                    pass

        update_task_status(task_id, "done")

    except Exception as e:
        print("worker error:", e)
        update_task_status(task_id, "error")

    driver.quit()


# ================= ROUTES =================

@app.route("/")
def home():
    if "user" not in session:
        return redirect("/login")
    return render_template("index.html")


# ================= LOGIN PAGE =================

@app.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "GET":
        return render_template("login.html")

    data = request.json

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    SELECT api_key FROM users
    WHERE username=? AND password=?
    """, (
        data["username"],
        hash_password(data["password"])
    ))

    user = cur.fetchone()
    conn.close()

    if user:
        return jsonify({"api_key": user[0]})

    return jsonify({"error": "invalid"})

    data = request.json

    username = data.get("username")
    password = data.get("password")

    conn = get_connection()
    cur = conn.cursor()

    hashed = hash_password(password)

    cur.execute("""
        SELECT api_key FROM users
        WHERE username=? AND password=?
    """, (username, hashed))

    user = cur.fetchone()
    conn.close()

    if user:
        session["user"] = username
        return jsonify({
            "status": "success",
            "api_key": user[0]
        })

    return jsonify({"status": "fail"})

# ================= REGISTER =================

@app.route("/register", methods=["POST"])
def register():

    data = request.json

    username = data.get("username")
    password = data.get("password")

    conn = get_connection()
    cur = conn.cursor()

    # check if user exists
    cur.execute("SELECT username FROM users WHERE username=?", (username,))
    if cur.fetchone():
        return jsonify({"status": "error", "msg": "user exists"})

    hashed = hash_password(password)

    api_key = generate_api_key()

    cur.execute("""
        INSERT INTO users(username, password, api_key)
        VALUES (?, ?, ?)
    """, (username, hashed, api_key))

    conn.commit()
    conn.close()

    return jsonify({"status": "registered"})


# ================= LOGOUT =================

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/login")


# ================= CREATE TASK =================

@app.route("/create_task", methods=["POST"])
def create_task():

    if "user" not in session:
        return jsonify({"error": "not logged in"})

    data = request.json
    username = session["user"]

    task_id = str(int(time.time()))

    save_task(
        task_id,
        username,
        "running",
        str(data.get("pages", [])),
        data.get("limit", 100),
        time.strftime("%Y-%m-%d %H:%M:%S")
    )

    threading.Thread(
        target=scraper_worker,
        args=(task_id, username, data.get("pages", []), data.get("limit", 100)),
        daemon=True
    ).start()

    return jsonify({"task_id": task_id})


# ================= TASK =================

@app.route("/get_task/<task_id>")
def get_task(task_id):
    return jsonify({
        "task": get_task_info(task_id),
        "results": get_task_results(task_id)
    })


# ================= STATS =================

@app.route("/stats")
def stats():

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM tasks")
    total_tasks = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM results")
    total_reels = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM tasks WHERE status='running'")
    running = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM tasks WHERE status='done'")
    done = cur.fetchone()[0]

    conn.close()

    return jsonify({
        "total_tasks": total_tasks,
        "total_reels": total_reels,
        "running_tasks": running,
        "completed_tasks": done
    })


# ================= START =================

if __name__ == "__main__":
    init_db()
    app.run(debug=True)
