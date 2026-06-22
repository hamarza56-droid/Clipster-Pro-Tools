from flask import Flask, request, jsonify, render_template, session, redirect
import hashlib
import time
import random
import threading

from database import *

app = Flask(__name__)
app.secret_key = "clipster_secret_key_123"

init_db()

# ================= HELPERS =================

def hash_password(p):
    return hashlib.sha256(p.encode()).hexdigest()

def generate_api_key():
    return str(random.randint(100000, 999999)) + str(int(time.time()))

# ================= HOME =================

@app.route("/")
def home():
    if "user" not in session:
        return redirect("/login")
    return render_template("index.html")

# ================= LOGIN =================

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")

    data = request.json

    user = get_user(
        data["username"],
        hash_password(data["password"])
    )

    if user:
        session["user"] = data["username"]
        return jsonify({
            "status": "success",
            "api_key": user["api_key"]
        })

    return jsonify({"status": "fail"})

# ================= REGISTER =================

@app.route("/register", methods=["POST"])
def register():
    data = request.json

    try:
        create_user(
            data["username"],
            hash_password(data["password"]),
            generate_api_key()
        )
        return jsonify({"status": "registered"})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)})

# ================= TASK QUEUE =================

TASKS = {}

def process_task(task_id, pages, limit, username):

    update_task_status(task_id, "running")

    total = len(pages)
    done = 0

    for page in pages:

        # ❌ CHECK CANCEL PROPERLY
        task = get_task_info(task_id)
        if task and task["cancelled"]:
            update_task_status(task_id, "cancelled")
            return

        for i in range(limit):

            reel = f"{page}/reel/{i}"
            duration = 30 + i

            if 28 <= duration <= 41:
                save_result(task_id, reel, duration)

            time.sleep(0.3)

        done += 1
        progress = int((done / total) * 100)

        update_progress(task_id, progress, done, f"Processed {page}")

    update_task_status(task_id, "done")

# ================= CREATE TASK =================

@app.route("/create_task", methods=["POST"])
def create_task():

    if "user" not in session:
        return jsonify({"error": "not logged in"})

    data = request.json
    task_id = str(int(time.time()))

    pages = data.get("pages", [])
    limit = data.get("limit", 10)

    save_task(
        task_id,
        session["user"],
        "queued",
        str(pages),
        limit,
        time.strftime("%Y-%m-%d %H:%M:%S")
    )

    # 🔥 START BACKGROUND THREAD (FIXES UI FREEZE + AUTO CANCEL BUG)
    t = threading.Thread(
        target=process_task,
        args=(task_id, pages, limit, session["user"])
    )
    t.start()

    return jsonify({"task_id": task_id})

# ================= GET TASK =================

@app.route("/get_task/<task_id>")
def get_task(task_id):

    task = get_task_info(task_id)
    results = get_task_results(task_id)

    return jsonify({
        "task": task,
        "results": results
    })

# ================= CANCEL TASK =================

@app.route("/cancel_task/<task_id>")
def cancel(task_id):

    cancel_task(task_id)
    return jsonify({"status": "cancelled"})

# ================= WORKER FEED =================

@app.route("/pending_tasks")
def pending_tasks():
    return jsonify(get_all_tasks())

# ================= PUSH RESULT =================

@app.route("/push_result", methods=["POST"])
def push_result():
    data = request.json

    save_result(
        data["task_id"],
        data["reel"],
        data["duration"]
    )

    return jsonify({"status": "ok"})

# ================= RUN =================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
