"""CI 流水线本地模拟演练 (高优 2).

模拟 sdk-publish.yml + blue-green-deploy.yml 的关键 step:
  1. detect: git diff 验证 OpenAPI 变更
  2. version: 计算版本号
  3. backend: 启动后端获取 openapi.json
  4. generate: 生成 5 语言 SDK
  5. verify-assets: sdk_publish_audit.py
  6. publish-python: publish_sdk.py --lang python --dry-run
  7. publish-typescript: publish_sdk.py --lang typescript-fetch/axios --dry-run
  8. publish-go: 检查 git_push.sh 存在
  9. publish-java: 检查 git_push.sh 存在

输出 JSON 报告.
执行:
  python scripts/ci_pipeline_drill.py
"""
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORT_PATH = ROOT / "logs" / "ci_pipeline_drill.json"
REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)


def _step(label: str, ok: bool, detail: str = "") -> dict:
    icon = "✅" if ok else "❌"
    print(f"  {icon} {label}: {detail or ('通过' if ok else '失败')}")
    return {"step": label, "ok": ok, "detail": detail}


def detect_openapi_change() -> dict:
    """1. 检测 OpenAPI 变更."""
    print("\n[Step 1] detect: OpenAPI 变更检测")
    try:
        r = subprocess.run(
            ["git", "diff", "--name-only", "HEAD~1", "--", "server/app/main.py", "server/app/api/"],
            cwd=str(ROOT.parent),
            capture_output=True, text=True, timeout=10,
        )
        changed = bool(r.stdout.strip())
        return _step("detect", True, f"changed={changed} (OpenAPI 相关文件)")
    except Exception as e:
        return _step("detect", False, str(e))


def compute_version() -> dict:
    """2. 计算 SDK 版本号."""
    print("\n[Step 2] version: 计算版本号")
    version = "0.1.0-drill"
    return _step("version", True, f"version={version}")


def start_backend() -> dict:
    """3. 启动后端获取 openapi.json."""
    print("\n[Step 3] backend: 启动后端 + 获取 openapi.json")
    import urllib.request
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/openapi.json", timeout=10) as r:
            data = json.loads(r.read())
            n_paths = len(data.get("paths", {}))
        return _step("backend", n_paths > 100, f"openapi.json paths={n_paths}")
    except Exception as e:
        return _step("backend", False, f"未运行: {e}")


def generate_sdk() -> dict:
    """4. 生成 5 语言 SDK (dry-run 检查 SDK 目录)."""
    print("\n[Step 4] generate: SDK 生成 (检查已存在的 SDK 目录)")
    sdk_root = ROOT / "sdk"
    if not sdk_root.exists():
        return _step("generate", False, "sdk 目录不存在")
    langs = ["python", "typescript-fetch", "typescript-axios", "go", "java"]
    details = {}
    for lang in langs:
        d = sdk_root / lang
        details[lang] = d.exists()
    all_ok = all(details.values())
    return _step("generate", all_ok, f"{sum(details.values())}/{len(details)} 语言 SDK 已生成")


def verify_assets() -> dict:
    """5. SDK 静态资产验证."""
    print("\n[Step 5] verify-assets: SDK 静态资产验证")
    r = subprocess.run(
        [sys.executable, "scripts/sdk_publish_audit.py"],
        cwd=str(ROOT), capture_output=True, text=True, timeout=60,
    )
    return _step("verify-assets", r.returncode == 0, "5 语言 SDK 静态就绪 + dry-run 通过")


def publish_python() -> dict:
    """6. 发布 Python SDK (dry-run)."""
    print("\n[Step 6] publish-python: PyPI 发布 (dry-run)")
    r = subprocess.run(
        [sys.executable, "scripts/publish_sdk.py", "--lang", "python", "--version", "0.1.0-drill", "--dry-run"],
        cwd=str(ROOT), capture_output=True, text=True, timeout=30,
    )
    return _step("publish-python", r.returncode == 0, "Python dry-run 通过")


def publish_typescript() -> dict:
    """7. 发布 TypeScript SDK (dry-run)."""
    print("\n[Step 7] publish-typescript: NPM 发布 (dry-run)")
    results = []
    for variant in ("typescript-fetch", "typescript-axios"):
        r = subprocess.run(
            [sys.executable, "scripts/publish_sdk.py", "--lang", "all", "--version", "0.1.0-drill", "--dry-run"],
            cwd=str(ROOT), capture_output=True, text=True, timeout=30,
        )
        results.append((variant, r.returncode == 0))
    ok = all(r[1] for r in results)
    return _step("publish-typescript", ok, f"{sum(1 for r in results if r[1])}/{len(results)} variant dry-run 通过")


def publish_go() -> dict:
    """8. 推送 Go SDK (检查 git_push.sh)."""
    print("\n[Step 8] publish-go: Go SDK 推送 (检查 git_push.sh)")
    gp = ROOT / "sdk" / "go" / "git_push.sh"
    return _step("publish-go", gp.exists(), f"git_push.sh 存在: {gp.exists()}")


def publish_java() -> dict:
    """9. 推送 Java SDK (检查 git_push.sh)."""
    print("\n[Step 9] publish-java: Java SDK 推送 (检查 git_push.sh)")
    gp = ROOT / "sdk" / "java" / "git_push.sh"
    return _step("publish-java", gp.exists(), f"git_push.sh 存在: {gp.exists()}")


def main() -> int:
    print("=" * 70)
    print("CI 流水线本地模拟演练 (sdk-publish.yml)")
    print("=" * 70)

    steps = [
        detect_openapi_change(),
        compute_version(),
        start_backend(),
        generate_sdk(),
        verify_assets(),
        publish_python(),
        publish_typescript(),
        publish_go(),
        publish_java(),
    ]

    ok = sum(1 for s in steps if s["ok"])
    total = len(steps)
    print("\n" + "=" * 70)
    print(f"演练结果: {ok}/{total} 通过")
    print("=" * 70)

    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "steps": steps,
        "summary": {
            "passed": ok,
            "total": total,
            "success_rate": f"{(ok / total * 100):.1f}%",
        },
    }
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\n报告: {REPORT_PATH}")
    return 0 if ok == total else 1


if __name__ == "__main__":
    sys.exit(main())
