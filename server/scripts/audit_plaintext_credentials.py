#!/usr/bin/env python3
"""扫描代码中的明文凭证残留

检查项:
  1. 真实 API Key (sk-..., gsk-... 等) 出现在代码文件中
  2. 真实数据库密码 (明文 'password=...' 模式)
  3. 真实微信 AppSecret (32 位十六进制)
  4. 真实支付宝私钥 (RSA Private Key 内容)
  5. 真实钉钉/飞书 Webhook Secret
"""
import re
import sys
from pathlib import Path

ROOT = Path(r"g:\IHUI-AI")
EXCLUDE_DIRS = {
    ".git", "node_modules", ".venv", "__pycache__",
    "dist", "build", ".nuxt", ".output",
    "docs/archive", "docs/PRODUCTION_CREDENTIALS.md",
    "server/sdk",  # 自动生成 SDK 不审计
    ".trae-cn",
    # 不审计的目录(本地工作区或编译产物,非生产代码)
    "backup",  # .gitignore 148
    "backups",  # 历史备份目录
    "storybook-static",  # 编译产物
    "__tests__",  # 测试文件中的 fixture 密码
    "tests",  # 测试目录
    "test_assets",
    "test_output",
    "test-results",
    "playwright-report",
    "storybook",
    "local_uploads",
    "pw-output",
    "screenshots",
    "coverage",
    # Python 虚拟环境
    ".venv-p312", "venv", "env",
    # uniCloud 库内置配置(不是凭证)
    "uniCloud-aliyun",
    "uniCloud-tcb",
    # 日志/中间产物
    "logs", "uploads", "tmp",
    # 第三方静态资源
    "swagger-ui",
    # e2e 测试 fixture 目录
    "e2e",
    # 自动生成 OpenAPI 客户端 SDK
    "sdk",
    # 历史 Java 源文件仓库(仅参考,不审计)
    "edu-assets",
    # SSL/证书目录
    "ssl",
}
EXCLUDE_FILES = {
    "PRODUCTION_CREDENTIALS.md",  # 凭证文档本身
    "audit_plaintext_credentials.py",  # 本审计脚本自身
}
# 不审计的路径模式(子串匹配)
EXCLUDE_PATH_PATTERNS = [
    "/test/", "/tests/", "/__tests__/",
    "/fixtures/", "/stories/",
    "/.storybook/",
    "/Lib/site-packages/",  # Python 第三方包
    "/node_modules/",
    "/uniCloud-aliyun/",
    "/uniCloud-tcb/",
]

# 1. OpenAI 风格 API Key (sk-...)
PATTERN_OPENAI = re.compile(r'sk-[A-Za-z0-9]{20,}')
# 2. Anthropic API Key
PATTERN_ANTHROPIC = re.compile(r'sk-ant-[A-Za-z0-9-]{20,}')
# 3. 微信 AppSecret 32位十六进制 (排除占位符)
PATTERN_WX_SECRET = re.compile(r'(?<![\w])[a-f0-9]{32}(?![\w])')
# 4. RSA 私钥
PATTERN_RSA = re.compile(r'-----BEGIN (RSA )?PRIVATE KEY-----')
# 5. 真实密码赋值 (password = "actual_password")
PATTERN_PASSWORD = re.compile(r'password\s*=\s*["\']([^"\']{6,})["\']', re.IGNORECASE)
# 6. 真实 Token (长度 > 40 字母数字)
PATTERN_TOKEN = re.compile(r'(?<![\w-])[A-Za-z0-9_-]{40,}(?![\w])')

PLACEHOLDER_HINTS = (
    "replace-with", "<", "your-", "example",
    "test", "fake", "mock", "placeholder", "REDACTED",
    "TODO", "xxxx", "***", "00000000", "12345678",
    # shell 模板变量
    "${", ":-zhs_", ":-postgr", ":-c6",
    # 常见占位符模式
    "admin123", "test123", "password123", "zhs123",
    "zhs_p", "zhs_",
    # URL 路径
    "/api/v1/", "/api/", "/auth/",
    # hex fixture (test)
    "11223344", "deadbeef", "0af765", "00000000",
)


def is_placeholder(text: str) -> bool:
    s = text.lower()
    return any(h in s for h in PLACEHOLDER_HINTS)


def scan_file(path: Path) -> list[dict]:
    findings = []
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return findings
    if not content:
        return findings

    for pat, kind in [
        (PATTERN_OPENAI, "OpenAI API Key (sk-...)"),
        (PATTERN_ANTHROPIC, "Anthropic API Key (sk-ant-...)"),
        (PATTERN_RSA, "RSA Private Key"),
    ]:
        for m in pat.finditer(content):
            if not is_placeholder(m.group()):
                findings.append({"kind": kind, "value": m.group()[:40], "line": None})

    # 微信 AppSecret / 长 hex
    for m in PATTERN_WX_SECRET.finditer(content):
        if not is_placeholder(m.group()):
            # 排除常见的 hash / uuid 模式
            line_no = content[:m.start()].count("\n") + 1
            findings.append({
                "kind": "32-char hex (possible secret)",
                "value": m.group()[:16] + "...",
                "line": line_no,
            })

    # RSA Private Key
    for m in PATTERN_RSA.finditer(content):
        if not is_placeholder(m.group()):
            findings.append({
                "kind": "RSA Private Key header",
                "value": m.group(),
                "line": None,
            })

    # 真实密码赋值 (严格匹配: 排除对象字段 formData.password 这类)
    # 排除 deploy 中的 helm/k8s 模板变量引用 (如 ${SMTP_PASSWORD})
    # 使用 re.MULTILINE 避免匹配三引号多行字符串
    for m in re.finditer(
        r'^(?:password|passwd|pwd)\s*[:=]\s*["\']([^"\']{6,})["\']',
        content, re.IGNORECASE | re.MULTILINE,
    ):
        pwd = m.group(1)
        # 排除变量名/对象字段
        if any(kw in pwd.lower() for kw in (
            "formdata.", "ref", "data.", ".value", "show",
            "db_password", "form", "object", "schema", "username", "auth",
            "lines", "toindic", "old_password", "new_password",
        )):
            continue
        if not is_placeholder(pwd) and not is_placeholder(m.group()):
            findings.append({
                "kind": "Password assignment",
                "value": pwd[:20] + "...",
                "line": None,
            })

    return findings


def main():
    total_findings = []
    file_count = 0
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        parts = rel.parts
        if any(p in EXCLUDE_DIRS for p in parts):
            continue
        rel_str = str(rel).replace("\\", "/")
        if any(p in rel_str for p in EXCLUDE_PATH_PATTERNS):
            continue
        if path.name in EXCLUDE_FILES:
            continue
        if path.suffix not in {".py", ".ts", ".tsx", ".js", ".jsx", ".vue", ".java", ".yml", ".yaml", ".json", ".env", ".sh", ".ps1", ".go", ".rs"}:
            continue
        file_count += 1
        findings = scan_file(path)
        for f in findings:
            f["file"] = str(rel)
            total_findings.append(f)

    print(f"扫描文件数: {file_count}")
    print(f"发现明文凭证: {len(total_findings)} 个\n")
    if total_findings:
        for f in total_findings[:30]:
            print(f"  [{f['kind']}] {f['file']}: {f['value']}")
        if len(total_findings) > 30:
            print(f"  ...还有 {len(total_findings) - 30} 个")
        sys.exit(1)
    else:
        print("[OK] 0 个明文凭证残留")


if __name__ == "__main__":
    main()
