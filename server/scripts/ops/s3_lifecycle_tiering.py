"""Phase 10 建议 5: 归档到冷存储分级 — S3 Lifecycle 规则管理.

目的:
  把 config/s3-lifecycle.yml 描述的 3 级存储规则
  (Standard → Glacier Instant → Deep Archive)
  渲染成 S3 PutBucketLifecycleConfiguration 请求 XML,
  支持 dry-run 校验 + 真实应用两种模式.

架构:
  config/s3-lifecycle.yml (规则源)
       ↓ load_rules()
  [{id, prefix, transitions, expiration, ...}, ...]
       ↓ render_s3_xml() / render_terraform()
  S3 API XML / Terraform aws_s3_bucket_lifecycle_configuration

用法:
  # 1. dry-run 校验 (默认, 不连 AWS)
  python scripts/ops/s3_lifecycle_tiering.py --config config/s3-lifecycle.yml

  # 2. 渲染 S3 XML 到文件
  python scripts/ops/s3_lifecycle_tiering.py --render-xml --output lifecycle.xml

  # 3. 渲染 Terraform 到文件
  python scripts/ops/s3_lifecycle_tiering.py --render-tf --output lifecycle.tf

  # 4. 应用到真 S3 (需 boto3 + AWS 凭据)
  AWS_PROFILE=zhs python scripts/ops/s3_lifecycle_tiering.py \\
      --bucket zhs-archive --apply
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

import yaml

# 配置路径
ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_CONFIG = ROOT / "config" / "s3-lifecycle.yml"


def load_rules(config_path: Path) -> list[dict[str, Any]]:
    """加载 lifecycle YAML 规则."""
    if not config_path.exists():
        raise FileNotFoundError(f"配置文件不存在: {config_path}")
    data = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    rules = data.get("rules", [])
    if not rules:
        raise ValueError(f"配置文件无 rules 字段: {config_path}")
    return rules


def validate_rules(rules: list[dict[str, Any]]) -> list[str]:
    """静态校验: id + prefix/filter 必填, transitions days 升序."""
    errors = []
    seen_ids = set()
    for i, r in enumerate(rules):
        rid = r.get("id")
        if not rid:
            errors.append(f"rule[{i}].id 缺失")
            continue
        if rid in seen_ids:
            errors.append(f"rule id 重复: {rid}")
        seen_ids.add(rid)
        # prefix 或 filter 必含其一
        has_prefix = bool(r.get("prefix"))
        has_filter = bool(r.get("filter"))
        if not has_prefix and not has_filter:
            errors.append(f"rule[{rid}] 必含 prefix 或 filter 之一")
        transitions = r.get("transitions", [])
        prev_days = 0
        for t in transitions:
            days = t.get("days")
            if days is None or days <= prev_days:
                errors.append(f"rule[{rid}].transitions days 必升序, 当前 {days} 之前 {prev_days}")
            prev_days = days or prev_days
            if not t.get("storage_class"):
                errors.append(f"rule[{rid}].transitions.storage_class 缺失")
    return errors


def render_s3_xml(rules: list[dict[str, Any]]) -> str:
    """渲染 S3 PutBucketLifecycleConfiguration 请求 XML."""
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<LifecycleConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">',
    ]
    for r in rules:
        lines.append("  <Rule>")
        lines.append(f"    <ID>{r['id']}</ID>")
        lines.append(f"    <Status>{'Enabled' if r.get('status', 'Enabled') == 'Enabled' else 'Disabled'}</Status>")
        # 优先用 Filter (tag-based), 否则用 Prefix
        if "filter" in r:
            f = r["filter"]
            lines.append("    <Filter>")
            if "prefix" in f:
                lines.append(f"      <Prefix>{f['prefix']}</Prefix>")
            if "tags" in f:
                for tk, tv in f["tags"].items():
                    lines.append("      <Tag>")
                    lines.append(f"        <Key>{tk}</Key>")
                    lines.append(f"        <Value>{tv}</Value>")
                    lines.append("      </Tag>")
            lines.append("    </Filter>")
        else:
            lines.append(f"    <Prefix>{r['prefix']}</Prefix>")
        for t in r.get("transitions", []):
            lines.append("    <Transition>")
            lines.append(f"      <Days>{t['days']}</Days>")
            lines.append(f"      <StorageClass>{t['storage_class']}</StorageClass>")
            lines.append("    </Transition>")
        if "expiration" in r:
            lines.append("    <Expiration>")
            lines.append(f"      <Days>{r['expiration']['days']}</Days>")
            lines.append("    </Expiration>")
        if "abort_incomplete_multipart_upload" in r:
            lines.append("    <AbortIncompleteMultipartUpload>")
            lines.append(
                f"      <DaysAfterInitiation>{r['abort_incomplete_multipart_upload']['days']}</DaysAfterInitiation>"
            )
            lines.append("    </AbortIncompleteMultipartUpload>")
        if "noncurrent_version_expiration" in r:
            lines.append("    <NoncurrentVersionExpiration>")
            lines.append(
                f"      <NoncurrentDays>{r['noncurrent_version_expiration']['noncurrent_days']}</NoncurrentDays>"
            )
            lines.append("    </NoncurrentVersionExpiration>")
        lines.append("  </Rule>")
    lines.append("</LifecycleConfiguration>")
    return "\n".join(lines)


def render_terraform(rules: list[dict[str, Any]]) -> str:
    """渲染 Terraform aws_s3_bucket_lifecycle_configuration 块."""
    blocks = []
    for r in rules:
        transitions_tf = ""
        for t in r.get("transitions", []):
            transitions_tf += (
                f"      transition {{\n"
                f"        days          = {t['days']}\n"
                f"        storage_class = \"{t['storage_class']}\"\n"
                f"      }}\n"
            )
        expiration_tf = ""
        if "expiration" in r:
            expiration_tf = f"      expiration {{ days = {r['expiration']['days']} }}\n"
        abort_tf = ""
        if "abort_incomplete_multipart_upload" in r:
            abort_tf = (
                f"      abort_incomplete_multipart_upload {{\n"
                f"        days_after_initiation = {r['abort_incomplete_multipart_upload']['days']}\n"
                f"      }}\n"
            )
        noncur_tf = ""
        if "noncurrent_version_expiration" in r:
            noncur_tf = (
                f"      noncurrent_version_expiration {{\n"
                f"        noncurrent_days = {r['noncurrent_version_expiration']['noncurrent_days']}\n"
                f"      }}\n"
            )
        # filter vs prefix
        if "filter" in r:
            f = r["filter"]
            filter_lines = "      filter {\n"
            if "prefix" in f:
                filter_lines += f"        prefix = \"{f['prefix']}\"\n"
            if "tags" in f:
                filter_lines += "        tags = {\n"
                for tk, tv in f["tags"].items():
                    filter_lines += f'          "{tk}" = "{tv}"\n'
                filter_lines += "        }\n"
            filter_lines += "      }\n"
        else:
            filter_lines = f"      prefix = \"{r['prefix']}\"\n"
        blocks.append(
            f"  rule {{\n"
            f"    id     = \"{r['id']}\"\n"
            f"    status = \"{r.get('status', 'Enabled')}\"\n"
            f"{filter_lines}"
            f"{transitions_tf}"
            f"{expiration_tf}"
            f"{abort_tf}"
            f"{noncur_tf}"
            f"  }}"
        )
    inner = "\n".join(blocks)
    return (
        f'resource "aws_s3_bucket_lifecycle_configuration" "zhs_archive" {{\n'
        f'  bucket = "zhs-archive"\n'
        f"  depends_on = [aws_s3_bucket.zhs_archive]\n\n"
        f"{inner}\n"
        f"}}\n"
    )


def _rule_to_api(r: dict[str, Any]) -> dict[str, Any]:
    """把 YAML rule 转 boto3 API dict.

    boto3 要求:
      - 单条件 (只有 prefix 或只有 tag) 直接放 Filter
      - 多条件 (prefix + tag) 用 Filter.And 包装
    """
    api_rule: dict[str, Any] = {
        "ID": r["id"],
        "Status": r.get("status", "Enabled"),
    }
    if "filter" in r:
        f = r["filter"]
        has_prefix = "prefix" in f
        tag_pairs = list(f.get("tags", {}).items()) if f.get("tags") else []
        has_tags = bool(tag_pairs)
        if has_prefix and has_tags:
            # 多条件 → And 包装 (And 内用 Tags 复数)
            api_filter: dict[str, Any] = {
                "And": {
                    "Prefix": f["prefix"],
                    "Tags": [{"Key": k, "Value": v} for k, v in tag_pairs],
                }
            }
        elif has_prefix:
            api_filter = {"Prefix": f["prefix"]}
        elif has_tags:
            # 顶层 Filter.Tag 必为 dict (单 tag), 多 tag 走 And
            if len(tag_pairs) == 1:
                k, v = tag_pairs[0]
                api_filter = {"Tag": {"Key": k, "Value": v}}
            else:
                api_filter = {"Tags": [{"Key": k, "Value": v} for k, v in tag_pairs]}
        else:
            api_filter = {}
        api_rule["Filter"] = api_filter
    else:
        api_rule["Prefix"] = r["prefix"]
    api_rule["Transitions"] = [
        {"Days": t["days"], "StorageClass": t["storage_class"]} for t in r.get("transitions", [])
    ] or None
    if api_rule["Transitions"] is None:
        api_rule.pop("Transitions")
    if "expiration" in r:
        api_rule["Expiration"] = {"Days": r["expiration"]["days"]}
    if "abort_incomplete_multipart_upload" in r:
        api_rule["AbortIncompleteMultipartUpload"] = {
            "DaysAfterInitiation": r["abort_incomplete_multipart_upload"]["days"]
        }
    return api_rule


def apply_to_s3(rules: list[dict[str, Any]], bucket: str, endpoint_url: str | None = None) -> dict[str, Any]:
    """应用到真实 S3 (需 boto3).

    Args:
        rules: 规则列表
        bucket: 桶名
        endpoint_url: 可选, 自定义 endpoint (LocalStack / moto server / MinIO)
    """
    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError("应用 S3 lifecycle 需 boto3: pip install boto3") from exc
    kwargs = {"region_name": os.environ.get("AWS_DEFAULT_REGION", "us-east-1")}
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    client = boto3.client("s3", **kwargs)
    lcc = {"Rules": [_rule_to_api(r) for r in rules]}
    resp = client.put_bucket_lifecycle_configuration(Bucket=bucket, LifecycleConfiguration=lcc)
    return {"bucket": bucket, "rules_count": len(rules), "http": resp.get("ResponseMetadata", {}).get("HTTPStatusCode")}


def main() -> int:
    parser = argparse.ArgumentParser(description="S3 归档冷存储分级 lifecycle 管理")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="lifecycle YAML 路径")
    parser.add_argument("--render-xml", action="store_true", help="渲染 S3 XML 到 --output")
    parser.add_argument("--render-tf", action="store_true", help="渲染 Terraform 到 --output")
    parser.add_argument("--output", type=Path, help="渲染输出路径")
    parser.add_argument("--apply", action="store_true", help="应用到真实 S3")
    parser.add_argument("--bucket", default="zhs-archive", help="S3 桶名")
    parser.add_argument(
        "--endpoint-url", default=os.environ.get("AWS_ENDPOINT_URL", ""), help="自定义 endpoint (LocalStack/moto/MinIO)"
    )
    args = parser.parse_args()

    rules = load_rules(args.config)
    errors = validate_rules(rules)
    if errors:
        print("配置校验失败:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    print(f"[ok] 加载 {len(rules)} 条 lifecycle 规则, 校验通过")

    if args.render_xml:
        xml = render_s3_xml(rules)
        if args.output:
            args.output.write_text(xml, encoding="utf-8")
            print(f"[ok] S3 XML 已写入: {args.output}")
        else:
            print(xml)
        return 0

    if args.render_tf:
        tf = render_terraform(rules)
        if args.output:
            args.output.write_text(tf, encoding="utf-8")
            print(f"[ok] Terraform 已写入: {args.output}")
        else:
            print(tf)
        return 0

    if args.apply:
        result = apply_to_s3(rules, args.bucket, endpoint_url=args.endpoint_url or None)
        print(f"[ok] lifecycle 已应用: {result}")
        return 0

    # 默认: dry-run 概要
    print(f"[dry-run] 桶={args.bucket}, 规则数={len(rules)}")
    for r in rules:
        transitions_str = ", ".join(f"{t['days']}d→{t['storage_class']}" for t in r.get("transitions", []))
        expire_str = f", expire={r['expiration']['days']}d" if "expiration" in r else ""
        print(f"  - {r['id']:30s} prefix={r.get('prefix', ''):25s} {transitions_str}{expire_str}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
