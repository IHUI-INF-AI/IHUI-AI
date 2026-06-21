"""OpenAPI Schema 漂移检测 (Phase 5-B).

目的: 防止 API 端点意外移除/改签名(可能引起客户端静默故障).

工作原理:
  1. 调用 create_app() 拉当前 OpenAPI schema
  2. 提取 "signature" = (method, path, request_schema_name, response_2xx_schemas)
  3. 与 baseline 文件 (tests/fixtures/openapi_baseline.json) 对比
  4. 输出新增/删除/签名变化的 endpoint, 退出码 0 (无变化) / 1 (有变化)

用法:
  python scripts/ci/check_openapi_schema_drift.py
  python scripts/ci/check_openapi_schema_drift.py --update   # 把当前 schema 写为 baseline
  python scripts/ci/check_openapi_schema_drift.py --baseline custom.json
  python scripts/ci/check_openapi_schema_drift.py --strict   # 字段级深比, 检测字段增删
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

BASELINE_PATH = ROOT / "tests" / "fixtures" / "openapi_baseline.json"


# ---------------------------------------------------------------------------
# 1. 拉当前 schema
# ---------------------------------------------------------------------------


def fetch_current_schema() -> dict:
    """通过 FastAPI factory 拉当前 OpenAPI schema."""
    from app.main import create_app

    app = create_app()
    return app.openapi()


# ---------------------------------------------------------------------------
# 2. 提取 signature
# ---------------------------------------------------------------------------


def extract_signature(schema: dict, strict: bool = False) -> dict[str, dict]:
    """从 OpenAPI schema 提取每个端点的关键 signature.

    非 strict: 只对比 method/path/req_schema/resp_2xx_schema
    strict:    额外对比每个 schema 内的字段
    """
    sigs = {}
    paths = schema.get("paths", {}) or {}
    for path, methods in paths.items():
        if not isinstance(methods, dict):
            continue
        for method, op in methods.items():
            if method.lower() not in ("get", "post", "put", "patch", "delete", "head", "options"):
                continue
            if not isinstance(op, dict):
                continue
            tag = ",".join(op.get("tags", []) or [])
            req_schema = _ref_name(_request_ref(op))
            resp_schemas = ",".join(
                sorted(
                    f"{code}:{_ref_name(rschema.get('schema') or rschema.get('content', {}).get('application/json', {}).get('schema', {}))}"
                    for code, rschema in (op.get("responses", {}) or {}).items()
                    if code.startswith("2")  # 只看 2xx
                )
            )
            # strict 模式: 把每个 schema 内的 fields 一起 hash
            if strict:
                req_fields = _schema_field_names(schema, req_schema)
                resp_fields = ",".join(
                    sorted(
                        f"{code}:{','.join(_schema_field_names(schema, _ref_name(rschema.get('schema') or rschema.get('content', {}).get('application/json', {}).get('schema', {}))))}"
                        for code, rschema in (op.get("responses", {}) or {}).items()
                        if code.startswith("2")
                    )
                )
                sigs[f"{method.upper()} {path}"] = {
                    "tag": tag,
                    "req_schema": req_schema,
                    "resp_2xx_schemas": resp_schemas,
                    "req_fields": req_fields,
                    "resp_fields": resp_fields,
                }
            else:
                sigs[f"{method.upper()} {path}"] = {
                    "tag": tag,
                    "req_schema": req_schema,
                    "resp_2xx_schemas": resp_schemas,
                }
    return sigs


def _ref_name(obj: Any) -> str:
    if not isinstance(obj, dict) or not obj:
        return ""
    if "$ref" in obj:
        return str(obj["$ref"]).rsplit("/", 1)[-1]
    # 可能是 inline schema, 提取 type
    if "type" in obj:
        return f"inline:{obj.get('type', 'object')}"
    return "inline:unknown"


def _request_ref(op: dict) -> dict:
    body = op.get("requestBody", {}) or {}
    content = body.get("content", {}) or {}
    json_content = content.get("application/json", {}) or {}
    return json_content.get("schema", {}) or {}


def _schema_field_names(schema: dict, ref_name: str) -> list[str]:
    """从 components.schemas.<ref_name>.properties 取字段名列表."""
    if not ref_name or ref_name.startswith("inline:"):
        return []
    components = schema.get("components", {}) or {}
    schemas = components.get("schemas", {}) or {}
    target = schemas.get(ref_name, {}) or {}
    props = target.get("properties", {}) or {}
    return sorted(props.keys())


# ---------------------------------------------------------------------------
# 3. Diff
# ---------------------------------------------------------------------------


def diff_signatures(
    baseline: dict[str, dict],
    current: dict[str, dict],
    whitelist: set[str] | None = None,
) -> dict[str, list]:
    """返回三类差异: added / removed / changed.

    whitelist: 已知会变的端点 (如 mock/wip), 跳过比对不报漂移.

    baseline 不应包含 __meta__ 键 (Phase 8 设计: meta 由 load_baseline_meta 单独加载).
    """
    wl = whitelist or set()
    added = sorted((set(current) - set(baseline)) - wl)
    removed = sorted((set(baseline) - set(current)) - wl)
    changed = []
    for key in set(baseline) & set(current):
        if key in wl:
            continue
        if baseline[key] != current[key]:
            changed.append(
                {
                    "endpoint": key,
                    "before": baseline[key],
                    "after": current[key],
                }
            )
    return {"added": added, "removed": removed, "changed": changed}


# ---------------------------------------------------------------------------
# 4. Baseline 持久化
# ---------------------------------------------------------------------------


def load_baseline(path: Path) -> dict[str, dict]:
    """加载 baseline signatures (不含 meta).

    兼容旧格式 (无 meta 字段) 与新格式 (meta + signatures).
    """
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and "signatures" in data:
        return data["signatures"]
    # 旧格式: 直接 signatures dict
    return data


def load_baseline_meta(path: Path) -> dict:
    """加载 baseline meta (Phase 8 strict 兼容 + Phase 9 whitelist).

    旧格式 (无 meta 字段) 视为 {"strict": False}.
    """
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and "meta" in data:
        meta = data["meta"] or {}
        # 兼容旧 baseline 没有 whitelist 字段
        if "whitelist" not in meta:
            meta["whitelist"] = []
        return meta
    return {"strict": False, "whitelist": []}


def save_baseline(path: Path, signatures: dict[str, dict], meta: dict) -> None:
    # whitelist 持久化: 保留已有 meta.whitelist (如果调用方没传)
    if "whitelist" not in meta:
        try:
            old = load_baseline_meta(path)
            meta["whitelist"] = old.get("whitelist", [])
        except Exception:
            meta["whitelist"] = []
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"meta": meta, "signatures": signatures}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# 5. Main
# ---------------------------------------------------------------------------


def main() -> int:
    p = argparse.ArgumentParser(description="OpenAPI Schema 漂移检测 (Phase 5-B / Phase 8 strict)")
    p.add_argument("--baseline", type=Path, default=BASELINE_PATH, help="baseline 文件路径")
    p.add_argument("--update", action="store_true", help="更新 baseline 并退出")
    p.add_argument("--strict", action="store_true", help="字段级深比 (Phase 8)")
    p.add_argument("--json", action="store_true", help="仅 JSON 输出到 stdout (CI)")
    args = p.parse_args()

    # --json 模式: banner 走 stderr, 让 stdout 纯净
    out = sys.stderr if args.json else sys.stdout

    def _print(msg: str = "") -> None:
        print(msg, file=out)

    _print("=" * 60)
    _print("OpenAPI Schema 漂移检测 (Phase 5-B)")
    _print("=" * 60)

    schema = fetch_current_schema()
    current = extract_signature(schema, strict=args.strict)
    _print(f"\n[Step 1] 当前 API endpoint 签名: {len(current)} 条")

    if args.update:
        save_baseline(
            args.baseline,
            current,
            {
                "strict": args.strict,
                "endpoint_count": len(current),
            },
        )
        _print(f"\n[OK] Baseline 已更新: {args.baseline}")
        return 0

    baseline = load_baseline(args.baseline)
    if not baseline:
        _print(f"\n[WARN]  baseline 不存在或为空: {args.baseline}")
        _print("   首次运行请先: python scripts/ci/check_openapi_schema_drift.py --update")
        return 0  # 不 fail 首次

    # Phase 8: strict baseline 兼容性 / 自适应
    # 避免"baseline 是非 strict 生成的, strict 模式全 655 changed"误报
    # 避免"baseline 是 strict 生成的, 默认模式全 655 changed"误报
    baseline_meta = load_baseline_meta(args.baseline)
    if args.strict and baseline:
        if not baseline_meta.get("strict"):
            _print()
            _print("=" * 60)
            _print("[FAIL] STRICT_BASELINE_INCOMPATIBLE: baseline 不是 strict 模式生成")
            _print("   请先运行: python scripts/ci/check_openapi_schema_drift.py --update --strict")
            _print("=" * 60)
            if args.json:
                print(
                    json.dumps(
                        {
                            "status": "strict_baseline_incompatible",
                            "hint": "请先运行 --update --strict 升级 baseline",
                        },
                        ensure_ascii=False,
                        indent=2,
                    )
                )
            return 1
    else:
        # 默认 (非 strict 显式) 行为: 自适应 baseline 格式
        # baseline 是 strict 生成 -> 自动按 strict 比, 避免 655 changed 误报
        if baseline_meta.get("strict") and not args.strict:
            current = extract_signature(schema, strict=True)
            _print("   (检测到 strict baseline, 自动启用 strict 模式重新比对)")

    _print(f"[Step 2] Baseline endpoint 签名: {len(baseline)} 条")

    # Phase 9: 白名单 (已知会变的端点, 跳过比对)
    whitelist = set(baseline_meta.get("whitelist", []) or [])
    if whitelist:
        _print(f"[Step 2.5] 白名单 endpoint: {len(whitelist)} 条 (跳过比对)")

    diff = diff_signatures(baseline, current, whitelist=whitelist)
    errs = []

    if diff["added"]:
        _print(f"\n[Step 3] 新增 endpoint: {len(diff['added'])} 条")
        for e in diff["added"]:
            _print(f"  + {e}")
        errs.extend([f"新增 endpoint: {e}" for e in diff["added"]])

    if diff["removed"]:
        _print(f"\n[Step 4] 删除 endpoint: {len(diff['removed'])} 条")
        for e in diff["removed"]:
            _print(f"  - {e}")
        errs.extend([f"删除 endpoint: {e}" for e in diff["removed"]])

    if diff["changed"]:
        _print(f"\n[Step 5] 签名变化 endpoint: {len(diff['changed'])} 条")
        for c in diff["changed"]:
            _print(f"  ~ {c['endpoint']}")
            for k in set(c["before"]) | set(c["after"]):
                if c["before"].get(k) != c["after"].get(k):
                    _print(f"      {k}: {c['before'].get(k)} -> {c['after'].get(k)}")
        errs.extend([f"签名变化: {c['endpoint']}" for c in diff["changed"]])

    _print()
    if not errs:
        _print("=" * 60)
        _print(f"[OK] PASS: OpenAPI schema 与 baseline 一致 ({len(current)} endpoints)")
        _print("=" * 60)
        if args.json:
            print(json.dumps({"status": "ok", "endpoints": len(current)}, ensure_ascii=False, indent=2))
        return 0

    _print("=" * 60)
    _print(f"[FAIL] FAIL: {len(errs)} 处漂移")
    _print("=" * 60)
    if args.json:
        print(
            json.dumps(
                {
                    "status": "drift",
                    "added": diff["added"],
                    "removed": diff["removed"],
                    "changed": diff["changed"],
                },
                ensure_ascii=False,
                indent=2,
                default=str,
            )
        )
    return 1


if __name__ == "__main__":
    sys.exit(main())
