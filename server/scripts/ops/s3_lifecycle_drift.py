"""Phase 13 建议 3: S3 Lifecycle 漂移检测.

目的:
  对比 config/s3-lifecycle.yml 描述的规则与线上 S3 实际配置,
  输出 add / delete / modify 三类漂移. 用于:
  1. CI: PR 提交时检测规则变更
  2. 巡检: 定期跑确认线上与配置一致
  3. 故障定位: 排查规则未生效

设计:
  1. load_yaml_rules(path)        读 YAML
  2. fetch_live_rules(client, bkt)  boto3 拉线上
  3. compare(yaml, live)          输出 DriftItem 列表
  4. format_human / format_json / format_markdown  三种输出

用法:
  # 1. 比对并打印人类可读
  python scripts/ops/s3_lifecycle_drift.py --config config/s3-lifecycle.yml --bucket zhs-archive

  # 2. 输出 JSON
  python scripts/ops/s3_lifecycle_drift.py --config ... --bucket ... --json

  # 3. 输出 Markdown (供 PR comment)
  python scripts/ops/s3_lifecycle_drift.py --config ... --bucket ... --markdown > diff.md

  # 4. CI 模式: 漂移>0 时 exit 1
  python scripts/ops/s3_lifecycle_drift.py --config ... --bucket ... --strict
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# 复用 s3_lifecycle_tiering 模块的 _rule_to_api / load_rules / validate_rules
_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT / "scripts" / "ops"))

from s3_lifecycle_tiering import _rule_to_api, load_rules, validate_rules  # noqa: E402

# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------

ACTION_ADD = "add"
ACTION_DELETE = "delete"
ACTION_MODIFY = "modify"


@dataclass
class DriftItem:
    """单条漂移."""

    rule_id: str
    action: str  # add / delete / modify
    yaml_rule: dict[str, Any] | None = None
    live_rule: dict[str, Any] | None = None
    diff_fields: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "action": self.action,
            "diff_fields": self.diff_fields,
            "yaml": self.yaml_rule,
            "live": self.live_rule,
        }


# ---------------------------------------------------------------------------
# 关键字段比较 (boto3 API dict 归一化后)
# ---------------------------------------------------------------------------

# 比较时忽略这些字段 (S3 自动填充或不影响行为)
_IGNORED_FIELDS = {"Status"}  # 状态不影响数据保留行为 (但保留 Modify 检测)


# 子结构归一化: list 按 Key 排序
def _normalize(obj: Any) -> Any:
    """递归归一化以便比较."""
    if isinstance(obj, dict):
        return {k: _normalize(obj[k]) for k in sorted(obj.keys())}
    if isinstance(obj, list):
        if not obj:
            return []  # 空 list
        # 对 Tags/Transitions 等 list, 按某个稳定 key 排序
        if isinstance(obj[0], dict):
            sort_key = None
            sort_key_is_int = False
            # 优先按 Days (transitions 用), 再 Key/ID/StorageClass
            for cand in ("Days", "Key", "ID", "StorageClass"):
                if cand in obj[0]:
                    sort_key = cand
                    sort_key_is_int = isinstance(obj[0][cand], int)
                    break
            if sort_key:
                if sort_key_is_int:
                    obj = sorted(obj, key=lambda x: int(x.get(sort_key, 0) or 0))
                else:
                    obj = sorted(obj, key=lambda x: (str(x.get(sort_key, "")), str(x.get("Value", ""))))
        return [_normalize(x) for x in obj]
    return obj


def _diff_fields(yaml_api: dict, live_api: dict) -> list[str]:
    """对比两个 boto3 API dict, 返回有差异的字段名列表."""
    yaml_n = _normalize(yaml_api)
    live_n = _normalize(live_api)
    fields: list[str] = []
    all_keys = set(yaml_n.keys()) | set(live_n.keys())
    for k in sorted(all_keys):
        if k in _IGNORED_FIELDS:
            continue
        if yaml_n.get(k) != live_n.get(k):
            fields.append(k)
    return fields


# ---------------------------------------------------------------------------
# 拉线上规则
# ---------------------------------------------------------------------------


def fetch_live_rules(s3_client, bucket: str) -> list[dict[str, Any]]:
    """用 boto3 拉线上 lifecycle 规则, 归一化为 API dict 列表.

    返回 list[dict] 与 _rule_to_api() 输出格式一致.
    """
    try:
        resp = s3_client.get_bucket_lifecycle_configuration(Bucket=bucket)
    except Exception as e:
        # 桶无 lifecycle 配置时, boto3 抛 ClientError
        code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
        if code in ("NoSuchLifecycleConfiguration", "NoSuchBucket"):
            return []
        raise
    rules: list[dict[str, Any]] = []
    for r in resp.get("Rules", []):
        # boto3 返回的字段名大写 (ID, Status, Filter, ...)
        rules.append(dict(r))
    return rules


# ---------------------------------------------------------------------------
# 核心比对
# ---------------------------------------------------------------------------


def compare(
    yaml_rules: list[dict[str, Any]],
    live_rules: list[dict[str, Any]],
) -> list[DriftItem]:
    """对比 YAML 规则与线上规则, 返回 DriftItem 列表."""
    # 转 API dict, 以 id 为 key
    yaml_by_id: dict[str, dict[str, Any]] = {}
    for r in yaml_rules:
        api = _rule_to_api(r)
        yaml_by_id[api["ID"]] = api

    live_by_id: dict[str, dict[str, Any]] = {}
    for r in live_rules:
        live_by_id[r["ID"]] = r

    items: list[DriftItem] = []
    # add / modify
    for rid, yrule in yaml_by_id.items():
        if rid not in live_by_id:
            items.append(
                DriftItem(
                    rule_id=rid,
                    action=ACTION_ADD,
                    yaml_rule=yrule,
                )
            )
        else:
            lrule = live_by_id[rid]
            diffs = _diff_fields(yrule, lrule)
            if diffs:
                items.append(
                    DriftItem(
                        rule_id=rid,
                        action=ACTION_MODIFY,
                        yaml_rule=yrule,
                        live_rule=lrule,
                        diff_fields=diffs,
                    )
                )
    # delete
    for rid, lrule in live_by_id.items():
        if rid not in yaml_by_id:
            items.append(
                DriftItem(
                    rule_id=rid,
                    action=ACTION_DELETE,
                    live_rule=lrule,
                )
            )
    # 排序: add → modify → delete, 同类按 rule_id
    order = {ACTION_ADD: 0, ACTION_MODIFY: 1, ACTION_DELETE: 2}
    items.sort(key=lambda x: (order.get(x.action, 99), x.rule_id))
    return items


# ---------------------------------------------------------------------------
# 输出格式
# ---------------------------------------------------------------------------


def format_human(items: list[DriftItem]) -> str:
    """人类可读格式."""
    if not items:
        return "✓ 无漂移: 线上 S3 lifecycle 与 YAML 配置一致\n"
    lines = [f"⚠ 发现 {len(items)} 条漂移:"]
    for it in items:
        if it.action == ACTION_ADD:
            lines.append(f"  + [ADD]    {it.rule_id}  (YAML 有, 线上无)")
        elif it.action == ACTION_DELETE:
            lines.append(f"  - [DELETE] {it.rule_id}  (线上有, YAML 无)")
        elif it.action == ACTION_MODIFY:
            lines.append(f"  ~ [MODIFY] {it.rule_id}  字段差异: {', '.join(it.diff_fields)}")
    return "\n".join(lines) + "\n"


def format_json(items: list[DriftItem]) -> str:
    """JSON 格式."""
    return json.dumps(
        {
            "drift_count": len(items),
            "items": [it.to_dict() for it in items],
        },
        ensure_ascii=False,
        indent=2,
    )


def format_markdown(items: list[DriftItem], bucket: str) -> str:
    """Markdown 格式 (供 PR comment)."""
    if not items:
        return f"## ✓ S3 Lifecycle 漂移检测: 无漂移\n\n桶 `{bucket}` 与 YAML 配置完全一致.\n"
    lines = [
        f"## ⚠ S3 Lifecycle 漂移检测: 发现 {len(items)} 条差异",
        "",
        f"桶: `{bucket}`",
        "",
        "| 操作 | 规则 ID | 差异字段 |",
        "| --- | --- | --- |",
    ]
    for it in items:
        sym = {"add": "➕", "delete": "➖", "modify": "✏️"}.get(it.action, "?")
        diff = ", ".join(it.diff_fields) if it.diff_fields else "-"
        lines.append(f"| {sym} {it.action.upper()} | `{it.rule_id}` | {diff} |")
    lines.append("")
    lines.append("> 运行 `python scripts/ops/s3_lifecycle_tiering.py --apply` 同步线上.")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _boto3_client(endpoint_url: str | None = None):
    import boto3

    kwargs: dict[str, Any] = {"region_name": os.environ.get("AWS_DEFAULT_REGION", "us-east-1")}
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    return boto3.client("s3", **kwargs)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="S3 Lifecycle 漂移检测: 线上 vs YAML",
    )
    parser.add_argument("--config", type=Path, required=True, help="YAML 配置路径")
    parser.add_argument("--bucket", required=True, help="S3 桶名")
    parser.add_argument("--endpoint-url", default=os.environ.get("AWS_ENDPOINT_URL", ""), help="自定义 endpoint")
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    parser.add_argument("--markdown", action="store_true", help="输出 Markdown")
    parser.add_argument("--strict", action="store_true", help="发现漂移时 exit 1 (CI 用)")
    args = parser.parse_args(argv)

    try:
        yaml_rules = load_rules(args.config)
    except Exception as e:
        print(f"[error] 加载 YAML 失败: {e}", file=sys.stderr)
        return 2

    errors = validate_rules(yaml_rules)
    if errors:
        print(f"[error] YAML 校验失败: {errors}", file=sys.stderr)
        return 2

    try:
        client = _boto3_client(args.endpoint_url or None)
        live_rules = fetch_live_rules(client, args.bucket)
    except Exception as e:
        print(f"[error] 拉线上规则失败: {e}", file=sys.stderr)
        return 3

    items = compare(yaml_rules, live_rules)

    if args.json:
        print(format_json(items))
    elif args.markdown:
        print(format_markdown(items, args.bucket))
    else:
        print(format_human(items))

    if args.strict and items:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
