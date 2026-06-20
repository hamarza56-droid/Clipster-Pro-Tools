from database import *
from flask import Flask, request, jsonify, render_template, session, redirect
import time
import hashlib
import random

app = Flask(__name__)
app.secret_key = "clipster_secret_key_123"

init_db()


# ================= AUTH HELPERS =================

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
    username = data.get("username")
    password = data.get("password")

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT api_key
        FROM users
        WHERE username=? AND password=?
    """, (username, hash_password(password)))

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

    return jsonify({
        "task_id": task_id,
        "status": "queued"
    })

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


# ================= TASK QUEUE API =================

@app.route("/pending_tasks")
def pending_tasks():
    tasks = get_all_tasks()

    pending = []

    for t in tasks:
        pending.append({
            "task_id": t[0],
            "username": t[1],
            "status": t[2],
            "created_at": t[3]
        })

    return jsonify(pending)

# ================= PUSH RESULT API =================

@app.route("/push_result", methods=["POST"])
def push_result():

    data = request.json

    task_id = data["task_id"]
    reel = data["reel"]
    duration = data["duration"]

    save_result(task_id, reel, duration)

    return jsonify({"status": "ok"})


# ================= START =================

if __name__ == "__main__":
    init_db()
    app.run(debug=True)
