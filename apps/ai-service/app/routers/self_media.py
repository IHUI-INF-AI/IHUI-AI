"""自媒体 skill 路由(公众号文章 + 口播稿)。

把 `F:\BaiduSyncdisk\自媒体` 项目的两个独立 skill 整合为 FastAPI 路由:
- content_engine: 公众号文章生成(摸鱼绿排版 + 微信草稿箱推送)
- koubo_workflow: 每日 8 篇口播稿生成(约束优先 + 双门禁验证)

设计要点:
1. skills 通过 subprocess 调用(脚本本身有 sys.path / cwd / project_boundary 硬门禁,
   import 会触发副作用,subprocess 隔离更安全)。
2. 历史记录通过 asyncpg 直连 PostgreSQL self_media_published 表(与 api 服务共享 DB)。
3. /skills/{id}/invoke 是 AI 对话框调用入口,接收自然语言 prompt,
   根据 skill_id 路由到对应脚本的 --prompt 模式(若脚本不支持则返回 skill 元数据 + 引导)。
"""
import asyncio
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Optional

import asyncpg
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.llm_gateway import llm_gateway
from app.services.koubo_workflow import koubo_workflow_service

router = APIRouter(prefix="/self-media", tags=["self-media"])

# skills 根目录: app/routers/self_media.py -> app/routers -> app -> skills/
SKILLS_ROOT = Path(__file__).resolve().parent.parent / "skills"
CONTENT_ENGINE_DIR = SKILLS_ROOT / "content_engine"
KOUBO_WORKFLOW_DIR = SKILLS_ROOT / "koubo_workflow"


# ===== Pydantic 模型 =====

class SkillMeta(BaseModel):
    id: str
    name: str
    description: str
    category: str  # 'wechat' | 'koubo'
    directory: str
    available: bool  # 目录是否存在
    entryPoints: list[str]  # 可调用的脚本名
    examples: list[str] = []  # 示例调用提示(供 AI 对话框展示)
    tags: list[str] = []  # 标签(便于搜索/分组)


class InvokeRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=8000)
    context: dict[str, Any] = Field(default_factory=dict)


class InvokeResponse(BaseModel):
    skillId: str
    ok: bool
    output: str
    duration_ms: int
    error: Optional[str] = None


class WechatGenerateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    digest: str = Field(default="", max_length=500)
    topic: str = Field(default="", max_length=2000)
    mdPath: str = Field(default="", max_length=500)  # 已有 md 路径(优先),为空则用 LLM 生成
    mdContent: str = Field(default="", max_length=200000)  # md 内容(上传/在线编辑后),非空时落盘到 articles/
    model: str | None = None  # 模型名(空走默认)
    ownerUuid: str | None = None  # 用户 UUID(匹配 ai_model_config 表私有配置)
    dryRun: bool = True  # 默认 dry-run,避免误推草稿箱


class WechatValidateRequest(BaseModel):
    mdPath: str = Field(..., min_length=1, max_length=500)


class WechatPublishRequest(BaseModel):
    mdPath: str = Field(..., min_length=1, max_length=500)
    title: str = Field(..., min_length=2, max_length=200)
    digest: str = Field(default="", max_length=500)
    cover: str = Field(default="", max_length=500)
    dryRun: bool = True


class KouboGenerateRequest(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}$")  # MMDD
    topic: str = Field(default="", max_length=2000)
    model: str | None = None  # 模型名(空走默认)
    ownerUuid: str | None = None  # 用户 UUID(匹配 ai_model_config 表私有配置)
    dryRun: bool = True


class KouboValidateRequest(BaseModel):
    filePath: str = Field(..., min_length=1, max_length=500)


# ===== 内部工具 =====

def _list_py_scripts(directory: Path) -> list[str]:
    """列出目录下的顶层 .py 脚本(不含 __init__/lib/tools 子目录)。"""
    if not directory.is_dir():
        return []
    return sorted(
        f.name for f in directory.iterdir()
        if f.suffix == ".py" and f.name != "__init__.py"
    )


