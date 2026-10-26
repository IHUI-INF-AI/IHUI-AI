# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""凭据保险库(Vault,2026-10-26 P0-2,对标 nanoMuse ``{{vault:NAME}}``)。

设计四条铁律(与 nanoMuse Sentinel 同口径):
1. 模型视野里只出现占位符 ``{{vault:NAME}}``,绝不出现真值;
2. 审批通过后,``resolve_vault_references`` 才把占位符替换回真值;
3. 工具输出若命中真值,``redact_vault_values`` 自动脱敏为 ``[REDACTED:NAME]``;
4. 子进程环境经 ``filter_vault_env`` 过滤,不继承凭据形环境变量(值绝不外带)。

纯函数内核:VaultStore 仅由调用方注入(测试用内存 dict);本模块不接触
任何后端、不读写文件、不发网络。
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass, field

# 占位符语法:{{ vault:NAME }} —— NAME 只允许标识符/点/连字符(防注入构造)
VAULT_PLACEHOLDER_RE = re.compile(r"\{\{\s*vault:\s*([A-Za-z0-9_.\-]+)\s*\}\}")
# 脱敏形态:[REDACTED:NAME]
REDACTED_FMT = "[REDACTED:{}]"


@dataclass
class VaultStore:
    """凭据保险库内存态(调用方决定持久化与注入方式)。"""

    _values: dict[str, str] = field(default_factory=dict)
    # 凭据形环境变量名:子进程过滤时剔除(及其值绝不外带)
    _env_keys: set[str] = field(default_factory=set)

    def put(self, name: str, value: str, *, env_key: "str | None" = None) -> None:
        """存入一个凭据槽(真值只在保险库内,模型看不到)。"""
        self._values[name] = value
        if env_key:
            self._env_keys.add(env_key)

    def get(self, name: str) -> "str | None":
        return self._values.get(name)

    def names(self) -> "list[str]":
        return list(self._values)

    def env_keys(self) -> "set[str]":
        return set(self._env_keys)


def resolve_vault_references(text: str, store: VaultStore) -> str:
    """审批通过后:占位符 → 真值。未知 NAME 保留占位符(绝不泄漏/绝不编造)。

    这是"保险库钥匙交出去"的唯一出口;调用方必须确认本次调用已通过审批。
    """

    def _sub(m: re.Match[str]) -> str:
        name = m.group(1)
        val = store.get(name)
        return val if val is not None else m.group(0)

    return VAULT_PLACEHOLDER_RE.sub(_sub, text)


def mask_vault_values(text: str, store: VaultStore) -> str:
    """把文本里的真值隐去为 ``{{vault:NAME}}``(出库前/回显前调用,可逆准备)。

    反向于 resolve:任何出现在保险库里的真值,只要在文本中,都替换为占位符,
    确保真值不进模型上下文、SSE 流与 transcript。真值应为高熵字符串(典型
    API key),短值/常见词误伤风险由调用方把关。
    """
    result = text
    for name in store.names():
        val = store.get(name)
        if not val:
            continue
        result = result.replace(val, "{{vault:" + name + "}}")
    return result


def redact_vault_values(text: str, store: VaultStore) -> str:
    """工具输出命中真值 ⇒ ``[REDACTED:NAME]``(入库/落日志前调用,不可逆)。"""
    result = text
    for name in store.names():
        val = store.get(name)
        if not val:
            continue
        result = result.replace(val, REDACTED_FMT.format(name))
    return result


def filter_vault_env(env: Mapping[str, str], store: VaultStore) -> "dict[str, str]":
    """子进程环境:剔除凭据形环境变量;返回值副本(绝不外带真值到子进程)。"""
    env_keys = store.env_keys()
    return {k: v for k, v in env.items() if k not in env_keys}
