# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 本文件覆盖:cross_account_guard._fingerprint_hash 名为"哈希"却返回明文拼接串
# 的缺陷修复(改为真正的 SHA-256 摘要)+ 已落盘设备图谱绑定的存量零损失迁移。
"""设备指纹摘要与存量迁移回归测试。

被测缺陷(修复前):
- `cross_account_guard._fingerprint_hash()` 文档写「计算指纹哈希(用于快速比较)
  「同指纹同哈希」,实现却是 `return "|".join(parts)` —— 含完整 UA、locale、
  时区与**精确到 4 位小数的经纬度**,没有任何哈希。该值经
  `device_graph_guard.record_binding()` 原样落盘。
- 消费面按"等值比较"使用它(`risk_scoring._score_fingerprint_ip` 组 set 判
  `len>1`;`device_graph_guard.detect_linkage` 判跨账号同指纹),所以改成摘要后
  **比较语义必须逐字不变**,且磁盘上的存量明文绑定必须能识别并就地转成
  `sha256(旧明文串)`(与新算法对同一浏览器算出的摘要逐字相等)。

测试覆盖(与票面四条要求一一对应):
1. 稳定性/形态:同一 BrowserFingerprint 两次调用得同一 64 位十六进制小写摘要
2. 判别力:8 个维度逐个改动(含 geolocation)摘要必变
3. 回归锁:摘要里绝不得出现坐标数字 / latitude / longitude / "|" / 原始 UA 子串,
   并以旧明文形态做阳性对照(否则本锁是空锁)
4. 端到端迁移:临时图谱文件(ANTI_RISK_DEVICE_GRAPH_FILE + 模块属性双保险,
   绝不写仓库树、绝不用默认路径)加载后明文变摘要、与新算法逐字等值、落盘
   不再含明文、二次加载零写入(幂等)
5. 比较语义:迁移后跨账号同指纹仍判关联(含"一条旧明文 + 一条新摘要"混存形态);
   空串哨兵不得被哈希成固定摘要(否则两个"无指纹"账号被误判为同一设备)

测试隔离(AGENTS.md §5):不 import 任何 DB/Redis 入口,不连生产 PostgreSQL(8810)
/ Redis(8811);所有落盘路径都在 pytest tmp_path 下。
"""
from __future__ import annotations

import dataclasses
import hashlib
import json
import re
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from app.services.publish.anti_risk import device_graph_guard
from app.services.publish.anti_risk.cross_account_guard import (
    CrossAccountGuard,
    _fingerprint_hash,
)
from app.services.publish.anti_risk.device_graph_guard import (
    DeviceGraphGuard,
    _migrate_fingerprint_hash,
)
from app.services.publish.anti_risk.fingerprint_isolation import (
    BrowserFingerprint,
    generate_fingerprint,
)

_DIGEST_RE = re.compile(r"\A[0-9a-f]{64}\Z")

# 反风控伪定位表里的真实城市坐标 —— 票面指定的哨兵值
_BEIJING = {"latitude": 39.9042, "longitude": 116.4074, "accuracy": 100}
_SHANGHAI = {"latitude": 31.2304, "longitude": 121.4737, "accuracy": 100}

# 一条手写的最小旧明文绑定样本(8 段以 "|" 连接,含真实坐标哨兵)
_LEGACY_SAMPLE = "ua|1920x1080|zh-CN|Asia/Shanghai|39.9042,116.4074|light|Win32|chromium"


# ---------------------------------------------------------------------------
# 夹具/工具
# ---------------------------------------------------------------------------


def _beijing_fingerprint(account_id: str = "acct_beijing") -> BrowserFingerprint:
    """取一个真实生成的指纹,并把 geolocation 钉死为北京坐标。

    目的:让 `f"{lat:.4f},{lng:.4f}"` 那一段必定产出哨兵数字 39.9042/116.4074,
    这样"摘要里不得出现坐标"的回归锁才有确定的被检物。
    """
    fp = generate_fingerprint(account_id)
    return dataclasses.replace(fp, geolocation=dict(_BEIJING))


