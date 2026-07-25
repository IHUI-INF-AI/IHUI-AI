"""差分隐私工具(L7 联邦学习,2026-07-25 立,对标 Google FL DP-SGD)。

提供纯函数差分隐私原语,供 FederatedLearner 在聚合跨用户 lessons 时:
1. 对 source_user_count 加 Laplace 噪声(防止成员推断攻击)
2. 对 confidence 加 Gaussian 噪声(防止通过置信度反推个体)
3. anonymize_user_id 用 sha256+salt 不可逆 hash user_id
4. anonymize_text 用正则脱敏 PII(邮箱/手机/IP/身份证)
5. k_anonymity_filter 过滤小群体(防止 k < k_min 的再识别)

设计原则:
- 全部纯函数,无 IO,无状态,可单例可静态
- 所有噪声采样用 stdlib random(非加密安全,FL 场景足够)
- salt 默认从环境变量 DP_SALT 读取,生产环境必须改

参考文献:
- Dwork & Roth, "The Algorithmic Foundations of Differential Privacy" (2014)
- Abadi et al., "Deep Learning with Differential Privacy" (DP-SGD, 2016)
- Google FL:https://ai.googleblog.com/2017/04/federated-learning-collaborative.html
"""

from __future__ import annotations

import hashlib
import math
import os
import random
import re
from typing import Any

# =============================================================================
# 默认 PII 脱敏正则(顺序敏感:先匹配长格式再匹配短格式,避免误替换)
# =============================================================================
# 邮箱:RFC 5322 简化版(覆盖 99% 常见邮箱)
_DEFAULT_EMAIL_PATTERN = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
# 手机号:中国大陆 11 位手机号(1 开头,第二位 3-9)
_DEFAULT_PHONE_PATTERN = r"(?<!\d)1[3-9]\d{9}(?!\d)"
# IPv4:四段点分十进制(0-255),边界用非数字防止误匹配
_DEFAULT_IPV4_PATTERN = (
    r"(?<!\d)(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)"
    r"(?:\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)){3}(?!\d)"
)
# 身份证号:18 位(最后一位可为 X),前 17 位为数字
_DEFAULT_ID_CARD_PATTERN = r"(?<!\d)[1-9]\d{16}[\dXx](?!\d)"

# 占位符(替换 PII 用)
_PLACEHOLDER_EMAIL = "[EMAIL]"
_PLACEHOLDER_PHONE = "[PHONE]"
_PLACEHOLDER_IP = "[IP]"
_PLACEHOLDER_ID = "[ID]"

# 默认 salt(生产环境必须通过 DP_SALT 环境变量覆盖)
_DEFAULT_SALT = "default-salt"


