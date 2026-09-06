# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""PR AI 评审端点(GitHub Actions 触发管道入口)。

POST /api/v1/pr-review
  body: { repo?, pr_number?, diff?, focus? }
  - 优先使用调用方传入的 diff(CI 本地已生成,服务端无需 GitHub 凭据)
  - 仅传 repo + pr_number 时回退为服务端拉取 GitHub diff(需 github_token)
返回统一 {code, message, data}(code=0 成功,400 参数错误,500 内部错误)。
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services import pr_reviewer

router = APIRouter()


class PrReviewRequest(BaseModel):
    repo: str | None = Field(None, description="owner/name 格式,用于评论标注")
    pr_number: int | None = Field(None, description="PR 编号")
    diff: str | None = Field(None, description="unified diff 文本,优先于 repo+pr_number")
    focus: list[str] | None = Field(
        None, description='关注维度 ["security","performance","style","bugs"]'
    )


def _render_comment(result: dict[str, Any]) -> str:
    """把结构化评审渲染成可贴到 PR 的 Markdown 文本。"""
    repo = result.get("repo")
    pr_number = result.get("pr_number")
    title = f"**PR `{repo}#{pr_number}` AI 评审**" if repo and pr_number else "**PR AI 评审**"
    lines = [title, "", result.get("summary", "") or "（无评审摘要）", ""]
    issues = result.get("issues") or []
    if issues:
        lines.append("### 评审意见")
        lines.append("")
        lines.append("| 严重度 | 文件 | 行 | 说明 | 建议 |")
        lines.append("| --- | --- | --- | --- | --- |")
        for it in issues:
            sev = it.get("severity", "")
            f = it.get("file", "") or "—"
            ln = it.get("line", "") or "—"
            msg = (it.get("message", "") or "").replace("\n", " ").replace("|", "\\|")
            sug = (it.get("suggestion", "") or "").replace("\n", " ").replace("|", "\\|")
            lines.append(f"| {sev} | {f} | {ln} | {msg} | {sug} |")
    else:
        lines.append("✅ 未发现明显问题。")
    stats = result.get("stats") or {}
    if stats.get("diff_truncated"):
        lines.append("")
        lines.append("> ⚠️ diff 过长已截断,评审可能不全面。")
    return "\n".join(lines)


def _wrap(code: int, message: str, data: Any) -> dict[str, Any]:
    return {"code": code, "message": message, "data": data}


@router.post("/pr-review")
async def pr_review(req: PrReviewRequest) -> dict[str, Any]:
    """对 PR diff 做 AI 评审,返回 {code,message,data}。"""
    try:
        if req.diff and req.diff.strip():
            result = await pr_reviewer.review_pr_from_diff(
                req.diff, repo=req.repo, pr_number=req.pr_number, focus=req.focus
            )
        elif req.repo and req.pr_number:
            result = await pr_reviewer.review_pr(
                req.repo, req.pr_number, focus=req.focus
            )
        else:
            return _wrap(400, "需提供 diff 或 repo+pr_number", None)
    except Exception as e:  # 服务端兜底:业务异常不暴露为 500 红,转结构化错误
        return _wrap(500, f"评审失败: {e}", None)

    if not result.get("ok"):
        return _wrap(400, result.get("message", "评审失败"), result)

    data = {
        "summary": result.get("summary", ""),
        "issues": result.get("issues", []),
        "stats": result.get("stats", {}),
        "diff_truncated": result.get("diff_truncated", False),
        "comment": _render_comment(result),
    }
    return _wrap(0, "ok", data)
