#!/usr/bin/env python3
"""
模拟报名数据插入脚本 - 迁移自 service_2/insert_data.js

为每个已发布的课程生成模拟报名数据。
使用 SQLAlchemy 或原始 SQL 直接操作数据库。
"""

import os
import sys
import random
import asyncio

# 添加项目根目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from sqlalchemy import text
from app.database import async_session_maker


async def insert_mock_signup_data():
    """为每个已发布课程插入模拟报名数据"""
    async with async_session_maker() as session:
        # 1. 查询已发布的课程
        result = await session.execute(
            text("SELECT id, name FROM t_lesson WHERE status = 'published'")
        )
        lessons = result.fetchall()
        print(f"找到 {len(lessons)} 个已发布课程")

        if not lessons:
            print("没有已发布课程，退出")
            return

        # 2. 确保有模拟会员数据
        print("检查并创建模拟会员...")
        for i in range(1, 31):
            try:
                await session.execute(
                    text("""INSERT IGNORE INTO t_member (id, name, phone, status, create_time, update_time)
                            VALUES (:id, :name, :phone, 'active', NOW(), NOW())"""),
                    {"id": i, "name": f"用户{i}", "phone": f"1380000{i:04d}"}
                )
            except Exception:
                pass
        await session.commit()

        # 3. 为每个课程插入报名数据
        print("开始插入报名数据...")
        total_inserted = 0

        for lesson in lessons:
            signup_count = 50 + random.randint(0, 250)
            for _ in range(signup_count):
                member_id = 1 + random.randint(0, 29)
                status = "sign_up" if random.random() < 0.85 else ("completed" if random.random() < 0.9 else "cancel_sign_up")
                days_ago = random.randint(0, 89)

                try:
                    await session.execute(
                        text("""INSERT IGNORE INTO t_sign_up (member_id, lesson_id, status, create_time, update_time)
                                VALUES (:member_id, :lesson_id, :status, DATE_SUB(NOW(), INTERVAL :days DAY), NOW())"""),
                        {"member_id": member_id, "lesson_id": lesson.id, "status": status, "days": days_ago}
                    )
                    total_inserted += 1
                except Exception:
                    pass

            print(f"课程 \"{lesson.name}\" (ID: {lesson.id}) 已处理")

        await session.commit()
        print(f"\n总共插入 {total_inserted} 条报名记录")

        # 4. 验证结果
        result = await session.execute(
            text("""SELECT l.id AS lesson_id, l.name AS lesson_name, COUNT(DISTINCT s.member_id) AS signup_count
                    FROM t_lesson l LEFT JOIN t_sign_up s ON l.id = s.lesson_id
                    WHERE l.status = 'published' GROUP BY l.id, l.name ORDER BY signup_count DESC LIMIT 10""")
        )
        print("\n前10个课程报名人数:")
        for row in result.fetchall():
            print(f"  {row.lesson_name}: {row.signup_count} 人")


if __name__ == "__main__":
    asyncio.run(insert_mock_signup_data())
