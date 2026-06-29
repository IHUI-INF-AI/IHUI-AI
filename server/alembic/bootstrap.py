"""Alembic 迁移引导 — 在执行 `alembic revision --autogenerate` 前需先 import 所有 model。"""
import sys
from pathlib import Path

# 确保能 import app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# 强制 import 所有 model，让 Base.metadata 完整收集
from app.database import Base  # noqa: F401
from app.models.user_models import *  # noqa: F401, F403
from app.models.agent_models import *  # noqa: F401, F403
from app.models.agent_settlement import *  # noqa: F401, F403
from app.models.activity_models import *  # noqa: F401, F403
from app.models.payment_models import *  # noqa: F401, F403
from app.models.course_models import *  # noqa: F401, F403
from app.models.oauth_models import *  # noqa: F401, F403
from app.models.sys_models import *  # noqa: F401, F403
from app.models.token_models import *  # noqa: F401, F403
from app.models.app_content_models import *  # noqa: F401, F403
