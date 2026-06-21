"""密码强度校验器 - 修复 Bug-3-续 + Bug-23-续.

不依赖 zxcvbn (避免引入大型 ML 模型, 部署简单), 自研基于启发式的 0-4 分级.
基于 NIST SP 800-63B 推荐:
  - 至少 8 位
  - 包含大小写字母 + 数字 (或 12+ 位的强密码短语)
  - 拒常见弱密码字典 (top 200 截选)
  - 拒连续/重复字符 (aaa, 123, qwerty)
  - 拒包含用户名/手机号/邮箱前缀的密码 (Bug-23-续 模糊匹配)
"""

import math
import re
from collections.abc import Iterable

# 常见弱密码字典 (top 200 截选, 实际项目可对接泄露库)
_COMMON_WEAK = {
    "123456",
    "123456789",
    "qwerty",
    "password",
    "12345",
    "qwerty123",
    "1q2w3e",
    "12345678",
    "111111",
    "1234567890",
    "000000",
    "abc123",
    "654321",
    "123123",
    "666666",
    "888888",
    "password1",
    "admin",
    "admin123",
    "root",
    "toor",
    "qwertyuiop",
    "iloveyou",
    "monkey",
    "dragon",
    "letmein",
    "trustno1",
    "sunshine",
    "princess",
    "welcome",
    "shadow",
    "ashley",
    "football",
    "jesus",
    "michael",
    "ninja",
    "mustang",
    "zhangsan",
    "lisi",
    "wangwu",
    "woaini",
    "asd123",
    "qwe123",
    "1qaz2wsx",
    "test",
    "test123",
    "guest",
    "master",
    "default",
    "passw0rd",
    # Bug-23-续 扩充: 国内外泄露库 top 100 + 中文常用
    "0000000000",
    "abcdefg",
    "abcd1234",
    "1q2w3e4r",
    "1q2w3e4r5t",
    "qwerty1",
    "qwerty12",
    "q1w2e3r4",
    "asdfghjkl",
    "asdfgh",
    "asdf1234",
    "zxcvbnm",
    "p@ssw0rd",
    "p@ssword",
    "pass1234",
    "123qwe",
    "12345qwert",
    "a123456",
    "1234abcd",
    "woaini1314",
    "5201314",
    "520520",
    "1314520",
    "iloveyou520",
    "woaini520",
    "qwerty520",
    "abcabc",
    "aaaaaa",
    "qqqqqq",
    "abcdef",
    "1111aaaa",
    "aaa111",
    "qwer1234",
    "qq123456",
    "123abc",
    "abc@123",
    "abc.123",
    "abc_123",
    "abc-123",
    "P@ssw0rd",
    "Password1",
    "Password123",
    "Qwerty123",
    "Admin@123",
    "Admin123",
    "Root123",
    "Abcd1234",
    "Qwe12345",
    "A12345678",
    "Aa123456",
    "Aa12345678",
    "Z123456",
    "A5201314",
    "Aa1234",
    "Zz123456",
    "Ww123456",
    # 出生年月 / 重复 6+ / 简单 phone
    "19900101",
    "19910101",
    "19890101",
    "199001011",
    "199001010",
    "13800138000",
    "13888888888",
    "13912345678",
}

# 常见键盘序列
_KEYBOARD_SEQ = (
    "qwertyuiop",
    "asdfghjkl",
    "zxcvbnm",
    "1234567890",
    "0987654321",
    "qwerty",
    "asdfgh",
    "!@#$%^&*()",
    "1qaz2wsx",
    "1qazxsw2",
    "zaq12wsx",
)


def _shannon_entropy(s: str) -> float:
    """计算字符串的 Shannon 熵 (位/字符)."""
    if not s:
        return 0.0
    from collections import Counter

    counts = Counter(s)
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


def _has_repeating_run(s: str, max_run: int = 4) -> bool:
    """是否含长度 >= max_run 的连续重复 (如 aaaa, 1111)."""
    if max_run < 2:
        return False
    return any(len(set(s[i:i + max_run])) == 1 for i in range(len(s) - max_run + 1))


