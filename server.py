from flask import Flask, request, jsonify, render_template, session, redirect
from flask_socketio import SocketIO
import hashlib
import time
import random
import redis
import json

from database import *

app = Flask(__name__)
app.secret_key = "clipster_secret_key_123"

socketio = SocketIO(app, cors_allowed_origins="*")

rdb = redis.Redis(
    host="YOUR_REDIS_HOST",
    port=6379,
    password="YOUR_REDIS_PASSWORD",
    decode_responses=True
)

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
        return jsonify({"status": "success"})

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


# ================= CREATE TASK (REDIS QUEUE) =================

@app.route("/create_task", methods=["POST"])
def create_task():

    if "user" not in session:
        return jsonify({"error": "not logged in"})

    data = request.json
    task_id = str(int(time.time()))

    task = {
        "task_id": task_id,
        "user": session["user"],
        "pages": data.get("pages", []),
        "limit": data.get("limit", 10),
        "status": "queued",
        "progress": 0
    }

    # save to redis queue
    rdb.lpush("task_queue", json.dumps(task))

    save_task(
        task_id,
        session["user"],
        "queued",
        str(task["pages"]),
        task["limit"],
        time.strftime("%Y-%m-%d %H:%M:%S")
    )

    return jsonify({"task_id": task_id})


# ================= GET TASK =================

@app.route("/get_task/<task_id>")
def get_task(task_id):

    task = get_task_info(task_id)
    results = get_task_results(task_id)

    return jsonify({
        "task": dict(task) if task else None,
        "results": results
    })


# ================= CANCEL TASK =================

@app.route("/cancel_task/<task_id>")
def cancel(task_id):

    cancel_task(task_id)

    # notify workers instantly
    rdb.set(f"cancel:{task_id}", "1")

    socketio.emit("status", {
        "task_id": task_id,
        "status": "cancelled"
    })

    return jsonify({"status": "cancelled"})


# ================= WORKER EVENTS =================

def emit_log(task_id, msg):
    socketio.emit("log", {
        "task_id": task_id,
        "msg": msg
    })


def emit_progress(task_id, progress):
    socketio.emit("progress", {
        "task_id": task_id,
        "progress": progress
    })


# ================= RUN =================

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)
