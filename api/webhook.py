from http.server import BaseHTTPRequestHandler
import json
import urllib.request

TOKEN = "9134534266:AAEay88ShrbujXpvCBkdwxBnHYD81NysNnc"
TELEGRAM_API = f"https://api.telegram.org/bot{TOKEN}"

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            update = json.loads(body.decode("utf-8"))
            if "message" in update:
                message = update["message"]
                chat_id = message["chat"]["id"]

                # Production Vercel URL
                app_url = "https://riso-studio-emperor203s-projects.vercel.app"

                reply_text = (
                    "🖨️ *RISO PRINT STUDIO // ТРАФАРЕТНЫЙ СТАНОК*\n\n"
                    "Добро пожаловать в цифровую студию ризографии!\n\n"
                    "• *Физический оверпринт:* соевые чернила Fluo Pink, Federal Blue, Sunflower\n"
                    "• *Смещение слоёв:* регулировка Misregistration\n"
                    "• *Полутоновый растр:* винтажные розетки без муара\n"
                    "• *Камера:* делайте снимки или загружайте любые фото\n\n"
                    "Нажмите кнопку ниже, чтобы открыть приложение прямо в Telegram 👇"
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
                urllib.request.urlopen(req)

        except Exception as e:
            print("Webhook error:", e)

        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write("Riso Telegram Webhook is Active!".encode("utf-8"))