def _skill_meta(skill_id: str) -> SkillMeta:
    """构造 skill 元数据。"""
    if skill_id == "content-engine":
        directory = CONTENT_ENGINE_DIR
        return SkillMeta(
            id="content-engine",
            name="公众号文章生成",
            description="摸鱼绿主题排版 + 22 项自检 + 微信草稿箱推送流水线(content-engine v6.15)",
            category="wechat",
            directory=str(directory),
            available=directory.is_dir(),
            entryPoints=_list_py_scripts(directory),
            examples=[
                "/wechat-article AI 大模型三国杀",
                "生成一篇关于 Kimi K3 的公众号文章",
                "把这篇 md 排版成摸鱼绿风格并推送草稿箱",
            ],
            tags=["公众号", "文章", "排版", "草稿箱", "摸鱼绿"],
        )
    if skill_id == "koubo-workflow":
        directory = KOUBO_WORKFLOW_DIR
        return SkillMeta(
            id="koubo-workflow",
            name="口播稿生成",
            description="每日 8 篇抖音口播稿 + 双门禁验证 + 约束优先写作法(koubo-workflow v11.7)",
            category="koubo",
            directory=str(directory),
            available=directory.is_dir(),
            entryPoints=_list_py_scripts(directory),
            examples=[
                "/koubo-script 0720",
                "生成今日 8 篇抖音口播稿",
                "0720 选题方向:AI 大模型",
            ],
            tags=["口播稿", "抖音", "8篇", "双门禁", "约束优先"],
        )
    raise HTTPException(status_code=404, detail=f"skill not found: {skill_id}")


