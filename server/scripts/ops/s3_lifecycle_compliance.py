"""Phase 17 建议 4: S3 跨桶生命周期合规检查 v5.

目的:
  - 多桶批量合规审计
  - 检测: 公开桶 / 未加密 / 无 lifecycle / 旧版本堆积 / 无 access log / 无跨区复制 / 标签缺失
  - 严重度: CRITICAL/HIGH/MEDIUM/LOW
  - 输出 Markdown 报表 + JSON 摘要

设计:
  ComplianceRule:
    id, name, severity, check_fn(bucket_config) -> list[Finding]

  BucketConfig:
    bucket, region, public_access_block, encryption, lifecycle_rules,
    versioning, replication, logging, tags

  ComplianceChecker:
    按规则集扫所有桶, 产出 Finding
    支持自定义规则

  ComplianceReporter:
    生成 Markdown / JSON 报表
    汇总: 桶总数 / 合规桶数 / 严重度统计 / 修复建议
"""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from enum import Enum

# ---------------------------------------------------------------------------
# 1. 枚举
# ---------------------------------------------------------------------------


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ---------------------------------------------------------------------------
# 2. 数据类
# ---------------------------------------------------------------------------


@dataclass
class Finding:
    """单条不合规项."""

    bucket: str
    rule_id: str
    rule_name: str
    severity: Severity
    message: str
    recommendation: str = ""
    detail: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["severity"] = self.severity.value
        return d


@dataclass
class BucketConfig:
    """S3 桶配置 (从 AWS / 内部 API / JSON 输入聚合)."""

    bucket: str
    region: str = "us-east-1"
    # 公开访问阻止: 4 个 flag (block_public_acls / block_public_policy / ignore_public_acls / restrict_public_buckets)
    public_access_block: dict = field(
        default_factory=lambda: {
            "BlockPublicAcls": True,
            "BlockPublicPolicy": True,
            "IgnorePublicAcls": True,
            "RestrictPublicBuckets": True,
        }
    )
    # bucket policy 中是否含公开权限
    has_public_policy: bool = False
    # 加密: SSE-S3 / SSE-KMS / None
    encryption: str | None = None  # "AES256" / "aws:kms" / None
    # 生命周期规则列表
    lifecycle_rules: list[dict] = field(default_factory=list)
    # 版本控制
    versioning: bool = False
    # 跨区复制
    replication_enabled: bool = False
    # 访问日志
    access_log_target: str | None = None
    # 桶标签
    tags: dict = field(default_factory=dict)
    # 桶大小 (GB) - 用于推荐 lifecycle tier
    size_gb: float = 0.0
    # 对象数
    objects: int = 0


@dataclass
class ComplianceRule:
    """单条合规规则."""

    id: str
    name: str
    severity: Severity
    check_fn: Callable[[BucketConfig], list[Finding]]
    description: str = ""


# ---------------------------------------------------------------------------
# 3. 内置规则集
# ---------------------------------------------------------------------------


def _rule_public_acl(cfg: BucketConfig) -> list[Finding]:
    """检测公开访问."""
    findings = []
    pab = cfg.public_access_block
    flags_off = [k for k, v in pab.items() if not v]
    if flags_off or cfg.has_public_policy:
        findings.append(
            Finding(
                bucket=cfg.bucket,
                rule_id="public-access",
                rule_name="S3 桶不应公开访问",
                severity=Severity.CRITICAL,
                message=f"桶可能被公开访问 (public_block_off={flags_off}, has_public_policy={cfg.has_public_policy})",
                recommendation="启用全部 4 个 PublicAccessBlock, 移除 bucket policy 中 Principal:*",
                detail={"flags_off": flags_off, "has_public_policy": cfg.has_public_policy},
            )
        )
    return findings


def _rule_encryption(cfg: BucketConfig) -> list[Finding]:
    """检测加密."""
    if not cfg.encryption:
        return [
            Finding(
                bucket=cfg.bucket,
                rule_id="no-encryption",
                rule_name="S3 桶必须加密",
                severity=Severity.HIGH,
                message="桶未配置默认加密 (SSE-S3 / SSE-KMS)",
                recommendation="启用 SSE-S3 (AES256) 或 SSE-KMS (合规要求时)",
            )
        ]
    return []


def _rule_lifecycle(cfg: BucketConfig) -> list[Finding]:
    """检测 lifecycle 规则."""
    if not cfg.lifecycle_rules:
        return [
            Finding(
                bucket=cfg.bucket,
                rule_id="no-lifecycle",
                rule_name="S3 桶应配置 lifecycle 策略",
                severity=Severity.MEDIUM,
                message="桶未配置任何 lifecycle 规则, 旧数据长期留存会增加成本",
                recommendation="配置 IA/Glacier 转换 + 过期清理, 至少包含 abort_incomplete_multipart_upload",
            )
        ]
    return []