def _legacy_plaintext(fp: BrowserFingerprint) -> str:
    """复刻修复前 `_fingerprint_hash` 的明文拼接形态(**只作对照夹具**)。

    这里刻意在测试里重写一遍字段集合与顺序,不是复制实现,而是给它上一把锁:
    谁改了 `_fingerprint_hash` 的 parts 字段集合或顺序,端到端迁移用例里
    `expected == _fingerprint_hash(fp)` 那条当场翻红 —— 那正是"已落盘绑定变成
    不可比"的判定条件。
    """
    parts = [
        fp.user_agent,
        f"{fp.viewport.get('width', 0)}x{fp.viewport.get('height', 0)}",
        fp.locale,
        fp.timezone_id,
        f"{fp.geolocation.get('latitude', 0):.4f},{fp.geolocation.get('longitude', 0):.4f}",
        fp.color_scheme,
        fp.platform,
        fp.sec_ch_ua,
    ]
    return "|".join(parts)


def _binding_payload(
    account_id: str,
    fingerprint_hash: str,
    *,
    proxy_ip: str = "direct",
) -> dict[str, Any]:
    """一条存量图谱记录。proxy_ip 默认 "direct"(detect_linkage 刻意跳过它),
    这样"同指纹关联"的断言不会被 IP 维度连带命中而失去判别力。
    """
    return {
        "account_id": account_id,
        "fingerprint_hash": fingerprint_hash,
        "proxy_ip": proxy_ip,
        "ua_hash": hashlib.sha256(account_id.encode("utf-8")).hexdigest()[:16],
        # canvas 维度未采集(见 cross_account_guard.async_record_device_binding)
        "canvas_hash": "",
        "bound_at": 1_700_000_000.0,
        "updated_at": 1_700_000_000.0,
    }


def _write_graph(path: Path, bindings: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"bindings": bindings, "updated_at": 1_700_000_000.0}, ensure_ascii=False),
        encoding="utf-8",
    )


def _read_graph(path: Path) -> dict[str, Any]:
    loaded: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return loaded


@pytest.fixture
def graph_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """把图谱落点指到 pytest tmp_path(仓库树之外)。

    双保险:① 设环境变量(防该模块在本 worker 里被重新 import 时取到默认路径);
    ② 直接 monkeypatch 模块级 `_GRAPH_FILE`(它只在 import 时读一次 env,单靠
    setenv 改不了已解析的常量 —— 与本仓 `test_anti_risk_risk_scoring.py` 里
    `monkeypatch.setattr(risk_scoring, "_EVENTS_FILE", ...)` 同一手法)。
    """
    target = tmp_path / "device_graph.json"
    monkeypatch.setenv("ANTI_RISK_DEVICE_GRAPH_FILE", str(target))
    monkeypatch.setattr(device_graph_guard, "_GRAPH_FILE", target)
    return target


class _PersistSpy:
    """统计 `_persist()` 被调用次数(= 加载路径是否又往盘上写了一次)。"""

    def __init__(self, guard: DeviceGraphGuard) -> None:
        self._guard = guard
        self._original = guard._persist
        self.calls = 0

    def __enter__(self) -> _PersistSpy:
        original = self._original

        async def _counting_persist() -> None:
            self.calls += 1
            await original()

        # 测试探针:替换实例方法以计数写入。mypy --strict 会判 method-assign,
        # 这是**故意的 monkeypatch**,不是类型逃生(AGENTS.md §3 例外依据)。
        self._guard._persist = _counting_persist  # type: ignore[method-assign]
        return self

    def __exit__(self, *exc: object) -> None:
        self._guard._persist = self._original  # type: ignore[method-assign]


# ---------------------------------------------------------------------------
# 1. 稳定性与形态
# ---------------------------------------------------------------------------


def test_same_fingerprint_yields_identical_64_hex_digest() -> None:
    """同一指纹两次调用必须得同一值,且恒为 64 位十六进制小写。"""
    fp = _beijing_fingerprint()
    first = _fingerprint_hash(fp)
    second = _fingerprint_hash(fp)

    assert first == second
    assert _DIGEST_RE.match(first), f"摘要形态不符 64 位小写十六进制: {first!r}"
    assert len(first) == 64