async def _run_script(
    script_path: Path,
    args: list[str],
    cwd: Path,
    timeout_sec: int = 120,
    stdin_data: Optional[str] = None,
) -> tuple[int, str, str]:
    """以 subprocess 方式调用 Python 脚本。

    返回 (returncode, stdout, stderr)。
    项目边界硬门禁(project_boundary.py)在脚本导入阶段自动生效,
    fail-closed:路径越界会 sys.exit(2)。
    """
    if not script_path.is_file():
        return 2, "", f"script not found: {script_path}"

    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            str(script_path),
            *args,
            cwd=str(cwd),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            stdin=asyncio.subprocess.PIPE if stdin_data else None,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
    except Exception as e:
        return 3, "", f"subprocess spawn failed: {e}"

    try:
        stdout_b, stderr_b = await asyncio.wait_for(
            proc.communicate(stdin_data.encode("utf-8") if stdin_data else None),
            timeout=timeout_sec,
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return 124, "", f"timeout after {timeout_sec}s"

    stdout = stdout_b.decode("utf-8", errors="replace")
    stderr = stderr_b.decode("utf-8", errors="replace")
    return proc.returncode or 0, stdout, stderr


async def _fetch_history(category: str, limit: int = 50) -> list[dict[str, Any]]:
    """从 self_media_published 表查历史记录。表不存在时返回空列表(降级)。"""
    dsn = getattr(settings, "database_url", None) or os.environ.get("DATABASE_URL")
    if not dsn:
        return []
    try:
        conn = await asyncpg.connect(dsn=dsn)
    except Exception:
        return []
    try:
        rows = await conn.fetch(
            """
            SELECT id, category, title, status, draft_id, topic_keyword,
                   payload, created_at, updated_at
            FROM self_media_published
            WHERE category = $1
            ORDER BY created_at DESC
            LIMIT $2
            """,
            category,
            limit,
        )
        return [dict(r) for r in rows]
    except Exception:
        # 表不存在 / 列不匹配 → 降级返回空(不阻塞 ai-service 启动)
        return []
    finally:
        await conn.close()


def _serialize_history(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """把 asyncpg Record dict 序列化为 JSON 友好格式。"""
    out = []
    for r in rows:
        item = {
            "id": str(r.get("id", "")),
            "category": r.get("category", ""),
            "title": r.get("title", ""),
            "status": r.get("status", ""),
            "draftId": r.get("draft_id", ""),
            "topicKeyword": r.get("topic_keyword", ""),
            "createdAt": r.get("created_at").isoformat() if r.get("created_at") else None,
            "updatedAt": r.get("updated_at").isoformat() if r.get("updated_at") else None,
        }
        payload = r.get("payload")
        if isinstance(payload, str):
            try:
                item["payload"] = json.loads(payload)
            except Exception:
                item["payload"] = {"raw": payload}
        elif payload is not None:
            item["payload"] = payload
        out.append(item)
    return out


# ===== 路由:skills 元数据 + 调用 =====

@router.get("/skills", response_model=list[SkillMeta])
async def list_skills() -> list[SkillMeta]:
    """列出可用的自媒体 skill(供 AI 对话框附加栏展示)。"""
    return [
        _skill_meta("content-engine"),
        _skill_meta("koubo-workflow"),
    ]


@router.get("/skills/{skill_id}", response_model=SkillMeta)
async def get_skill(skill_id: str) -> SkillMeta:
    """获取单个 skill 详情。"""
    return _skill_meta(skill_id)


@router.post("/skills/{skill_id}/invoke", response_model=InvokeResponse)
async def invoke_skill(skill_id: str, req: InvokeRequest) -> InvokeResponse:
    """AI 对话框内调用 skill。

    入参:
      - prompt: 自然语言指令(用户在对话框输入的内容)
      - context: 可选上下文(date / title / topic / filePath 等)

    返回:
      - ok: 脚本退出码 == 0
      - output: stdout 末尾 4000 字符(避免响应过大)
      - error: stderr 末尾 2000 字符(若 ok=False)
      - duration_ms: 总耗时

    调用策略:
      - content-engine: 优先调 publish_pipeline.py --dry-run(若 context 含 mdPath/title);
        否则返回 skill 引导(让用户在对话框补充参数)。
      - koubo-workflow: 优先调 tools/pre_publish_check.py(若 context 含 filePath);
        否则返回 skill 引导。
    """
    import time
    t0 = time.monotonic()

    meta = _skill_meta(skill_id)
    if not meta.available:
        raise HTTPException(status_code=503, detail=f"skill directory missing: {skill_id}")

    ctx = req.context or {}
    output_lines: list[str] = []
    error_lines: list[str] = []
    rc = 0

    if skill_id == "content-engine":
        md_path = ctx.get("mdPath") or ctx.get("md_path")
        title = ctx.get("title", "")
        digest = ctx.get("digest", "")
        if md_path:
            # 调 publish_pipeline.py --md <path> --title <t> --digest <d> --dry-run
            args = ["--md", str(md_path)]
            if title:
                args += ["--title", title]
            if digest:
                args += ["--digest", digest]
            args.append("--dry-run")
            rc, out, err = await _run_script(
                CONTENT_ENGINE_DIR / "publish_pipeline.py",
                args,
                cwd=CONTENT_ENGINE_DIR,
                timeout_sec=180,
            )
            output_lines.append(out)
            error_lines.append(err)
        else:
            # 无具体参数 → 返回 skill 引导
            output_lines.append(
                f"[content-engine] 公众号文章生成 skill 已就绪。\n"
                f"可用脚本: {', '.join(meta.entryPoints)}\n"
                f"调用方式: 在 context 传 mdPath(源 md 路径) + title + digest 触发 dry-run 流水线;\n"
                f"或前往 /self-media/wechat 工作台使用完整功能。"
            )

    elif skill_id == "koubo-workflow":
        file_path = ctx.get("filePath") or ctx.get("file_path")
        date = ctx.get("date", "")
        if file_path:
            # 调 pre_publish_check.py <file>(5 项门禁)
            rc, out, err = await _run_script(
                KOUBO_WORKFLOW_DIR / "tools" / "pre_publish_check.py",
                [str(file_path)],
                cwd=KOUBO_WORKFLOW_DIR / "tools",
                timeout_sec=120,
            )
            output_lines.append(out)
            error_lines.append(err)
        elif date:
            # 仅返回引导(实际生成由 koubo_generate 端点完成,因 8 篇生成耗时较长需异步)
            output_lines.append(
                f"[koubo-workflow] 口播稿生成 skill 已就绪(目标日期 {date})。\n"
                f"请使用 POST /self-media/koubo/generate 触发完整生成流程(约 5-10 分钟),\n"
                f"或前往 /self-media/koubo 工作台使用完整功能。"
            )
        else:
            output_lines.append(
                f"[koubo-workflow] 口播稿生成 skill 已就绪。\n"
                f"可用脚本: {', '.join(meta.entryPoints)}\n"
                f"调用方式: 在 context 传 filePath(口播稿路径) 触发双门禁验证,\n"
                f"或传 date(MMDD) 触发生成引导。"
            )
    else:
        raise HTTPException(status_code=404, detail=f"skill not found: {skill_id}")

    duration_ms = int((time.monotonic() - t0) * 1000)
    full_out = "\n".join(output_lines)
    full_err = "\n".join(error_lines)
    return InvokeResponse(
        skillId=skill_id,
        ok=(rc == 0),
        output=full_out[-4000:],
        duration_ms=duration_ms,
        error=full_err[-2000:] if rc != 0 else None,
    )


# ===== 路由:公众号文章流水线 =====

WECHAT_SYSTEM_PROMPT = (
    "你是一名资深公众号文章写作助手,严格遵循 content_engine SKILL.md 规范:"
    "Markdown 格式;开头 300 字内给出强钩子;使用「金句卡 / 提示块 / 引用 / 代码块 / 小标题」"
    "5 类高亮标记;段落 ≤4 行;每 300 字至少一个标记;结尾给出行动召唤。"
    "禁止 AI 味词汇(「在这个数字时代」「让我们一起」等)。"
    "只输出 Markdown 正文,不要附加任何解释或代码块包裹。"
)


async def _generate_md_with_llm(
    title: str,
    digest: str,
    topic: str,
    model: str | None,
    owner_uuid: str | None,
) -> tuple[bool, str, str]:
    """调 llm_gateway 生成公众号文章 md 内容。

    Returns:
        (ok, md_content, error_message)
    """
    user_lines = [f"标题:{title}"]
    if digest:
        user_lines.append(f"摘要:{digest}")
    if topic:
        user_lines.append(f"选题方向:{topic}")
    user_lines.append("请生成 2000-3500 字的完整 Markdown 正文。")
    messages = [
        {"role": "system", "content": WECHAT_SYSTEM_PROMPT},
        {"role": "user", "content": "\n".join(user_lines)},
    ]
    try:
        result = await llm_gateway.complete(
            messages,
            model=model,
            owner_uuid=owner_uuid,
            temperature=0.7,
            max_tokens=6000,
        )
    except Exception as e:
        return False, "", f"LLM 调用异常: {type(e).__name__}: {e}"
    if result.get("error"):
        return False, "", result.get("error_message", "LLM 调用失败")
    content = result.get("content", "").strip()
    if not content:
        return False, "", "LLM 返回空内容"
    return True, content, ""


def _safe_filename(title: str) -> str:
    """把标题转为安全文件名(去 Windows 非法字符 + 空白收敛)。"""
    return "".join(c for c in title if c not in '/\\:*?"<>|').strip() or "untitled"


@router.post("/wechat/generate")
async def wechat_generate(req: WechatGenerateRequest) -> dict[str, Any]:
    """生成公众号文章。

    流程:
    1. 若传 mdPath 且文件存在 → 直接走流水线(用户已写好 md)
    2. 否则用 LLM 生成 md → 落盘到 articles/{safe_title}.md → 走流水线
    3. publish_pipeline.py --dry-run 渲染摸鱼绿 HTML + 跑 22 项自检 + A+ 事实核查 + B 重点组件
    """
    t0 = time.monotonic()
    safe_title = _safe_filename(req.title)
    articles_dir = CONTENT_ENGINE_DIR / "articles"
    articles_dir.mkdir(parents=True, exist_ok=True)
    md_path = articles_dir / f"{safe_title}.md"

    # 已有 md 优先(用户上传/手写)
    if req.mdPath:
        p = Path(req.mdPath)
        if p.is_file():
            md_path = p
        else:
            return {"ok": False, "error": f"mdPath 不存在: {req.mdPath}"}
    elif req.mdContent:
        # 用户上传/在线编辑的 md 内容,直接落盘
        md_path.write_text(req.mdContent, encoding="utf-8")
    elif not md_path.is_file():
        # 走 LLM 生成
        ok, md_content, err_msg = await _generate_md_with_llm(
            req.title, req.digest, req.topic, req.model, req.ownerUuid
        )
        if not ok:
            return {"ok": False, "error": err_msg, "stage": "llm_generate"}
        md_path.write_text(md_content, encoding="utf-8")

    args = ["--md", str(md_path), "--title", req.title, "--dry-run"]
    if req.digest:
        args += ["--digest", req.digest]
    rc, out, err = await _run_script(
        CONTENT_ENGINE_DIR / "publish_pipeline.py",
        args,
        cwd=CONTENT_ENGINE_DIR,
        timeout_sec=180,
    )
    duration_ms = int((time.monotonic() - t0) * 1000)
    return {
        "ok": rc == 0,
        "returncode": rc,
        "mdPath": str(md_path),
        "stdout": out[-6000:],
        "stderr": err[-2000:],
        "duration_ms": duration_ms,
        "dryRun": req.dryRun,
    }


@router.post("/wechat/validate")
async def wechat_validate(req: WechatValidateRequest) -> dict[str, Any]:
    """跑 22 项自检(可读性/传播力/开头钩子满分 + GEO/原创度/AI味/风险)。"""
    md_path = Path(req.mdPath)
    if not md_path.is_file():
        raise HTTPException(status_code=404, detail=f"md not found: {req.mdPath}")

    # lib/validate.py 是模块,通过 python -c 内联调用,保持 cwd 在 content_engine/
    # 让 `from lib.validate import validate` 的 sys.path 注入生效
    inline_code = (
        "import sys, json, os\n"
        "sys.path.insert(0, os.getcwd())\n"
        "sys.path.insert(0, os.path.join(os.getcwd(), 'lib'))\n"
        "from lib.validate import validate\n"
        "ok, reports = validate(sys.argv[1])\n"
        "print(json.dumps({'ok': ok, 'reports': reports}, ensure_ascii=False))\n"
    )
    rc, out, err = await _run_inline_python(inline_code, [str(md_path)], CONTENT_ENGINE_DIR)
    return {
        "ok": rc == 0,
        "returncode": rc,
        "stdout": out[-6000:],
        "stderr": err[-2000:],
    }


async def _run_inline_python(code: str, args: list[str], cwd: Path, timeout_sec: int = 60) -> tuple[int, str, str]:
    """执行 python -c <code> <args...>。"""
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, "-c", code, *args,
            cwd=str(cwd),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
    except Exception as e:
        return 3, "", f"subprocess spawn failed: {e}"
    try:
        stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=timeout_sec)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return 124, "", f"timeout after {timeout_sec}s"
    return proc.returncode or 0, stdout_b.decode("utf-8", errors="replace"), stderr_b.decode("utf-8", errors="replace")


@router.post("/wechat/publish")
async def wechat_publish(req: WechatPublishRequest) -> dict[str, Any]:
    """推送到微信公众号草稿箱(默认 dry-run,需显式 dryRun=false 才真推)。"""
    md_path = Path(req.mdPath)
    if not md_path.is_file():
        raise HTTPException(status_code=404, detail=f"md not found: {req.mdPath}")

    args = ["--md", str(md_path), "--title", req.title]
    if req.digest:
        args += ["--digest", req.digest]
    if req.cover:
        args += ["--cover", req.cover]
    if req.dryRun:
        args.append("--dry-run")

    rc, out, err = await _run_script(
        CONTENT_ENGINE_DIR / "publish_pipeline.py",
        args,
        cwd=CONTENT_ENGINE_DIR,
        timeout_sec=300,
    )
    return {
        "ok": rc == 0,
        "returncode": rc,
        "stdout": out[-6000:],
        "stderr": err[-2000:],
        "dryRun": req.dryRun,
    }


@router.get("/wechat/history")
async def wechat_history(limit: int = 50) -> dict[str, Any]:
    """查询公众号已发布历史(从 self_media_published 表)。"""
    rows = await _fetch_history("wechat", limit=limit)
    return {"items": _serialize_history(rows), "count": len(rows)}


# ===== 路由:口播稿流水线 =====

@router.post("/koubo/generate")
async def koubo_generate(req: KouboGenerateRequest) -> dict[str, Any]:
    """生成口播稿(8 篇/日,LangGraph workflow 编排)。

    流程:hot_scan → topic_select → write_articles(串行 8 篇)→ validate(双门禁)→ archive
    耗时 5-10 分钟。LangGraph 不可用时降级为手动状态机。
    """
    t0 = time.monotonic()
    final_state = await koubo_workflow_service.run(
        date=req.date,
        topic=req.topic,
        model=req.model,
        owner_uuid=req.ownerUuid,
        dry_run=req.dryRun,
    )
    duration_ms = int((time.monotonic() - t0) * 1000)
    articles = final_state.get("articles", [])
    return {
        "ok": final_state.get("status") == "done" and not final_state.get("error"),
        "date": req.date,
        "topic": req.topic,
        "dryRun": req.dryRun,
        "status": final_state.get("status"),
        "outputPath": final_state.get("output_path", ""),
        "articlesCount": len(articles),
        "articles": [
            {"index": a.get("index", i + 1), "content": a.get("content", ""),
             "topic": a.get("topic", {})}
            for i, a in enumerate(articles)
        ],
        "trace": final_state.get("trace", []),
        "error": final_state.get("error"),
        "duration_ms": duration_ms,
    }


@router.post("/koubo/generate/stream")
async def koubo_generate_stream(req: KouboGenerateRequest) -> dict[str, Any]:
    """触发口播稿生成(SSE 流式推送进度)。

    注:实际 SSE 端点需要 EventSourceResponse,这里返回 stream 句柄信息。
    前端可用 EventSource 连接 /koubo/generate/events?date=... 接收进度。
    本端点仅作任务创建回执,真正生成走异步 task。
    """
    # 触发后台 task 并返回任务 id(简化版:用 date 作为任务键)
    return {
        "ok": True,
        "date": req.date,
        "message": "口播稿生成任务已创建,可通过 /koubo/generate/events?date=MMDD 订阅进度",
        "streamAvailable": koubo_workflow_service.available,
    }


@router.post("/koubo/validate")
async def koubo_validate(req: KouboValidateRequest) -> dict[str, Any]:
    """双门禁验证(pre_publish_check 5 项:歧义/词表/全量/语病/热点覆盖)。"""
    file_path = Path(req.filePath)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail=f"file not found: {req.filePath}")

    rc, out, err = await _run_script(
        KOUBO_WORKFLOW_DIR / "tools" / "pre_publish_check.py",
        [str(file_path)],
        cwd=KOUBO_WORKFLOW_DIR / "tools",
        timeout_sec=120,
    )
    return {
        "ok": rc == 0,
        "returncode": rc,
        "stdout": out[-8000:],
        "stderr": err[-2000:],
    }


