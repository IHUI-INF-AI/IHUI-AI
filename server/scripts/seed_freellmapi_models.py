"""同步 FreeLLMAPI 模型清单到 zhs_ai_model_info / zhs_ai_model_info_unify.

FreeLLMAPI 是本地聚合代理 (https://github.com/tashfeenahmed/freellmapi),
把多家 LLM 厂商的免费额度聚合到一个 OpenAI 兼容端点 (/v1).
本脚本从 {FREELLMAPI_BASE_URL}/models 拉取模型清单, 幂等写入两张表:
  - zhs_ai_model_info:        前端模型选择器数据源 (name/source/status/sort)
  - zhs_ai_model_info_unify:  LLM 统一路由表 (code/model_code/url/quest_type/manufacturer)

执行:
  python -m scripts.seed_freellmapi_models

幂等: 已存在 (按 name/code 匹配) 的模型跳过, 不覆盖自定义配置.
依赖:
  - 表结构必须先建好 (python -m scripts.init_db 或 alembic upgrade head)
  - httpx (后端已依赖)
  - server/.env.production 含 FREELLMAPI_API_KEY / FREELLMAPI_BASE_URL
"""
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import httpx
from loguru import logger
from sqlalchemy import Engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import SessionFactory1, engine1


# ──────────────────────────────────────────────────────────
# FreeLLMAPI 模型清单拉取
# ──────────────────────────────────────────────────────────
def fetch_freellmapi_models(base_url: str | None = None, api_key: str | None = None) -> list[dict]:
    """从 FreeLLMAPI /v1/models 端点拉取模型清单.

    FreeLLMAPI 是 OpenAI 兼容端点, /v1/models 返回:
      {"object": "list", "data": [{"id": "gpt-4", "object": "model", "owned_by": "openai"}, ...]}

    Args:
        base_url: 覆盖 settings.FREELLMAPI_BASE_URL (测试用)
        api_key:  覆盖 settings.FREELLMAPI_API_KEY (测试用)

    Returns:
        模型列表, 每项 {"id": str, "owned_by": str, "object": "model"}.
        拉取失败返回空列表 (不抛异常, 允许 FreeLLMAPI 离线时跳过 seed).
    """
    url_base = (base_url or settings.FREELLMAPI_BASE_URL).rstrip("/")
    # /v1/models 端点 (base_url 已含 /v1 时直接拼接 /models)
    if url_base.endswith("/v1"):
        models_url = f"{url_base}/models"
    else:
        models_url = f"{url_base}/v1/models"
    key = api_key if api_key is not None else settings.FREELLMAPI_API_KEY
    headers = {"Authorization": f"Bearer {key}"} if key else {}

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(models_url, headers=headers)
            resp.raise_for_status()
            payload = resp.json()
        data = payload.get("data") if isinstance(payload, dict) else payload
        if not isinstance(data, list):
            logger.warning(f"[seed_freellmapi] /v1/models 返回非预期格式: {type(payload)}")
            return []
        models = [m for m in data if isinstance(m, dict) and m.get("id")]
        logger.info(f"[seed_freellmapi] 拉取到 {len(models)} 个模型 from {models_url}")
        return models
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[seed_freellmapi] 拉取失败 ({models_url}): {e}")
        return []


# ──────────────────────────────────────────────────────────
# DB 写入 (幂等)
# ──────────────────────────────────────────────────────────
def _ensure_tables_exist(engine: Engine) -> None:
    """幂等确保 zhs_ai_model_info / zhs_ai_model_info_unify 表存在.

    生产环境由 alembic 010_add_ai_model_unify 迁移建表, 这里只做兜底.
    """
    existing = set(inspect(engine).get_table_names())
    if "zhs_ai_model_info" not in existing:
        logger.warning("[seed_freellmapi] zhs_ai_model_info 表不存在, 请先运行 alembic upgrade head")
    if "zhs_ai_model_info_unify" not in existing:
        logger.warning("[seed_freellmapi] zhs_ai_model_info_unify 表不存在, 请先运行 alembic 010 迁移")


