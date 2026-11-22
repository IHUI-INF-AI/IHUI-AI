# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""发布平台账号凭据生命线守卫(机主 2026-11-22 定案)。

诉求:所有 app 应用发布平台的登录账号,永久保活在加密凭据库(publish_accounts),
且发布流水线随时可提取登录。三套机制(凭据库/保活中心/提取通道)均已在位,本守卫
不重建它们,只把六条不变量钉成机器判据 —— 因为"永久"在本仓的可信形式从来不是
"当前恰好成立",而是"改坏当场红"(仓内已记 7 次"装了没接电"静默失效)。

六条生命线:
  R 全量覆盖  —— 保活探针从 publish_accounts 取全部 active 账号,不硬编码平台白名单;
                  新增适配器/平台自动纳入保活,不必改保活代码。
  K 主密钥    —— env 显式主密钥 + 解密环 + generated 兜底写锚定文件,密钥文件被 gitignore;
                  且主密钥两键登记在 config env 白名单(否则 .env 显式设置读不到,静默退回
                  文件密钥/generated),换目录/换进程不打哑历史密文也不泄露进仓库。
  E 提取通道  —— 两条解密提取入口都必须带 user_id 归属 + 缺参 fail-closed + 解密返回:
                  ① 流水线 scheduler._load_credentials(任务发布链路);
                  ② router publish._load_account_credentials(monitor verify/metrics 链路,
                     审计 2026-11-22 抓出的越权面:targets 可含脏 account_id,无归属兜底会
                     解出他人凭据)。
  W 开关可读  —— KEEPALIVE_/COOKIE_REFRESH_ 前缀在 config env 白名单,否则 .env 写了也读不到,
                  中心恒判"未启用"而自检也这么说(第 7 例静默失效)。

判据是纯函数(输入全是源码文本/事实),真实树喂进去应全绿;变异用例喂反事实源码,
必须逐条报出对应令牌 —— 守卫本身恒真就等于没守卫,所以变异验证固化进测试。
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services.keepalive.probes import build_probes

_SERVICE_ROOT = Path(__file__).resolve().parents[1]


def _src(rel: str) -> str:
    """剥掉 docstring,只留可执行源码(与 test_checkin_listing_never_decrypts 同口径)。"""
    text = (_SERVICE_ROOT / rel).read_text(encoding="utf-8")
    parts = text.split('"""')
    return "".join(part for i, part in enumerate(parts) if i % 2 == 0)


# 机器令牌:判据只吐这些,断言逐枚比对(散文会被改写,令牌不会)
V_PROBE_SOURCE = "R1:publish-probe-source"
V_PROBE_ACTIVE = "R2:publish-probe-active"
V_PROBE_WHITELIST = "R3:publish-probe-platform-whitelist"
V_KEY_ENV = "K1:master-key-env-or-ring"
V_KEY_PERSIST = "K2:generated-fallback-persist"
V_KEY_GITIGNORE = "K3:key-file-not-gitignored"
V_KEY_ENV_WHITELIST = "K4:master-key-not-in-env-whitelist"
V_EXTRACT_SCOPE = "E1:extract-lost-user-scope"
V_EXTRACT_FAILCLOSED = "E2:extract-failclosed-guard"
V_EXTRACT_DECRYPT = "E3:extract-no-decrypt"
V_ROUTER_EXTRACT_SCOPE = "E4:router-extract-lost-user-scope"
V_ROUTER_EXTRACT_FAILCLOSED = "E5:router-extract-failclosed-guard"
V_ENV_WHITELIST = "W1:keepalive-env-prefix"
V_PROBE_WIRED = "P1:publish-probe-not-wired"


def audit_lifeline(
    *,
    probe_code: str,
    crypto_code: str,
    scheduler_code: str,
    router_code: str,
    config_code: str,
    key_file_ignored: bool,
    probe_sources: list[str],
) -> list[str]:
    """纯判据:输入五段源码 + 两个事实,返回违规令牌列表(空=全绿)。"""
    v: list[str] = []
    # R —— 全量覆盖
    if "FROM publish_accounts" not in probe_code:
        v.append(V_PROBE_SOURCE)
    if "status = 'active'" not in probe_code:
        v.append(V_PROBE_ACTIVE)
    if "platform IN" in probe_code.upper() or "platform =" in probe_code:
        v.append(V_PROBE_WHITELIST)
    # K —— 主密钥持久化 + env 白名单登记
    if "_KEY_ENV" not in crypto_code or "_LEGACY_ENV" not in crypto_code:
        v.append(V_KEY_ENV)
    if "token_bytes" not in crypto_code or "_KEY_FILE" not in crypto_code:
        v.append(V_KEY_PERSIST)
    if not key_file_ignored:
        v.append(V_KEY_GITIGNORE)
    if '"PUBLISH_CREDENTIALS_KEY"' not in config_code:
        v.append(V_KEY_ENV_WHITELIST)
    # E① —— 流水线提取通道
    if "user_id=$3" not in scheduler_code:
        v.append(V_EXTRACT_SCOPE)
    if "if account_id is None or not user_id" not in scheduler_code:
        v.append(V_EXTRACT_FAILCLOSED)
    if "decrypt(cipher)" not in scheduler_code:
        v.append(V_EXTRACT_DECRYPT)
    # E② —— router 提取通道(审计抓出的越权面)
    if "user_id=$3" not in router_code:
        v.append(V_ROUTER_EXTRACT_SCOPE)
    if "if not user_id:" not in router_code:
        v.append(V_ROUTER_EXTRACT_FAILCLOSED)
    # W —— 开关可读
    if '"KEEPALIVE_"' not in config_code or '"COOKIE_REFRESH_"' not in config_code:
        v.append(V_ENV_WHITELIST)
    # P —— 探针确实接进中心
    if "publish" not in [s.lower() for s in probe_sources]:
        v.append(V_PROBE_WIRED)
    return v


