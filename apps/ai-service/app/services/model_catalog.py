# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型分类引擎(2026-08-29 立)—— 解决"模型选择器塞满历史过时模型"问题。

背景
----
`GET /llm/models` 的数据源是 `default_models.json` + DB `ai_model_config_models`
(relay_public=true,当前 999 条)。ModelSyncService 每 6 小时从各厂商 `/v1/models`
**全量同步**,厂商不下架的旧代次模型会永久滞留,再加上 embedding / reranker /
TTS / ASR / 图像生成等非对话模型,以及 `-preview-09-2025` 快照、`:free` / `:batch`
价格变体,最终全部灌进聊天模型下拉框。

既有的 `ModelAvailabilityService` 只做 **provider 级**过滤(有没有 key、余额够不够、
连不连得上),**没有模型代次维度**——只要 openrouter / nvidia 这些 provider 健康,
几百个模型就整包出现。本模块补上这一维度。

产出两个正交维度
----------------
1. **category(用途分类)** —— 让用户明确知道这模型是干什么的:
   chat / vision / embedding / rerank / tts / asr / image / video / guard / other
2. **model_tier(代次档位)** —— 决定默认展示还是折叠:
   latest(最新最强,默认展示)/ standard(可用但非最新)/ legacy(已过时)

判定优先级(先具体后通用,避免误判)
----------------------------------
1. 用途分类:rerank → embedding → tts → asr → image → video → guard → ocr → vision → chat
   (`bge-reranker` 同时含 `bge`,故 rerank 必须先于 embedding 判)
2. 代次档位:
   a. 非对话用途(embedding/rerank/tts/asr/image/video/guard/ocr)→ 一律 legacy
      (聊天场景调不通,默认不进聊天选择器;点开"历史模型"才能看到,且按用途分组标注)
   b. release_date 早于 `LEGACY_RELEASE_DAYS`(默认 365 天)→ legacy
   c. `-preview-09-2025` / `-0813` / `-20260420` 日期快照,`:free` `:batch` 价格变体 → standard
   d. 精选白名单 `CURATED_LATEST`(代次关键词,如 `claude-opus-5` / `deepseek-v4`)→ **候选**
      latest —— 仍需过第二趟同系列版本比较
   e. 同系列(family)内比较:主版本低于系列最高 → legacy;同主版本次版本偏低 → standard
      (白名单不豁免这一步,否则 `gpt-5` / `gpt-5.1` / … / `gpt-5.6` 会全部算"最新")
   f. `-preview` / `-exp` 实验版 → standard
   g. 其余 → standard

系列(family)归一化
------------------
不同 provider 对同一模型的前缀不同,统一取路径最后一段再归一:
    openrouter  `~z-ai/glm-5.3-flash`        → `glm-5.3-flash`  family=glm ver=5.3
    siliconflow `deepseek-ai/DeepSeek-V4-Pro`→ `deepseek-v4-pro` family=deepseek-v ver=4
    cloudflare  `@cf/baai/bge-m3`            → `bge-m3`          family=bge ver=3
    opencode_zen `claude-opus-5`             → `claude-opus-5`   family=claude-opus ver=5
版本号 = 名字里第一段数字(支持 `3.2` / `3-12` / `3` 三种写法)。

使用
----
    from ..services.model_catalog import annotate_models
    annotate_models(models)   # 原地给每个 dict 加 category / model_tier / family

本模块纯函数、无 I/O、无 async,可直接单测。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Iterable, Optional

__all__ = [
    "ModelCategory",
    "ModelTier",
    "ModelClassification",
    "LEGACY_RELEASE_DAYS",
    "CURATED_LATEST",
    "classify_model",
    "annotate_models",
]

# ---------------------------------------------------------------------------
# 枚举
# ---------------------------------------------------------------------------


class ModelCategory(str, Enum):
    """用途分类(用户可见,决定"这模型是干什么的")。"""

    CHAT = "chat"  # 文本对话 / 推理
    VISION = "vision"  # 视觉理解(多模态对话)
    EMBEDDING = "embedding"  # 向量嵌入
    RERANK = "rerank"  # 重排序
    TTS = "tts"  # 语音合成
    ASR = "asr"  # 语音识别
    IMAGE = "image"  # 图像生成
    VIDEO = "video"  # 视频生成
    GUARD = "guard"  # 安全审核
    OCR = "ocr"  # 文字识别
    OTHER = "other"  # 未归类


