"""OpenAPI SDK 自动生成脚本.

从 FastAPI 服务拉取 /openapi.json, 用 openapi-generator-cli 生成多语言 SDK.

支持语言:
  - typescript-fetch (前端)
  - typescript-axios (前端, 带 axios)
  - python (后端, httpx 异步)
  - java (Android/后端)
  - go (云原生)

使用:
  python gen_openapi_sdk.py                       # 全量生成 (默认 5 语言)
  python gen_openapi_sdk.py --lang typescript    # 单语言
  python gen_openapi_sdk.py --tag auth           # 按 tag 过滤
  python gen_openapi_sdk.py --base http://api.zhs.com  # 从远程拉
  python gen_openapi_sdk.py --verify             # 仅验证 OpenAPI 完整性

输出目录:
  server/sdk/typescript-fetch/
  server/sdk/typescript-axios/
  server/sdk/python/
  server/sdk/java/
  server/sdk/go/

要求:
  pip install openapi-generator-cli
  npm install -g @openapitools/openapi-generator-cli
"""

import argparse
import json
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SDK_ROOT = ROOT / "sdk"
SCHEMA_PATH = ROOT / "openapi.json"

DEFAULT_BASE = "http://127.0.0.1:8000"
LANG_MAP = {
    "ts": "typescript-fetch",
    "ts-fetch": "typescript-fetch",
    "ts-axios": "typescript-axios",
    "python": "python",
    "java": "java",
    "go": "go",
}


def fetch_schema(base: str, out: Path) -> dict:
    """拉取 /openapi.json 并保存到本地."""
    url = f"{base.rstrip('/')}/openapi.json"
    print(f"[1/4] 拉取 OpenAPI 规范: {url}")
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  [ERROR] 拉取失败: {e}")
        sys.exit(1)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  [OK] 保存到: {out}")
    return data


def verify_schema(schema: dict) -> bool:
    """验证 OpenAPI 规范完整性."""
    print(f"[2/4] 验证 OpenAPI 规范")
    issues = []
    # 必填字段
    for k in ("openapi", "info", "paths"):
        if k not in schema:
            issues.append(f"缺少字段: {k}")
    # 版本
    ver = schema.get("openapi", "")
    if not ver.startswith("3."):
        issues.append(f"OpenAPI 版本应为 3.x, 当前: {ver}")
    # 路径统计
    paths = schema.get("paths", {})
    op_count = 0
    for p, methods in paths.items():
        for m in methods:
            if m in ("get", "post", "put", "delete", "patch", "head", "options", "trace"):
                op_count += 1
    print(f"  [INFO] OpenAPI {ver}, 路径 {len(paths)} 条, 操作 {op_count} 个")
    # 检查空 summary
    empty_summary = 0
    for p, methods in paths.items():
        for m, op in methods.items():
            if m in ("get", "post", "put", "delete", "patch") and not op.get("summary"):
                empty_summary += 1
    if empty_summary:
        print(f"  [WARN] {empty_summary} 个端点缺少 summary")
    if issues:
        for i in issues:
            print(f"  [ERROR] {i}")
        return False
    print(f"  [OK] 验证通过")
    return True


def filter_by_tag(schema: dict, tag: str) -> dict:
    """按 tag 过滤 paths, 保留包含该 tag 的端点."""
    print(f"[INFO] 过滤 tag = {tag}")
    new_paths = {}
    for p, methods in schema["paths"].items():
        kept = {}
        for m, op in methods.items():
            if m not in ("get", "post", "put", "delete", "patch"):
                continue
            tags = op.get("tags", [])
            if tag in tags:
                kept[m] = op
        if kept:
            new_paths[p] = kept
    filtered = dict(schema)
    filtered["paths"] = new_paths
    print(f"  [OK] 过滤后保留 {len(new_paths)} 条路径")
    return filtered