def _real_inputs() -> dict[str, object]:
    gitignore = (_SERVICE_ROOT / ".gitignore").read_text(encoding="utf-8")
    return {
        "probe_code": _src("app/services/keepalive/probes.py"),
        "crypto_code": _src("app/services/publish/credentials_crypto.py"),
        "scheduler_code": _src("app/services/publish/scheduler.py"),
        "router_code": _src("app/routers/publish.py"),
        "config_code": _src("app/core/config.py"),
        "key_file_ignored": "data/" in gitignore,
        "probe_sources": [getattr(p, "source", "") for p in build_probes()],
    }


def test_lifeline_green_on_current_tree() -> None:
    """真实树六条生命线全绿 —— 任一被改坏,本用例当场红。"""
    assert audit_lifeline(**_real_inputs()) == []  # type: ignore[arg-type]


# 反事实变异:每例只改坏一处,守卫必须报出且只报出对应令牌。
# 这同时是"变异验证"——证明守卫不是恒真(改坏了真会红)。
@pytest.mark.parametrize(
    ("field", "old", "new", "expected"),
    [
        ("probe_code", "FROM publish_accounts", "FROM other_table", V_PROBE_SOURCE),
        ("probe_code", "status = 'active'", "status = 'disabled'", V_PROBE_ACTIVE),
        ("probe_code", "ORDER BY id", "AND platform = 'csdn' ORDER BY id", V_PROBE_WHITELIST),
        ("crypto_code", "_KEY_ENV", "MIGRATED_SYMBOL", V_KEY_ENV),
        ("crypto_code", "token_bytes", "b'x'*32", V_KEY_PERSIST),
        ("scheduler_code", "user_id=$3", "user_id=$2", V_EXTRACT_SCOPE),
        ("scheduler_code", "if account_id is None or not user_id", "if False", V_EXTRACT_FAILCLOSED),
        ("scheduler_code", "decrypt(cipher)", "cipher", V_EXTRACT_DECRYPT),
        ("router_code", "user_id=$3", "user_id=$2", V_ROUTER_EXTRACT_SCOPE),
        ("router_code", "if not user_id:", "if True:", V_ROUTER_EXTRACT_FAILCLOSED),
        ("config_code", '"PUBLISH_CREDENTIALS_KEY"', '"MIGRATED_KEY"', V_KEY_ENV_WHITELIST),
        ("config_code", '"KEEPALIVE_"', '"MIGRATED_"', V_ENV_WHITELIST),
    ],
)
def test_lifeline_detects_each_regression(
    field: str, old: str, new: str, expected: str
) -> None:
    """改坏一处 ⇒ 判据报出该令牌(变异验证,守卫非恒真)。"""
    inputs = _real_inputs()
    text = str(inputs[field])
    assert old in text, f"变异锚点已漂移: {old!r} 不在 {field} 中"
    # 全局替换:模拟"该机制被整体移除"。只替换首处会让别处的同名锚点继续满足判据
    # (变异验证实测抓出的恒真漏洞:_KEY_ENV/token_bytes/FROM publish_accounts/
    #  user_id=$3 都在源码出现多处),守卫就恒真了 —— 必须整段抹掉才算真变异。
    inputs[field] = text.replace(old, new)
    violations = audit_lifeline(**inputs)  # type: ignore[arg-type]
    assert expected in violations, f"守卫未拦住 {expected},实际 {violations}"


def test_lifeline_detects_key_file_leak() -> None:
    """密钥文件一旦不再被 gitignore ⇒ 泄露风险,守卫报出。"""
    inputs = _real_inputs()
    inputs["key_file_ignored"] = False
    assert V_KEY_GITIGNORE in audit_lifeline(**inputs)  # type: ignore[arg-type]


def test_lifeline_detects_publish_probe_unwired() -> None:
    """保活中心探针表若摘掉发布探针 ⇒ 发布账号全部失去保活,守卫报出。"""
    inputs = _real_inputs()
    inputs["probe_sources"] = ["checkin"]
    assert V_PROBE_WIRED in audit_lifeline(**inputs)  # type: ignore[arg-type]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
