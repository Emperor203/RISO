from http.server import BaseHTTPRequestHandler
import json
import base64
import urllib.request
import uuid

TOKEN = "9134534266:AAEay88ShrbujXpvCBkdwxBnHYD81NysNnc"
TELEGRAM_API = f"https://api.telegram.org/bot{TOKEN}"

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS, GET")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body.decode("utf-8"))

            # 1. Direct photo send request from WebApp
            if "photo_base64" in data and "chat_id" in data:
                chat_id = data.get("chat_id")
                photo_b64 = data.get("photo_base64", "")
                caption = data.get("caption", "🎨 Ваш ризограф-оттиск!\n\nНажмите на фото ➔ три точки (⋮) ➔ «Сохранить в галерею» 📲")

                if "," in photo_b64:
                    photo_b64 = photo_b64.split(",", 1)[1]
                image_bytes = base64.b64decode(photo_b64)

                boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
                parts = []
                parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"chat_id\"\r\n\r\n{chat_id}\r\n".encode("utf-8"))
                parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"caption\"\r\n\r\n{caption}\r\n".encode("utf-8"))
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

            # 2. Telegram Bot Webhook Update
            if "message" in data:
                message = data["message"]
                chat_id = message["chat"]["id"]
                app_url = "https://riso-studio-emperor203s-projects.vercel.app"

                reply_text = (
                    "🖨️ *RISO PRINT STUDIO // ТРАФАРЕТНЫЙ СТАНОК*\n\n"
                    "Добро пожаловать в цифровую студию ризографии!\n\n"
                    "• *Физический оверпринт:* соевые чернила Fluo Pink, Federal Blue, Sunflower\n"
                    "• *Штампы мастера:* японский Hanko 印 и нумерация тиража\n"
                    "• *Изоляция слоёв:* просмотр каждого барабана отдельно и Ч/Б мастер-плёнка\n"
                    "• *Камера и галерея:* делайте снимки или загружайте любые фото\n\n"
                    "Нажмите кнопку ниже, чтобы открыть студию прямо в Telegram 👇"
                )

                payload = {
                    "chat_id": chat_id,
                    "text": reply_text,
                    "parse_mode": "Markdown",
                    "reply_markup": {
                        "inline_keyboard": [
                            [
                                {
                                    "text": "🎨 ЗАПУСТИТЬ RISO STUDIO",
                                    "web_app": {"url": app_url}
                                }
                            ]
                        ]
                    }
                }

                req = urllib.request.Request(
                    f"{TELEGRAM_API}/sendMessage",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                urllib.request.urlopen(req, timeout=10)

        except Exception as e:
            print("Webhook error:", e)

        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))

    def do_GET(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write("Riso Telegram Webhook is Active!".encode("utf-8"))
