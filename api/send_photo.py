from http.server import BaseHTTPRequestHandler
import json
import base64
import urllib.request
import urllib.parse
import uuid

TOKEN = "9134534266:AAEay88ShrbujXpvCBkdwxBnHYD81NysNnc"
TELEGRAM_API = f"https://api.telegram.org/bot{TOKEN}"

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body.decode("utf-8"))
            chat_id = data.get("chat_id")
            photo_b64 = data.get("photo_base64", "")
            caption = data.get("caption", "🎨 Ваш ризограф-оттиск!\n\nНажмите на фото ➔ три точки (⋮) ➔ «Сохранить в галерею» 📲")

            if not chat_id or not photo_b64:
                self.send_response(400)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": "Missing chat_id or photo_base64"}).encode("utf-8"))
                return

            # Strip data:image/...;base64, prefix if present
            if "," in photo_b64:
                photo_b64 = photo_b64.split(",", 1)[1]
            image_bytes = base64.b64decode(photo_b64)

            # Build multipart/form-data request
            boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
            parts = []

            # chat_id
            parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"chat_id\"\r\n\r\n{chat_id}\r\n".encode("utf-8"))

            # caption
            parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"caption\"\r\n\r\n{caption}\r\n".encode("utf-8"))

            # photo file
            parts.append(
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"riso_art.png\"\r\nContent-Type: image/png\r\n\r\n".encode("utf-8")
                + image_bytes
                + b"\r\n"
            )
            parts.append(f"--{boundary}--\r\n".encode("utf-8"))

            payload_bytes = b"".join(parts)

            req = urllib.request.Request(
                f"{TELEGRAM_API}/sendPhoto",
                data=payload_bytes,
                headers={
                    "Content-Type": f"multipart/form-data; boundary={boundary}",
                    "Content-Length": str(len(payload_bytes))
                }
            )

            with urllib.request.urlopen(req, timeout=20) as resp:
                result_json = resp.read().decode("utf-8")

            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(result_json.encode("utf-8"))
            return

        except Exception as e:
            self.send_response(500)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))

    def do_GET(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write("Send Photo API is Ready!".encode("utf-8"))
