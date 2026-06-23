from flask import Flask, request, jsonify, render_template, session, redirect
import hashlib, time, random, threading, secrets
from database import *

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

init_db()

ADMIN_USERNAME = "Kaelrix"

# ================= HELPERS =================

def hash_password(p):
    return hashlib.sha256(p.encode()).hexdigest()


def generate_api_key():
    return str(random.randint(100000, 999999)) + str(int(time.time()))


def is_admin():
    return session.get("user") == ADMIN_USERNAME


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
        session["user"] = user["username"]
        session["role"] = user["role"]

        return jsonify({
            "status": "success",
            "role": user["role"]
        })

    return jsonify({"status": "fail"})


# ================= REGISTER =================

@app.route("/register", methods=["POST"])
def register():
    data = request.json

    role = "admin" if data["username"] == ADMIN_USERNAME else "user"

    try:
        create_user(
            data["username"],
            hash_password(data["password"]),
            generate_api_key(),
            role
        )
        return jsonify({"status": "registered"})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)})


# ================= ADMIN PANEL =================

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
        "tasks": get_all_tasks(),
        "campaigns": get_campaigns()
    })


@app.route("/admin/set_role", methods=["POST"])
def set_role():
    if not is_admin():
        return jsonify({"error": "unauthorized"})

    data = request.json
    update_user_role(data["username"], data["role"])

    return jsonify({"status": "updated"})