class ModelTier(str, Enum):
    """代次档位(决定默认展示还是收进"历史模型")。"""

    LATEST = "latest"  # 最新最强 —— 默认直接展示
    STANDARD = "standard"  # 可用但非最新 —— 折叠区
    LEGACY = "legacy"  # 已过时 —— 折叠区,排在最后


#: 对话类用途(聊天模型选择器默认只展示这些)
CONVERSATIONAL_CATEGORIES = frozenset({ModelCategory.CHAT, ModelCategory.VISION})

#: 非对话用途(聊天场景调不通,一律不进默认列表)
NON_CONVERSATIONAL_CATEGORIES = frozenset(
    {
        ModelCategory.EMBEDDING,
        ModelCategory.RERANK,
        ModelCategory.TTS,
        ModelCategory.ASR,
        ModelCategory.IMAGE,
        ModelCategory.VIDEO,
        ModelCategory.GUARD,
        ModelCategory.OCR,
        ModelCategory.OTHER,
    }
)

#: release_date 早于 N 天 → legacy
LEGACY_RELEASE_DAYS = 365

# ---------------------------------------------------------------------------
# 用途分类规则(顺序敏感:先具体后通用)
# ---------------------------------------------------------------------------

_CATEGORY_RULES: tuple[tuple[ModelCategory, str], ...] = (
    # rerank 必须先于 embedding 判(`bge-reranker-v2-m3` 同时含 `bge`)
    (ModelCategory.RERANK, r"rerank|re-rank|bce-?emb.*rank"),
    (
        ModelCategory.EMBEDDING,
        r"embed|bge-|bge_|gte-|e5-|text-similarity|jina-embeddings|"
        r"sentence-transformers|text-embedding|multimodal-embedding|embeddinggemma",
    ),
    (
        ModelCategory.TTS,
        r"tts|text-to-speech|kokoro|cosyvoice|fish-speech|megatts|spark-tts|"
        r"aura-\d|voice|speech-synth|suno|chattts|moss-ttsd|step-tts|glm-tts|index-tts",
    ),
    (
        ModelCategory.ASR,
        r"asr|whisper|transcribe|sensevoice|automatic-speech|nova-3|deepgram|"
        r"fun-asr|paraformer|fire-red-asr|step-asr",
    ),
    (
        ModelCategory.IMAGE,
        r"flux|stable-diffusion|sdxl|kolors|imagen|dall-e|seedream|text-to-image|"
        r"playground-v|recraft|hidream|qwen-image|diffusion|-image(?:$|-)|image-edit|"
        r"imagegen|image-gen|midjourney|omnigen|next-image",
    ),
    (
        ModelCategory.VIDEO,
        r"sora|kling|wan2|wan-|text-to-video|video-gen|hunyuan-video|seedance|"
        r"video-generation|ltx-video|cogvideo",
    ),
    (ModelCategory.GUARD, r"guard|safety|moderation|shield|llama-?guard"),
    (ModelCategory.OCR, r"ocr|paddle-?ocr|dots-?ocr"),
    # 视觉理解:多模态对话模型(注意不要命中上面的图像生成)
    (
        ModelCategory.VISION,
        r"vision|-vl(?:$|[-_])|vl-|omni|4o|claude-3|gemini-.*-flash$|audio-preview",
    ),
)

# ---------------------------------------------------------------------------
# 精选白名单(代次关键词,不是具体 id —— 新 provider 接入自动覆盖)
# 命中即 latest。维护原则:厂商发布新代次时追加一行,旧代次不必立即删除
# (代次比较规则会自动把更老的版本压到 legacy)。
# ---------------------------------------------------------------------------

