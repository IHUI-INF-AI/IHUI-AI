"""新迁移模型的数据库表结构补齐脚本.

为以下新增模型创建表:
- SimpleBotConfig (coze_zhs_py/models/simple_bot_config.py)
- TBoxEventLog  (内存中, 不需要建表)
- AiBotSites (ZHS_Server_java small/domain/AiBotSites.java)
- PaymentCallback (ZHS_Server_java small/domain/PaymentCallback.java)
- TransferInfo (ZHS_Server_java small/domain/TransferInfo.java)
- UserAgentFreeTimes (ZHS_Server_java small/domain/UserAgentFreeTimes.java)
- WxPayNotification (ZHS_Server_java small/domain/WxPayNotification.java)

执行方式: python scripts/init_migrated_models.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from loguru import logger
from sqlalchemy.schema import MetaData

from app.database import ENGINES, Base


def init_migrated_models():
    """为迁移来的模型创建表结构."""
    logger.info("=" * 70)
    logger.info("开始初始化迁移模型表结构")
    logger.info("=" * 70)

    # 导入新模型
    imported = []
    try:
        from app.models import java_missing_models  # AiBotSites, PaymentCallback, TransferInfo, UserAgentFreeTimes, WxPayNotification
        imported.append("java_missing_models")
    except ImportError as e:
        logger.warning(f"导入 java_missing_models 失败: {e}")

    try:
        from app.models import simple_bot_config  # SimpleBotConfig
        imported.append("simple_bot_config")
    except ImportError as e:
        logger.warning(f"导入 simple_bot_config 失败: {e}")

    # tbox_models 中 TBoxEventLog 是内存存储, 不建表

    if not imported:
        logger.error("未导入任何新模型, 请检查 models/ 目录")
        return False

    logger.info(f"已导入新模型模块: {imported}")

    # 收集需要新建的表
    target_tables = {
        "ai_bot_sites",
        "payment_callbacks",
        "transfer_infos",
        "user_agent_free_times",
        "wx_pay_notifications",
        "simple_bot_configs",
    }

    new_tables = []
    for table_name in target_tables:
        if table_name in Base.metadata.tables:
            new_tables.append(Base.metadata.tables[table_name])
        else:
            logger.warning(f"未找到表: {table_name}")

    logger.info(f"需要创建 {len(new_tables)} 个新表: {[t.name for t in new_tables]}")

    if not new_tables:
        logger.warning("没有需要创建的表")
        return True

    # 按数据库引擎创建
    for eng_name, eng in ENGINES.items():
        try:
            url = str(eng.url)
            if url.startswith("sqlite"):
                tmp_meta = MetaData()
                for table in new_tables:
                    if table.schema is None:
                        table.to_metadata(tmp_meta)
                    else:
                        table.to_metadata(tmp_meta, schema=None)
                tmp_meta.create_all(bind=eng)
                logger.info(f"[{eng_name}] (SQLite) 新模型表创建完成 ({len(tmp_meta.tables)} 个表)")
            else:
                for table in new_tables:
                    table.create(bind=eng, checkfirst=True)
                logger.info(f"[{eng_name}] 新模型表创建完成 ({len(new_tables)} 个表)")
        except Exception as e:
            logger.error(f"[{eng_name}] 创建失败: {e}")
            return False

    logger.info("=" * 70)
    logger.info("迁移模型表结构初始化完成")
    logger.info("=" * 70)
    return True


if __name__ == "__main__":
    success = init_migrated_models()
    sys.exit(0 if success else 1)