def _has_keyboard_seq(s: str, min_len: int = 4) -> bool:
    """是否含键盘序列 (大小写不敏感)."""
    ls = s.lower()
    for seq in _KEYBOARD_SEQ:
        # 连续 4 字符匹配
        for i in range(len(seq) - min_len + 1):
            sub = seq[i : i + min_len]
            if sub in ls:
                return True
        # 反向序列
        for i in range(len(seq) - min_len + 1):
            sub = seq[i : i + min_len][::-1]
            if sub in ls:
                return True
    return False


def password_strength(password: str) -> int:
    """返回 0-4 的强度分 (4 最强).

    评分:
      0: 不可用 (< 6 位 / 弱密码 / 熵 < 1.5)
      1: 弱 (6-7 位, 仅单一字符集)
      2: 中 (8-11 位, 含字母+数字)
      3: 强 (>= 12 位, 含字母+数字+符号)
      4: 极强 (>= 14 位, 字符集覆盖全, 熵 >= 3.0)
    """
    if not password or not isinstance(password, str):
        return 0

    # 长度上限: bcrypt 72 字节限制, 实际推荐 <= 64
    if len(password) < 6:
        return 0
    if len(password) > 128:
        return 0  # 过长不健康

    if password.lower() in _COMMON_WEAK:
        return 0
    if _has_repeating_run(password):
        return 1  # 长度够, 但重复, 降级
    if _has_keyboard_seq(password):
        return 1

    has_lower = bool(re.search(r"[a-z]", password))
    has_upper = bool(re.search(r"[A-Z]", password))
    has_digit = bool(re.search(r"\d", password))
    has_symbol = bool(re.search(r"[^a-zA-Z0-9]", password))

    char_classes = sum([has_lower, has_upper, has_digit, has_symbol])
    entropy = _shannon_entropy(password)

    if len(password) < 8:
        return 1  # 短密码
    if len(password) < 12:
        # 中等长度, 至少字母+数字
        if char_classes >= 2:
            return 2
        return 1
    if len(password) < 14:
        # 较长, 至少 3 类
        if char_classes >= 3 and entropy >= 2.5:
            return 3
        return 2
    # >= 14 位
    if char_classes >= 3 and entropy >= 3.0:
        return 4
    if char_classes >= 2 and entropy >= 2.0:
        return 3
    return 2


def password_issues(password: str) -> list[str]:
    """返回密码的所有问题描述 (空 list 表示通过)."""
    issues: list[str] = []
    if not password or not isinstance(password, str):
        return ["密码不能为空"]
    if len(password) < 8:
        issues.append(f"密码至少 8 位 (当前 {len(password)} 位)")
    if len(password) > 128:
        issues.append("密码不应超过 128 位")
    if password.lower() in _COMMON_WEAK:
        issues.append("密码过于常见, 请换一个")
    if _has_repeating_run(password):
        issues.append("密码含连续重复字符")
    if _has_keyboard_seq(password):
        issues.append("密码含键盘序列, 容易被猜")
    if not re.search(r"[a-z]", password):
        issues.append("缺少小写字母")
    if not re.search(r"[A-Z]", password):
        issues.append("缺少大写字母")
    if not re.search(r"\d", password):
        issues.append("缺少数字")
    if not re.search(r"[^a-zA-Z0-9]", password):
        issues.append("建议加入特殊字符")
    return issues


def validate_password(password: str, min_strength: int = 2) -> tuple[bool, str]:
    """校验密码是否满足最低强度.

    Returns:
        (ok, msg)  ok=True 时 msg 描述强度等级; ok=False 时 msg 描述问题.
    """
    score = password_strength(password)
    if score < min_strength:
        issues = password_issues(password)
        msg = "; ".join(issues) if issues else f"强度不足 (等级 {score} < {min_strength})"
        return False, msg
    return True, f"强度等级 {score}/4"


def password_is_compromised(password: str) -> bool:
    """密码是否在弱密码字典中."""
    return password.lower() in _COMMON_WEAK


# ---------------------------------------------------------------------------
# Bug-23-续: 模糊匹配 -- 密码里包含用户名/手机/邮箱前缀一律弱化
# ---------------------------------------------------------------------------