CURATED_LATEST: tuple[str, ...] = (
    # Anthropic
    r"claude-opus-5|claude-sonnet-5|claude-haiku-5",
    r"claude-opus-4-[6-9]|claude-sonnet-4-[6-9]|claude-haiku-4-[5-9]",
    # OpenAI(`o[1-9]` 必须加左边界,否则 `solar-pro4` 的 "o4" 会误命中)
    r"gpt-5|gpt-6|(?:^|[-/_.])o[1-9](?:-mini|-preview)?$",
    # Google
    r"gemini-3|gemini-4",
    # 智谱 GLM
    r"glm-5|glm-6",
    # DeepSeek
    r"deepseek-v4|deepseek-v5|deepseek-r2",
    # Moonshot Kimi
    r"kimi-k3|kimi-k4",
    # xAI Grok
    r"grok-4|grok-5",
    # 阿里 Qwen
    r"qwen3\.[5-9]|qwen4",
    # Meta Llama
    r"llama-4|llama-5",
    # 阶跃 StepFun
    r"step-3|step-4",
    # MiniMax
    r"minimax-m[2-9]",
    # 字节 Seed / 豆包
    r"seed-2|seed-3|doubao-2|doubao-3",
    # 腾讯混元
    r"hunyuan-hy3|hunyuan-turbo|hunyuan-.*-2026",
    # 百度文心
    r"ernie-5|ernie-4\.5",
    # 其他国产新代次
    r"ling-3|ling-4",
    # `-latest` 别名族:永远指向厂商当前最新版
    # (openrouter 用 `~vendor/xxx-latest`,Google/Mistral 直接用 `xxx-latest`)。
    # 落入 latest 后仍要过第二趟同系列版本比较,故 `gemini-2.5-...-audio-latest`
    # 这类老代次别名会被自动压下去。
    r"-latest$",
)

# ---------------------------------------------------------------------------
# 变体标记
# ---------------------------------------------------------------------------

# 价格/渠道变体:`:free` `:batch` 冒号式,以及 `-free` 后缀式(opencode_zen 用后者)
_RE_PRICING_VARIANT = re.compile(
    r":(free|batch|nitro|floor|extended|online)$|-(free|batch)$", re.I
)
# 日期快照:`-preview-09-2025` / `-10-2025` / `-0813` / `-20260420` / `-02-23`
_RE_SNAPSHOT = re.compile(
    r"-(?:preview-)?\d{2}-\d{4}$"  # -preview-09-2025 / -10-2025
    r"|-\d{8}$"  # -20260420
    r"|-\d{6}$"  # -202604
    r"|-\d{4}$"  # -0813
    r"|-\d{2}-\d{2}$",  # -02-23
    re.I,
)
_RE_EXPERIMENTAL = re.compile(r"(?:^|-)exp(?:$|-)|\bexperimental\b", re.I)
_RE_PREVIEW = re.compile(r"(?:^|-)preview(?:$|-)", re.I)
_RE_LATEST_ALIAS = re.compile(r"-latest$", re.I)
_RE_DEPRECATED = re.compile(r"deprecated|legacy|old-model|do-not-use", re.I)

#: 版本修饰词(不参与代次比较,只影响同版本内排序)
_VARIANTS = (
    "ultra",
    "opus",
    "max",
    "pro",
    "plus",
    "turbo",
    "sonnet",
    "flash",
    "haiku",
    "thinking",
    "code",
    "coder",
    "instruct",
    "chat",
    "base",
    "lite",
    "mini",
    "nano",
    "air",
    "large",
    "small",
    "medium",
    "tiny",
)

_RE_VERSION = re.compile(r"(?<!\d)(\d{1,2}(?:[.-]\d{1,2}){0,2})(?!\d)")
#: 参数量尾巴:`-32b-instruct` / `.4t-a95b` / `-16e` 这类(见 _extract_family_and_version)
#: 用法:把 version 末段与 tail 拼起来验证是否构成完整参数量(如 "2" + ".4t-a95b" → "2.4t")
_RE_PARAM_SCALE_JOIN = re.compile(r"^\d+(?:\.\d+)?[bkmtae](?:[-_]|$)", re.I)


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ModelClassification:
    """单模型分类结果。"""

    category: ModelCategory
    tier: ModelTier
    family: str
    generation: Optional[str]
    reason: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "category": self.category.value,
            "model_tier": self.tier.value,
            "family": self.family,
            "generation": self.generation,
            "classify_reason": self.reason,
        }


# ---------------------------------------------------------------------------
# 内部工具
# ---------------------------------------------------------------------------


