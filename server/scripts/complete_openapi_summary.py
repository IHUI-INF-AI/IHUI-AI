"""OpenAPI summary 补全脚本.

扫描 /openapi.json 找出缺 summary 的端点, 自动生成友好描述.
策略:
  1. 优先保留显式 summary
  2. 缺 summary 时用 operationId + path 推断 (中文/英文双语)
  3. 缺 operationId 时用 method + path 生成
  4. 缺 description 时用 summary

用法:
  python complete_openapi_summary.py                  # 补全并写回 openapi.json
  python complete_openapi_summary.py --report         # 只统计缺漏
  python complete_openapi_summary.py --lang zh        # 补全用中文
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = ROOT / "openapi.json"
DEFAULT_BASE = "http://127.0.0.1:8000"

# 方法 -> 中文动作
METHOD_ZH = {
    "get": "查询",
    "post": "创建",
    "put": "更新",
    "delete": "删除",
    "patch": "修改",
    "head": "检查",
    "options": "选项",
}

# tag -> 中文名 (用于 summary 头部)
TAG_ZH = {
    "Authentication": "认证",
    "User": "用户",
    "Agent": "智能体",
    "Course": "课程",
    "Order": "订单",
    "Payment": "支付",
    "Chat": "对话",
    "File": "文件",
    "System": "系统",
    "Log": "日志",
    "Mock": "Mock",
    "Statistics": "统计",
    "Health": "健康检查",
}


def parse_path_tokens(path: str) -> list[str]:
    """从路径提取有意义的 token (排除 {param} 和 API 前缀)."""
    parts = re.split(r"[/{}-]+", path)
    tokens = []
    skip = {"api", "v1", "v2", "v3"}
    for p in parts:
        if not p or p.startswith("{") or p in skip:
            continue
        tokens.append(p)
    return tokens


def infer_summary(method: str, path: str, operation: dict, lang: str) -> str:
    """从 path + operationId 推断 summary."""
    if operation.get("summary"):
        return operation["summary"]
    op_id = operation.get("operationId", "")
    tokens = parse_path_tokens(path)
    action = METHOD_ZH.get(method.lower(), method.upper()) if lang == "zh" else method.upper()
    # 从 operationId 拆出动作 (如 get_user_list -> get / user / list)
    if op_id:
        # 替换下划线为空格, 提取主要关键词
        words = re.split(r"[_\s]+", op_id)
        # 过滤方法名重复
        words = [w for w in words if w.lower() != method.lower()]
        if words:
            resource = " ".join(w for w in words[:3] if not w.isdigit())
            if lang == "zh":
                return f"{action}{resource}"
            return f"{action.title()} {resource}".strip()
    if tokens:
        if lang == "zh":
            return f"{action}{''.join(t.title() for t in tokens[:2])}"
        return f"{action.title()} {' '.join(t.title() for t in tokens[:2])}".strip()
    return f"{action.title() if lang != 'zh' else action} {path}"


def infer_description(method: str, path: str, operation: dict, summary: str) -> str:
    """生成更详细的 description."""
    if operation.get("description"):
        return operation["description"]
    op_id = operation.get("operationId", "")
    desc = f"端点: {method.upper()} {path}"
    if op_id:
        desc += f"\n操作 ID: {op_id}"
    if summary:
        desc += f"\n摘要: {summary}"
    return desc


def main():
    parser = argparse.ArgumentParser(description="OpenAPI summary 补全")
    parser.add_argument("--base", default=DEFAULT_BASE, help="API base URL")
    parser.add_argument("--lang", default="zh", choices=["zh", "en"], help="summary 语言")
    parser.add_argument("--report", action="store_true", help="只生成报告, 不修改")
    parser.add_argument("--out", default=str(SCHEMA_PATH), help="输出文件")
    args = parser.parse_args()

    if not SCHEMA_PATH.exists():
        print(f"[ERROR] {SCHEMA_PATH} 不存在, 请先运行 gen_openapi_sdk.py --verify")
        sys.exit(1)

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    paths = schema.get("paths", {})

    stats = {
        "total": 0,
        "has_summary": 0,
        "has_desc": 0,
        "missing_summary": 0,
        "missing_desc": 0,
        "no_tags": 0,
        "by_tag": {},
    }

    fixes = []
    desc_fixes = 0
    for path, methods in paths.items():
        for m, op in methods.items():
            if m not in ("get", "post", "put", "delete", "patch", "head", "options", "trace"):
                continue
            stats["total"] += 1
            tag = (op.get("tags") or ["default"])[0]
            stats["by_tag"].setdefault(tag, {"total": 0, "missing_summary": 0})
            stats["by_tag"][tag]["total"] += 1
            if not op.get("tags"):
                stats["no_tags"] += 1
            if op.get("summary"):
                stats["has_summary"] += 1
            else:
                stats["missing_summary"] += 1
                stats["by_tag"][tag]["missing_summary"] += 1
                if not args.report:
                    op["summary"] = infer_summary(m, path, op, args.lang)
                    fixes.append((m.upper(), path, op["summary"]))
            if op.get("description"):
                stats["has_desc"] += 1
            else:
                stats["missing_desc"] += 1
                if not args.report:
                    op["description"] = infer_description(m, path, op, op.get("summary", ""))
                    desc_fixes += 1

    # 输出报告
    print(f"\n{'=' * 80}")
    print(f"OpenAPI Summary 补全报告 (lang={args.lang})")
    print(f"{'=' * 80}")
    print(f"  总操作数:    {stats['total']}")
    print(f"  有 summary:  {stats['has_summary']} ({stats['has_summary']*100//max(stats['total'],1)}%)")
    print(f"  缺 summary:  {stats['missing_summary']} ({stats['missing_summary']*100//max(stats['total'],1)}%)")
    print(f"  有 desc:     {stats['has_desc']} ({stats['has_desc']*100//max(stats['total'],1)}%)")
    print(f"  缺 desc:     {stats['missing_desc']} ({stats['missing_desc']*100//max(stats['total'],1)}%)")
    print(f"  无 tag:      {stats['no_tags']}")
    print(f"\n  按 tag 统计 (top 15 缺漏):")
    sorted_tags = sorted(stats["by_tag"].items(), key=lambda x: -x[1]["missing_summary"])[:15]
    for tag, t in sorted_tags:
        rate = (t["total"] - t["missing_summary"]) * 100 // max(t["total"], 1)
        print(f"    {tag:<30s}  {t['total']:>4d} 总,  {t['missing_summary']:>4d} 缺 ({rate}% 已覆盖)")
    print(f"{'=' * 80}")

    if args.report:
        return

    # 写回
    if not fixes and desc_fixes == 0:
        print(f"\n[OK] 无需补全")
        return
    print(f"\n[INFO] 补全 {len(fixes)} 个 summary, {desc_fixes} 个 description")
    # 同时展示前 5 个示例
    for m, p, s in fixes[:5]:
        print(f"  [{m}] {p:<60s} -> {s}")
    if len(fixes) > 5:
        print(f"  ... 及其他 {len(fixes)-5} 个")

    out = Path(args.out)
    out.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[OK] 已写入: {out}")


if __name__ == "__main__":
    main()