def test_digest_is_plain_sha256_of_field_join() -> None:
    """摘要必须就是"旧明文串"的 SHA-256 —— 迁移等价性的构造级证明。"""
    fp = _beijing_fingerprint()
    assert _fingerprint_hash(fp) == hashlib.sha256(
        _legacy_plaintext(fp).encode("utf-8")
    ).hexdigest()


# ---------------------------------------------------------------------------
# 2. 判别力:逐维改动必变
# ---------------------------------------------------------------------------

_Mutations: list[tuple[str, Callable[[BrowserFingerprint], dict[str, object]]]] = [
    ("user_agent", lambda fp: {"user_agent": fp.user_agent + " (mutated)"}),
    ("viewport", lambda fp: {"viewport": {**fp.viewport, "width": fp.viewport["width"] + 1}}),
    ("locale", lambda fp: {"locale": "en-US"}),
    ("timezone_id", lambda fp: {"timezone_id": "Asia/Tokyo"}),
    (
        "geolocation",
        lambda fp: {
            "geolocation": {**fp.geolocation, "latitude": fp.geolocation["latitude"] + 0.0001}
        },
    ),
    ("color_scheme", lambda fp: {"color_scheme": "dark" if fp.color_scheme == "light" else "light"}),
    ("platform", lambda fp: {"platform": "Linux x86_64" if fp.platform != "Linux x86_64" else "Win32"}),
    # 不靠"版本号一定含 131"这种数据表巧合 —— 加后缀对任何 sec_ch_ua 都必然改变串
    ("sec_ch_ua", lambda fp: {"sec_ch_ua": fp.sec_ch_ua + '; "Mut";v="1"'}),
]


@pytest.mark.parametrize(
    "field_name,mutation",
    _Mutations,
    ids=[name for name, _ in _Mutations],
)
def test_each_dimension_change_changes_digest(
    field_name: str, mutation: Callable[[BrowserFingerprint], dict[str, object]]
) -> None:
    """8 维中任一维改动(含经纬度末位 0.0001)摘要必须变化。"""
    assert field_name  # 参数名保留,便于失败定位
    fp = _beijing_fingerprint("acct_mutator")
    baseline = _fingerprint_hash(fp)
    mutated = _fingerprint_hash(dataclasses.replace(fp, **mutation(fp)))
    assert mutated != baseline


def test_different_fingerprints_get_different_digests() -> None:
    """不同指纹 → 不同摘要;相同指纹串 → 相同摘要(等值比较的判别力)。

    刻意不断言"12 个账号必得 12 个摘要":指纹池只有 4×6×8×2=384 组合,
    账号间撞车是**池子的性质**不是摘要的性质,拿它当断言会种下 flaky 用例。
    """
    fps = [generate_fingerprint(f"acct_{i}") for i in range(12)]
    plaintexts = {_legacy_plaintext(fp) for fp in fps}
    digests = {_fingerprint_hash(fp) for fp in fps}

    assert len(digests) == len(plaintexts)
    assert len(digests) > 1


# ---------------------------------------------------------------------------
# 3. 回归锁:明文成分不得外流
# ---------------------------------------------------------------------------


def test_digest_leaks_no_coordinates_or_plaintext_structure() -> None:
    """摘要里绝不得出现坐标数字 / latitude / longitude / "|" / 原始 UA 子串。"""
    fp = _beijing_fingerprint()
    digest = _fingerprint_hash(fp)

    # 票面指定哨兵:真城市坐标值(带小数点与去掉小数点两种形态都查)
    assert "39.9042" not in digest
    assert "116.4074" not in digest
    assert f"{_BEIJING['latitude']:.4f}" not in digest
    assert f"{_BEIJING['longitude']:.4f}" not in digest
    assert "399042" not in digest
    assert "1164074" not in digest
    assert "latitude" not in digest
    assert "longitude" not in digest
    assert "|" not in digest
    for ua_fragment in ("Mozilla", "AppleWebKit", "Chrome/", "Gecko", "Windows NT"):
        assert ua_fragment not in digest
    assert fp.locale not in digest
    assert fp.timezone_id not in digest
    assert "Asia" not in digest
    assert "Shanghai" not in digest
    # 最强形态:只允许十六进制字符(上面每一条的兜底)
    assert set(digest) <= set("0123456789abcdef")