def _normalize(model_id: str) -> str:
    """归一化模型名:去 openrouter 的 `~` 前缀、取路径最后一段、转小写。

    `~z-ai/glm-5.3-flash` → `glm-5.3-flash`
    `@cf/baai/bge-m3`     → `bge-m3`
    `deepseek-ai/DeepSeek-V4-Pro` → `deepseek-v4-pro`
    """
    name = (model_id or "").strip()
    if not name:
        return ""
    name = name.lstrip("~@")
    # 分段:cloudflare 的 `@cf/vendor/model` 剥掉 @cf 后仍有两段
    parts = [p for p in name.split("/") if p]
    if parts and parts[0].lower() in ("cf", "hf", "models"):
        parts = parts[1:]
    # 取最后一段作为模型名(第一段通常是厂商命名空间)
    return (parts[-1] if parts else name).lower()


def _strip_variant_tokens(name: str) -> str:
    """去掉 pricing 变体 / 快照 / 预览 / latest 别名后缀,得到"主干名"。"""
    out = _RE_PRICING_VARIANT.sub("", name)
    out = _RE_SNAPSHOT.sub("", out)
    out = _RE_PREVIEW.sub("", out)
    out = _RE_LATEST_ALIAS.sub("", out)
    return out.strip("-_")


def _extract_family_and_version(name: str) -> tuple[str, Optional[str]]:
    """从主干名提取 (family, version)。

    `deepseek-v4-pro` → ("deepseek-v", "4")
    `claude-opus-4-6`  → ("claude-opus", "4-6")
    `gemini-3.1-flash` → ("gemini", "3.1")
    `kimi-k3`          → ("kimi-k", "3")
    `yi-large`         → ("yi-large", None)

    **参数量后缀必须剥离**(2026-08-29 bugfix):`qwen3-32b` 里的 `32b` 是参数量
    而非版本号,若不剥离会得到 version="3-32",导致整组 qwen 的"最高版本"被
    算成 3.32,把真正的 `qwen3.8` 判成过时。同理 `gemma-3-12b-it` → 3、
    `llama-4-maverick-17b-128e-instruct` → 4、`qwen3.8-2.4t-a95b` → 3.8。
    判据:版本号匹配之后紧跟 `b`/`m`/`k`/`t`(参数量单位)时,丢弃最后一段。
    """
    m = _RE_VERSION.search(name)
    if not m:
        return (name.strip("-_") or name, None)
    version = m.group(1)
    head = name[: m.start()].strip("-_")
    if not head:
        # 数字在最前面(如 `3.5-sonnet`),用整段当 family
        return (name.strip("-_"), version)

    # 参数量后缀,两种情况:
    #   ① 参数量数字被 version 吃掉 → tail 以单位字母开头:
    #      `qwen3-32b` → version="3-32" + tail="b-instruct"  → 丢末段 → "3"
    #      `gemma-3-12b-it` → "3-12" + "b-it"                → "3"
    #   ② 参数量横跨 version 末段与 tail(只吃掉一半):
    #      `qwen3.8-2.4t-a95b` → "3.8-2" + ".4t-a95b"        → 丢末段 → "3.8"
    #   ③ 参数量完整落在 tail 里 → **不能动 version**,否则会把次版本号误删:
    #      `qwen3.5-397b-a17b` → "3.5" + "-397b-a17b"        → 保持 "3.5"
    #       (曾误判:末段 "5" 被当成参数量丢掉 → 3.5 退化成 3)
    tail = name[m.end() :]
    parts = re.split(r"[.-]", version)
    if len(parts) > 1:
        if tail and tail[0] in ("b", "m", "k", "t"):
            version = ".".join(parts[:-1])
        elif _RE_PARAM_SCALE_JOIN.match(f"{parts[-1]}{tail}"):
            version = ".".join(parts[:-1])
    return (head, version)


def _version_tuple(version: Optional[str]) -> tuple[int, ...]:
    """版本号 → 可比较元组。`4-6` → (4, 6);`3.1` → (3, 1);None → ()"""
    if not version:
        return ()
    return tuple(int(p) for p in re.split(r"[.-]", version) if p.isdigit())


def _version_sort_key(version: tuple[int, ...]) -> tuple[int, int, int]:
    """版本元组归一化到 3 位再比较,避免 (4, 8) 因"位数多"被误判大于 (5,)。

    claude-opus-4-8 → (4, 8, 0);claude-opus-5 → (5, 0, 0) → 5 > 4.8,opus-5 是更新代次。
    """
    return (
        version[0] if len(version) > 0 else 0,
        version[1] if len(version) > 1 else 0,
        version[2] if len(version) > 2 else 0,
    )


