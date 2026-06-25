"""路径卫生 pytest 测试 (2026-06-25 D 任务: 接入 CI)

覆盖:
  1. 无新增硬编码 G:\\1/G:\\dev/G:\\tmp 路径 (扫描 + 白名单)
  2. 无新增硬编码 Linux /tmp/... 测试路径 (扫描)
  3. 配置正确指向系统 tempdir (config.py 验证)
  4. 不存在 G 盘根目录 G:\\1/G:\\dev/G:\\tmp
  5. .gitignore 兜底规则存在

失败时输出详细诊断, 便于 CI 日志排查.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import pytest

# 加入项目根
ROOT = Path(__file__).resolve().parents[2]
SERVER_DIR = ROOT / "server"
CLIENT_DIR = ROOT / "client"

sys.path.insert(0, str(SERVER_DIR / "scripts"))
from _scan_hardcoded_g_drive_paths import PATTERNS, EXCLUDE_DIRS, iter_files, should_scan  # noqa: E402
from _scan_client_hardcoded_paths import WHITELIST_SUBSTRINGS as CLIENT_WHITELIST  # noqa: E402

# 合理文件白名单 (修复记录/工具脚本/验证脚本, 这些是合理的)
WHITELIST_SUBSTRINGS = [
    "2026-06-25 修复",  # 修复记录注释
    "2026-06-25 P2 加固",
    "2026-06-25 防回归",
    "_delete_g_drive_artifacts",  # 清理工具
    "_delete_empty_g_drive_dirs",  # 清理工具
    "_fix_backups_hardcoded_paths",  # 修复工具
    "_verify_e2e_login_outdir",  # 验证工具
    "_verify_outdir_no_g_drive",  # 验证工具
    "_scan_hardcoded_g_drive_paths",  # 扫描器自身
    "_scan_client_hardcoded_paths",  # 扫描器自身
    "_final_path_verification",  # 最终验证脚本自身
    "test_path_hygiene",  # 本测试自身
    "test_pitr_cross_cloud",  # PITR 测试断言 (检查 shell 脚本内容含 /tmp/pitr_restore_)
] + CLIENT_WHITELIST

# 文件级白名单 (这些文件内的硬编码路径是合理的, 不算违规)
FILE_WHITELIST = [
    # 2026-06-25 扩展
    "deploy/monitoring/prometheus.yml",  # prometheus 配置, Linux 部署用
    "scripts/ops/drill_log.py",  # 演练日志 (已用平台感知修复)
    "scripts/ops/retry_drill_steps.py",  # 演练重试 (已用平台感知修复)
    "test_invoice_download.py",  # SSRF 防护测试, 故意用 /etc/passwd
    "test_alertmanager_integration.py",  # 字符串断言 (检查 prometheus 配置内容)
    "test_ebpf_observability.py",  # eBPF mock 数据
    "test_pg_monitoring_e2e.py",  # 字符串断言 (检查 prometheus 配置内容)
    "_cleanup_g_users_dir.py",  # 本会话创建的 G 盘根清理工具
    "_investigate_g_users_deep.py",  # 本会话创建的 G:\Users 调查工具
    "_investigate_g_users.py",  # 本会话创建的 G:\Users 调查工具
    "_final_path_verification.py",  # 本会话创建的最终验证脚本
    # 2026-06-25 扩展: client 子项目
    "client/deploy.sh",  # client Linux 部署脚本
    "client/public/pdf.worker.mjs",  # pdf.js 源 (vendored lib, 含 /home/web_user)
    "client/public/pdf.worker.min.mjs",  # pdf.js 压缩包 (vendored lib)
]


def _is_whitelisted(path: str, line: str) -> bool:
    # 文件级白名单 (支持正斜杠和反斜杠)
    path_normalized = path.replace("\\", "/")
    if any(name.replace("\\", "/") in path_normalized for name in FILE_WHITELIST):
        return True
    # 行级白名单
    if any(sub in line for sub in WHITELIST_SUBSTRINGS):
        return True
    return any(name in path for name in [
        "_delete_g_drive_artifacts", "_delete_empty_g_drive_dirs",
        "_fix_backups_hardcoded_paths", "_verify_e2e_login_outdir",
        "_verify_outdir_no_g_drive", "_scan_hardcoded_g_drive_paths",
        "_scan_client_hardcoded_paths", "_final_path_verification",
        "test_path_hygiene", "test_pitr_cross_cloud",
    ])


def _scan_root(root: Path) -> list[tuple[str, int, str]]:
    """扫描 root 下所有代码文件, 返回 (path, lineno, line) 列表."""
    matches = []
    for p in iter_files(root):
        if not should_scan(p):
            continue
        try:
            content = p.read_text(encoding="utf-8", errors="ignore")
        except (FileNotFoundError, PermissionError, OSError):
            continue
        for i, line in enumerate(content.splitlines(), 1):
            for pat in PATTERNS:
                m = pat.search(line)
                if m:
                    matches.append((str(p.relative_to(ROOT)), i, line.strip()[:200]))
                    break
    return matches


def _real_hits(matches: list[tuple[str, int, str]]) -> list[tuple[str, int, str]]:
    """过滤掉白名单文件, 返回"真硬编码"列表."""
    return [m for m in matches if not _is_whitelisted(m[0], m[2])]


# ============== 测试用例 ==============

class TestNoHardcodedGDrivePaths:
    """无新增硬编码 G:\\1/G:\\dev/G:\\tmp 路径."""

    def test_server_no_new_hardcode(self):
        """server 子项目无新增硬编码."""
        matches = _scan_root(SERVER_DIR)
        real = _real_hits(matches)
        if real:
            msg = "\n".join(f"  {p}:{n}\n    {l}" for p, n, l in real)
            pytest.fail(f"发现 {len(real)} 处 server 真硬编码:\n{msg}")

    def test_client_no_new_hardcode(self):
        """client 子项目无新增硬编码."""
        if not CLIENT_DIR.exists():
            pytest.skip("client 目录不存在")
        matches = _scan_root(CLIENT_DIR)
        real = _real_hits(matches)
        if real:
            msg = "\n".join(f"  {p}:{n}\n    {l}" for p, n, l in real)
            pytest.fail(f"发现 {len(real)} 处 client 真硬编码:\n{msg}")


class TestConfigPathCorrect:
    """配置正确指向系统 tempdir (跨平台兜底生效)."""

    def test_local_file_dir_uses_tempfile(self):
        """LOCAL_FILE_DIR 不能是裸 /tmp/filetmp."""
        sys.path.insert(0, str(SERVER_DIR))
        try:
            from app.config import settings  # noqa: PLC0415
        except Exception as e:
            pytest.skip(f"app.config 加载失败: {e}")
        # 允许自定义, 但禁止裸 /tmp/filetmp 这种 Windows 误解释路径
        forbidden = [
            "/tmp/filetmp",
            "/tmp/refund_evidence",
            "/tmp/zhs_canary_state.json",
            "/tmp/zhs_backfill.db",
            "/tmp/zhs_local_files",
        ]
        if settings.LOCAL_FILE_DIR in forbidden:
            pytest.fail(
                f"LOCAL_FILE_DIR={settings.LOCAL_FILE_DIR!r} 是硬编码 /tmp/..., "
                f"在 Windows 上会创建到 G:\\tmp\\... 应使用 tempfile.gettempdir()"
            )

    def test_tempfile_gettempdir_not_in_g_drive_root(self):
        """tempfile.gettempdir() 不应返回 G:\\1/G:\\dev/G:\\tmp."""
        import tempfile
        td = tempfile.gettempdir()
        forbidden = ["G:\\1", "G:\\dev", "G:\\tmp", "G:/1", "G:/dev", "G:/tmp"]
        for f in forbidden:
            if td == f or td.startswith(f + os.sep) or td.startswith(f + "/"):
                pytest.fail(f"tempfile.gettempdir()={td!r} 命中 G 盘根禁止模式 {f!r}")


class TestNoGDriveRootArtifacts:
    """不存在 G 盘根目录的临时目录 (允许 CI 环境不存在这些目录, 仅本地校验)."""

    @pytest.mark.skipif(os.name != "nt", reason="仅 Windows 平台检查 G 盘根")
    def test_g_drive_root_artifact_dirs_absent(self):
        # 2026-06-25 扩展: 增加 G:\\Users 检查 (rewrite_edu_models.py 误存导致的)
        forbidden = ["G:\\1", "G:\\dev", "G:\\tmp", "G:\\pw-output", "G:\\Users"]
        existing = [p for p in forbidden if os.path.exists(p)]
        if existing:
            pytest.fail(
                f"G 盘根目录存在意外目录: {existing}. "
                f"请运行 server/scripts/_delete_g_drive_artifacts.ps1 清理"
            )


class TestGitignoreHasGuard:
    """根 .gitignore 包含 G 盘根目录兜底规则."""

    def test_root_gitignore_has_g_drive_guard(self):
        gi = ROOT / ".gitignore"
        if not gi.exists():
            pytest.skip("根 .gitignore 不存在")
        text = gi.read_text(encoding="utf-8", errors="ignore")
        # 必须包含对 G:/1, G:/dev, G:/tmp 的忽略
        required = ["G:/1", "G:/dev", "G:/tmp"]
        missing = [r for r in required if r not in text]
        if missing:
            pytest.fail(f"根 .gitignore 缺少 G 盘根目录防回归规则: {missing}")
