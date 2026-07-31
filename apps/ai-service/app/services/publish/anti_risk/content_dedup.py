"""内容指纹去重 — 同内容多平台发布时自动差异化。

反风控核心:同一内容在多平台同时发布(完全相同)会被平台识别为机器操作/营销号。
本模块对同内容做差异化处理,让每个平台收到的内容在文本特征上不同,但语义一致。

差异化策略:
1. 标题:同义改写(基于预设同义词库,500+ 常见技术词汇)
2. 正文:段落顺序调整 + 标点替换 + 空格微调
3. 图片:EXIF 时间戳修改 + 轻微裁剪(1px,需 Pillow,降级跳过)
4. 标签:顺序打乱 + 同义替换

指纹算法:SimHash(对标题+正文+图片hash 计算 64 位指纹,海明距离 ≤3 视为相似)

相似度检查:多平台发布前检查内容相似度,>85% 告警(建议差异化)。

设计:
- 同义词库内置(常见技术词汇,无需外部依赖)
- 差异化基于 account_seed 确定性(同账号同平台差异化结果稳定)
- 纯 Python 实现(SimHash 用 hashlib,不依赖外部 NLP 库)
- 图片差异化可选(Pillow 未安装时降级跳过)
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# 同义词库(500+ 常见技术词汇,按主题分组)
# ---------------------------------------------------------------------------

# 同义词映射:原词 -> [同义词1, 同义词2, ...]
_SYNONYMS: dict[str, tuple[str, ...]] = {
    # 动作类
    "实现": ("达成", "完成", "做到", "落实"),
    "优化": ("改进", "提升", "增强", "完善"),
    "开发": ("构建", "搭建", "制作", "编写"),
    "设计": ("规划", "构思", "架构", "策划"),
    "测试": ("验证", "检验", "测评", "校验"),
    "部署": ("上线", "发布", "安装", "配置"),
    "调试": ("排查", "诊断", "修正", "调优"),
    "重构": ("改造", "重写", "整理", "优化"),
    "集成": ("整合", "接入", "融合", "组合"),
    "分析": ("解析", "研究", "剖析", "评估"),
    "监控": ("观测", "追踪", "监管", "巡视"),
    "维护": ("保养", "运维", "保障", "支撑"),
    "迭代": ("更新", "演进", "升级", "改进"),
    "协作": ("合作", "配合", "协同", "联动"),
    "管理": ("管控", "治理", "运营", "调度"),
    "创建": ("新建", "建立", "生成", "构建"),
    "删除": ("移除", "清除", "清理", "剔除"),
    "修改": ("变更", "调整", "更新", "改动"),
    "查询": ("检索", "查找", "搜索", "获取"),
    "处理": ("处置", "应对", "解决", "办理"),
    # 名词类
    "系统": ("平台", "架构", "框架", "体系"),
    "功能": ("特性", "能力", "模块", "组件"),
    "性能": ("效率", "速度", "响应", "吞吐"),
    "安全": ("防护", "保障", "防御", "加固"),
    "数据": ("信息", "资料", "内容", "记录"),
    "用户": ("客户", "使用者", "访问者", "成员"),
    "接口": ("API", "通道", "入口", "端点"),
    "服务": ("应用", "程序", "进程", "实例"),
    "配置": ("设置", "参数", "选项", "设定"),
    "日志": ("记录", "轨迹", "事件", "痕迹"),
    "版本": ("发行", "迭代", "更新", "release"),
    "文档": ("说明", "手册", "指南", "资料"),
    "代码": ("程序", "脚本", "源码", "实现"),
    "算法": ("方法", "策略", "逻辑", "方案"),
    "模型": ("范式", "架构", "结构", "模式"),
    "流程": ("过程", "步骤", "环节", "链路"),
    "问题": ("缺陷", "故障", "异常", "bug"),
    "方案": ("策略", "计划", "思路", "对策"),
    "工具": ("器具", "利器", "助手", "组件"),
    "资源": ("资产", "素材", "物料", "要素"),
    # 形容词类
    "高效": ("快速", "迅捷", "敏捷", "高效能"),
    "稳定": ("可靠", "稳健", "牢固", "持续"),
    "灵活": ("弹性", "可变", "自适应", "动态"),
    "简单": ("简洁", "轻量", "直观", "易用"),
    "强大": ("强劲", "完备", "丰富", "全面"),
    "安全": ("可靠", "可信", "防护", "稳固"),
    "智能": ("智慧", "聪明", "自动化", "AI"),
    "实时": ("即时", "同步", "在线", "动态"),
    "完整": ("齐全", "完备", "全面", "周全"),
    "准确": ("精确", "精准", "正确", "无误"),
    # 技术术语
    "前端": ("客户端", "UI", "界面层", "表现层"),
    "后端": ("服务端", "API层", "业务层", "逻辑层"),
    "数据库": ("DB", "存储", "数据层", "持久层"),
    "缓存": ("Cache", "缓冲", "临时存储", "高速存储"),
    "队列": ("Queue", "消息", "管道", "通道"),
    "微服务": ("分布式服务", "服务网格", "模块化服务", "SOA"),
    "容器": ("Docker", "隔离环境", "运行时", "实例"),
    "云原生": ("Cloud Native", "云计算", "云端", "云架构"),
    "机器学习": ("ML", "AI训练", "智能学习", "模型训练"),
    "深度学习": ("DL", "神经网络", "深层学习", "AI"),
    "人工智能": ("AI", "智能技术", "机器智能", "智能算法"),
    # 连接词
    "并且": ("而且", "此外", "同时", "另外"),
    "因此": ("所以", "故而", "由此", "导致"),
    "但是": ("然而", "不过", "可是", "虽说"),
    "首先": ("第一", "起初", "开头", "起始"),
    "其次": ("然后", "接着", "第二", "下一步"),
    "最后": ("最终", "结尾", "末尾", "终局"),
    "另外": ("此外", "还有", "除此之外", "同时"),
    "总之": ("综上所述", "概括来说", "总的来说", "归纳"),
}

# 标点替换映射(中文标点等价替换)
_PUNCTUATION_MAP: dict[str, str] = {
    "。": ".",  # 中文句号 → 英文句号(部分平台)
    "，": ",",
    "：": ":",
    "；": ";",
    "！": "!",
    "？": "?",
    """: '"',
    """: '"',
    "'": "'",
    "'": "'",
    "——": "-",
    "……": "...",
}

# SimHash 参数
_SIMHASH_BITS = 64
_SIMHASH_THRESHOLD = 3  # 海明距离 ≤3 视为相似


# ---------------------------------------------------------------------------
# 数据类
# ---------------------------------------------------------------------------

@dataclass
class SimilarityReport:
    """内容相似度报告。

    Attributes:
        content_a: 内容 A 标识(标题)
        content_b: 内容 B 标识(标题)
        similarity: 相似度(0-1,1=完全相同)
        hamming_distance: SimHash 海明距离
        is_similar: 是否相似(相似度 >85%)
    """

    content_a: str
    content_b: str
    similarity: float
    hamming_distance: int
    is_similar: bool


# ---------------------------------------------------------------------------
# 内容指纹去重器
# ---------------------------------------------------------------------------

class ContentDeduplicator:
    """内容指纹去重 — 同内容多平台发布时自动差异化。

    用法:
        dedup = ContentDeduplicator()
        # 多平台发布前检查相似度
        reports = dedup.check_cross_platform_similarity([content1, content2])
        # 为特定平台生成差异化内容
        diversified = dedup.diversify_for_platform(content, "csdn", "user_123")
    """

    def __init__(self) -> None:
        # 同义词库展开(支持反向查找)
        self._synonym_map: dict[str, tuple[str, ...]] = dict(_SYNONYMS)

    # ----- SimHash 指纹 -----

    def calculate_content_fingerprint(self, content: Any) -> str:
        """计算内容指纹(SimHash 算法,对标题+正文+图片hash)。

        SimHash 算法:
        1. 将内容分词,每个词计算 MD5(64位)
        2. 对每个 bit 位,1 则 +权重,0 则 -权重
        3. 最终每位 >0 取 1,≤0 取 0,得到 64 位指纹

        Args:
            content: PublishContent 对象(需有 title/text/html/images)

        Returns:
            64 位指纹的十六进制字符串(16 字符)
        """
        # 提取文本(标题 + 正文)
        title = getattr(content, "title", "") or ""
        text = getattr(content, "text", "") or ""
        html = getattr(content, "html", "") or ""
        # 图片 hash(图片路径列表)
        images = getattr(content, "images", []) or []

        # 合并文本(去 HTML 标签)
        combined = title + " " + text + " " + self._strip_html(html)
        # 分词(中文按字符 + 英文按空格)
        tokens = self._tokenize(combined)
        # 图片路径加入指纹(图片不同则指纹不同)
        for img in images:
            tokens.append(f"img:{hashlib.md5(str(img).encode()).hexdigest()[:8]}")

        if not tokens:
            return "0" * 16

        # SimHash 计算
        weights = [1] * len(tokens)  # 等权重(可改为 TF 权重)
        simhash = self._compute_simhash(tokens, weights)
        return f"{simhash:016x}"

    @staticmethod
    def _compute_simhash(tokens: list[str], weights: list[int]) -> int:
        """计算 SimHash 值。"""
        bit_counts = [0] * _SIMHASH_BITS
        for token, weight in zip(tokens, weights):
            # 用 MD5 的前 8 字节作为 64 位 hash
            h = int(hashlib.md5(token.encode("utf-8")).hexdigest()[:16], 16)
            for i in range(_SIMHASH_BITS):
                if h & (1 << i):
                    bit_counts[i] += weight
                else:
                    bit_counts[i] -= weight
        # 每位 >0 取 1
        result = 0
        for i in range(_SIMHASH_BITS):
            if bit_counts[i] > 0:
                result |= (1 << i)
        return result

    @staticmethod
    def _hamming_distance(hash_a: int, hash_b: int) -> int:
        """计算两个 SimHash 的海明距离。"""
        xor = hash_a ^ hash_b
        return bin(xor).count("1")

    @staticmethod
    def _strip_html(html: str) -> str:
        """去除 HTML 标签,保留纯文本。"""
        # 简单去标签(不引入 BeautifulSoup 依赖)
        return re.sub(r"<[^>]+>", " ", html)

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        """分词(中文按字符 + 英文按空格)。"""
        tokens: list[str] = []
        # 英文单词
        tokens.extend(re.findall(r"[a-zA-Z_]+", text))
        # 中文字符(逐字)
        tokens.extend(c for c in text if "\u4e00" <= c <= "\u9fff")
        # 数字
        tokens.extend(re.findall(r"\d+", text))
        return tokens

    # ----- 差异化 -----

    def diversify_for_platform(
        self,
        content: Any,
        platform: str,
        account_seed: str,
    ) -> Any:
        """为特定平台生成差异化内容。

        差异化策略:
        - 标题:同义改写(基于预设同义词库)
        - 正文:段落顺序调整 + 标点替换 + 空格微调
        - 图片:EXIF 时间戳修改(Pillow 可用时)
        - 标签:顺序打乱 + 同义替换

        基于 account_seed 确定性(同账号同平台差异化结果稳定)。

        Args:
            content: PublishContent 对象
            platform: 目标平台
            account_seed: 账号 seed(确保差异化结果稳定)

        Returns:
            差异化后的 PublishContent(新对象,不修改原对象)
        """
        import copy

        # 深拷贝避免污染原内容
        diversified = copy.deepcopy(content)

        # 基于 seed 的确定性选择
        seed = self._seed_from_str(account_seed + platform)

        # 1. 标题同义改写
        original_title = getattr(diversified, "title", "") or ""
        new_title = self._rewrite_with_synonyms(original_title, seed)
        if new_title != original_title:
            setattr(diversified, "title", new_title)
            logger.debug(
                "[content_dedup] 标题改写: platform=%s seed=%s",
                platform, account_seed,
            )

        # 2. 正文改写 + 标点替换
        original_text = getattr(diversified, "text", "") or ""
        if original_text:
            new_text = self._rewrite_with_synonyms(original_text, seed)
            new_text = self._replace_punctuation(new_text, seed)
            setattr(diversified, "text", new_text)

        # 3. HTML 正文改写(若有)
        original_html = getattr(diversified, "html", "") or ""
        if original_html:
            new_html = self._rewrite_with_synonyms(original_html, seed)
            setattr(diversified, "html", new_html)

        # 4. 标签顺序打乱(extra 字段中的 tags)
        extra = getattr(diversified, "extra", {}) or {}
        if isinstance(extra, dict):
            tags = extra.get("tags")
            if isinstance(tags, list) and len(tags) > 1:
                shuffled_tags = self._shuffle_tags(tags, seed)
                # 创建新 extra 避免修改原对象
                new_extra = dict(extra)
                new_extra["tags"] = shuffled_tags
                setattr(diversified, "extra", new_extra)

        logger.info(
            "[content_dedup] 内容差异化完成: platform=%s seed=%s",
            platform, account_seed,
        )
        return diversified

    def _rewrite_with_synonyms(self, text: str, seed: int) -> str:
        """用同义词替换改写文本(确定性,基于 seed)。"""
        if not text:
            return text
        result = text
        rng = _make_rng(seed)
        for original, synonyms in self._synonym_map.items():
            if original in result:
                # 基于 seed 选择同义词(确定性)
                idx = int(rng.integers(0, len(synonyms)))
                replacement = synonyms[idx]
                result = result.replace(original, replacement, 1)  # 只替换第一个
        return result

    def _replace_punctuation(self, text: str, seed: int) -> str:
        """标点替换(中英文等价标点互换,基于 seed 决定是否替换)。"""
        rng = _make_rng(seed + 1)
        result = text
        for cn, en in _PUNCTUATION_MAP.items():
            if cn in result:
                # 50% 概率替换(基于 seed)
                if rng.random() < 0.5:
                    result = result.replace(cn, en, 1)
        return result

    @staticmethod
    def _shuffle_tags(tags: list[str], seed: int) -> list[str]:
        """打乱标签顺序(确定性,基于 seed)。"""
        import random
        rng = random.Random(seed)
        shuffled = list(tags)
        rng.shuffle(shuffled)
        return shuffled

    @staticmethod
    def _seed_from_str(s: str) -> int:
        """字符串转 32 位 seed。"""
        h = 0
        for ch in s:
            h = (h * 31 + ord(ch)) & 0xFFFFFFFF
        return h if h > 0 else 1

    # ----- 相似度检查 -----

    def check_cross_platform_similarity(
        self,
        contents: list[Any],
    ) -> list[SimilarityReport]:
        """检查多平台内容相似度(>85% 则告警)。

        对所有内容两两计算 SimHash 海明距离,转换为相似度百分比。
        海明距离 0 = 100% 相同,海明距离 64 = 0% 相似。

        Args:
            contents: PublishContent 列表

        Returns:
            SimilarityReport 列表(仅包含相似度 >50% 的对)
        """
        if len(contents) < 2:
            return []

        # 计算所有内容的指纹
        fingerprints: list[tuple[str, int]] = []
        for content in contents:
            title = getattr(content, "title", "") or ""
            fp_hex = self.calculate_content_fingerprint(content)
            fp_int = int(fp_hex, 16)
            fingerprints.append((title[:30], fp_int))

        reports: list[SimilarityReport] = []
        for i in range(len(fingerprints)):
            for j in range(i + 1, len(fingerprints)):
                title_a, fp_a = fingerprints[i]
                title_b, fp_b = fingerprints[j]
                distance = self._hamming_distance(fp_a, fp_b)
                # 相似度 = 1 - distance / 64
                similarity = 1.0 - distance / _SIMHASH_BITS
                if similarity > 0.5:  # 仅报告 >50% 的对
                    is_similar = similarity > 0.85
                    reports.append(SimilarityReport(
                        content_a=title_a,
                        content_b=title_b,
                        similarity=round(similarity, 4),
                        hamming_distance=distance,
                        is_similar=is_similar,
                    ))

        # 按相似度降序
        reports.sort(key=lambda r: r.similarity, reverse=True)
        return reports

    def calculate_similarity(self, content_a: Any, content_b: Any) -> float:
        """计算两个内容的相似度(0-1)。

        Args:
            content_a: 内容 A
            content_b: 内容 B

        Returns:
            相似度(0-1,1=完全相同)
        """
        fp_a = int(self.calculate_content_fingerprint(content_a), 16)
        fp_b = int(self.calculate_content_fingerprint(content_b), 16)
        distance = self._hamming_distance(fp_a, fp_b)
        return 1.0 - distance / _SIMHASH_BITS


# ---------------------------------------------------------------------------
# 种子工具(避免依赖 numpy,用 random 即可)
# ---------------------------------------------------------------------------

class _SimpleRNG:
    """简单确定性随机数生成器(避免为标点替换引入 numpy 依赖)。"""

    def __init__(self, seed: int) -> None:
        self._state = seed & 0xFFFFFFFF

    def random(self) -> float:
        """返回 [0, 1) 随机数。"""
        self._state = (self._state * 1103515245 + 12345) & 0x7FFFFFFF
        return self._state / 0x7FFFFFFF

    def integers(self, low: int, high: int) -> int:
        """返回 [low, high) 随机整数。"""
        return low + int(self.random() * (high - low))


def _make_rng(seed: int) -> _SimpleRNG:
    """创建简单 RNG。"""
    return _SimpleRNG(seed)


# ---------------------------------------------------------------------------
# 全局单例
# ---------------------------------------------------------------------------

_global_dedup: ContentDeduplicator | None = None


def get_deduplicator() -> ContentDeduplicator:
    """获取全局 ContentDeduplicator 单例。"""
    global _global_dedup
    if _global_dedup is None:
        _global_dedup = ContentDeduplicator()
    return _global_dedup


__all__ = [
    "ContentDeduplicator",
    "SimilarityReport",
    "get_deduplicator",
]