def test_legacy_plaintext_positive_control() -> None:
    """阳性对照:上述每个哨兵在**旧明文形态**里都命中,否则第 3 组锁是空锁。

    §22c 的教训反过来用 —— 哨兵必须真能命中缺陷形态,不然回归锁等于没上。
    """
    fp = _beijing_fingerprint()
    legacy = _legacy_plaintext(fp)

    assert "39.9042" in legacy
    assert "116.4074" in legacy
    assert "|" in legacy
    assert "Mozilla" in legacy
    assert "Asia/Shanghai" in legacy
    assert not _DIGEST_RE.match(legacy)


# ---------------------------------------------------------------------------
# 4. 端到端存量迁移
# ---------------------------------------------------------------------------


async def test_migration_converts_plaintext_bindings_to_digest(graph_file: Path) -> None:
    """含明文 fingerprint_hash 的图谱:加载即迁移、与新算法逐字等值、盘上无明文。"""
    fp_a = _beijing_fingerprint("acct_a")
    fp_b = generate_fingerprint("acct_b")
    legacy_a = _legacy_plaintext(fp_a)
    legacy_b = _legacy_plaintext(fp_b)
    _write_graph(
        graph_file,
        [_binding_payload("acct_a", legacy_a), _binding_payload("acct_b", legacy_b)],
    )
    # 前置态:盘上确实是明文(JSON 会转义 sec_ch_ua 里的引号,所以按解析后的值比)
    assert _read_graph(graph_file)["bindings"][0]["fingerprint_hash"] == legacy_a

    guard = DeviceGraphGuard()
    bindings = await guard.get_all_bindings()  # 触发 _ensure_loaded → 迁移

    # ① 内存里的值已变摘要,且与新算法对同一指纹的输出**逐字相等**
    by_account = {b.account_id: b.fingerprint_hash for b in bindings}
    assert by_account["acct_a"] == _fingerprint_hash(fp_a)
    assert by_account["acct_b"] == _fingerprint_hash(fp_b)
    assert _DIGEST_RE.match(by_account["acct_a"])
    assert _DIGEST_RE.match(by_account["acct_b"])

    # ② 落盘文件已不含任何明文。
    #    注意:明文整串**不能**直接当子串查 —— JSON 会把 sec_ch_ua 里的引号转义成
    #    \"，"整串不在文件里"在迁移前后都成立,那是一条没牙的断言。所以按
    #    不含引号的片段查文件,再按解析后的值查"没有竖线/没有 UA 痕迹"。
    on_disk = graph_file.read_text(encoding="utf-8")
    for plaintext_fragment in ("Mozilla", "AppleWebKit", "39.9042", "Asia/Shanghai", "Win32"):
        assert plaintext_fragment not in on_disk, f"明文片段 {plaintext_fragment} 仍在盘上"
    assert all(
        "|" not in b["fingerprint_hash"] and "Mozilla" not in b["fingerprint_hash"]
        for b in _read_graph(graph_file)["bindings"]
    )
    persisted = {b["account_id"]: b["fingerprint_hash"] for b in _read_graph(graph_file)["bindings"]}
    assert persisted == by_account

    # ③ 其余字段零损失(账号数与绑定时间戳原样)
    assert len(bindings) == 2
    assert {b.bound_at for b in bindings} == {1_700_000_000.0}
    assert {b.ua_hash for b in bindings} == {
        hashlib.sha256(b"acct_a").hexdigest()[:16],
        hashlib.sha256(b"acct_b").hexdigest()[:16],
    }