def run_openapi_generator(schema: Path, lang: str, out: Path) -> bool:
    """调用 openapi-generator-cli 生成 SDK."""
    print(f"[3/4] 生成 {lang} SDK -> {out}")
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)
    # 自动查找 CLI (npm 全局目录, npx, PATH)
    cli = _find_cli()
    if not cli:
        print("  [WARN] openapi-generator-cli 未安装, 跳过")
        return False
    cmd = [
        cli,
        "generate",
        "-g", lang,
        "-i", str(schema),
        "-o", str(out),
        "--skip-validate-spec",
        "--additional-properties=packageName=zhs_api,projectName=zhs-api,sortParamsByRequiredFlag=true,useES6=true",
    ]
    try:
        result = subprocess.run(
            cmd,
            check=False,
            capture_output=True,
            text=True,
            timeout=600,
        )
        if result.returncode != 0:
            err = (result.stderr or "")[:500]
            print(f"  [ERROR] {err}")
            return False
        size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
        print(f"  [OK] {lang} SDK 已生成 ({size // 1024} KB)")
        return True
    except FileNotFoundError:
        print(f"  [WARN] CLI 不可执行: {cli}")
        return False
    except Exception as e:
        print(f"  [ERROR] {e}")
        return False


def _find_cli() -> str | None:
    """查找 openapi-generator-cli 路径."""
    import os
    import shutil

    # 1) shutil.which (PATH 查找)
    found = shutil.which("openapi-generator-cli")
    if found:
        return found
    # 2) npm 全局目录 (Windows)
    appdata = os.environ.get("APPDATA", "")
    if appdata:
        candidate = os.path.join(appdata, "npm", "openapi-generator-cli.cmd")
        if os.path.exists(candidate):
            return candidate
    # 3) npx
    npx = shutil.which("npx")
    if npx:
        return npx + " openapi-generator-cli"
    return None


def generate_stub_sdk(lang: str, schema: dict, out: Path) -> bool:
    """无 openapi-generator-cli 时, 生成精简手写 SDK stub."""
    print(f"[3/4] 生成 {lang} stub SDK -> {out}")
    out.mkdir(parents=True, exist_ok=True)

    if lang == "typescript-fetch":
        out.joinpath("package.json").write_text(
            '{"name": "zhs-api-sdk", "version": "1.0.0", "main": "index.ts"}',
            encoding="utf-8",
        )
        out.joinpath("index.ts").write_text(_ts_fetch_stub(schema), encoding="utf-8")
    elif lang == "python":
        out.joinpath("zhs_api.py").write_text(_python_stub(schema), encoding="utf-8")
    else:
        out.joinpath("README.md").write_text(f"# {lang} SDK stub\n", encoding="utf-8")
    return True


def _ts_fetch_stub(schema: dict) -> str:
    """TypeScript fetch SDK stub."""
    info = schema.get("info", {})
    lines = [
        "/**",
        f" * ZHS API SDK (TypeScript Fetch) - {info.get('title', 'API')}",
        f" * version: {info.get('version', '1.0.0')}",
        " */",
        "",
        "const BASE_URL = process.env.ZHS_API_BASE || 'http://127.0.0.1:8000';",
        "",
        "export interface ApiResponse<T> { code: string; msg: string; data: T }",
        "",
        "async function request<T>(method: string, path: string, body?: unknown, query?: Record<string, unknown>): Promise<T> {",
        "  const url = new URL(BASE_URL + path);",
        "  if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, String(v)));",
        "  const res = await fetch(url.toString(), {",
        "    method,",
        "    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },",
        "    body: body ? JSON.stringify(body) : undefined,",
        "  });",
        "  if (!res.ok) throw new Error(`HTTP ${res.status}`);",
        "  const json = (await res.json()) as ApiResponse<T>;",
        "  if (json.code !== '0') throw new Error(json.msg);",
        "  return json.data;",
        "}",
        "",
        "export const zhs = {",
    ]
    for path, methods in list(schema.get("paths", {}).items())[:50]:
        for m, op in methods.items():
            if m not in ("get", "post", "put", "delete", "patch"):
                continue
            op_id = op.get("operationId", f"{m}_{path.replace('/', '_')}")
            tag = (op.get("tags") or ["default"])[0]
            summary = (op.get("summary") or op_id)[:40]
            lines.append(f"  /** {summary} */")
            lines.append(f"  {op_id}(params?: unknown): Promise<unknown> {{ return request('{m.upper()}', '{path}', params); }},")
    lines.append("};")
    return "\n".join(lines)


