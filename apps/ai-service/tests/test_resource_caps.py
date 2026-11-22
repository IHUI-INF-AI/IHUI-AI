# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""资源型上限接线(2026-11-01 安全强化同族第 5 批)。

两处都是"每条目背后是活的资源",不是单纯字节数:
- `file_editor._FILE_VERSION_STORE`:每条 record 装**整份文件正文**,内层已有
  `MAX_FILE_VERSIONS` 封顶,但外层键 `(session_id, path)` **永不逐出** ⇒ 换会话/换路径
  就能无限累积源码副本;
- `spec_generator._active_watchers`:每枚 watcher 挂着活的 Observer 线程 + 文件句柄,
  `watch_id` 由调用方选的 scope 决定 ⇒ 线程/FD 耗尽先于 OOM。
"""

from __future__ import annotations

import inspect
from pathlib import Path

import pytest

from app.services import file_editor, spec_generator


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    file_editor._FILE_VERSION_STORE.clear()
    yield
    file_editor._FILE_VERSION_STORE.clear()


# ------------------------------------------------------------------ 文件版本表


def test_file_version_outer_keys_are_capped(monkeypatch) -> None:
    monkeypatch.setattr(file_editor, "_FILE_VERSION_MAX_KEYS", 3)
    for i in range(10):
        file_editor._remember_file_versions((f"s{i}", f"/repo/f{i}.ts"), [{"v": i}])
    assert len(file_editor._FILE_VERSION_STORE) <= 3, "外层键必须封顶"
    assert file_editor.file_version_key_evictions >= 7, "逐出量必须可观测"
    # 最新的留下、最旧的被逐出(逐出=交还内存,Redis 那份仍在,不是丢数据)
    assert file_editor._FILE_VERSION_STORE[("s9", "/repo/f9.ts")] == [{"v": 9}]
    assert ("s0", "/repo/f0.ts") not in file_editor._FILE_VERSION_STORE


def test_overwriting_existing_key_does_not_evict(monkeypatch) -> None:
    """正向对照:同一 (session, path) 追加版本不该把别人的键挤掉。"""
    monkeypatch.setattr(file_editor, "_FILE_VERSION_MAX_KEYS", 3)
    before = file_editor.file_version_key_evictions
    key = ("same", "/repo/a.ts")
    file_editor._remember_file_versions(key, [{"v": 1}])
    file_editor._remember_file_versions(key, [{"v": 2}])
    assert file_editor.file_version_key_evictions == before
    assert len(file_editor._FILE_VERSION_STORE) == 1


def test_all_version_writes_go_through_the_capped_writer() -> None:
    """形状锁:文件里对 `_FILE_VERSION_STORE[key] = …` 的赋值**只允许出现在写口函数内部**。

    摘掉任一处调用(改回裸赋值)⇒ 文件里多出一次赋值,这条即红;
    写口自身有两次赋值(覆盖同键 / 新键落库),所以判"内外相等"而不是判固定数字。
    """
    src = Path(file_editor.__file__).read_text(encoding="utf-8")
    code = "\n".join(
        ln for ln in src.split("\n") if not ln.lstrip().startswith("#")
    )
    total = code.count("_FILE_VERSION_STORE[key] =")
    inside_writer = inspect.getsource(file_editor._remember_file_versions).count(
        "_FILE_VERSION_STORE[key] ="
    )
    assert total > 0 and total == inside_writer, (
        f"文件里出现 {total} 次裸赋值,写口函数内只有 {inside_writer} 次 ⇒ 有旁路绕过封顶"
    )
    assert code.count("_remember_file_versions(") >= 3  # 定义 + 两处调用


# ------------------------------------------------------------------ watcher 名额


def test_watcher_quota_is_checked_before_starting_a_thread() -> None:
    """封顶必须排在 `observer.start()` 之前,否则拒绝时已经泄漏线程与句柄。"""
    src = inspect.getsource(spec_generator)
    limit_at = src.index('"watcher_limit"')
    start_at = src.index("observer.start()")
    assert limit_at < start_at, "名额闸排在启动之后 = 拒了但还是把线程起起来了"
    assert "MAX_ACTIVE_WATCHERS" in src
    assert spec_generator.MAX_ACTIVE_WATCHERS >= 1


def test_watcher_refusal_is_explainable_not_silent() -> None:
    """拒绝要带 live/limit 与出路,不能只回一个 error 词。"""
    src = inspect.getsource(spec_generator)
    block = src[src.index('"watcher_limit"') - 200 : src.index('"watcher_limit"') + 400]
    assert '"live"' in block and '"limit"' in block and '"hint"' in block


def test_stop_watch_still_frees_the_slot() -> None:
    """正向对照:stop_watch 会交还名额(否则上限变成"先到先得,永不释放")。"""
    src = inspect.getsource(spec_generator)
    assert "_active_watchers.pop(watch_id, None)" in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
