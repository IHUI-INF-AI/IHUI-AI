"""
初始化 zhs_ai_model_info_unify 表并插入测试模型.

⚠️ 安全提示: access_key 字段已脱敏为占位符 <YOUR_ZHIPU_API_KEY>
生产部署时通过 env (ZHIPU_API_KEY) 注入, 详见 docs/PRODUCTION_CREDENTIALS.md

用法:
    cd server
    # 1. 复制 .env.production.example 为 .env.production 并填入 ZHIPU_API_KEY
    # 2. 执行初始化
    python -m scripts.init_llm_model
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine1, get_session


# 占位符 - 部署时从 ZHIPU_API_KEY 环境变量注入
ZHIPU_API_KEY_PLACEHOLDER = os.environ.get("ZHIPU_API_KEY", "<YOUR_ZHIPU_API_KEY>")


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS zhs_ai_model_info_unify (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(64) NOT NULL UNIQUE,
    type VARCHAR(20),
    name VARCHAR(100),
    model_code VARCHAR(100),
    img VARCHAR(500),
    url VARCHAR(500),
    access_key VARCHAR(500),
    task_generation TEXT,
    task_query TEXT,
    quest_type VARCHAR(20),
    variables TEXT,
    manufacturer VARCHAR(50),
    is_gratis INTEGER DEFAULT 1,
    is_del INTEGER DEFAULT 0,
    sort INTEGER DEFAULT 0,
    open_desc TEXT,
    model_desc TEXT,
    grass_roots INTEGER DEFAULT 0,
    is_new INTEGER DEFAULT 0,
    is_top INTEGER DEFAULT 0,
    is_hot INTEGER DEFAULT 0
)
"""


def init():
    """创建表并插入测试模型."""
    print("[LLM Init] 开始初始化...")

    # 创建表
    with engine1.begin() as conn:
        conn.execute(text(CREATE_TABLE_SQL))
    print("[LLM Init] 表 zhs_ai_model_info_unify 创建成功 (或已存在)")

    # 检查是否已有数据
    with get_session() as db:
        count = db.execute(text("SELECT COUNT(*) FROM zhs_ai_model_info_unify")).scalar()
        if count > 0:
            print(f"[LLM Init] 表中已有 {count} 条记录, 跳过插入")
            return

        # 插入智谱 GLM 模型 (access_key 从 ZHIPU_API_KEY 环境变量注入)
        db.execute(text("""
            INSERT INTO zhs_ai_model_info_unify
                (code, type, name, model_code, url, access_key,
                 quest_type, manufacturer, is_gratis, is_del, sort,
                 open_desc, model_desc)
            VALUES
                ('zhipu_glm4_flash', 'chat', '智谱GLM-4-Flash (免费)',
                 'glm-4-flash',
                 'https://open.bigmodel.cn/api/paas/v4',
                 :api_key,
                 'openai', 'zhipu', 1, 0, 1,
                 '智谱清言GLM-4-Flash, 免费模型, 适合快速测试',
                 'GLM-4-Flash是智谱AI推出的免费大语言模型, 支持中英文对话'),
                ('zhipu_glm4', 'chat', '智谱GLM-4',
                 'glm-4',
                 'https://open.bigmodel.cn/api/paas/v4',
                 :api_key,
                 'openai', 'zhipu', 0, 0, 2,
                 '智谱清言GLM-4, 高质量模型',
                 'GLM-4是智谱AI的旗舰大语言模型, 具备强大的推理能力')
        """), {"api_key": ZHIPU_API_KEY_PLACEHOLDER})
        db.commit()

    print("[LLM Init] 插入 2 个智谱模型")
    print(f"[LLM Init] access_key 来源: {'env (ZHIPU_API_KEY)' if ZHIPU_API_KEY_PLACEHOLDER != '<YOUR_ZHIPU_API_KEY>' else '占位符 (请设置 ZHIPU_API_KEY)'}")
    print("[LLM Init] 初始化完成.")


if __name__ == "__main__":
    init()