async def test_migration_is_idempotent_second_load_zero_write(graph_file: Path) -> None:
    """二次加载:不得再改动任何值、不得再产生写入(幂等)。"""
    fp = _beijing_fingerprint("acct_once")
    _write_graph(graph_file, [_binding_payload("acct_once", _legacy_plaintext(fp))])

    first = DeviceGraphGuard()
    await first.get_all_bindings()
    after_first_load = graph_file.read_bytes()

    # 全新实例 = 全新一次读盘(模拟跨进程重启)
    second = DeviceGraphGuard()
    with _PersistSpy(second) as spy:
        bindings = await second.get_all_bindings()
        assert bindings[0].fingerprint_hash == _fingerprint_hash(fp)
    assert spy.calls == 0, "二次加载不得再回写落盘"
    assert graph_file.read_bytes() == after_first_load, "二次加载不得改动文件字节"


async def test_already_digest_graph_is_untouched(graph_file: Path) -> None:
    """已是摘要形态的存量:原样保留,不重复哈希、不写入。"""
    fp = _beijing_fingerprint("acct_digest")
    digest = _fingerprint_hash(fp)
    _write_graph(graph_file, [_binding_payload("acct_digest", digest)])
    before = graph_file.read_bytes()

    guard = DeviceGraphGuard()
    with _PersistSpy(guard) as spy:
        bindings = await guard.get_all_bindings()

    assert bindings[0].fingerprint_hash == digest
    assert spy.calls == 0
    assert graph_file.read_bytes() == before


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        pytest.param("", "", id="empty-sentinel-stays-empty"),
        pytest.param("a" * 64, "a" * 64, id="already-digest-kept"),
        pytest.param(
            "3f78685e268def984df90f785914c375ebb9a10272d084a8c9f083a9fbd5a6d1",
            "3f78685e268def984df90f785914c375ebb9a10272d084a8c9f083a9fbd5a6d1",
            id="real-digest-kept",
        ),
        pytest.param(
            "A" * 64,
            hashlib.sha256(("A" * 64).encode("utf-8")).hexdigest(),
            id="uppercase-64-hex-treated-as-plaintext",
        ),
        pytest.param(
            _LEGACY_SAMPLE,
            hashlib.sha256(_LEGACY_SAMPLE.encode("utf-8")).hexdigest(),
            id="legacy-plaintext-migrated",
        ),
    ],
)
def test_migrate_fingerprint_hash_pure_function(value: str, expected: str) -> None:
    """迁移判据的纯函数面:摘要/空串保留,其余一律转摘要(且幂等)。"""
    once = _migrate_fingerprint_hash(value)
    assert once == expected
    assert _migrate_fingerprint_hash(once) == once, "迁移必须幂等"


# ---------------------------------------------------------------------------
# 5. 比较语义跨新旧保持
# ---------------------------------------------------------------------------


async def test_linkage_still_detected_after_migrating_one_of_two(graph_file: Path) -> None:
    """一条旧明文 + 一条新摘要(混存形态)迁移后仍判"同指纹关联"。

    这就是"跨重启比较语义不变"的正面证明:两侧被归一到同一取值空间。
    """
    fp_shared = _beijing_fingerprint("acct_shared")
    fp_other = dataclasses.replace(_beijing_fingerprint("acct_other"), geolocation=dict(_SHANGHAI))
    digest_shared = _fingerprint_hash(fp_shared)
    _write_graph(
        graph_file,
        [
            _binding_payload("acct_old", _legacy_plaintext(fp_shared)),  # 明文存量
            _binding_payload("acct_new", digest_shared),  # 新代码写入(同一指纹)
            _binding_payload("acct_other", _legacy_plaintext(fp_other)),  # 别的指纹
        ],
    )

    guard = DeviceGraphGuard()
    report = await guard.detect_linkage("acct_old")

    assert report.is_linked
    assert "fingerprint" in report.linkage_types
    linked_ids = {item["account_id"] for item in report.linked_accounts}
    assert linked_ids == {"acct_new"}, "只有同一指纹的账号才应被判关联"
    assert "fingerprint_hash" in next(
        item["reasons"] for item in report.linked_accounts if item["account_id"] == "acct_new"
    )


