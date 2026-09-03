# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌​​​⁠

"""file_editor.py 文件版本快照的 Redis 持久化层测试。

不依赖真实 Redis:用极简 in-memory FakeRedis mock `_redis_client` 验证:
- 内存 + Redis 双写一致性(snapshot 全量落 Redis,带 TTL + key 索引)
- 无 Redis(URL 未配置 / 包缺失)→ 纯内存行为不变(静默降级)
- Redis 读写异常 → 静默降级为纯内存,不抛异常影响主流程
- 内存 miss 时回滚可从 Redis 恢复(并回填内存缓存)
- reset 同时清空内存与 Redis
"""

from __future__ import annotations

import json

import pytest

from app.services import file_editor

# =============================================================================
# 极简 in-memory FakeRedis(Python dict 实现,覆盖 file_editor 用到的命令)
# =============================================================================


class _FakeRedis:
    """Mini in-memory Redis 双例(pipeline 收集后同批执行)。"""

    def __init__(self) -> None:
        self._data: dict[str, object] = {}
        self._kinds: dict[str, str] = {}

    def ping(self) -> bool:
        return True

    def pipeline(self) -> _FakePipeline:
        return _FakePipeline(self)

    # ---- list 操作 ----
    def rpush(self, key: str, *values: str) -> int:
        arr = self._data.setdefault(key, [])
        self._kinds[key] = "list"
        if not isinstance(arr, list):
            arr = []
            self._data[key] = arr
        arr.extend(values)
        return len(arr)

    def lrange(self, key: str, start: int, stop: int) -> list[str]:
        arr = self._data.get(key, []) if self._kinds.get(key) == "list" else []
        if stop == -1:
            stop = len(arr) - 1
        return list(arr[start : stop + 1])

    def delete(self, *keys: str) -> int:
        n = 0
        for k in keys:
            self._data.pop(k, None)
            n += self._kinds.pop(k, None) is not None
        return n

    def expire(self, key: str, ttl: int) -> int:
        return self._data.get(key) is not None

    # ---- set 操作 ----
    def sadd(self, key: str, *values: str) -> int:
        s = self._data.setdefault(key, set())
        if not isinstance(s, set):
            s = set()
            self._data[key] = s
        self._kinds[key] = "set"
        s.update(values)
        return len(values)

    def smembers(self, key: str) -> set[str]:
        if self._kinds.get(key) == "set":
            return set(self._data.get(key, ()))  # type: ignore[arg-type]
        return set()


class _FakePipeline:
    """缓冲命令,execute() 时按序应用到底层 FakeRedis。"""

    def __init__(self, r: _FakeRedis) -> None:
        self._r = r
        self._ops: list[tuple[str, tuple]] = []

    def __enter__(self) -> _FakePipeline:
        return self

    def __exit__(self, *exc: object) -> bool:
        return False

    def delete(self, *keys: str) -> _FakePipeline:
        self._ops.append(("delete", keys))
        return self

    def rpush(self, key: str, *values: str) -> _FakePipeline:
        self._ops.append(("rpush", (key, *values)))
        return self

    def expire(self, key: str, ttl: int) -> _FakePipeline:
        self._ops.append(("expire", (key, ttl)))
        return self

    def sadd(self, key: str, *values: str) -> _FakePipeline:
        self._ops.append(("sadd", (key, *values)))
        return self

    def execute(self) -> None:
        for method, args in self._ops:
            getattr(self._r, method)(*args)


# =============================================================================
# fixtures
# =============================================================================


@pytest.fixture(autouse=True)
def _reset_store():
    file_editor._reset_file_version_store()
    file_editor._redis_available = None
    yield
    file_editor._reset_file_version_store()
    file_editor._redis_available = None


@pytest.fixture
def redis_env(monkeypatch) -> _FakeRedis:
    """注入一个可用 FakeRedis,模拟"配置了 REDIS_URL 且连接成功"。"""
    r = _FakeRedis()
    monkeypatch.setattr(file_editor, "_redis_client", lambda: r)
    monkeypatch.setattr(file_editor, "_redis_enabled", lambda: True)
    monkeypatch.setattr(file_editor, "_redis_available", True)
    return r


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    """把 file_editor 工作区白名单指向临时目录。"""
    monkeypatch.setattr(file_editor, "_WORKSPACE_ROOTS", [str(tmp_path)])
    return tmp_path


# =============================================================================
# 快照持久化:内存 + Redis 双写
# =============================================================================


def test_snapshot_persists_full_record_to_redis(workspace, redis_env):
    target = workspace / "a.txt"
    target.write_text("line1\n", encoding="utf-8")
    file_editor.snapshot_file("sess", str(target), checkpoint_id="ckpt-1")

    # 内存有版本
    assert len(file_editor._FILE_VERSION_STORE) == 1
    # Redis 列表持久化了完整记录(含 path/content/checkpoint_id)
    rkey = file_editor._redis_versions_key("sess", str(target.resolve()))
    raw = redis_env.lrange(rkey, 0, -1)
    assert len(raw) == 1
    data = json.loads(raw[0])
    assert data["path"] == str(target.resolve())
    assert data["content"] == "line1\n"
    assert data.get("checkpoint_id") == "ckpt-1"
    assert "version_id" in data and "created_at" in data
    # key 已进入 reset 索引
    assert rkey in redis_env.smembers(file_editor._FILE_VERSION_KEY_INDEX)