def _normalize_for_match(s: str) -> str:
    """模糊匹配归一化: 删除非字母数字, 全部小写."""
    if not s:
        return ""
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _user_context_keys(
    username: str | None = None,
    phone: str | None = None,
    email: str | None = None,
    full_name: str | None = None,
) -> list[str]:
    """从用户上下文 (用户名/手机/邮箱/姓名) 提取所有禁止在密码中出现的子串.

    例: phone="13812345678" -> ["13812345678", "138", "1234", "5678"]
    例: email="john.doe@x.com" -> ["johndoe", "john", "doe"]
    """
    keys: list[str] = []
    if username:
        u = _normalize_for_match(username)
        if len(u) >= 3:
            keys.append(u)
    if phone:
        p = re.sub(r"\D", "", str(phone))
        if len(p) >= 4:
            keys.append(p)
            # 前 3 位 + 后 4 位 (手机号段)
            if len(p) >= 7:
                keys.append(p[:3])
                keys.append(p[-4:])
                keys.append(p[-6:])
    if email:
        e = _normalize_for_match(email.split("@", 1)[0])
        if len(e) >= 3:
            keys.append(e)
            # 名字部分 (点分隔)
            for part in e.split("."):
                if len(part) >= 3:
                    keys.append(part)
    if full_name:
        n = _normalize_for_match(full_name)
        if len(n) >= 3:
            keys.append(n)
            # 拼音切分: 每 2-3 字一段
            for i in range(len(n)):
                for ln in (2, 3):
                    if i + ln <= len(n):
                        keys.append(n[i : i + ln])
    return list({k for k in keys if len(k) >= 3})


def password_contains_user_info(
    password: str,
    username: str | None = None,
    phone: str | None = None,
    email: str | None = None,
    full_name: str | None = None,
) -> tuple[bool, str | None]:
    """检查密码是否包含用户个人信息片段 (Bug-23-续).

    Returns:
        (matched, key)  matched=True 时 key 为命中的子串.
    """
    if not password:
        return False, None
    keys = _user_context_keys(username, phone, email, full_name)
    if not keys:
        return False, None
    p = _normalize_for_match(password)
    if not p:
        return False, None
    for k in keys:
        if k and k in p:
            return True, k
    return False, None


def password_is_obviously_weak(
    password: str,
    username: str | None = None,
    phone: str | None = None,
    email: str | None = None,
    full_name: str | None = None,
) -> tuple[bool, list[str]]:
    """综合判断密码是否显然弱 (Bug-23-续 入口).

    Returns:
        (is_weak, reasons) reasons 为命中规则的描述 list.
    """
    reasons: list[str] = []
    if not password or not isinstance(password, str):
        return True, ["密码不能为空"]
    if len(password) < 6:
        reasons.append(f"密码至少 6 位 (当前 {len(password)} 位)")
    if len(password) > 128:
        reasons.append("密码不应超过 128 位")
    if password.lower() in _COMMON_WEAK:
        reasons.append("密码在常见弱密码字典中")
    if _has_repeating_run(password):
        reasons.append("密码含连续重复字符 (如 aaaa, 1111)")
    if _has_keyboard_seq(password):
        reasons.append("密码含键盘序列, 容易被猜")
    matched, key = password_contains_user_info(password, username, phone, email, full_name)
    if matched:
        reasons.append(f"密码含用户信息片段 '{key}'")
    return bool(reasons), reasons


def weak_password_batch(
    passwords: Iterable[str],
    user_lookup: dict | None = None,
) -> dict:
    """批量校验弱密码 (用于密码修改 / 重置场景).

    user_lookup: 可选 {password -> {username, phone, email, full_name}} 上下文.
    """
    out: dict = {"weak": [], "ok": []}
    for pwd in passwords:
        ctx = (user_lookup or {}).get(pwd, {})
        is_weak, reasons = password_is_obviously_weak(
            pwd,
            username=ctx.get("username"),
            phone=ctx.get("phone"),
            email=ctx.get("email"),
            full_name=ctx.get("full_name"),
        )
        if is_weak:
            out["weak"].append({"password_hash": _hash_for_log(pwd), "reasons": reasons})
        else:
            out["ok"].append(pwd)
    return out


def _hash_for_log(pwd: str) -> str:
    """对密码做一个不可逆短哈希, 方便日志去重, 不暴露明文."""
    import hashlib

    return hashlib.sha256(pwd.encode("utf-8")).hexdigest()[:12]