async def test_empty_fingerprint_hash_is_not_migrated_and_does_not_link(graph_file: Path) -> None:
    """空串是"未记录指纹"的哨兵:不得被哈希成固定值,否则两个空值账号被误判同一设备。"""
    _write_graph(
        graph_file,
        [_binding_payload("acct_e1", ""), _binding_payload("acct_e2", "")],
    )

    guard = DeviceGraphGuard()
    bindings = await guard.get_all_bindings()
    assert {b.fingerprint_hash for b in bindings} == {""}

    report = await guard.detect_linkage("acct_e1")
    assert "fingerprint" not in report.linkage_types
    assert report.is_linked is False


async def test_corrupt_graph_file_only_warns_and_does_not_raise(graph_file: Path) -> None:
    """降级不炸:JSON 坏了 / 字段缺失一律只 warn,不得让发布主流程抛。"""
    _write_graph(graph_file, [])
    graph_file.write_text("{ this is not json", encoding="utf-8")

    guard = DeviceGraphGuard()
    assert await guard.get_all_bindings() == []  # 不得抛

    # 缺 fingerprint_hash 键 → from_dict 抛 KeyError,也必须被吞成 warn
    graph_file.write_text(
        json.dumps({"bindings": [{"account_id": "acct_x"}]}), encoding="utf-8"
    )
    broken = DeviceGraphGuard()
    assert await broken.get_all_bindings() == []

    # 时间戳坏了 → float() 抛 ValueError,同样不得外泄
    graph_file.write_text(
        json.dumps({"bindings": [{**_binding_payload("acct_y", "b" * 64), "bound_at": "not-a-float"}]}),
        encoding="utf-8",
    )
    bad_ts = DeviceGraphGuard()
    assert await bad_ts.get_all_bindings() == []


async def test_record_binding_writes_digest_and_keeps_prefix_logging(graph_file: Path) -> None:
    """新绑定直接落摘要;盘上只出现摘要(日志面 [:12] 前缀截断在摘要下安全)。"""
    fp = _beijing_fingerprint("acct_new_write")
    guard = DeviceGraphGuard()
    await guard.record_binding(
        account_id="acct_new_write",
        fingerprint_hash=_fingerprint_hash(fp),
        proxy_ip="direct",
        ua_hash="u" * 16,
        canvas_hash="seed:1",
    )

    on_disk = graph_file.read_text(encoding="utf-8")
    assert _fingerprint_hash(fp) in on_disk
    assert "39.9042" not in on_disk
    assert "Mozilla" not in on_disk
    assert "|" not in on_disk


async def test_record_device_binding_leaves_canvas_uncollected(
    graph_file: Path,
) -> None:
    """canvas 列必须是空串,不得是按账号派生的 seed(生产面回归锁)。

    `fingerprint_seed` 是按 account_id 生成的 Canvas/Audio **噪声种子**(用来扰动输出),
    不是被测出来的 canvas 值:跨账号必不同。把它写进这张表,等于给
    detect_linkage 的 canvas 比较一个结构上永不命中的反向信号 —— 列里看着有内容,
    判据却永远为假。留空串才是与实现一致的登记(该维度显式跳过)。
    """
    account_id = "acct_canvas_uncollected"
    await CrossAccountGuard().async_record_device_binding(
        account_id=account_id,
        fingerprint=_beijing_fingerprint(account_id),
    )

    bindings = await DeviceGraphGuard().get_all_bindings()
    mine = [b for b in bindings if b.account_id == account_id]
    assert len(mine) == 1
    assert mine[0].canvas_hash == ""
    # 其余维度必须照常写入 —— 否则这条断言会退化成"整行没写"的假绿
    assert mine[0].fingerprint_hash == _fingerprint_hash(_beijing_fingerprint(account_id))
    assert len(mine[0].ua_hash) == 16


def test_graph_target_is_not_the_repo_default(graph_file: Path) -> None:
    """夹具自检:本票用例的图谱落点必须在仓库树之外(AGENTS.md §15)。"""
    default_path = (Path.cwd() / ".ihui-agent" / "tmp" / "device_graph.json").resolve()
    assert graph_file != default_path
    assert graph_file == device_graph_guard._GRAPH_FILE
    assert Path.cwd() not in graph_file.parents
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