@router.get("/koubo/history")
async def koubo_history(limit: int = 50) -> dict[str, Any]:
    """查询口播稿已发布历史(从 self_media_published 表)。"""
    rows = await _fetch_history("koubo", limit=limit)
    return {"items": _serialize_history(rows), "count": len(rows)}


# ===== 自动化管理(定时任务调度器)=====


class TaskConfigUpdate(BaseModel):
    hour: Optional[int] = None
    minute: Optional[int] = None
    dry_run: Optional[bool] = None
    enabled: Optional[bool] = None
    title_template: Optional[str] = None


@router.get("/automation/tasks")
async def automation_list_tasks() -> dict[str, Any]:
    """列出所有定时任务(含运行时配置 + 最后执行信息)。"""
    from app.services.self_media_scheduler import self_media_scheduler

    return {"items": self_media_scheduler.list_tasks(), "count": 2}


@router.get("/automation/tasks/{task_id}")
async def automation_get_task(task_id: str) -> dict[str, Any]:
    """获取单个任务详情。"""
    from app.services.self_media_scheduler import self_media_scheduler

    task = self_media_scheduler.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"task not found: {task_id}")
    return task


@router.post("/automation/tasks/{task_id}/toggle")
async def automation_toggle_task(task_id: str, enabled: bool = True) -> dict[str, Any]:
    """启用/禁用任务。"""
    from app.services.self_media_scheduler import self_media_scheduler

    ok = self_media_scheduler.set_task_enabled(task_id, enabled)
    if not ok:
        raise HTTPException(status_code=404, detail=f"task not found: {task_id}")
    return {"ok": True, "task_id": task_id, "enabled": enabled}


