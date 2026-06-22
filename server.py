from flask import Flask, request, jsonify, render_template, session, redirect
import hashlib
import time
import random

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

# ================= CREATE TASK =================

@app.route("/create_task", methods=["POST"])
def create_task():

    if "user" not in session:
        return jsonify({"error": "not logged in"})

    data = request.json
    task_id = str(int(time.time()))

    save_task(
        task_id,
        session["user"],
        "queued",
        str(data.get("pages", [])),
        data.get("limit", 10),
        time.strftime("%Y-%m-%d %H:%M:%S")
    )

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

# ================= WORKER =================

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