def _rule_old_versions(cfg: BucketConfig) -> list[Finding]:
    """检测旧版本堆积."""
    if not cfg.versioning:
        return []  # 没启用 versioning 不需要这条规则
    has_noncurrent_expire = any("NoncurrentVersionExpiration" in r for r in cfg.lifecycle_rules)
    if not has_noncurrent_expire:
        return [
            Finding(
                bucket=cfg.bucket,
                rule_id="old-versions-accumulate",
                rule_name="版本化桶应清理旧版本",
                severity=Severity.MEDIUM,
                message="启用了 versioning 但 lifecycle 没配 NoncurrentVersionExpiration, 旧版本会持续累积",
                recommendation="添加 NoncurrentVersionExpiration (建议 30-90 天)",
            )
        ]
    return []


def _rule_access_log(cfg: BucketConfig) -> list[Finding]:
    """检测访问日志."""
    if not cfg.access_log_target:
        return [
            Finding(
                bucket=cfg.bucket,
                rule_id="no-access-log",
                rule_name="生产桶应开启访问日志",
                severity=Severity.LOW,
                message="桶未配置访问日志目标, 审计困难",
                recommendation="指向专用日志桶 (启用 lifecycle 自动归档)",
            )
        ]
    return []


def _rule_replication(cfg: BucketConfig) -> list[Finding]:
    """检测跨区复制 (生产关键桶)."""
    # 仅当桶有 size 且有标签 prod=true 才要求 replication
    is_prod = str(cfg.tags.get("env", "")).lower() == "prod"
    if not is_prod:
        return []
    if not cfg.replication_enabled:
        return [
            Finding(
                bucket=cfg.bucket,
                rule_id="no-replication",
                rule_name="生产桶应跨区复制",
                severity=Severity.HIGH,
                message="生产桶 (env=prod) 未配置跨区复制, 区域级故障会丢数据",
                recommendation="配置 CrossRegionReplication 到备份区域 (启用 versioning + 源/目标 KMS)",
            )
        ]
    return []


def _rule_tags(cfg: BucketConfig) -> list[Finding]:
    """检测必填标签."""
    required = ["project", "env", "owner"]
    missing = [t for t in required if t not in cfg.tags]
    if missing:
        return [
            Finding(
                bucket=cfg.bucket,
                rule_id="missing-tags",
                rule_name="桶标签应包含 project/env/owner",
                severity=Severity.LOW,
                message=f"缺标签: {missing}",
                recommendation="补齐标签, 便于成本归集 / 权限 / 自动化",
                detail={"missing": missing},
            )
        ]
    return []


def _rule_abort_multipart(cfg: BucketConfig) -> list[Finding]:
    """检测 abort incomplete multipart upload 配置."""
    has_abort = any("AbortIncompleteMultipartUpload" in r for r in cfg.lifecycle_rules)
    if not has_abort:
        return [
            Finding(
                bucket=cfg.bucket,
                rule_id="no-abort-multipart",
                rule_name="应清理未完成分片上传",
                severity=Severity.LOW,
                message="lifecycle 缺 AbortIncompleteMultipartUpload, 未完成分片会长期挂账",
                recommendation="添加 AbortIncompleteMultipartUpload (建议 7 天)",
            )
        ]
    return []


DEFAULT_RULES: list[ComplianceRule] = [
    ComplianceRule(
        id="public-access",
        name="S3 桶不应公开访问",
        severity=Severity.CRITICAL,
        check_fn=_rule_public_acl,
        description="防止数据外泄",
    ),
    ComplianceRule(
        id="no-encryption",
        name="S3 桶必须加密",
        severity=Severity.HIGH,
        check_fn=_rule_encryption,
        description="数据静态加密",
    ),
    ComplianceRule(
        id="no-lifecycle",
        name="S3 桶应配置 lifecycle 策略",
        severity=Severity.MEDIUM,
        check_fn=_rule_lifecycle,
        description="控制成本",
    ),
    ComplianceRule(
        id="old-versions-accumulate",
        name="版本化桶应清理旧版本",
        severity=Severity.MEDIUM,
        check_fn=_rule_old_versions,
        description="防止旧版本堆积",
    ),
    ComplianceRule(
        id="no-access-log",
        name="生产桶应开启访问日志",
        severity=Severity.LOW,
        check_fn=_rule_access_log,
        description="审计追溯",
    ),
    ComplianceRule(
        id="no-replication",
        name="生产桶应跨区复制",
        severity=Severity.HIGH,
        check_fn=_rule_replication,
        description="区域级容灾",
    ),
    ComplianceRule(
        id="missing-tags",
        name="桶标签应包含 project/env/owner",
        severity=Severity.LOW,
        check_fn=_rule_tags,
        description="成本归集 / 权限 / 自动化",
    ),
    ComplianceRule(
        id="no-abort-multipart",
        name="应清理未完成分片上传",
        severity=Severity.LOW,
        check_fn=_rule_abort_multipart,
        description="防止分片挂账",
    ),
]


