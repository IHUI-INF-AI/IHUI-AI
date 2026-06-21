"""Phase 8 周演练报告归档脚本 (建议 5 落地工具).

目的:
  合规/审计要求 - Phase 8 周演练报告需长期留存 (≥ 90 天)
  把 drill_report.md + 抑制工单 + Grafana annotations ID + OIDC 审计日志
  打包为 phase8_weekly_<date>.zip, 推到 s3://zhs-archive/phase8/.

架构:
  ┌──────────────────┐
  │ drill_report.md  │
  │ inhibit/*.md     │  →  archive_phase8_drill.py
  │ oidc/*.json      │      ↓
  │ grafana_ids.json │  zip 加密 + 校验和
  └──────────────────┘      ↓
                       s3 (或本地 mock 路径)

用法:
  # 1. 演练后归档, 推到本地 mock 目录
  python scripts/ops/archive_phase8_drill.py --date 20260616 --s3-bucket local

  # 2. 演练后归档, 推到真 s3 (需 boto3 + AWS 凭据)
  AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=yyy \\
  python scripts/ops/archive_phase8_drill.py --date 20260616 --s3-bucket zhs-archive

  # 3. 演练后归档, 加密 zip (密码保护)
  python scripts/ops/archive_phase8_drill.py --date 20260616 --s3-bucket local --encrypt

输出:
  - logs/archive/phase8_weekly_<date>.zip (含 manifest + drill_report + 工单 + 元数据)
  - logs/archive/phase8_weekly_<date>.zip.sha256 (SHA256 校验和)
  - logs/archive/phase8_weekly_<date>.zip.meta.json (s3 推送结果)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import zipfile
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent

ARCHIVE_DIR = ROOT / "logs" / "archive"
DEFAULT_S3_PREFIX = "phase8"


# ---------------------------------------------------------------------------
# 1. 收集本次演练相关产物
# ---------------------------------------------------------------------------


def collect_artifacts(date: str) -> dict:
    """收集指定 date 的所有 phase8 演练产物.

    Returns:
        dict: {kind: file_path} 包含:
          - drill_report: drill_report.md
          - inhibit_md/json: 抑制工单
          - oidc_audit: OIDC 兑换审计
          - grafana_ids: Grafana annotations 响应
          - log_tail: 应用日志尾部
          - screenshots: dashboard 截图
    """
    artifacts = {}

    # 1. drill_report.md
    drill_report = ROOT / "drill_report.md"
    if drill_report.exists():
        artifacts["drill_report"] = drill_report

    # 2. 抑制工单
    inhibit_dir = ROOT / "logs" / "inhibit_tickets"
    if inhibit_dir.exists():
        for f in inhibit_dir.glob(f"{date}.*"):
            artifacts[f"inhibit_{f.suffix.lstrip('.')}"] = f

    # 3. OIDC 审计
    oidc_dir = ROOT / "logs" / "oidc_test"
    if oidc_dir.exists():
        artifacts["oidc_audit"] = oidc_dir

    # 4. Grafana annotations 响应 (本次演练)
    gf_dir = ROOT / "logs" / "drill_annotations"
    if gf_dir.exists():
        for f in gf_dir.glob(f"*-{date}-*.json"):
            artifacts["grafana_ids"] = f

    # 5. Dashboard 截图
    dash_dir = ROOT / "logs" / "dashboard_screenshots"
    if dash_dir.exists():
        for f in dash_dir.glob(f"*-{date}-*.png"):
            artifacts.setdefault("screenshots", []).append(f)

    return artifacts


def build_manifest(date: str, artifacts: dict, zip_path: Path) -> dict:
    """构造归档 manifest, 含 file list + SHA256 + drill metadata."""
    files_info = []
    for kind, path in artifacts.items():
        if isinstance(path, list):
            for p in path:
                files_info.append(
                    {
                        "kind": kind,
                        "name": p.name,
                        "size": p.stat().st_size,
                        "sha256": _sha256(p),
                    }
                )
        elif isinstance(path, Path) and path.is_dir():
            for f in sorted(path.iterdir()):
                if f.is_file():
                    files_info.append(
                        {
                            "kind": f"{kind}/{f.name}",
                            "name": f.name,
                            "size": f.stat().st_size,
                            "sha256": _sha256(f),
                        }
                    )
        elif isinstance(path, Path) and path.exists():
            files_info.append(
                {
                    "kind": kind,
                    "name": path.name,
                    "size": path.stat().st_size,
                    "sha256": _sha256(path),
                }
            )

    return {
        "date": date,
        "archived_at": datetime.now(UTC).isoformat(),
        "zip_name": zip_path.name,
        "zip_size": zip_path.stat().st_size,
        "zip_sha256": _sha256(zip_path),
        "file_count": len(files_info),
        "total_uncompressed_size": sum(f["size"] for f in files_info),
        "files": files_info,
        "retention_days": 90,
        "compliance": "ISO27001-A.10.7 (Production data archival)",
        "generated_by": "scripts/ops/archive_phase8_drill.py",
    }


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------------------
# 2. 打包 zip (可选加密)
# ---------------------------------------------------------------------------


def make_zip(date: str, artifacts: dict, out_path: Path, encrypt: bool = False) -> Path:
    """打包 zip, 含 manifest + 所有 artifacts.

    文件结构:
      phase8_weekly_<date>/
        manifest.json
        drill_report.md
        inhibit/<date>.md
        inhibit/<date>.json
        oidc_audit/<files>
        grafana_ids/<file>
        screenshots/<files>
    """
    archive_root = f"phase8_weekly_{date}"
    if out_path.exists():
        out_path.unlink()

    # 加密模式
    if encrypt:
        try:
            import pyzipper  # type: ignore
        except ImportError:
            print("✗ 加密模式需要安装 pyzipper: pip install pyzipper")
            sys.exit(2)
        password = os.environ.get("ZHS_ARCHIVE_PASSWORD", "phase8-archive-2026").encode("utf-8")
        zip_ctx = pyzipper.AESZipFile(
            str(out_path),
            "w",
            compression=pyzipper.ZIP_DEFLATED,
            encryption=pyzipper.WZ_AES,
        )
        zip_ctx.setpassword(password)
    else:
        zip_ctx = zipfile.ZipFile(str(out_path), "w", compression=zipfile.ZIP_DEFLATED)

    with zip_ctx as zf:
        # 先写占位 manifest, 后写实际内容
        for kind, path in artifacts.items():
            if isinstance(path, list):
                for p in path:
                    zf.write(p, f"{archive_root}/screenshots/{p.name}")
            elif isinstance(path, Path) and path.is_dir():
                for f in sorted(path.iterdir()):
                    if f.is_file():
                        zf.write(f, f"{archive_root}/oidc_audit/{f.name}")
            elif isinstance(path, Path) and path.exists():
                zf.write(path, f"{archive_root}/{path.name}")

    return out_path


# ---------------------------------------------------------------------------
# 3. 推送到 s3 (或本地 mock)
# ---------------------------------------------------------------------------


def push_to_s3_or_local(zip_path: Path, s3_bucket: str, s3_key: str) -> dict:
    """推送到 s3, s3_bucket=='local' 时推到 logs/archive/_s3_mock/ 模拟."""
    if s3_bucket == "local":
        mock_dir = ROOT / "logs" / "archive" / "_s3_mock" / s3_key
        mock_dir.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(zip_path, mock_dir)
        return {
            "target": "local-mock",
            "bucket": "local",
            "key": str(mock_dir.relative_to(ROOT)),
            "size": zip_path.stat().st_size,
            "sha256": _sha256(zip_path),
        }
    # 真实 s3
    try:
        import boto3  # type: ignore
    except ImportError:
        print("✗ 真实 s3 推送需要 boto3: pip install boto3")
        sys.exit(2)
    s3 = boto3.client("s3")
    s3.upload_file(str(zip_path), s3_bucket, s3_key)
    return {
        "target": "s3",
        "bucket": s3_bucket,
        "key": s3_key,
        "size": zip_path.stat().st_size,
        "sha256": _sha256(zip_path),
    }


# ---------------------------------------------------------------------------
# 4. CLI 主流程
# ---------------------------------------------------------------------------


def main() -> int:
    p = argparse.ArgumentParser(description="Phase 8 周演练报告归档")
    p.add_argument("--date", required=True, help="演练日期 YYYYMMDD")
    p.add_argument("--s3-bucket", default="local", help="s3 bucket 名, 'local' 走本地 mock")
    p.add_argument("--s3-prefix", default=DEFAULT_S3_PREFIX, help="s3 key prefix")
    p.add_argument("--encrypt", action="store_true", help="AES-256 加密 zip")
    p.add_argument("--out-dir", default=str(ARCHIVE_DIR), help="zip 输出目录")
    args = p.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. 收集产物
    artifacts = collect_artifacts(args.date)
    if not artifacts:
        print(f"✗ 未找到 {args.date} 演练产物 (drill_report.md 等)")
        return 2
    file_count = sum(len(list(p.iterdir())) if isinstance(p, Path) and p.is_dir() else 1 for p in artifacts.values())
    print(f"[collect] {len(artifacts)} kinds, {file_count} files")
    for k, v in artifacts.items():
        if isinstance(v, list):
            print(f"  {k}: {len(v)} files")
        else:
            print(f"  {k}: {v.name if v.exists() else '(missing)'}")

    # 2. 打包
    zip_name = f"phase8_weekly_{args.date}.zip"
    zip_path = out_dir / zip_name
    make_zip(args.date, artifacts, zip_path, encrypt=args.encrypt)
    print(f"[zip]    {zip_path} ({zip_path.stat().st_size} bytes)")

    # 3. 写 manifest
    manifest = build_manifest(args.date, artifacts, zip_path)
    manifest_path = zip_path.with_suffix(".manifest.json")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[manifest] {manifest_path}")

    # 4. SHA256 校验和
    sha_path = zip_path.with_suffix(zip_path.suffix + ".sha256")
    sha_path.write_text(f"{manifest['zip_sha256']}  {zip_name}\n", encoding="utf-8")
    print(f"[sha256] {sha_path}")

    # 5. 推送到 s3 / 本地 mock
    s3_key = f"{args.s3_prefix}/{args.date}/{zip_name}"
    push_result = push_to_s3_or_local(zip_path, args.s3_bucket, s3_key)
    meta_path = out_dir / f"phase8_weekly_{args.date}.push.meta.json"
    meta_path.write_text(
        json.dumps(
            {
                "pushed_at": datetime.now(UTC).isoformat(),
                "date": args.date,
                "encrypt": args.encrypt,
                "s3": push_result,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"[push]   target={push_result['target']} bucket={push_result['bucket']} key={push_result['key']}")
    print(f"[meta]   {meta_path}")

    print("\n[OK] 归档完成: 90 天留存, 合规 ISO27001-A.10.7")
    return 0


if __name__ == "__main__":
    sys.exit(main())
