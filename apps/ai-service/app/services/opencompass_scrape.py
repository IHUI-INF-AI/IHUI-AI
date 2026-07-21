"""OpenCompass 司南排行榜抓取服务(2026-07-22 新增)。

用途:OpenCompass(rank.opencompass.org.cn)是 Vue SPA,数据完全 JS 渲染,
后端 API 受 nginx WAF 保护返回 405。本服务用 Playwright headless Chromium
渲染页面后提取表格数据。

设计:
- 复用 screenshot_service._get_browser 单例(避免重复启动 Chromium)
- goto + waitForSelector('table') + page.evaluate 提取
- 超时 30s,失败抛异常由调用方降级
- 返回结构化 entries,与 api 端 LeaderboardEntry 一致
"""

from __future__ import annotations

import logging
import time
from typing import Any

from .screenshot_service import _get_browser

logger = logging.getLogger(__name__)

OPENCOMPASS_URL = "https://rank.opencompass.org.cn/leaderboard/llm"

# page.evaluate 提取所有表格数据的 JS 代码
# OpenCompass 用 ant-design Vue Table,thead 和 tbody 在**独立的 table 元素**:
# - <div class="ant-table-header"><table><thead><tr><th>...</th></tr></thead></table></div>
# - <div class="ant-table-body"><table><tbody><tr><td>...</td></tr></tbody></table></div>
# 所以需要按顺序配对 header-table 和 body-table,合并出 { headers, rows }
# 返回 [{ tableIdx, headers, rows }]
_EXTRACT_JS = """
() => {
  const tables = Array.from(document.querySelectorAll('table'));
  const headerTables = tables.filter(t => t.querySelector('thead'));
  const bodyTables = tables.filter(t => t.querySelector('tbody'));
  const count = Math.max(headerTables.length, bodyTables.length);
  const result = [];
  for (let i = 0; i < count; i++) {
    const ht = headerTables[i];
    const bt = bodyTables[i];
    const headers = ht
      ? Array.from(ht.querySelectorAll('thead th'))
          .map(th => (th.innerText || th.textContent || '').trim())
      : [];
    const rows = bt
      ? Array.from(bt.querySelectorAll('tbody tr')).map(tr =>
          Array.from(tr.querySelectorAll('td'))
            .map(td => (td.innerText || td.textContent || '').trim())
        )
      : [];
    result.push({ tableIdx: i, headers, rows });
  }
  return result;
}
"""


def _find_col(headers: list[str], keywords: list[str]) -> int | None:
    """启发式查找列索引(大小写不敏感,包含任一关键词即命中)。"""
    for idx, h in enumerate(headers):
        if not h:
            continue
        hl = h.lower()
        for kw in keywords:
            if kw.lower() in hl:
                return idx
    return None


def _try_float(s: Any) -> float | None:
    """尝试把字符串转为 float(支持 '95.32' / '95.32%' / '95.32 分')。"""
    if s is None:
        return None
    try:
        cleaned = str(s).replace("%", "").replace("分", "").strip()
        return float(cleaned)
    except Exception:
        return None