class DifferentialPrivacy:
    """差分隐私工具(单例,纯函数)。

    提供 Laplace / Gaussian 机制、PII 脱敏、k-anonymity 过滤等原语,
    供 FederatedLearner 在聚合跨用户 lessons 时保护用户隐私。
    """

    def __init__(self, *, rng: random.Random | None = None) -> None:
        """初始化差分隐私工具。

        Args:
            rng: 可选的随机数生成器(测试可注入固定种子 rng 以确定性输出)。
                 默认 None 时用模块级 random(非加密安全,FL 场景足够)。
        """
        self._rng = rng

    # ==================================================================
    # 噪声机制
    # ==================================================================

    def laplace_noise(self, sensitivity: float, epsilon: float) -> float:
        """Laplace 机制:生成 Laplace(0, sensitivity/epsilon) 噪声。

        Laplace 机制是纯 ε-差分隐私的标准机制,适用于数值型查询。
        noise = sensitivity / epsilon * ln(1/U),U ~ Uniform(0, 1)

        Args:
            sensitivity: 查询的灵敏度(单条记录对结果的最大影响)。
            epsilon: 隐私预算,越小隐私越强但噪声越大(通常 0.1-1.0)。

        Returns:
            噪声偏移量(可正可负),调用方加到真实值上即可。
            sensitivity=0 时返回 0;epsilon 极大时返回近 0。
        """
        if sensitivity == 0:
            return 0.0
        if epsilon <= 0:
            # epsilon 非法时不加噪声(避免除零,调用方应保证 epsilon > 0)
            return 0.0
        # U ~ Uniform(0, 1),避免 U=0 导致 ln 无穷大
        u = self._uniform_01()
        # Laplace(0, b) 采样:b = sensitivity / epsilon
        # 用 inverse CDF 采样(对标 Dwork & Roth 2014):
        #   U < 0.5:  x = b * ln(2*U)          (负侧,2U ∈ (0,1),ln < 0)
        #   U >= 0.5: x = -b * ln(2*(1-U))     (正侧,2(1-U) ∈ (0,1],ln <= 0)
        b = sensitivity / epsilon
        if u < 0.5:
            return b * math.log(2.0 * u)
        else:
            return -b * math.log(2.0 * (1.0 - u))

    def gaussian_noise(
        self, sensitivity: float, epsilon: float, delta: float
    ) -> float:
        """Gaussian 机制:生成 Gaussian(0, σ²) 噪声,(ε, δ)-差分隐私。

        Gaussian 机制适用于需要更紧隐私预算组合的场景(如 DP-SGD)。
        σ = sqrt(2 * ln(1.25/δ)) * sensitivity / epsilon

        Args:
            sensitivity: 查询的灵敏度。
            epsilon: 隐私预算,> 0。
            delta: 失败概率(通常 1e-5 或更小),> 0 且 < 1。

        Returns:
            噪声偏移量(可正可负)。
            sensitivity=0 返回 0;epsilon 极大返回近 0。
        """
        if sensitivity == 0:
            return 0.0
        if epsilon <= 0 or delta <= 0 or delta >= 1:
            return 0.0
        # σ = sqrt(2 * ln(1.25/δ)) * sensitivity / epsilon
        sigma = math.sqrt(2.0 * math.log(1.25 / delta)) * sensitivity / epsilon
        # Box-Muller 变换生成标准正态分布样本
        u1 = self._uniform_01()
        u2 = self._uniform_01()
        # 避免 log(0)
        if u1 <= 0:
            u1 = 1e-10
        z = math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
        return sigma * z

    def apply_to_count(
        self, count: int, *, epsilon: float = 1.0
    ) -> int:
        """对计数值加 Laplace 噪声,clip 到非负(避免负数)。

        计数查询灵敏度为 1(单条记录影响计数最多 1)。

        Args:
            count: 真实计数值(如 source_user_count)。
            epsilon: 隐私预算,默认 1.0。

        Returns:
            加噪后的计数值 max(0, count + noise),噪声为整数舍入。
        """
        noise = self.laplace_noise(sensitivity=1.0, epsilon=epsilon)
        return max(0, int(round(count + noise)))

    def apply_to_score(
        self,
        score: float,
        *,
        epsilon: float = 1.0,
        sensitivity: float = 1.0,
    ) -> float:
        """对评分加 Laplace 噪声,clip 到 [0.0, 1.0]。

        Args:
            score: 真实评分(0.0-1.0,如 confidence)。
            epsilon: 隐私预算,默认 1.0。
            sensitivity: 灵敏度,默认 1.0(评分范围 0-1 时单条记录最大影响 1)。

        Returns:
            加噪后的评分,clip 到 [0.0, 1.0]。
        """
        noise = self.laplace_noise(sensitivity=sensitivity, epsilon=epsilon)
        return max(0.0, min(1.0, score + noise))

    # ==================================================================
    # 隐私保护:hash 脱敏 + PII 脱敏
    # ==================================================================

    def anonymize_user_id(
        self, user_id: str, *, salt: str | None = None
    ) -> str:
        """用 sha256(user_id + salt) 生成不可逆 hash。

        salt 默认从环境变量 DP_SALT 读取,未设置时用 "default-salt"。
        生产环境必须通过 DP_SALT 环境变量覆盖默认 salt。

        Args:
            user_id: 原始用户 ID(如 UUID 字符串)。
            salt: 可选 salt,默认 None 时用 os.environ["DP_SALT"] 或 "default-salt"。

        Returns:
            sha256(user_id + salt) 的 64 字符十六进制 hash(不可逆)。
        """
        if salt is None:
            salt = os.environ.get("DP_SALT", _DEFAULT_SALT)
        # sha256 哈希(UTF-8 编码),返回 64 字符 hex
        return hashlib.sha256(f"{user_id}:{salt}".encode("utf-8")).hexdigest()

    def anonymize_text(
        self,
        text: str,
        *,
        redact_patterns: list[str] | None = None,
    ) -> str:
        """用正则脱敏 PII(邮箱/手机号/IP/身份证号)。

        Args:
            text: 原始文本(可能含 PII)。
            redact_patterns: 可选自定义正则列表(默认 None 用内置 4 类 PII 正则)。

        Returns:
            脱敏后的文本,PII 替换为 [EMAIL] / [PHONE] / [IP] / [ID]。
            无 PII 时原样返回。多次出现都替换。
        """
        if not text:
            return text
        # 默认脱敏 4 类 PII(顺序敏感:身份证先于手机号,避免误匹配)
        # 实际顺序:邮箱 → 身份证 → IPv4 → 手机号
        # 身份证(18 位)优先于手机号(11 位),防止手机号被当作身份证前 11 位
        patterns: list[tuple[str, str]] = [
            (_DEFAULT_EMAIL_PATTERN, _PLACEHOLDER_EMAIL),
            (_DEFAULT_ID_CARD_PATTERN, _PLACEHOLDER_ID),
            (_DEFAULT_IPV4_PATTERN, _PLACEHOLDER_IP),
            (_DEFAULT_PHONE_PATTERN, _PLACEHOLDER_PHONE),
        ]
        # 自定义正则覆盖默认(测试用)
        if redact_patterns is not None:
            patterns = [(p, _PLACEHOLDER_EMAIL) for p in redact_patterns]

        result = text
        for pattern, placeholder in patterns:
            result = re.sub(pattern, placeholder, result)
        return result

    # ==================================================================
    # k-anonymity
    # ==================================================================

    def k_anonymity_filter(
        self, values: list[Any], *, k: int = 5
    ) -> list[Any]:
        """只保留出现次数 >= k 的值(防止小群体再识别)。

        k-anonymity 是隐私保护的基本要求:任何等价类至少包含 k 条记录。
        本实现按值分组,只返回出现次数 >= k 的值(去重后排序)。

        Args:
            values: 值列表(可重复,如多个用户贡献的 lesson title)。
            k: 最小出现次数阈值,默认 5。

        Returns:
            去重后出现次数 >= k 的值列表(按值排序)。
            空列表输入返回空列表。k=1 时全保留。
        """
        if not values:
            return []
        # 统计每个值的出现次数
        counts: dict[Any, int] = {}
        for v in values:
            counts[v] = counts.get(v, 0) + 1
        # 只保留 count >= k 的值(去重 + 排序)
        return sorted([v for v, c in counts.items() if c >= k])

    # ==================================================================
    # 内部工具
    # ==================================================================

    def _uniform_01(self) -> float:
        """生成 (0, 1) 区间均匀分布随机数(避免 0 和 1 边界)。

        注入 rng 时用 rng.random(),否则用模块级 random.random()。
        """
        if self._rng is not None:
            u = self._rng.random()
        else:
            u = random.random()
        # 避免 0.0(导致 log(0))和严格等于边界值
        if u <= 0.0:
            return 1e-10
        if u >= 1.0:
            return 1.0 - 1e-10
        return u


# 全局单例(与 meta_learner / failure_clusterer 风格一致)
differential_privacy = DifferentialPrivacy()