def test_redis_version_list_matches_memory_order(workspace, redis_env):
    target = workspace / "b.txt"
    for i in range(3):
        target.write_text(f"content-{i}", encoding="utf-8")
        file_editor.snapshot_file("sess", str(target))
    rkey = file_editor._redis_versions_key("sess", str(target.resolve()))
    raw = redis_env.lrange(rkey, 0, -1)
    # 顺序与内存一致(旧→新):第一个版本内容为 content-0
    assert json.loads(raw[0])["content"] == "content-0"
    assert json.loads(raw[-1])["content"] == "content-2"


def test_version_quota_trimmed_in_redis(workspace, redis_env):
    target = workspace / "q.txt"
    for i in range(25):
        target.write_text(f"c{i}", encoding="utf-8")
        file_editor.snapshot_file("q", str(target))
    rkey = file_editor._redis_versions_key("q", str(target.resolve()))
    raw = redis_env.lrange(rkey, 0, -1)
    assert len(raw) == file_editor.MAX_FILE_VERSIONS
    assert json.loads(raw[0])["content"] == "c5"  # 最早的 0-4 被丢弃


# =============================================================================
# 内存 miss 时从 Redis 恢复
# =============================================================================


def test_rollback_recovers_from_redis(workspace, redis_env):
    target = workspace / "r.txt"
    target.write_text("v0", encoding="utf-8")
    file_editor.snapshot_file("sess", str(target))
    target.write_text("v1", encoding="utf-8")
    versions = file_editor.list_file_versions("sess", str(target))
    vid = versions[0]["version_id"]

    # 模拟进程重启:内存被清空,仅剩 Redis
    file_editor._FILE_VERSION_STORE.clear()
    assert file_editor.list_file_versions("sess", str(target))  # 从 Redis 恢复列表
    assert len(file_editor._FILE_VERSION_STORE) == 1  # 内存已回填

    target.write_text("v2", encoding="utf-8")
    result = file_editor.rollback_file("sess", str(target), version_id=vid)
    assert result["ok"] is True
    assert target.read_text(encoding="utf-8") == "v0"


def test_list_recovers_from_redis_on_miss(workspace, redis_env):
    target = workspace / "l.txt"
    target.write_text("x", encoding="utf-8")
    file_editor.snapshot_file("sess", str(target))
    file_editor._FILE_VERSION_STORE.clear()  # 内存 miss
    versions = file_editor.list_file_versions("sess", str(target))
    assert len(versions) == 1
    assert versions[0]["path"] == str(target.resolve())


# =============================================================================
# reset:内存与 Redis 都清空
# =============================================================================


def test_reset_clears_memory_and_redis(workspace, redis_env):
    target = workspace / "c.txt"
    target.write_text("x", encoding="utf-8")
    file_editor.snapshot_file("sess", str(target))
    rkey = file_editor._redis_versions_key("sess", str(target.resolve()))
    assert redis_env.lrange(rkey, 0, -1) != []

    file_editor._reset_file_version_store()
    assert file_editor._FILE_VERSION_STORE == {}
    assert redis_env.lrange(rkey, 0, -1) == []
    assert redis_env.smembers(file_editor._FILE_VERSION_KEY_INDEX) == set()


# =============================================================================
# 无 Redis(URL 未配置 / 包缺失)→ 纯内存行为不变(静默降级)
# =============================================================================


def test_no_redis_uses_pure_memory(workspace, monkeypatch):
    monkeypatch.setattr(file_editor, "_redis_available", False)
    monkeypatch.setattr(file_editor, "_redis_client", lambda: None)
    # _redis_enabled 返回 False,纯内存主流程不受影响
    assert file_editor._redis_client() is None

    target = workspace / "m.txt"
    target.write_text("mem", encoding="utf-8")
    file_editor.snapshot_file("sess", str(target))
    target.write_text("mem2", encoding="utf-8")
    versions = file_editor.list_file_versions("sess", str(target))
    assert len(versions) == 1
    result = file_editor.rollback_file(
        "sess", str(target), version_id=versions[0]["version_id"]
    )
    assert result["ok"] is True
    assert target.read_text(encoding="utf-8") == "mem"


# =============================================================================
# Redis 读写异常 → 静默降级,不抛异常影响主流程
# =============================================================================


def test_redis_failure_degrades_silently(workspace, monkeypatch):
    class _Boom:
        def __getattr__(self, name):
            raise RuntimeError("redis down")

        def ping(self):
            raise RuntimeError("redis down")

    monkeypatch.setattr(file_editor, "_redis_client", lambda: _Boom())
    monkeypatch.setattr(file_editor, "_redis_enabled", lambda: True)
    monkeypatch.setattr(file_editor, "_redis_available", True)

    target = workspace / "d.txt"
    target.write_text("v0", encoding="utf-8")
    # 快照:Redis 写失败仅 warning,内存照常写入
    file_editor.snapshot_file("sess", str(target), checkpoint_id="ckpt-x")
    target.write_text("v1", encoding="utf-8")
    versions = file_editor.list_file_versions("sess", str(target))
    assert len(versions) == 1
    # 回滚:Redis 读失败静默降级,内存版本仍可用于回滚
    result = file_editor.rollback_file(
        "sess", str(target), version_id=versions[0]["version_id"]
    )
    assert result["ok"] is True
    assert target.read_text(encoding="utf-8") == "v0"