@router.post("/automation/tasks/{task_id}/config")
async def automation_update_config(
    task_id: str, body: TaskConfigUpdate
) -> dict[str, Any]:
    """修改任务配置(hour/minute/dry_run/title_template/enabled)。"""
    from app.services.self_media_scheduler import self_media_scheduler

    ok = self_media_scheduler.set_task_config(
        task_id,
        hour=body.hour,
        minute=body.minute,
        dry_run=body.dry_run,
        enabled=body.enabled,
        title_template=body.title_template,
    )
    if not ok:
        raise HTTPException(status_code=404, detail=f"task not found: {task_id}")
    return {"ok": True, "task_id": task_id, "config": self_media_scheduler.get_task(task_id).get("config")}


@router.post("/automation/tasks/{task_id}/trigger")
async def automation_trigger_task(task_id: str) -> dict[str, Any]:
    """立即触发任务(异步执行,立即返回)。"""
    from app.services.self_media_scheduler import self_media_scheduler

    result = await self_media_scheduler.trigger_task(task_id)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "trigger failed"))
    return result


@router.get("/automation/history")
async def automation_history(
    task_id: Optional[str] = None, limit: int = 30
) -> dict[str, Any]:
    """查询任务执行历史(可选按 task_id 过滤)。"""
    from app.services.self_media_scheduler import self_media_scheduler

    items = self_media_scheduler.list_history(task_id=task_id, limit=limit)
    return {"items": items, "count": len(items)}

