"""健康检查脚本"""
import urllib.request
import sys

urls = [
    "http://127.0.0.1:8001/health",
    "http://127.0.0.1:8001/health/live",
    "http://127.0.0.1:8001/health/ready",
    "http://127.0.0.1:8001/docs",
    "http://127.0.0.1:8001/openapi.json",
]

results = []
for url in urls:
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            body = resp.read().decode("utf-8", errors="replace")[:200]
            results.append((url, status, body))
    except Exception as e:
        results.append((url, "ERR", str(e)[:200]))

for url, status, body in results:
    print(f"[{status}] {url}")
    print(f"  Body: {body}")
    print()

ok = sum(1 for _, s, _ in results if s == 200)
print(f"=== {ok}/{len(results)} endpoints OK ===")
sys.exit(0 if ok == len(results) else 1)