# ---------------------------------------------------------------------------
# 4. ComplianceChecker
# ---------------------------------------------------------------------------


class ComplianceChecker:
    """合规检查器."""

    def __init__(self, rules: list[ComplianceRule] | None = None):
        self.rules = rules if rules is not None else list(DEFAULT_RULES)

    def add_rule(self, rule: ComplianceRule) -> None:
        self.rules.append(rule)

    def check_one(self, cfg: BucketConfig) -> list[Finding]:
        findings: list[Finding] = []
        for r in self.rules:
            try:
                findings.extend(r.check_fn(cfg))
            except Exception as e:  # 规则异常不阻塞其它规则
                findings.append(
                    Finding(
                        bucket=cfg.bucket,
                        rule_id=r.id,
                        rule_name=r.name,
                        severity=Severity.LOW,
                        message=f"规则执行异常: {e}",
                        recommendation="联系规则维护者",
                    )
                )
        return findings

    def check_many(self, configs: list[BucketConfig]) -> dict[str, list[Finding]]:
        out: dict[str, list[Finding]] = {}
        for cfg in configs:
            out[cfg.bucket] = self.check_one(cfg)
        return out

    def summary(self, results: dict[str, list[Finding]]) -> dict:
        total_buckets = len(results)
        compliant = sum(1 for fs in results.values() if len(fs) == 0)
        total_findings = sum(len(fs) for fs in results.values())
        sev_count: dict[str, int] = {s.value: 0 for s in Severity}
        for fs in results.values():
            for f in fs:
                sev_count[f.severity.value] += 1
        return {
            "total_buckets": total_buckets,
            "compliant_buckets": compliant,
            "non_compliant_buckets": total_buckets - compliant,
            "compliance_pct": round(compliant / total_buckets * 100, 2) if total_buckets else 0.0,
            "total_findings": total_findings,
            "by_severity": sev_count,
        }

    def findings_to_list(self, results: dict[str, list[Finding]]) -> list[Finding]:
        out: list[Finding] = []
        for fs in results.values():
            out.extend(fs)
        # 按严重度倒序
        order = {Severity.CRITICAL: 4, Severity.HIGH: 3, Severity.MEDIUM: 2, Severity.LOW: 1}
        out.sort(key=lambda f: (-order[f.severity], f.bucket, f.rule_id))
        return out


# ---------------------------------------------------------------------------
# 5. ComplianceReporter
# ---------------------------------------------------------------------------


class ComplianceReporter:
    """跨桶合规报表."""

    def __init__(self, checker: ComplianceChecker | None = None):
        self.checker = checker or ComplianceChecker()

    def report(self, configs: list[BucketConfig], results: dict[str, list[Finding]]) -> str:
        summary = self.checker.summary(results)
        findings = self.checker.findings_to_list(results)
        lines: list[str] = []
        lines.append("# S3 跨桶生命周期合规报表")
        lines.append("")
        lines.append(f"- 桶总数: **{summary['total_buckets']}**")
        lines.append(f"- 合规桶: **{summary['compliant_buckets']}**")
        lines.append(f"- 不合规桶: **{summary['non_compliant_buckets']}**")
        lines.append(f"- 合规率: **{summary['compliance_pct']:.1f}%**")
        lines.append(f"- Finding 总数: **{summary['total_findings']}**")
        lines.append("")
        lines.append("## 按严重度分布")
        lines.append("")
        lines.append("| 严重度 | 数量 |")
        lines.append("| --- | --- |")
        for sev in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW]:
            lines.append(f"| {sev.value} | {summary['by_severity'][sev.value]} |")
        lines.append("")
        # 不合规桶列表
        non_compliant = [(b, fs) for b, fs in results.items() if fs]
        if non_compliant:
            lines.append("## 不合规桶")
            lines.append("")
            for bucket, fs in non_compliant:
                lines.append(f"### {bucket}")
                lines.append("")
                for f in fs:
                    lines.append(f"- **[{f.severity.value}]** {f.rule_name}: {f.message}")
                    if f.recommendation:
                        lines.append(f"  - 建议: {f.recommendation}")
                lines.append("")
        # 修复优先级
        if findings:
            lines.append("## 修复优先级 (Top 20)")
            lines.append("")
            lines.append("| # | 桶 | 规则 | 严重度 | 描述 | 建议 |")
            lines.append("| --- | --- | --- | --- | --- | --- |")
            for i, f in enumerate(findings[:20], 1):
                rec = f.recommendation.replace("|", "\\|") if f.recommendation else ""
                msg = f.message.replace("|", "\\|")
                lines.append(f"| {i} | {f.bucket} | {f.rule_name} | {f.severity.value} | {msg} | {rec} |")
        return "\n".join(lines) + "\n"

    def to_json(self, configs: list[BucketConfig], results: dict[str, list[Finding]]) -> str:
        summary = self.checker.summary(results)
        findings = self.checker.findings_to_list(results)
        payload = {
            "summary": summary,
            "findings": [f.to_dict() for f in findings],
            "buckets": [asdict(c) for c in configs],
            "generated_at": time.time(),
        }
        return json.dumps(payload, ensure_ascii=False, indent=2, default=str)


