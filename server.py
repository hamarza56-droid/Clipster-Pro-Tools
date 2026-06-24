from flask import Flask, request, jsonify, render_template, session, redirect, send_file
import hashlib, random, secrets, uuid, os, zipfile
import os

os.environ["PATH"] += ":" + os.path.join(os.getcwd(), "ffmpeg-bin")
from database import *

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

init_db()

ADMIN_USERNAME = "Kaelrix"

# ================= HELPERS =================

def hash_password(p):
    return hashlib.sha256(p.encode()).hexdigest()


def is_admin():
    return session.get("role") == "admin"


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

    data = request.get_json()
    user = get_user(data["username"], hash_password(data["password"]))

    if not user:
        return jsonify({"status": "fail"})

    if user["username"] == ADMIN_USERNAME:
        update_user_role(ADMIN_USERNAME, "admin")
        user["role"] = "admin"

    session["user"] = user["username"]
    session["role"] = user["role"]

    return jsonify({
        "status": "success",
        "role": user["role"],
        "api_key": user["api_key"]
    })


# ================= REGISTER =================

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    role = "admin" if data["username"] == ADMIN_USERNAME else "user"

    create_user(
        data["username"],
        hash_password(data["password"]),
        str(uuid.uuid4()),
        role
    )

    return jsonify({"status": "registered"})


# ================= TASK API (WORKER SUPPORT) =================

@app.route("/create_task", methods=["POST"])
def create_task_api():
    data = request.get_json()

    task_id = str(uuid.uuid4())

    create_task(
        task_id,
        session["user"],
        data["pages"],
        data["limit"]
    )

    return jsonify({"task_id": task_id})


@app.route("/pending_tasks")
def pending_tasks():
    return jsonify(get_all_tasks())


@app.route("/get_task/<task_id>")
def get_task_api(task_id):
    return jsonify({"task": get_task(task_id)})


@app.route("/push_result", methods=["POST"])
def push_result_api():
    data = request.get_json()

    push_result(
        data["task_id"],
        data["reel"],
        data["duration"]
    )

    return jsonify({"ok": True})


@app.route("/update_progress", methods=["POST"])
def update_progress_api():
    data = request.get_json()
    update_progress(data["task_id"], data["progress"])
    return jsonify({"ok": True})


# ================= HISTORY =================

@app.route("/history")
def history():
    if "user" not in session:
        return redirect("/login")

    return render_template("history.html", tasks=get_history(session["user"]))


# ================= ADMIN =================

@app.route("/admin")
def admin():
    if not is_admin():
        return "Access Denied", 403
    return render_template("admin.html")


@app.route("/admin/data")
def admin_data():
    if not is_admin():
        return jsonify({"error": "unauthorized"})

    return jsonify({
        "users": get_all_users(),
        "tasks": get_all_tasks()
    })


# ================= RUN =================

if __name__ == "__main__":
    app.run(debug=True)
