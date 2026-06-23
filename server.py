from flask import Flask, request, jsonify, render_template, session, redirect
import hashlib, time, random, secrets
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

    if not data:
        return jsonify({"status": "fail", "msg": "no data"})

    username = data.get("username")
    password = data.get("password")

    user = get_user(username, hash_password(password))

    if user:

        # ensure admin consistency
        if user["username"] == ADMIN_USERNAME:
            update_user_role(ADMIN_USERNAME, "admin")
            user["role"] = "admin"

        session["user"] = user["username"]
        session["role"] = user["role"]

        return jsonify({
            "status": "success",
            "api_key": user["api_key"],
            "role": user["role"]
        })

    return jsonify({"status": "fail", "msg": "invalid credentials"})


# ================= REGISTER =================

@app.route("/register", methods=["POST"])
def register():

    data = request.get_json()

    username = data.get("username")
    password = data.get("password")

    role = "admin" if username == ADMIN_USERNAME else "user"

    try:
        create_user(
            username,
            hash_password(password),
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

    data = request.get_json()

    update_user_role(data["username"], data["role"])

    return jsonify({"status": "updated"})


# ================= TASKS =================

@app.route("/pending_tasks")
def pending_tasks():
    if "user" not in session:
        return jsonify([])

    return jsonify(get_all_tasks())


# ================= RUN =================

if __name__ == "__main__":
    app.run(debug=True)
