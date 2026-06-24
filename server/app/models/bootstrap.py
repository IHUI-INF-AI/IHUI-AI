"""触发所有 model 加载,让 Base.metadata 收集到所有表.

复用 app/models/__init__.py 的完整导入清单, 避免漏掉新增模型导致
autogenerate 误判 (例如 chat_room/crew/knowledge/learn/java_missing 等).
"""
import app.models  # noqa: F401
