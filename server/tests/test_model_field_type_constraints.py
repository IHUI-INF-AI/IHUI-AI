"""test_model_field_type_constraints

CI 强制: 所有 model 主键必须是 String(32/64) 或 Integer (A.1/A.2/A.4 修复后的回归防护).

历史背景: 2026-06-27 凌晨修复 6 处主键违规 (Activity/AgentSettlement/WithdrawalDetail/
  CrewSession/Task/Message). 此测试防止后续重构重新引入 String(36/255)/GUID 类型主键.

运行: pytest tests/test_model_field_type_constraints.py -v
"""
from __future__ import annotations

import inspect
from typing import Type

import pytest
from sqlalchemy import BigInteger, Integer, SmallInteger, String

from app.database import Base


def _all_concrete_models() -> list[Type[Base]]:
    import app.models  # noqa: F401  触发所有 model 注册
    out: list[Type[Base]] = []
    for _, obj in inspect.getmembers(app.models):
        if (
            inspect.isclass(obj)
            and issubclass(obj, Base)
            and obj is not Base
            and obj.__dict__.get("__tablename__") is not None
        ):
            out.append(obj)
    return out


@pytest.mark.parametrize("model_class", _all_concrete_models(), ids=lambda c: c.__name__)
def test_pk_is_string64_or_integer(model_class: Type[Base]) -> None:
    """主键 id 列必须是 String(32/64) 或 Integer (含 BigInteger/SmallInteger)."""
    pk_cols = list(model_class.__table__.primary_key.columns)
    assert pk_cols, f"{model_class.__name__} 没有主键"
    for col in pk_cols:
        ct = col.type
        ok = (
            (isinstance(ct, String) and ct.length in (32, 64))
            or isinstance(ct, (Integer, BigInteger, SmallInteger))
        )
        assert ok, (
            f"{model_class.__name__}.{col.name} 主键类型 = {ct!r}, "
            f"必须是 String(32/64) 或 Integer/BigInteger/SmallInteger"
        )