def seed_models(
    models: list[dict],
    engine: Engine | None = None,
) -> dict:
    """幂等写入模型清单到 zhs_ai_model_info + zhs_ai_model_info_unify.

    Args:
        models: fetch_freellmapi_models() 返回的模型列表
        engine: 可选, 指定数据库引擎 (测试隔离). 默认全局 engine1.

    Returns:
        {"inserted_info": int, "skipped_info": int, "inserted_unify": int, "skipped_unify": int}
    """
    if not models:
        logger.info("[seed_freellmapi] 无模型可写入, 跳过")
        return {"inserted_info": 0, "skipped_info": 0, "inserted_unify": 0, "skipped_unify": 0}

    target_engine = engine or engine1
    _ensure_tables_exist(target_engine)

    factory = sessionmaker(bind=target_engine) if engine is not None else SessionFactory1
    inserted_info = 0
    skipped_info = 0
    inserted_unify = 0
    skipped_unify = 0

    with factory() as db:
        for idx, m in enumerate(models):
            model_id = m.get("id", "")
            owner = m.get("owned_by", "freellmapi")
            if not model_id:
                continue

            # ── 1. zhs_ai_model_info (按 name 去重) ──
            existing_info = db.execute(
                text("SELECT id FROM zhs_ai_model_info WHERE name = :name"),
                {"name": model_id},
            ).first()
            if existing_info:
                skipped_info += 1
            else:
                db.execute(text("""
                    INSERT INTO zhs_ai_model_info (id, name, source, icon, description, status, sort)
                    VALUES (:id, :name, :source, :icon, :description, :status, :sort)
                """), {
                    "id": str(uuid.uuid4()),
                    "name": model_id,
                    "source": "freellmapi",
                    "icon": "",
                    "description": f"FreeLLMAPI 聚合模型 ({owner})",
                    "status": 1,
                    "sort": idx,
                })
                inserted_info += 1

            # ── 2. zhs_ai_model_info_unify (按 code 去重) ──
            existing_unify = db.execute(
                text("SELECT id FROM zhs_ai_model_info_unify WHERE code = :code"),
                {"code": model_id},
            ).first()
            if existing_unify:
                skipped_unify += 1
            else:
                # quest_type=http (FreeLLMAPI 是 HTTP OpenAI 兼容端点)
                # url 指向 FreeLLMAPI base, access_key 留空 (运行时从 settings 读)
                db.execute(text("""
                    INSERT INTO zhs_ai_model_info_unify
                        (id, code, type, name, model_code, img, url, access_key,
                         task_generation, task_query, quest_type, variables, manufacturer,
                         is_gratis, is_del, is_new, is_top, is_hot, sort,
                         open_desc, model_desc, grass_roots, created_at, updated_at)
                    VALUES
                        (:id, :code, :type, :name, :model_code, :img, :url, :access_key,
                         :task_generation, :task_query, :quest_type, :variables, :manufacturer,
                         :is_gratis, :is_del, :is_new, :is_top, :is_hot, :sort,
                         :open_desc, :model_desc, :grass_roots, :created_at, :updated_at)
                """), {
                    "id": str(uuid.uuid4()),
                    "code": model_id,
                    "type": "chat",
                    "name": model_id,
                    "model_code": model_id,
                    "img": "",
                    "url": settings.FREELLMAPI_BASE_URL,
                    "access_key": "",
                    "task_generation": "",
                    "task_query": "",
                    "quest_type": "http",
                    "variables": "{}",
                    "manufacturer": "freellmapi",
                    "is_gratis": 1,
                    "is_del": 0,
                    "is_new": 0,
                    "is_top": 0,
                    "is_hot": 0,
                    "sort": idx,
                    "open_desc": f"FreeLLMAPI 聚合模型 ({owner})",
                    "model_desc": "",
                    "grass_roots": "",
                    "created_at": None,
                    "updated_at": None,
                })
                inserted_unify += 1

        db.commit()

    return {
        "inserted_info": inserted_info,
        "skipped_info": skipped_info,
        "inserted_unify": inserted_unify,
        "skipped_unify": skipped_unify,
    }


# ──────────────────────────────────────────────────────────
# 主入口
# ──────────────────────────────────────────────────────────
def main() -> int:
    logger.info("[seed_freellmapi] 开始同步 FreeLLMAPI 模型清单")
    logger.info(f"[seed_freellmapi] BASE_URL={settings.FREELLMAPI_BASE_URL}")

    if not settings.FREELLMAPI_API_KEY:
        logger.warning("[seed_freellmapi] FREELLMAPI_API_KEY 为空, /v1/models 可能返回 401")

    models = fetch_freellmapi_models()
    if not models:
        logger.warning("[seed_freellmapi] 未拉取到模型 (FreeLLMAPI 离线或未配置), 跳过 seed")
        return 0

    result = seed_models(models)
    logger.info(
        f"[seed_freellmapi] ✓ 同步完成: "
        f"zhs_ai_model_info (新增 {result['inserted_info']}, 跳过 {result['skipped_info']}), "
        f"zhs_ai_model_info_unify (新增 {result['inserted_unify']}, 跳过 {result['skipped_unify']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