# ---------------------------------------------------------------------------
# 6. CLI
# ---------------------------------------------------------------------------


def _demo_configs() -> list[BucketConfig]:
    """演示配置: 包含 1 个完全合规 + 多个不合规."""
    return [
        # 合规桶
        BucketConfig(
            bucket="zhs-prod-logs",
            region="us-east-1",
            public_access_block={
                "BlockPublicAcls": True,
                "BlockPublicPolicy": True,
                "IgnorePublicAcls": True,
                "RestrictPublicBuckets": True,
            },
            has_public_policy=False,
            encryption="aws:kms",
            lifecycle_rules=[
                {
                    "ID": "log-tier",
                    "Status": "Enabled",
                    "Transitions": [{"Days": 30, "StorageClass": "STANDARD_IA"}],
                    "NoncurrentVersionExpiration": {"NoncurrentDays": 30},
                    "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7},
                },
            ],
            versioning=True,
            replication_enabled=True,
            access_log_target="zhs-prod-logs-access",
            tags={"project": "zhs", "env": "prod", "owner": "platform"},
            size_gb=500.0,
            objects=1000000,
        ),
        # 公开访问 + 未加密
        BucketConfig(
            bucket="zhs-public-assets",
            region="us-east-1",
            public_access_block={
                "BlockPublicAcls": False,
                "BlockPublicPolicy": False,
                "IgnorePublicAcls": False,
                "RestrictPublicBuckets": False,
            },
            has_public_policy=True,
            encryption=None,
            lifecycle_rules=[],
            versioning=False,
            replication_enabled=False,
            access_log_target=None,
            tags={},
            size_gb=200.0,
            objects=50000,
        ),
        # 无 lifecycle + 缺标签
        BucketConfig(
            bucket="zhs-prod-backup",
            region="us-west-2",
            encryption="AES256",
            lifecycle_rules=[],
            versioning=True,
            replication_enabled=False,
            access_log_target="zhs-prod-backup-log",
            tags={"project": "zhs"},
            size_gb=2048.0,
            objects=200000,
        ),
    ]


def main(
    argv: list[str] | None = None,
    checker: ComplianceChecker | None = None,
    reporter: ComplianceReporter | None = None,
) -> int:
    import argparse

    p = argparse.ArgumentParser(description="S3 跨桶生命周期合规检查 v5")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_demo = sub.add_parser("demo")
    p_demo.add_argument("--format", default="markdown", choices=["markdown", "json"])

    p_scan = sub.add_parser("scan")
    p_scan.add_argument("--config", required=True, help="JSON 配置文件路径")
    p_scan.add_argument("--format", default="markdown", choices=["markdown", "json"])

    args = p.parse_args(argv)

    chk = checker or ComplianceChecker()
    rep = reporter or ComplianceReporter(chk)

    if args.cmd == "demo":
        configs = _demo_configs()
        results = chk.check_many(configs)
        if args.format == "json":
            print(rep.to_json(configs, results))
        else:
            print(rep.report(configs, results))
        return 0

    if args.cmd == "scan":
        with open(args.config, encoding="utf-8") as f:
            data = json.load(f)
        configs = [BucketConfig(**b) for b in data.get("buckets", [])]
        results = chk.check_many(configs)
        if args.format == "json":
            print(rep.to_json(configs, results))
        else:
            print(rep.report(configs, results))
        return 0

    return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
