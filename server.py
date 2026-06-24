from flask import Flask, request, jsonify, render_template, session, redirect, send_file
import hashlib, time, random, secrets, os, zipfile
from database import *

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

init_db()

UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "outputs"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)


# ================= HELPERS =================

def hash_password(p):
    return hashlib.sha256(p.encode()).hexdigest()


def generate_task_id():
    return str(int(time.time())) + str(random.randint(1000, 9999))


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

    user = get_user(
        data["username"],
        hash_password(data["password"])
    )

    if user:
        session["user"] = user["username"]
        session["role"] = user["role"]

        return jsonify({"status": "success", "role": user["role"]})

    return jsonify({"status": "fail"})


# ================= BACKGROUND CHANGER PAGE =================

@app.route("/background-changer")
def bg_page():
    if "user" not in session:
        return redirect("/login")
    return render_template("background_changer.html")


# ================= CREATE TASK =================

@app.route("/create_bg_task", methods=["POST"])
def create_bg_task():

    if "user" not in session:
        return jsonify({"error": "not logged in"})

    files = request.files.getlist("videos")
    background = request.files["background"]

    task_id = generate_task_id()

    bg_path = f"{UPLOAD_FOLDER}/{task_id}_bg.jpg"
    background.save(bg_path)

    save_task(task_id, session["user"], bg_path, time.strftime("%Y-%m-%d %H:%M:%S"))

    video_paths = []

    for f in files:
        path = f"{UPLOAD_FOLDER}/{task_id}_{f.filename}"
        f.save(path)
        video_paths.append(path)

    process_videos(task_id, video_paths, bg_path)

    return jsonify({"task_id": task_id})


# ================= FFmpeg PROCESSOR =================

def process_videos(task_id, videos, bg):

    update_task_status(task_id, "processing")

    output_files = []

    total = len(videos)

    for i, video in enumerate(videos):

        out = f"{OUTPUT_FOLDER}/{task_id}_{i}.mp4"

        # 🔥 9:16 background fit + zoom-out center effect
        cmd = f"""
        ffmpeg -y -i "{bg}" -i "{video}"
        -filter_complex "
        [1:v]scale=720:1280:force_original_aspect_ratio=increase,
        crop=720:1280,
        setsar=1[vid];
        [0:v]scale=720:1280[bg];
        [bg][vid]overlay=(W-w)/2:(H-h)/2
        " -c:v libx264 -preset fast -crf 23 "{out}"
        """

        os.system(cmd)

        output_files.append(out)

        update_progress(task_id, int((i+1)/total*100))

    # ZIP OUTPUT
    zip_path = f"{OUTPUT_FOLDER}/{task_id}.zip"

    with zipfile.ZipFile(zip_path, "w") as z:
        for f in output_files:
            z.write(f, os.path.basename(f))

    save_result(task_id, zip_path)

    update_task_status(task_id, "done")


# ================= DOWNLOAD =================

@app.route("/download/<task_id>")
def download(task_id):

    zip_path = f"{OUTPUT_FOLDER}/{task_id}.zip"
    return send_file(zip_path, as_attachment=True)


# ================= HISTORY =================

@app.route("/history")
def history():

    if "user" not in session:
        return redirect("/login")

    data = get_history(session["user"])
    return render_template("history.html", tasks=data)


# ================= ADMIN =================

@app.route("/admin")
def admin():
    if session.get("role") != "admin":
        return "Access Denied", 403
    return render_template("admin.html")


# ================= RUN =================

if __name__ == "__main__":
    app.run(debug=True)
