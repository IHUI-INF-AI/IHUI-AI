# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""双面等值断言(G-998137,b76-09b 票2,2026-09-30)。

票面核心:api 进程内的"决策与事实同源"(守门 116 / collectEgressFacts)只救了 api
那一趟 fetch;跨进程一侧(ai-service 的 httpx/LiteLLM 出网)读的是各自 env,两侧可
同时"绿"而对同一 URL 得出不同的代理/CA 结论 —— 实现同源救不了输入分叉。本文件把
**同一份 env、同一份 URL 语料**分别交给两侧判据:

  ① TS 侧:apps/api/src/utils/proxy-dispatcher.ts 的 collectEgressFacts(生产判据本体,
     经 node 22 原生 type-stripping 直接加载 .ts,不打平行导出);
  ② Python 侧:app/core/config.py 的 resolve_egress_facts(本侧唯一出口)。

逐字段断言全等(不只 proxied / customCa / noProxyMatched 三项 —— 判据漂移可以先从
任何一个字段的分叉上被看见)。另附凭据卫生断言:两侧事实面都不得出现代理端口值、
代理主机名、CA 路径(守门 67 / AGENTS §5e 口径:只许报变量名与状态枚举)。
"""

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest

from app.core.config import resolve_egress_facts

REPO_ROOT = Path(__file__).resolve().parents[3]
TS_DISPATCHER = REPO_ROOT / "apps" / "api" / "src" / "utils" / "proxy-dispatcher.ts"

# 同一份 env(两侧各喂同一份;值全是虚构的语料值,不含任何真实凭据)。
# 注意:**不喂 *_proxy 通用变量**——Windows 上 node 的 process.env 查找大小写不敏感,
# 设了 HTTPS_PROXY 就等于同时设了 https_proxy,大小写两档的区分是平台语义不是判据
# 语义;把它喂进语料会把平台差异误判成判据漂移。envProxyVars 字段的等值改由
# "两侧都为空表"这一档覆盖(通用变量的名字列举属 EGRESS_ENV_PROXY_VAR_NAMES 闭集测试)。
PARITY_ENV: dict[str, str] = {
    "PROXY_URL": "http://127.0.0.1:7897",
    "PROXY_DOMAINS": "api.stepfun.com,api.openai.com",
    "NO_PROXY": "api.openai.com",
    "NODE_EXTRA_CA_CERTS": "/etc/ssl/custom-ca.pem",
}

# 语料:一个白名单域、一个内网 host、一个 NO_PROXY 命中域(与白名单重叠构成
# proxied=true ∧ noProxyMatched=true 的可诊断指纹)、一个解析不出来的垃圾串
PARITY_URLS = [
    "https://api.stepfun.com/step_plan/v1/models",
    "http://10.0.0.1:8802/api",
    "https://api.openai.com/v1/models",
    "not a url",
]

# 本测试涉及的变量在宿主 shell 里都可能已存在 ⇒ 交给子进程前逐条剥掉,不得盲留
_MANAGED_VARS = (
    "PROXY_URL",
    "PROXY_DOMAINS",
    "NO_PROXY",
    "no_proxy",
    "HTTPS_PROXY",
    "https_proxy",
    "HTTP_PROXY",
    "http_proxy",
    "ALL_PROXY",
    "all_proxy",
    "NODE_EXTRA_CA_CERTS",
    "NODE_TLS_CA_CERTS",
)


def _load_ts_facts(urls: list[str]) -> list[dict]:
    """用 node 22 原生 type-stripping 直接加载生产判据本体(.ts),同一份 env 逐 URL 取事实。

    2026-10-11 修(CI run 38084051334 红因①):CI 的 test-python job 只装 python 依赖
    (uv pip install),**没有 npm install** —— proxy-dispatcher.ts 顶部裸说明符
    `import ... from 'undici'` 与 `from '@ihui/types'` 在 node 的 ESM resolve 阶段
    直接 ERR_MODULE_NOT_FOUND(exit=1),判据根本没被加载。修法是给子进程挂一个
    module resolve 钩子(node ≥20.6 的 module.register 正道,不动生产文件):

      1. '@ihui/types' → 仓库内真实 TS 源 packages/types/src/egress-facts.ts。
         判据常量(EGRESS_ENV_PROXY_VAR_NAMES)与工厂(createEgressFacts)的**真身**,
         不做任何桩 —— 等值断言两头仍是生产代码。
      2. 'undici' → 最小桩(空 ProxyAgent 类 + 透传 fetch)。collectEgressFacts 是
         纯 env/URL 判据,不触网不建 agent(ProxyAgent 只在真实派发函数里 new),
         桩不触及任何被断言的字段。

    CI 的 actions/checkout 默认 fetch-depth=1 也照常可跑(不需要 git 历史/node_modules)。
    """
    node = shutil.which("node")
    if not node:
        pytest.fail("PATH 上找不到 node:TS 侧判据无法加载,等值断言无法判定(宁红不跳)")
    types_src = REPO_ROOT / "packages" / "types" / "src" / "egress-facts.ts"
    if not TS_DISPATCHER.is_file():
        pytest.fail(f"生产判据本体不存在:{TS_DISPATCHER}(判据失明,宁红不跳)")
    if not types_src.is_file():
        pytest.fail(f"@ihui/types 判据源不存在:{types_src}(判据失明,宁红不跳)")

    undici_stub = (
        "export class ProxyAgent {}\n"
        "export const fetch = globalThis.fetch;\n"
        "export default { ProxyAgent, fetch };\n"
    )
    with tempfile.TemporaryDirectory(prefix="egress-parity-hooks-") as td:
        hooks = Path(td) / "egress-parity-hooks.mjs"
        hooks.write_text(
            "export async function resolve(specifier, context, nextResolve) {\n"
            "  if (specifier === '@ihui/types') {\n"
            f"    return {{ url: {json.dumps(types_src.as_uri())}, shortCircuit: true }};\n"
            "  }\n"
            "  if (specifier === 'undici') {\n"
            "    return { url: 'data:text/javascript,' + encodeURIComponent(\n"
            f"      {json.dumps(undici_stub)}\n"
            "    ), shortCircuit: true };\n"
            "  }\n"
            "  return nextResolve(specifier, context);\n"
            "}\n",
            encoding="utf-8",
        )
        entry = Path(td) / "egress-parity-register.mjs"
        entry.write_text(
            "import { register } from 'node:module';\n"
            "register(new URL('./egress-parity-hooks.mjs', import.meta.url));\n",
            encoding="utf-8",
        )

        code = (
            "const urls = JSON.parse(process.argv[1]);"
            "import(process.argv[2]).then((m) => {"
            "process.stdout.write(JSON.stringify(urls.map((u) => m.collectEgressFacts(u))));"
            "});"
        )
        # env 侧与 python 侧同一份语料 env:先剥宿主壳里可能存在的同名变量再灌入
        child_env = {k: v for k, v in os.environ.items() if k not in _MANAGED_VARS}
        child_env.update(PARITY_ENV)
        proc = subprocess.run(
            [node, "--import", entry.as_uri(), "-e", code, json.dumps(urls), TS_DISPATCHER.as_uri()],
            capture_output=True,
            text=True,
            timeout=120,
            env=child_env,
        )
        if proc.returncode != 0:
            pytest.fail(f"TS 侧判据加载失败(exit={proc.returncode}):{proc.stderr[-500:]}")
        return json.loads(proc.stdout)


def test_dual_side_parity_full_fields() -> None:
    """同一份 env、同一份语料:两侧 12 个字段逐字段全等(含 None/null 与数组逐项)。"""
    ts_facts = _load_ts_facts(PARITY_URLS)
    assert len(ts_facts) == len(PARITY_URLS)
    for url, ts in zip(PARITY_URLS, ts_facts, strict=True):
        py = resolve_egress_facts(url, PARITY_ENV)
        assert set(py) == set(ts), f"字段闭集漂移:{url}"
        for field in ts:
            assert py[field] == ts[field], f"{url} 的 {field}:py={py[field]!r} ts={ts[field]!r}"


def test_allowlisted_domain_proxied() -> None:
    facts = resolve_egress_facts("https://api.stepfun.com/step_plan/v1/models", PARITY_ENV)
    assert facts["proxied"] is True
    assert facts["policyDeclined"] is None
    assert facts["noProxyMatched"] is False


def test_internal_host_never_proxied() -> None:
    facts = resolve_egress_facts("http://10.0.0.1:8802/api", PARITY_ENV)
    assert facts["proxied"] is False
    assert facts["policyDeclined"] == "internal-host"


def test_no_proxy_hit_is_fact_not_route() -> None:
    """NO_PROXY 命中只作为事实回来,不改变路由(proxied=true ∧ noProxyMatched=true 是合法对)。"""
    facts = resolve_egress_facts("https://api.openai.com/v1/models", PARITY_ENV)
    assert facts["proxied"] is True
    assert facts["noProxyMatched"] is True
    assert facts["noProxyVar"] == "NO_PROXY"


def test_unparseable_url_is_its_own_bucket() -> None:
    facts = resolve_egress_facts("not a url", PARITY_ENV)
    assert facts["urlParseable"] is False
    assert facts["targetHostname"] is None
    assert facts["policyDeclined"] == "url-unparseable"


def test_unconfigured_proxy_declines_with_reason() -> None:
    facts = resolve_egress_facts("https://api.openai.com/v1", {})
    assert facts["proxied"] is False
    assert facts["proxySource"] == "none"
    assert facts["policyDeclined"] == "proxy-unconfigured"


def test_ca_state_and_env_var_names_only() -> None:
    """CA 状态单独一档;语料 env 不含通用代理变量 ⇒ envProxyVars 为空表(见 PARITY_ENV 注释)。"""
    facts = resolve_egress_facts("https://api.stepfun.com/x", PARITY_ENV)
    assert facts["customCa"] == "node-extra-ca-certs"
    assert facts["envProxyVars"] == []


def test_no_credential_material_in_facts() -> None:
    """两侧事实面都不得带出端口值 / 代理主机名 / CA 路径(守门 67 口径)。"""
    ts_facts = _load_ts_facts(PARITY_URLS)
    py_facts = [resolve_egress_facts(u, PARITY_ENV) for u in PARITY_URLS]
    for blob in (json.dumps(ts_facts), json.dumps(py_facts, ensure_ascii=False)):
        for forbidden in ("7897", "should-never-leak", "9999", "custom-ca.pem", "user:pass"):
            assert forbidden not in blob, f"事实面漏出了凭据语料:{forbidden}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
