from database import *
from flask import Flask, request, jsonify, render_template, session, redirect
import time
import hashlib
import random
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.secret_key = "clipster_secret_key_123"

# WebSocket setup
socketio = SocketIO(app, cors_allowed_origins="*")

init_db()

# ================= TASK STATE =================
active_tasks = {}
cancel_flags = {}

# ================= AUTH =================

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
        return jsonify({"status": "success", "api_key": user[0]})

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

    api_key = generate_api_key()

    cur.execute("""
        INSERT INTO users(username, password, api_key)
        VALUES (?, ?, ?)
    """, (username, hash_password(password), api_key))

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
        data.get("limit", 10),
        time.strftime("%Y-%m-%d %H:%M:%S")
    )

    active_tasks[task_id] = True
    cancel_flags[task_id] = False

    return jsonify({"task_id": task_id})


# ================= CANCEL TASK =================

@app.route("/cancel_task/<task_id>")
def cancel_task(task_id):

    cancel_flags[task_id] = True
    update_task_status(task_id, "cancelled")

    socketio.emit("log", {
        "task_id": task_id,
        "msg": "❌ Task cancelled by user"
    })

    return jsonify({"status": "cancelled"})


# ================= GET TASK =================

@app.route("/get_task/<task_id>")
def get_task(task_id):

    task = get_task_info(task_id)
    results = get_task_results(task_id)

    if not task:
        return jsonify({"task": None, "results": []})

    return jsonify({
        "task": task,
        "results": results
    })


# ================= SOCKET EVENTS =================

@socketio.on("connect")
def connect():
    emit("log", {"msg": "connected"})


# ================= LIVE LOG FUNCTION =================

def send_log(task_id, msg):

    print(f"[{task_id}] {msg}")

    socketio.emit("log", {
        "task_id": task_id,
        "msg": msg
    })


# ================= PROGRESS UPDATE =================

def update_progress_live(task_id, progress, page=""):

    socketio.emit("progress", {
        "task_id": task_id,
        "progress": progress,
        "page": page
    })

    update_progress(task_id, progress, page)


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


# ================= PENDING TASKS =================

@app.route("/pending_tasks")
def pending_tasks():
    return jsonify(get_all_tasks())


# ================= PUSH RESULT =================

@app.route("/push_result", methods=["POST"])
def push_result():

    data = request.json

    task_id = data["task_id"]
    reel = data["reel"]
    duration = data["duration"]

    save_result(task_id, reel, duration)

    return jsonify({"status": "ok"})


# ================= RUN SERVER =================

if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=True
    )
