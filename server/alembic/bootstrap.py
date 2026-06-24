"""Alembic 迁移引导 — 在执行 `alembic revision --autogenerate` 前需先 import 所有 model。"""
import sys
from pathlib import Path

# 确保能 import app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# 强制 import 所有 model，让 Base.metadata 完整收集.
# 复用 app/models/__init__.py 的完整导入清单, 避免漏掉新增模型导致 autogenerate 误判.
from app.database import Base  # noqa: F401
import app.models  # noqa: F401

