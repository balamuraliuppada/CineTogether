import os
import urllib.request

port = os.getenv("PORT", "8000")
urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=3)
