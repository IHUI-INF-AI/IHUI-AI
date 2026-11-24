# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""操作级 disabled 拒执门的反向用例(2026-11-24)。

声明与执行曾漂移:ConnectorOperation.disabled 注释写"默认停用、需显式 opt-in",
但 custom_http.CustomHttpConnector.invoke() 从不读它,带 disabled=True 的操作照样执行。
本文件钉住执行层 fail-closed 行为,并用变异验证防"注释绿、代码不绿"。
"""
from __future__ import annotations

import pytest

from app.services.connectors import custom_http


def _connector(*, disabled: bool, allow_write: bool = True, capability: str = "action"):
    """构造一个不触网的最小连接器:disabled 门在 _execute 之前,永不发请求。"""
    return custom_http.CustomHttpConnector(
        {
            "key": "gate-test",
            "spec": {
                "base_url": "https://example.invalid",
                "auth_kind": "none",
                "allow_write": allow_write,
            },
            "operations": [
                {
                    "id": "op1",
                    "capability": capability,
                    "method": "POST" if capability == "action" else "GET",
                    "path": "/x",
                    "disabled": disabled,
                }
            ],
        }
    )


@pytest.mark.asyncio
async def test_disabled_action_refused_even_with_write_allowed():
    """显式 disabled=True 的写操作:即使连接器开了 allow_write,也必须拒执。"""
    conn = _connector(disabled=True, allow_write=True)
    with pytest.raises(custom_http.ConnectorExecutionError, match="操作已停用"):
        await conn.invoke("op1")


@pytest.mark.asyncio
async def test_disabled_read_also_refused():
    """字段语义是"这条操作停用",不限于写 —— 读操作置 True 同样拒。"""
    conn = _connector(disabled=True, allow_write=False, capability="list")
    with pytest.raises(custom_http.ConnectorExecutionError, match="操作已停用"):
        await conn.invoke("op1")


@pytest.mark.asyncio
async def test_missing_disabled_defaults_to_executable():
    """缺省门:存量 operations 与内置模板都没有这个键,必须仍可执行(不被误拒)。

    这里只验到"越过 disabled 门":后续缺占位符/不可达域名会抛别的错,但绝不是
    "操作已停用"。若有人把 from_dict 缺省改成 True,这条会先撞 disabled 门而红。
    """
    conn = custom_http.CustomHttpConnector(
        {
            "key": "no-disabled-key",
            "spec": {"base_url": "https://example.invalid", "auth_kind": "none", "allow_write": True},
            "operations": [
                {"id": "op1", "capability": "action", "method": "POST", "path": "/x"}
            ],
        }
    )
    with pytest.raises(Exception) as exc:
        await conn.invoke("op1")
    # 越过 disabled 门后可能在 _execute 里因无网/缺参失败;任何一种都不是"已停用"
    assert "操作已停用" not in str(exc.value)


@pytest.mark.asyncio
async def test_disabled_false_executable():
    """显式 False 不能被误当停用,同样只验越门。"""
    conn = _connector(disabled=False, allow_write=True)
    with pytest.raises(Exception) as exc:
        await conn.invoke("op1")
    assert "操作已停用" not in str(exc.value)


def test_mutation_lock_gate_line_present():
    """变异锁:源码里那句拒执门被抹掉即红(防注释写绿、代码没绿)。"""
    import inspect

    src = inspect.getsource(custom_http.CustomHttpConnector.invoke)
    assert "if op.disabled:" in src
    assert "操作已停用" in src
    broken = src.replace("if op.disabled:", "if False:")
    assert broken != src
    assert "if op.disabled:" not in broken
