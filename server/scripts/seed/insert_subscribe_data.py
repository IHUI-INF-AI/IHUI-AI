#!/usr/bin/env python3
"""
模拟直播订阅数据插入脚本 - 迁移自 service_2/insert_subscribe_data.js
"""

import os
import sys
import random
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from sqlalchemy import text
from app.database import async_session_maker


async def insert_subscribe_data():
    """为每个直播频道插入模拟订阅数据"""
    async with async_session_maker() as session:
        result = await session.execute(
            text("SELECT id, name FROM t_channel")
        )
        channels = result.fetchall()
        print(f"找到 {len(channels)} 个直播频道")

        if not channels:
            print("没有直播频道，退出")
            return

        print("开始插入直播订阅数据...")
        total_inserted = 0

        for channel in channels:
            subscribe_count = 30 + random.randint(0, 170)
            for _ in range(subscribe_count):
                member_id = 1 + random.randint(0, 29)
                days_ago = random.randint(0, 59)

                try:
                    await session.execute(
                        text("""INSERT IGNORE INTO t_subscribe (member_id, channel_id, create_time, update_time)
                                VALUES (:member_id, :channel_id, DATE_SUB(NOW(), INTERVAL :days DAY), NOW())"""),
                        {"member_id": member_id, "channel_id": channel.id, "days": days_ago}
                    )
                    total_inserted += 1
                except Exception:
                    pass

            print(f"直播 \"{channel.name}\" (ID: {channel.id}) 已处理")

        await session.commit()
        print(f"\n总共插入 {total_inserted} 条订阅记录")

        result = await session.execute(
            text("""SELECT c.id AS channel_id, c.name AS channel_name, COUNT(DISTINCT s.member_id) AS subscribe_count
                    FROM t_channel c LEFT JOIN t_subscribe s ON c.id = s.channel_id
                    GROUP BY c.id, c.name ORDER BY subscribe_count DESC LIMIT 15""")
        )
        print("\n直播订阅人数统计:")
        for row in result.fetchall():
            print(f"  {row.channel_name}: {row.subscribe_count} 人")


if __name__ == "__main__":
    asyncio.run(insert_subscribe_data())