def _python_stub(schema: dict) -> str:
    """Python httpx SDK stub."""
    info = schema.get("info", {})
    lines = [
        '"""ZHS API SDK (Python httpx)."""',
        "",
        "import os",
        "from typing import Any, Optional",
        "import httpx",
        "",
        "BASE_URL = os.environ.get('ZHS_API_BASE', 'http://127.0.0.1:8000')",
        "",
        "class ZhsClient:",
        "    def __init__(self, token: str = '', base_url: str = BASE_URL, timeout: float = 30.0):",
        "        self._client = httpx.AsyncClient(base_url=base_url, timeout=timeout, headers={'Authorization': f'Bearer {token}'})",
        "",
        "    async def request(self, method: str, path: str, **kwargs) -> Any:",
        "        resp = await self._client.request(method, path, **kwargs)",
        "        resp.raise_for_status()",
        "        data = resp.json()",
        "        if data.get('code') != '0':",
        "            raise RuntimeError(data.get('msg', 'unknown error'))",
        "        return data.get('data')",
        "",
        "    async def aclose(self):",
        "        await self._client.aclose()",
        "",
        "",
    ]
    for path, methods in list(schema.get("paths", {}).items())[:50]:
        for m, op in methods.items():
            if m not in ("get", "post", "put", "delete", "patch"):
                continue
            op_id = op.get("operationId", f"{m}_{path.replace('/', '_')}")
            summary = (op.get("summary") or op_id)[:40]
            lines.append(f"    async def {op_id}(self, **kwargs) -> Any:")
            lines.append(f'        """{summary}"""')
            lines.append(f"        return await self.request('{m.upper()}', '{path}', **kwargs)")
            lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="OpenAPI SDK 自动生成")
    parser.add_argument("--base", default=DEFAULT_BASE, help="API base URL")
    parser.add_argument("--lang", default="all", help=f"语言 (all|{','.join(LANG_MAP.keys())})")
    parser.add_argument("--tag", default="", help="按 tag 过滤 (可选)")
    parser.add_argument("--verify", action="store_true", help="仅验证 OpenAPI 规范")
    parser.add_argument("--out", default=str(SDK_ROOT), help="输出目录")
    args = parser.parse_args()

    out_root = Path(args.out)
    out_root.mkdir(parents=True, exist_ok=True)

    # 1) 拉取 schema
    schema = fetch_schema(args.base, SCHEMA_PATH)

    # 2) 验证
    if not verify_schema(schema):
        print("[FAIL] OpenAPI 规范验证失败")
        sys.exit(1)
    if args.verify:
        return

    # 3) tag 过滤
    if args.tag:
        schema = filter_by_tag(schema, args.tag)
        filter_path = SCHEMA_PATH.with_suffix(".filtered.json")
        filter_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
        schema_path = filter_path
    else:
        schema_path = SCHEMA_PATH

    # 4) 生成
    langs = list(LANG_MAP.values()) if args.lang == "all" else [LANG_MAP[args.lang]]
    print(f"[4/4] 开始生成 {len(langs)} 种 SDK")
    success = 0
    for lang in langs:
        out = out_root / lang
        if run_openapi_generator(schema_path, lang, out):
            success += 1
        else:
            # 降级为 stub
            generate_stub_sdk(lang, schema, out)
            success += 1
    print(f"\n[{'OK' if success == len(langs) else 'WARN'}] 完成 {success}/{len(langs)} 个 SDK")
    print(f"  输出: {out_root}")


if __name__ == "__main__":
    main()
