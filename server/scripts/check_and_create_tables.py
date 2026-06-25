"""检查数据库连接和表状态"""
import os
import sys

print("=== 环境变量检查 ===")
print(f"ENV: {os.environ.get('ENV', '未设置')}")
print(f"DB_HOST: {os.environ.get('DB_HOST', '未设置')}")
print(f"DB_NAME: {os.environ.get('DB_NAME', '未设置')}")

print()
print("=== 数据库连接测试 ===")
try:
    from app.database import get_session
    from sqlalchemy import text
    with get_session() as db:
        result = db.execute(text("SELECT 1 as test"))
        print("[OK] 数据库连接成功")
        # 检查新表是否已存在
        for table in ["power_purchase_rule", "zhs_developer_fund_logs", "zhs_user_sys_link"]:
            try:
                db.execute(text(f"SELECT 1 FROM {table} LIMIT 1"))
                print(f"[OK] 表 {table} 已存在")
            except Exception:
                print(f"[INFO] 表 {table} 不存在，需要创建")
except Exception as e:
    print(f"[FAIL] 数据库连接失败: {e}")
    sys.exit(1)

print()
print("=== 使用 create_all 创建新表 ===")
try:
    from app.database import get_session_for_table, engine1, engine2, engine3
    from app.models.java_missing_models import PowerPurchaseRule, ZhsDeveloperFundLogs, ZhsUserSysLink
    new_tables = [
        ("power_purchase_rule", PowerPurchaseRule.__table__),
        ("zhs_developer_fund_logs", ZhsDeveloperFundLogs.__table__),
        ("zhs_user_sys_link", ZhsUserSysLink.__table__),
    ]
    # 尝试在各个 engine 上创建
    for engine in [engine1, engine2, engine3]:
        if engine is None:
            continue
        try:
            for name, table in new_tables:
                if not table.exists(engine):
                    table.create(engine, checkfirst=True)
                    print(f"[OK] 在 engine 上创建表: {name}")
                else:
                    print(f"[SKIP] 表已存在: {name}")
            break
        except Exception as e:
            print(f"[WARN] engine 创建失败: {e}")
            continue
    print("[OK] 新表创建流程完成")
except Exception as e:
    print(f"[FAIL] 创建表失败: {e}")
    import traceback
    traceback.print_exc()