def _parse_release_date(value: Any) -> Optional[datetime]:
    """解析 release_date(支持 datetime / ISO 字符串)。空串视为缺失。

    脏数据防护(2026-08-29):DB 里 nvidia_nim 部分行的 release_date 是
    `1993-04-26`(时间戳回绕/占位值),若照常参与判断会把 kimi-k3 这类
    全新模型误判成 legacy。早于 2020 年的一律视为"缺失"。
    """
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    elif isinstance(value, str):
        text = value.strip().replace("Z", "+00:00")
        if not text:
            return None
        try:
            dt = datetime.fromisoformat(text)
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
    else:
        return None
    if dt.year < 2020:
        return None
    return dt


def _classify_category(name: str, raw_id: str) -> tuple[ModelCategory, str]:
    """用途分类(顺序敏感)。返回 (category, 命中规则)。"""
    haystack = f"{raw_id} {name}".lower()
    for category, pattern in _CATEGORY_RULES:
        m = re.search(pattern, haystack)
        if m:
            return (category, f"{category.value}:{m.group(0)}")
    return (ModelCategory.CHAT, "chat:default")


def _is_curated(name: str, raw_id: str) -> bool:
    """是否命中精选白名单。

    对 raw_id 与归一化 name **分别**匹配(而非拼成一个字符串):
    白名单里有锚定 `^` / `$` 的规则(如 openrouter 的 `~vendor/xxx-latest` 别名),
    拼接后 `~anthropic/claude-opus-latest|claude-opus-latest` 的 `$` 会失配。
    """
    for target in (raw_id.lower(), name.lower()):
        if any(re.search(p, target) for p in CURATED_LATEST):
            return True
    return False


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------


def classify_model(
    model_id: str,
    provider: str = "",
    release_date: Any = None,
    tags: Optional[Iterable[str]] = None,
    now: Optional[datetime] = None,
) -> ModelClassification:
    """对单个模型分类(纯函数,无 I/O)。

    注意:代次比较需要全量上下文,这里的 tier 只做"单模型可判定"的部分
    (白名单 / 时间窗 / 变体标记 / 非对话用途)。同系列版本比较由
    `annotate_models()` 在全量上二次回填。
    """
    raw = (model_id or "").strip()
    name = _normalize(raw)
    trunk = _strip_variant_tokens(name)
    family, generation = _extract_family_and_version(trunk)
    category, cat_reason = _classify_category(name, raw)

    tag_set = {str(t).lower() for t in (tags or ())}
    if not tag_set:
        # DB tags 缺失时按名字补一个兜底判断(不影响主分类,仅作参考)
        if "embedding" in name:
            tag_set.add("embedding")

    provider_code = (provider or "").lower()

    # 1. 非对话用途 → 直接 legacy(聊天场景调不通)
    if category in NON_CONVERSATIONAL_CATEGORIES:
        return ModelClassification(
            category=category,
            tier=ModelTier.LEGACY,
            family=family,
            generation=generation,
            reason=f"non-conversational ({cat_reason})",
        )

    # 2. 显式废弃标记
    if _RE_DEPRECATED.search(raw):
        return ModelClassification(
            category=category,
            tier=ModelTier.LEGACY,
            family=family,
            generation=generation,
            reason="deprecated-marker",
        )

    # 3. 发布时间窗
    released = _parse_release_date(release_date)
    if released is not None:
        now_dt = now or datetime.now(timezone.utc)
        if released < now_dt - timedelta(days=LEGACY_RELEASE_DAYS):
            return ModelClassification(
                category=category,
                tier=ModelTier.LEGACY,
                family=family,
                generation=generation,
                reason=f"released >{LEGACY_RELEASE_DAYS}d ago ({released.date()})",
            )

    # 4. 日期快照 / 价格变体 → standard(能用,但不是"最新最强")。
    #    必须先于白名单判,否则 `deepseek-v4-pro-0813:batch` 这类会被误判成 latest。
    if _RE_PRICING_VARIANT.search(raw.lower()) or _RE_SNAPSHOT.search(name):
        return ModelClassification(
            category=category,
            tier=ModelTier.STANDARD,
            family=family,
            generation=generation,
            reason="pricing-or-snapshot-variant",
        )

    # 5. 实验版 / 废弃预览版(`-exp` 明确不是稳定版,优先于白名单判)
    if _RE_EXPERIMENTAL.search(name):
        return ModelClassification(
            category=category,
            tier=ModelTier.STANDARD,
            family=family,
            generation=generation,
            reason="experimental",
        )

    # 6. 精选白名单 → **候选** latest(仍要过第二趟同系列版本比较,见 annotate_models)
    if _is_curated(name, raw):
        return ModelClassification(
            category=category,
            tier=ModelTier.LATEST,
            family=family,
            generation=generation,
            reason="curated-latest",
        )

    # 7. 预览版 → standard
    if _RE_PREVIEW.search(name):
        return ModelClassification(
            category=category,
            tier=ModelTier.STANDARD,
            family=family,
            generation=generation,
            reason="preview",
        )

    # 8. 其余 → standard(等全量代次比较再定)
    return ModelClassification(
        category=category,
        tier=ModelTier.STANDARD,
        family=family,
        generation=generation,
        reason=f"unclassified-default (provider={provider_code})",
    )


