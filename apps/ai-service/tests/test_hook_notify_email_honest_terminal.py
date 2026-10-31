# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""notify(email) hook 的诚实终态(2026-11-01 安全强化)。

缺陷:`HookEngine._notify_email` 原先 `except ImportError: return None  # 降级视为成功`,
而 `app/services/email_service.py` 在本仓**不存在** —— 于是每一枚 `notify: email` hook
都在"从未投递"的情况下报告成功。Hook 是审计/告警的到人通道(本仓到人只有邮件一条,
AGENTS §5e),把"没送到"说成"送到了"就是本仓反复实测到的那条失效形态:安静。

本文件的三条例据各有反向牙:① 前提仍在(模块确实不存在)、② 行为(必须返回失败)、
③ 形状(ImportError 分支里不得再出现 return None)。
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

from app.services.hook_engine import HookEngine


def test_premise_email_service_still_absent() -> None:
    """前提锁:出口确实不存在。哪天补上了邮件出口,这条会红,提醒重判本用例与实现。"""
    assert importlib.util.find_spec("app.services.email_service") is None
    assert not Path("app/services/email_service.py").exists()


@pytest.mark.asyncio
async def test_notify_email_reports_failure_instead_of_fake_success() -> None:
    engine = HookEngine()
    result = await engine._notify_email(
        {"to": "ops@example.com"}, "deploy.failed", "构建失败", {}
    )
    assert result is not None, "未投递却返回成功(None)= 把告警埋掉的假绿"
    assert isinstance(result, str)
    assert "未投递" in result


@pytest.mark.asyncio
async def test_notify_email_missing_recipient_also_fails_honestly() -> None:
    """config 里没有 to/email 时同样不能冒成功(取不到输入 ⇒ 未判定,不是"没问题")。"""
    engine = HookEngine()
    result = await engine._notify_email({}, "deploy.failed", "x", {})
    assert result is not None


def test_import_error_branch_does_not_claim_success() -> None:
    """形状锁:ImportError 分支里不得再写 return None(散文里引用旧写法不算)。"""
    src = Path("app/services/hook_engine.py").read_text(encoding="utf-8")
    at = src.index("async def _notify_email")
    body = src[at : at + 2200]
    code = "\n".join(
        line for line in body.split("\n") if not line.lstrip().startswith("#")
    )
    except_at = code.index("except ImportError")
    tail = code[except_at : except_at + 700]
    assert "return None" not in tail, "ImportError 分支又回到'降级视为成功'"
    assert "return (" in tail or 'return "' in tail
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
