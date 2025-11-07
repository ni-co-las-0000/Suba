from flask import Flask, render_template, request, jsonify, send_file, url_for
from gtts import gTTS
from pydub import AudioSegment
import os, uuid
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_FOLDER = "static/audios"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXT = {'.mp3', '.wav', '.ogg', '.flac', '.m4a'}

def unique_filename(ext=".mp3"):
    return f"{uuid.uuid4().hex}{ext}"

def is_allowed(filename):
    return os.path.splitext(filename)[1].lower() in ALLOWED_EXT

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/upload", methods=["POST"])
def upload():
    f = request.files.get("file")
    if not f:
        return jsonify({"error":"no file"}), 400
    filename = secure_filename(f.filename)
    if not is_allowed(filename):
        return jsonify({"error":"format not allowed"}), 400
    ext = os.path.splitext(filename)[1].lower()
    outname = unique_filename(ext)
    path = os.path.join(UPLOAD_FOLDER, outname)
    f.save(path)
    return jsonify({"filename": outname})

@app.route("/create_tts", methods=["POST"])
def create_tts():
    data = request.get_json() or {}
    text = data.get("text","").strip()
    if not text:
        return jsonify({"error":"empty text"}), 400
    outname = unique_filename(".mp3")
    outpath = os.path.join(UPLOAD_FOLDER, outname)
    # Use gTTS with TLD com.mx for deeper voice
    tts = gTTS(text=text, lang="es", tld="com.mx")
    tts.save(outpath)
    return jsonify({"filename": outname})

@app.route("/compose", methods=["POST"])
def compose():
    """
    Expects JSON: {"items": [{"type":"audio"|"tts", "filename":"..."} , ...]}
    Produces a single mp3 with 1 second silence between items.
    """
    data = request.get_json() or {}
    items = data.get("items", [])
    if not items:
        return jsonify({"error":"no items"}), 400
    composed = None
    silence = AudioSegment.silent(duration=1000)  # 1 second
    for it in items:
        fname = it.get("filename")
        if not fname:
            continue
        path = os.path.join(UPLOAD_FOLDER, fname)
        if not os.path.exists(path):
            continue
        try:
            seg = AudioSegment.from_file(path)
        except Exception as e:
            continue
        if composed is None:
            composed = seg
        else:
            composed = composed + silence + seg
    if composed is None:
        return jsonify({"error":"no valid audio segments"}), 400
    outname = unique_filename(".mp3")
    outpath = os.path.join(UPLOAD_FOLDER, outname)
    # Export as mp3
    composed.export(outpath, format="mp3")
    return jsonify({"filename": outname, "url": url_for('static', filename='audios/' + outname)})

@app.route("/download/<filename>")
def download(filename):
    path = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(path):
        return "Not found", 404
    return send_file(path, as_attachment=True)

if __name__ == "__main__":
    from waitress import serve
    serve(app, host="0.0.0.0", port=5000)
