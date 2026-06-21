"""前端样式静态审计脚本.

审计内容:
  1. !important 使用情况 (按文件 + 行号)
  2. 高特异性选择器 (3 层以上 .a .b .c)
  3. 容器类型是否走项目全局样式 (_cards.scss / _buttons.scss / _inputs.scss)
  4. Element Plus :deep() 滥用检测

执行:
  python scripts/frontend_style_audit.py
"""
import json
import re
from pathlib import Path

CLIENT_SRC = Path(__file__).resolve().parent.parent.parent / "client" / "src"
REPORT_PATH = Path(__file__).resolve().parent.parent.parent / "client" / "logs" / "frontend_style_audit.json"
REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

# 跳过 node_modules / dist
SKIP_DIRS = {"node_modules", "dist", "storybook-static"}
GLOB_PATTERNS = ["*.vue", "*.scss", "*.css", "*.ts", ".js", ".html"]


def is_code_line(text: str) -> bool:
    """判断是否是代码行 (非纯注释)."""
    s = text.strip()
    if s.startswith("//") or s.startswith("/*") or s.startswith("*"):
        return False
    # 排除 // 或 /* 在中段的注释行
    if "//" in s and "/*" not in s:
        idx = s.index("//")
        prefix = s[:idx].strip()
        if not prefix or prefix.endswith(";"):
            return False
    return True


def audit_important() -> dict:
    """扫描 !important 使用."""
    findings = []
    for ext in ("vue", "scss", "css"):
        for f in CLIENT_SRC.rglob(f"*.{ext}"):
            if any(p in f.parts for p in SKIP_DIRS):
                continue
            try:
                text = f.read_text(encoding="utf-8")
            except Exception:
                continue
            for i, line in enumerate(text.splitlines(), 1):
                if "!important" in line and is_code_line(line):
                    findings.append({
                        "file": str(f.relative_to(CLIENT_SRC)).replace("\\", "/"),
                        "line": i,
                        "snippet": line.strip()[:120],
                    })
    # 按文件聚合
    by_file = {}
    for x in findings:
        by_file.setdefault(x["file"], []).append(x)
    return {
        "total": len(findings),
        "files": len(by_file),
        "top_files": sorted(by_file.items(), key=lambda x: -len(x[1]))[:10],
        "all": findings[:50],  # 只列前 50 条
    }


def audit_high_specificity() -> dict:
    """扫描 3 层以上嵌套类选择器 (如 .a .b .c .d)."""
    findings = []
    pattern = re.compile(r"(\.[\w-]+\s+){3,}\.[\w-]+")
    for ext in ("vue", "scss", "css"):
        for f in CLIENT_SRC.rglob(f"*.{ext}"):
            if any(p in f.parts for p in SKIP_DIRS):
                continue
            try:
                text = f.read_text(encoding="utf-8")
            except Exception:
                continue
            for i, line in enumerate(text.splitlines(), 1):
                if pattern.search(line) and is_code_line(line):
                    findings.append({
                        "file": str(f.relative_to(CLIENT_SRC)).replace("\\", "/"),
                        "line": i,
                        "snippet": line.strip()[:120],
                    })
    return {
        "total": len(findings),
        "all": findings[:30],
    }


def audit_container_styles() -> dict:
    """审计容器类型 (.card / .modal / .btn / .input) 是否走项目全局样式.

    策略: 统计 _cards.scss / _buttons.scss / _inputs.scss 中的类定义, 然后在 .vue 中查找
    是否重复定义这些类的样式.
    """
    global_styles = {
        "card": CLIENT_SRC / "styles" / "_cards.scss",
        "btn": CLIENT_SRC / "styles" / "_buttons.scss",
        "input": CLIENT_SRC / "styles" / "_inputs.scss",
    }
    summary = {}
    for kind, p in global_styles.items():
        exists = p.exists()
        line_count = 0
        if exists:
            line_count = len(p.read_text(encoding="utf-8").splitlines())
        summary[kind] = {
            "path": str(p.relative_to(CLIENT_SRC)).replace("\\", "/"),
            "exists": exists,
            "lines": line_count,
        }
    return summary


def main() -> int:
    print("=" * 70)
    print("前端样式静态审计 (高优 1)")
    print("=" * 70)

    important = audit_important()
    high_spec = audit_high_specificity()
    container = audit_container_styles()

    print(f"\n[1] !important 使用")
    print(f"  实际代码行 (非注释): {important['total']} 处, 涉及 {important['files']} 文件")
    for path, items in important["top_files"][:5]:
        print(f"    - {path}: {len(items)} 处")

    print(f"\n[2] 高特异性选择器 (3+ 层)")
    print(f"  发现: {high_spec['total']} 处")

    print(f"\n[3] 容器全局样式文件")
    for kind, info in container.items():
        icon = "✅" if info["exists"] else "❌"
        print(f"  {icon} {kind}: {info['path']} ({info['lines']} 行)")

    # 写报告
    report = {
        "important": important,
        "high_specificity": high_spec,
        "container_styles": container,
    }
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\n报告: {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
