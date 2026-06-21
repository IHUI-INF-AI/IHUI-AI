"""从 OpenAPI 自动生成 Locust 压测路径.

解决手动维护 locustfile.py 中路径与后端不一致的问题.
启动时:
  1. 拉取 /openapi.json
  2. 过滤出 GET 端点
  3. 去掉 path 参数 (e.g. {id}) -> 用 ?xxx=1 代替
  4. 输出到 locustfile_auto.py (可被 locust 加载)
"""

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

OPENAPI_URL = "http://127.0.0.1:8000/openapi.json"
OUTPUT = ROOT / "scripts" / "dev" / "locustfile_auto.py"

# 优先压测的 tag (核心业务)
PRIORITY_TAGS = {
    "Health",
    "Auth",
    "User",
    "Agent",
    "Agent Use Detail",
    "Course",
    "Resource",
    "Content",
    "AI",
    "Search",
    "Mock",
}

# 排除的 tag (不参与压测, 如 admin/调试/迁移)
EXCLUDED_TAGS = {
    "Admin",
    "Debug",
    "Migration",
    "Alembic",
}


def fetch_openapi() -> dict:
    with urllib.request.urlopen(OPENAPI_URL, timeout=15) as r:
        return json.loads(r.read())


def normalize_path(path: str) -> tuple[str, dict]:
    """把 path 中的 {xxx} 替换为 ?xxx=1 形式.

    返回: (new_path, query_params_dict)
    """
    import re

    query = {}
    # 找到所有 {name} 替换
    for m in re.findall(r"\{(\w+)\}", path):
        query[m] = "1"
    new_path = re.sub(r"\{(\w+)\}", "1", path)
    return new_path, query


def gen_locustfile():
    schema = fetch_openapi()
    paths = schema.get("paths", {})

    # 收集 GET 端点
    tasks = []
    for path, methods in paths.items():
        if not path.startswith("/api/v1/"):
            continue
        get_op = methods.get("get")
        if not get_op:
            continue
        tags = get_op.get("tags", [])
        if any(t in EXCLUDED_TAGS for t in tags):
            continue
        # 必须有 summary 才纳入
        summary = get_op.get("summary", "")
        if not summary:
            continue
        normalized, query = normalize_path(path)
        tasks.append((normalized, query, tags, summary))

    # 按优先级 tag 排序
    def tag_priority(item):
        tags = item[2]
        for t in tags:
            if t in PRIORITY_TAGS:
                return 0
        return 1

    tasks.sort(key=tag_priority)

    # 生成 Python 代码
    code = [
        '"""自动生成的 Locust 压测路径 - 从 /openapi.json 动态同步.',
        "",
        f"  生成时间: {Path(__file__).stat().st_mtime}",
        f"  端点数: {len(tasks)}",
        f"  数据源: {OPENAPI_URL}",
        "",
        "用法:",
        "    locust -f scripts/dev/locustfile_auto.py --host=http://127.0.0.1:8000",
        '"""',
        "",
        "import random",
        "import uuid",
        "",
        "from locust import HttpUser, between, task",
        "",
        "",
        "def make_token(uid: str) -> str:",
        '    """生成一个 JWT token."""',
        "    from datetime import timedelta",
        "    from app.security import create_access_token",
        "",
        '    return create_access_token(uid, expires_delta=timedelta(hours=1))',
        "",
        "",
        "class ZHSAutoUser(HttpUser):",
        '    """自动从 OpenAPI 同步的压测用户 - 覆盖所有 GET 端点."""',
        "",
        "    wait_time = between(1, 3)",
        "",
        "    def on_start(self):",
        "        self.uid = f\"locust-{uuid.uuid4().hex[:8]}\"",
        "        self.token = make_token(self.uid)",
        "        self.headers = {",
        '            "Authorization": f"Bearer {self.token}",',
        '            "X-User-UUID": self.uid,',
        "        }",
        "",
    ]
    # 权重: 前 20 个高优 10, 接下来 30 个 5, 其余 1
    for i, (path, query, tags, summary) in enumerate(tasks):
        if i < 20:
            weight = 10
        elif i < 50:
            weight = 5
        elif i < 100:
            weight = 2
        else:
            weight = 1
        comment = f"# [{'/'.join(tags)}] {summary[:60]}"
        params_str = ", ".join(f'"{k}": "1"' for k in query.keys())
        name = path[:60]
        code.append(f"    @task({weight})")
        code.append(f"    def task_{i:03d}(self):  # {comment}")
        code.append(f'        self.client.get(')
        code.append(f'            "{path}",')
        if params_str:
            code.append(f"            params={{{params_str}}},")
        code.append(f"            headers=self.headers,")
        code.append(f'            name="{name}",')
        code.append(f"        )")
        code.append("")

    code_text = "\n".join(code)
    OUTPUT.write_text(code_text, encoding="utf-8")
    print(f"[OK] 生成 {OUTPUT.name}  端点数: {len(tasks)}")
    return len(tasks)


if __name__ == "__main__":
    n = gen_locustfile()
    sys.exit(0 if n > 0 else 1)