async def scrape_opencompass(timeout_ms: int = 30000) -> dict[str, Any]:
    """抓取 OpenCompass 司南排行榜。

    返回:
        {
            "entries": List[dict],  # LeaderboardEntry-like
            "captured_at": int(time.time() * 1000),
            "url": OPENCOMPASS_URL,
            "headers": list[str],
        }

    失败抛异常,由调用方 try/except 返回错误响应。
    """
    browser = await _get_browser()
    context = await browser.new_context(
        viewport={"width": 1280, "height": 900},
        locale="zh-CN",
        timezone_id="Asia/Shanghai",
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    )
    page = await context.new_page()
    try:
        await page.goto(OPENCOMPASS_URL, wait_until="domcontentloaded", timeout=timeout_ms)

        # 等待表格出现(JS 渲染完成的核心标志)
        try:
            await page.wait_for_selector("table", state="attached", timeout=timeout_ms)
        except Exception:
            # 退化等待 networkidle
            try:
                await page.wait_for_load_state("networkidle", timeout=10_000)
            except Exception:
                pass

        # 等待 ant-design Vue Table 渲染数据行(tbody tr 出现)
        # OpenCompass 用 ant-design Vue,数据加载后 tbody 才有 tr
        try:
            await page.wait_for_selector("table tbody tr", state="attached", timeout=20_000)
        except Exception:
            # 数据行等待超时,继续执行(可能是 loading 状态,稍后再试)
            pass

        # 额外等待 2s 让数据填充完整(Vue 异步渲染)
        await page.wait_for_timeout(2000)

        tables = await page.evaluate(_EXTRACT_JS)
        if not tables:
            raise RuntimeError("OpenCompass 页面无表格(JS 渲染未完成或页面结构变化)")

        # 找第一个有数据的表格(ant-design Vue thead/tbody 分离,第一个通常是能力榜)
        first_table = next(
            (t for t in tables if t.get("rows")),
            tables[0] if tables else {"headers": [], "rows": []},
        )
        headers = first_table.get("headers", [])
        rows = first_table.get("rows", [])

        # 启发式定位列索引
        # OpenCompass 列结构(2026-07-22 实测):
        # 0: 序号(空) / 1: 模型(含 "模型名\n开源闭源 · 机构") / 2: 发布日期 / 3: 参数量
        # 4: 均分(总分) / 5-10: 子能力(语言/知识/推理/数学/代码/智能体)
        name_idx = _find_col(headers, ["模型", "名称", "model", "name"])
        date_idx = _find_col(headers, ["发布日期", "发布", "日期", "date"])
        params_idx = _find_col(headers, ["参数量", "参数", "params"])
        score_idx = _find_col(headers, ["均分", "总分", "综合", "平均", "score", "total", "overall"])

        # 兜底:若未命中,用常见默认值
        if name_idx is None:
            name_idx = 1 if len(headers) >= 2 else 0
        if score_idx is None and len(headers) >= 5:
            # 找第一个数值列(跳过 name/date/params)
            skip = {name_idx, date_idx, params_idx}
            for idx in range(len(headers)):
                if idx in skip or not headers[idx]:
                    continue
                sample_count = 0
                for r in rows[:3]:
                    if idx < len(r) and _try_float(r[idx]) is not None:
                        sample_count += 1
                if sample_count >= 2:
                    score_idx = idx
                    break

        # 非能力分数列(从 scores map 中排除)
        meta_cols = {name_idx, date_idx, params_idx, score_idx}

        entries: list[dict[str, Any]] = []
        for i, row in enumerate(rows):
            if not row or len(row) < 2:
                continue
            raw_name = (row[name_idx] if name_idx < len(row) else "").strip()
            if not raw_name or raw_name == "-":
                continue

            # ant-design Vue 把 "模型名\n开源闭源 · 机构" 合并到一个 td
            # 用换行符拆分:第一行是模型名,第二行是 "开源/闭源 · 机构"
            name_lines = [ln.strip() for ln in raw_name.split("\n") if ln.strip()]
            model_name = name_lines[0] if name_lines else raw_name
            provider: str | None = None
            if len(name_lines) > 1:
                # 第二行格式:"闭源 · OpenAI" / "开源 · DeepSeek"
                org_line = name_lines[1]
                if "·" in org_line:
                    provider = org_line.split("·", 1)[1].strip() or None
                else:
                    provider = org_line or None

            # 分数
            score = (
                row[score_idx] if score_idx is not None and score_idx < len(row) else ""
            ).strip() or None

            # 子能力分数(只保留数值列,排除 name/date/params/score)
            scores_map: dict[str, Any] = {}
            for col_idx, h in enumerate(headers):
                if col_idx in meta_cols or not h:
                    continue
                if col_idx < len(row):
                    val = row[col_idx].strip()
                    if val and val != "-":
                        scores_map[h] = val

            # 发布日期作为 publishedAt(可选)
            published_at = None
            if date_idx is not None and date_idx < len(row):
                date_str = row[date_idx].strip()
                if date_str and date_str != "-":
                    try:
                        # OpenCompass 格式:2026/3/5
                        from datetime import datetime
                        published_at = datetime.strptime(date_str, "%Y/%m/%d").isoformat()
                    except Exception:
                        pass

            entries.append({
                "leaderboard": "opencompass",
                "category": "overall",
                "rank": i + 1,
                "modelName": model_name[:200],
                "provider": provider,
                "score": score,
                "scores": scores_map or None,
                "publishedAt": published_at,
            })

        # 若分数是数值,按分数降序重排 rank
        if any(_try_float(e.get("score")) is not None for e in entries):
            entries.sort(
                key=lambda e: _try_float(e.get("score")) or 0.0,
                reverse=True,
            )
            for idx, e in enumerate(entries):
                e["rank"] = idx + 1

        logger.info(
            "[opencompass_scrape] 提取 %d 条记录(列:%s)",
            len(entries),
            headers,
        )
        return {
            "entries": entries[:50],
            "captured_at": int(time.time() * 1000),
            "url": OPENCOMPASS_URL,
            "headers": headers,
        }
    finally:
        await page.close()
        await context.close()
