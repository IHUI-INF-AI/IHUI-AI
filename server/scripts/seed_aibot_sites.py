"""Seed aibot_sites table with sample AI tool data for the AI World page.

Run: python -m scripts.seed_aibot_sites
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text, create_engine, inspect
from sqlalchemy.orm import Session

from app.database import SessionFactory1
from app.models.java_missing_models import AiBotSites

SAMPLE_SITES = [
    # === AI图像工具 ===
    {
        "name": "Midjourney",
        "short_desc": "AI 绘画生成工具，输入文字描述即可生成高质量艺术图片",
        "section": "AI图像工具",
        "sub_section": "常用AI图像工具|AI图片生成",
        "icon_url": "https://www.midjourney.com/apple-touch-icon.png",
        "detail_url": "/sites/midjourney.html",
        "official_url": "https://www.midjourney.com",
        "panel_html": "<p>Midjourney 是一款强大的 AI 绘画工具...</p>",
    },
    {
        "name": "Stable Diffusion",
        "short_desc": "开源 AI 图像生成模型，支持本地部署与自定义训练",
        "section": "AI图像工具",
        "sub_section": "常用AI图像工具|AI图片生成",
        "icon_url": "https://stability.ai/favicon.ico",
        "detail_url": "/sites/stable-diffusion.html",
        "official_url": "https://stability.ai",
        "panel_html": "<p>Stable Diffusion 是一款开源的 AI 图像生成模型...</p>",
    },
    {
        "name": "Remove.bg",
        "short_desc": "AI 一键移除图片背景，快速高效",
        "section": "AI图像工具",
        "sub_section": "常用AI图像工具|AI图片背景移除",
        "icon_url": "https://www.remove.bg/favicon.ico",
        "detail_url": "/sites/remove-bg.html",
        "official_url": "https://www.remove.bg",
        "panel_html": "<p>Remove.bg 使用 AI 技术一键移除图片背景...</p>",
    },
    {
        "name": "Upscaler",
        "short_desc": "AI 图片无损放大工具，提升图片分辨率",
        "section": "AI图像工具",
        "sub_section": "常用AI图像工具|AI图片放大",
        "icon_url": "https://upscaler.com/favicon.ico",
        "detail_url": "/sites/upscaler.html",
        "official_url": "https://upscaler.com",
        "panel_html": "<p>Upscaler 使用 AI 技术无损放大图片...</p>",
    },
    # === AI办公工具 ===
    {
        "name": "ChatGPT",
        "short_desc": "OpenAI 推出的 AI 对话助手，支持写作、编程、分析等多种任务",
        "section": "AI办公工具",
        "sub_section": "AI对话助手|通用对话",
        "icon_url": "https://chat.openai.com/favicon.ico",
        "detail_url": "/sites/chatgpt.html",
        "official_url": "https://chat.openai.com",
        "panel_html": "<p>ChatGPT 是 OpenAI 推出的 AI 对话助手...</p>",
    },
    {
        "name": "Claude",
        "short_desc": "Anthropic 推出的 AI 助手，擅长长文本分析与写作",
        "section": "AI办公工具",
        "sub_section": "AI对话助手|通用对话",
        "icon_url": "https://claude.ai/favicon.ico",
        "detail_url": "/sites/claude.html",
        "official_url": "https://claude.ai",
        "panel_html": "<p>Claude 是 Anthropic 推出的 AI 助手...</p>",
    },
    {
        "name": "Notion AI",
        "short_desc": "Notion 集成的 AI 写作助手，支持文档摘要、翻译、润色",
        "section": "AI办公工具",
        "sub_section": "AI写作工具|文档写作",
        "icon_url": "https://www.notion.so/favicon.ico",
        "detail_url": "/sites/notion-ai.html",
        "official_url": "https://www.notion.so",
        "panel_html": "<p>Notion AI 是 Notion 集成的 AI 写作助手...</p>",
    },
    {
        "name": "Gamma",
        "short_desc": "AI 一键生成 PPT 演示文稿，输入主题自动排版",
        "section": "AI办公工具",
        "sub_section": "AI写作工具|PPT生成",
        "icon_url": "https://gamma.app/favicon.ico",
        "detail_url": "/sites/gamma.html",
        "official_url": "https://gamma.app",
        "panel_html": "<p>Gamma 使用 AI 一键生成 PPT...</p>",
    },
    # === AI视频工具 ===
    {
        "name": "Runway",
        "short_desc": "AI 视频生成与编辑平台，支持文生视频、视频抠图等功能",
        "section": "AI视频工具",
        "sub_section": "AI视频生成|文生视频",
        "icon_url": "https://runwayml.com/favicon.ico",
        "detail_url": "/sites/runway.html",
        "official_url": "https://runwayml.com",
        "panel_html": "<p>Runway 是 AI 视频生成与编辑平台...</p>",
    },
    {
        "name": "Pika",
        "short_desc": "AI 视频生成工具，输入文字或图片即可生成创意短视频",
        "section": "AI视频工具",
        "sub_section": "AI视频生成|文生视频",
        "icon_url": "https://pika.art/favicon.ico",
        "detail_url": "/sites/pika.html",
        "official_url": "https://pika.art",
        "panel_html": "<p>Pika 是 AI 视频生成工具...</p>",
    },
    {
        "name": "Kling AI",
        "short_desc": "快手推出的 AI 视频生成工具，支持高质量文生视频",
        "section": "AI视频工具",
        "sub_section": "AI视频生成|图生视频",
        "icon_url": "https://klingai.com/favicon.ico",
        "detail_url": "/sites/kling-ai.html",
        "official_url": "https://klingai.com",
        "panel_html": "<p>Kling AI 是快手推出的 AI 视频生成工具...</p>",
    },
    # === AI编程工具 ===
    {
        "name": "GitHub Copilot",
        "short_desc": "GitHub 与 OpenAI 合作推出的 AI 代码补全工具",
        "section": "AI编程工具",
        "sub_section": "代码助手|代码补全",
        "icon_url": "https://github.githubassets.com/favicons/favicon.svg",
        "detail_url": "/sites/github-copilot.html",
        "official_url": "https://github.com/features/copilot",
        "panel_html": "<p>GitHub Copilot 是 AI 代码补全工具...</p>",
    },
    {
        "name": "Cursor",
        "short_desc": "AI 驱动的代码编辑器，支持智能代码生成与重构",
        "section": "AI编程工具",
        "sub_section": "代码助手|AI编辑器",
        "icon_url": "https://cursor.sh/favicon.ico",
        "detail_url": "/sites/cursor.html",
        "official_url": "https://cursor.sh",
        "panel_html": "<p>Cursor 是 AI 驱动的代码编辑器...</p>",
    },
    {
        "name": "Codeium",
        "short_desc": "免费 AI 代码补全工具，支持多种编程语言与 IDE",
        "section": "AI编程工具",
        "sub_section": "代码助手|代码补全",
        "icon_url": "https://codeium.com/favicon.ico",
        "detail_url": "/sites/codeium.html",
        "official_url": "https://codeium.com",
        "panel_html": "<p>Codeium 是免费 AI 代码补全工具...</p>",
    },
    # === AI音频工具 ===
    {
        "name": "Suno",
        "short_desc": "AI 音乐生成工具，输入文字描述即可创作完整歌曲",
        "section": "AI音频工具",
        "sub_section": "AI音乐生成|文生音乐",
        "icon_url": "https://suno.com/favicon.ico",
        "detail_url": "/sites/suno.html",
        "official_url": "https://suno.com",
        "panel_html": "<p>Suno 是 AI 音乐生成工具...</p>",
    },
    {
        "name": "ElevenLabs",
        "short_desc": "AI 语音合成与克隆工具，支持多语言高质量语音生成",
        "section": "AI音频工具",
        "sub_section": "AI语音合成|文字转语音",
        "icon_url": "https://elevenlabs.io/favicon.ico",
        "detail_url": "/sites/elevenlabs.html",
        "official_url": "https://elevenlabs.io",
        "panel_html": "<p>ElevenLabs 是 AI 语音合成工具...</p>",
    },
]


def _get_engine_url():
    """Get the actual engine URL (SQLite fallback or PostgreSQL)."""
    from app.database import engine1
    return str(engine1.url)


def _ensure_table():
    """Create aibot_sites table directly via DDL (bypassing schema issues)."""
    from sqlalchemy import text
    from app.database import engine1

    inspector = inspect(engine1)
    if "aibot_sites" in inspector.get_table_names():
        print("[seed] aibot_sites 表已存在")
        return True

    # 检测数据库类型选择合适的 DDL
    url = str(engine1.url)
    if url.startswith("sqlite"):
        ddl = """
            CREATE TABLE aibot_sites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                short_desc TEXT,
                section VARCHAR(128),
                sub_section VARCHAR(255),
                icon_url VARCHAR(512),
                detail_url VARCHAR(512),
                official_url VARCHAR(512),
                panel_html TEXT,
                created_at DATETIME,
                updated_at DATETIME
            )
        """
    else:
        ddl = """
            CREATE TABLE aibot_sites (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                short_desc TEXT,
                section VARCHAR(128),
                sub_section VARCHAR(255),
                icon_url VARCHAR(512),
                detail_url VARCHAR(512),
                official_url VARCHAR(512),
                panel_html TEXT,
                created_at TIMESTAMP,
                updated_at TIMESTAMP
            )
        """
    with engine1.connect() as conn:
        conn.execute(text(ddl))
        conn.commit()
    print("[seed] aibot_sites 表创建成功")
    return True


def seed():
    """Create aibot_sites table (if missing) and insert sample data."""
    # 1. 确保表存在
    _ensure_table()

    # 2. 插入数据
    db = SessionFactory1()
    try:
        existing = db.query(AiBotSites).count()
        if existing > 0:
            print(f"[seed] aibot_sites 已有 {existing} 条数据, 跳过 seed")
            return True

        now = datetime.utcnow()
        for item in SAMPLE_SITES:
            db.add(AiBotSites(
                name=item["name"],
                short_desc=item["short_desc"],
                section=item["section"],
                sub_section=item["sub_section"],
                icon_url=item["icon_url"],
                detail_url=item["detail_url"],
                official_url=item["official_url"],
                panel_html=item["panel_html"],
                created_at=now,
                updated_at=now,
            ))
        db.commit()
        print(f"[seed] 成功插入 {len(SAMPLE_SITES)} 条样本数据到 aibot_sites 表")
        return True
    except Exception as e:
        db.rollback()
        print(f"[seed] seed 失败: {e}")
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = seed()
    sys.exit(0 if success else 1)
