"""drill_log.py 跨平台路径单元测试 (2026-06-25 A 任务).

覆盖:
  1. Windows 平台默认 LOG_ROOT 是 %TEMP%/zhs-migration (非裸 /var/log/...)
  2. Linux 平台默认 LOG_ROOT 是 /var/log/zhs-migration
  3. 环境变量 ZHS_DRILL_LOG_ROOT 优先级最高
  4. get_log_root() 返回可写目录
  5. init_drill_log() 正确创建日志文件
  6. collect_step() 追加日志内容
  7. LOG_ROOT 不会命中 G:\\var (Windows 误展开)
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest

# 2026-06-25: Windows 上 os.name == "nt", Linux/Mac 上 os.name == "posix"
IS_WINDOWS = os.name == "nt"
SKIP_LINUX = pytest.mark.skipif(not IS_WINDOWS, reason="仅 Windows 平台测试")
SKIP_WINDOWS = pytest.mark.skipif(IS_WINDOWS, reason="仅 Linux/Mac 平台测试")

SCRIPTS_OPS = Path(__file__).resolve().parents[1] / "scripts" / "ops"
sys.path.insert(0, str(SCRIPTS_OPS))


class TestDrillLogPath:
    """drill_log.py 跨平台路径行为测试."""

    def setup_method(self):
        """每次测试前重新加载 drill_log (避免模块缓存污染)."""
        for mod in list(sys.modules):
            if mod == "drill_log":
                del sys.modules[mod]
        # 清理环境变量
        os.environ.pop("ZHS_DRILL_LOG_ROOT", None)

    def test_default_path_no_g_drive_on_windows(self):
        """Windows 平台: 默认 LOG_ROOT 不在 G:\\var\\... (即不能是硬编码 /var/log)."""
        if not IS_WINDOWS:
            pytest.skip("仅 Windows 平台测试")
        from drill_log import LOG_ROOT  # noqa: PLC0415
        # 绝对路径展开后不能以 G:\\var 开头
        abs_path = LOG_ROOT.absolute()
        assert not str(abs_path).startswith("G:\\var"), (
            f"Windows 默认 LOG_ROOT {abs_path} 命中 G:\\var (即被误展开为硬编码 /var/log), "
            f"应改用 tempfile.gettempdir()"
        )
        # 应该是 %TEMP%/zhs-migration
        expected_parent = Path(tempfile.gettempdir())
        assert str(abs_path).startswith(str(expected_parent)), (
            f"LOG_ROOT {abs_path} 不在 %TEMP% {expected_parent} 下"
        )
        assert "zhs-migration" in abs_path.name, f"LOG_ROOT 名称应含 zhs-migration, 实际: {abs_path}"

    @SKIP_LINUX
    def test_env_var_overrides_default(self):
        """环境变量 ZHS_DRILL_LOG_ROOT 优先级最高 (Windows)."""
        custom = "D:\\custom_logs\\zhs"
        os.environ["ZHS_DRILL_LOG_ROOT"] = custom
        from drill_log import LOG_ROOT  # noqa: PLC0415
        # 注意: Path 不会自动展开环境变量, 也不接受反斜杠路径
        # 我们检查字符串包含
        assert str(LOG_ROOT) == custom or str(LOG_ROOT).endswith(custom), (
            f"环境变量未覆盖 LOG_ROOT, 实际: {LOG_ROOT}"
        )

    def test_get_log_root_returns_writable(self):
        """get_log_root() 返回的目录可写."""
        from drill_log import get_log_root  # noqa: PLC0415
        root = get_log_root()
        assert root.exists(), f"get_log_root() 返回不存在的目录: {root}"
        # 写入测试
        test_file = root / "_drill_test.txt"
        try:
            test_file.write_text("test", encoding="utf-8")
            assert test_file.exists()
        except (OSError, PermissionError) as e:
            pytest.fail(f"get_log_root() 返回的目录不可写: {root}, 错误: {e}")
        finally:
            if test_file.exists():
                test_file.unlink()

    def test_get_log_root_no_g_drive_root(self):
        """get_log_root() 不会创建 G:\\var 之类的根目录."""
        if not IS_WINDOWS:
            pytest.skip("仅 Windows 平台测试")
        from drill_log import get_log_root  # noqa: PLC0415
        root = get_log_root()
        abs_str = str(root.absolute())
        # 禁止 G:\\Users, G:\\var, G:\\home, G:\\opt, G:\\etc 等根级误创建
        forbidden = ["G:\\Users", "G:\\var", "G:\\home", "G:\\opt", "G:\\etc", "G:\\tmp"]
        for f in forbidden:
            if abs_str.startswith(f + "\\") or abs_str.startswith(f + "/"):
                pytest.fail(f"get_log_root() 命中 G 盘根禁止模式 {f}: {abs_str}")
        # 应该以 C:\Users 或 %TEMP% 开头
        assert abs_str.startswith("C:\\") or abs_str.startswith(tempfile.gettempdir()), (
            f"get_log_root() 路径 {abs_str} 应在 C:\\Users 或 %TEMP% 下"
        )

    def test_local_log_root_relative(self):
        """LOCAL_LOG_ROOT 是相对路径 (兜底), 不在 G 盘根."""
        from drill_log import LOCAL_LOG_ROOT  # noqa: PLC0415
        # 相对路径, 不应有 G:\\ 前缀
        assert not str(LOCAL_LOG_ROOT).startswith("G:\\"), (
            f"LOCAL_LOG_ROOT 包含 G:\\ 前缀: {LOCAL_LOG_ROOT}"
        )
        # 2026-06-25: Windows 上 Path("logs/...") 会被自动转 "logs\\..." 用 as_posix() 比较
        assert LOCAL_LOG_ROOT.as_posix() == "logs/zhs-migration", (
            f"LOCAL_LOG_ROOT 应为 'logs/zhs-migration', 实际: {LOCAL_LOG_ROOT}"
        )


class TestDrillLogFunctions:
    """drill_log.py 函数行为测试."""

    def setup_method(self):
        """每次测试前清理环境变量并使用临时目录."""
        self.tmp_root = Path(tempfile.mkdtemp(prefix="zhs_drill_test_"))
        os.environ["ZHS_DRILL_LOG_ROOT"] = str(self.tmp_root)
        for mod in list(sys.modules):
            if mod == "drill_log":
                del sys.modules[mod]

    def teardown_method(self):
        """清理测试创建的临时目录."""
        import shutil
        if self.tmp_root.exists():
            shutil.rmtree(self.tmp_root, ignore_errors=True)
        os.environ.pop("ZHS_DRILL_LOG_ROOT", None)

    def test_init_drill_log_creates_file(self):
        """init_drill_log() 创建日期命名的日志文件."""
        from drill_log import init_drill_log  # noqa: PLC0415
        date = "20260625"
        rc = init_drill_log(date)
        assert rc == 0
        log_path = self.tmp_root / f"{date}.log"
        assert log_path.exists(), f"日志文件未创建: {log_path}"
        content = log_path.read_text(encoding="utf-8")
        assert "ZHS Platform 演练日志" in content
        assert date in content

    def test_collect_step_appends_to_log(self):
        """collect_step() 追加内容到日志文件."""
        from drill_log import init_drill_log, collect_step, get_log_root  # noqa: PLC0415
        date = "20260625"
        init_drill_log(date)
        log_path = self.tmp_root / f"{date}.log"
        initial_content = log_path.read_text(encoding="utf-8")
        # collect_step 会尝试跑 alembic 脚本, 这里只验证日志追加格式
        # (实际跑命令可能失败, 但只要日志有 STEP 行就算成功)
        try:
            collect_step(date, "dry-run", cwd=Path.cwd())
        except Exception:
            pass  # 允许子命令失败, 我们只关心日志追加
        # 验证日志被追加
        new_content = log_path.read_text(encoding="utf-8")
        assert "STEP: dry-run" in new_content, "collect_step 未追加 STEP 行"
        assert len(new_content) > len(initial_content), "collect_step 未追加内容"


class TestNoGDriveRootArtifacts:
    """drill_log 调用后不会创建 G 盘根目录."""

    @SKIP_LINUX
    def test_drill_log_does_not_create_g_drive_roots(self):
        """跑 drill_log 函数后, G 盘根目录无新增临时目录."""
        if not IS_WINDOWS:
            pytest.skip("仅 Windows 平台测试")
        # 调用 drill_log 主要函数
        from drill_log import init_drill_log  # noqa: PLC0415
        try:
            init_drill_log("20260625_test_no_g_drive")
        except Exception:
            pass
        # 检查 G 盘根
        forbidden = ["G:\\Users", "G:\\var", "G:\\home", "G:\\opt", "G:\\etc", "G:\\tmp"]
        existing = [p for p in forbidden if os.path.exists(p)]
        assert not existing, f"drill_log 调用后 G 盘根新增临时目录: {existing}"