def annotate_models(
    models: list[dict[str, Any]],
    now: Optional[datetime] = None,
) -> list[dict[str, Any]]:
    """批量分类:给每个模型 dict 原地附加 category / model_tier / family 字段。

    两趟处理:
    - 第一趟:单模型分类(用途 + 白名单 + 时间窗 + 变体)
    - 第二趟:按 family 分组做**代次比较** —— 同系列里主版本低于最高的压到 legacy,
      同主版本低次版本的压到 standard。这样新模型上线时旧代次自动降级,无需改白名单。

    **预设档位优先**:若模型 dict 里已带 `model_tier`(如 `default_models.json`
    手工标注的兜底主力模型),则保留预设值,不被引擎覆盖。

    返回同一 list(原地修改),便于链式调用。
    """
    if not models:
        return models

    classifications: list[ModelClassification] = []
    for m in models:
        cls = classify_model(
            str(m.get("id") or m.get("model") or ""),
            provider=str(m.get("provider") or ""),
            release_date=m.get("release_date"),
            tags=m.get("tags"),
            now=now,
        )
        classifications.append(cls)
        preset_tier = m.get("model_tier")
        patch = cls.as_dict()
        if preset_tier in {t.value for t in ModelTier}:
            patch["model_tier"] = preset_tier
            patch["classify_reason"] = f"preset:{preset_tier}"
        m.update(patch)

    # ---- 第二趟:同系列代次比较 ----
    by_family: dict[str, list[int]] = {}
    for idx, cls in enumerate(classifications):
        if cls.category not in CONVERSATIONAL_CATEGORIES:
            continue
        if not cls.generation:
            continue
        by_family.setdefault(cls.family, []).append(idx)

    for family, idxs in by_family.items():
        if len(idxs) < 2:
            continue
        versions = [_version_tuple(classifications[i].generation) for i in idxs]
        max_ver = max(versions, key=_version_sort_key)
        max_key = _version_sort_key(max_ver)
        for i in idxs:
            cls = classifications[i]
            model = models[i]
            # 预设档位(default_models.json 手工标注)不参与自动降级
            if str(model.get("classify_reason") or "").startswith("preset:"):
                continue
            ver = _version_tuple(cls.generation)
            if not ver:
                continue
            ver_key = _version_sort_key(ver)
            if ver_key[0] < max_key[0]:
                # 主版本落后一代以上 → legacy
                model["model_tier"] = ModelTier.LEGACY.value
                model["classify_reason"] = (
                    f"older-generation ({cls.family} {cls.generation} < {'.'.join(map(str, max_ver))})"
                )
            elif ver_key < max_key:
                # 同主版本,次版本偏低(gpt-5.1 < gpt-5.6、opus-4-8 < opus-5)→ standard
                model["model_tier"] = ModelTier.STANDARD.value
                model["classify_reason"] = (
                    f"minor-behind ({cls.family} {cls.generation} < {'.'.join(map(str, max_ver))})"
                )

    return models
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
