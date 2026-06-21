"""多语言 SDK 发布脚本 (PyPI + NPM).

支持发布:
  - Python SDK → PyPI (twine upload)
  - TypeScript SDK → NPM (npm publish)

前置条件:
  - 已用 gen_openapi_sdk.py 生成 SDK
  - PyPI: 配置 ~/.pypirc 或设置 TWINE_USERNAME/TWINE_PASSWORD
  - NPM: 配置 ~/.npmrc 或设置 NPM_TOKEN

用法:
  python scripts/publish_sdk.py --check                 # 仅检查发布前置条件
  python scripts/publish_sdk.py --lang python           # 发布 Python SDK 到 PyPI
  python scripts/publish_sdk.py --lang typescript       # 发布 TypeScript SDK 到 NPM
  python scripts/publish_sdk.py --lang all              # 发布全部
  python scripts/publish_sdk.py --lang python --dry-run # 干跑模式 (不实际推送)
"""
import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SDK_ROOT = ROOT / "sdk"

# SDK 目录映射
SDK_DIRS = {
    "python": SDK_ROOT / "python",
    "typescript-fetch": SDK_ROOT / "typescript-fetch",
    "typescript-axios": SDK_ROOT / "typescript-axios",
}


def check_python_prereqs() -> tuple[bool, list[str]]:
    """检查 Python SDK 发布前置条件."""
    issues = []
    # twine
    if not shutil.which("twine"):
        issues.append("twine 未安装 (pip install twine)")
    # build
    if not shutil.which("python -m build"):
        pass  # 用 python -m build 模块
    # SDK 目录
    sdk_dir = SDK_DIRS["python"]
    if not sdk_dir.exists():
        issues.append(f"Python SDK 目录不存在: {sdk_dir} (先运行 gen_openapi_sdk.py)")
    else:
        # 检查 pyproject.toml 或 setup.py
        if not (sdk_dir / "pyproject.toml").exists() and not (sdk_dir / "setup.py").exists():
            issues.append("Python SDK 缺少 pyproject.toml 或 setup.py")
    # PyPI 凭据
    has_pypirc = Path.home().joinpath(".pypirc").exists()
    has_env = bool(os.getenv("TWINE_USERNAME") and os.getenv("TWINE_PASSWORD"))
    if not has_pypirc and not has_env:
        issues.append("PyPI 凭据未配置 (配置 ~/.pypirc 或设置 TWINE_USERNAME/TWINE_PASSWORD)")
    return len(issues) == 0, issues


def check_typescript_prereqs() -> tuple[bool, list[str]]:
    """检查 TypeScript SDK 发布前置条件."""
    issues = []
    # npm
    if not shutil.which("npm"):
        issues.append("npm 未安装 (安装 Node.js)")
    # SDK 目录 + package.json (dry-run 模式下 package.json 缺失可自动生成)
    for ts_dir_name in ("typescript-fetch", "typescript-axios"):
        ts_dir = SDK_DIRS[ts_dir_name]
        if not ts_dir.exists():
            issues.append(f"{ts_dir_name} SDK 目录不存在: {ts_dir}")
            continue
        # package.json 缺失不算阻塞 (prepare_typescript_sdk 会生成)
    # NPM 凭据
    npmrc = Path.home().joinpath(".npmrc")
    has_npmrc = npmrc.exists()
    has_token = bool(os.getenv("NPM_TOKEN"))
    if not has_npmrc and not has_token:
        issues.append("NPM 凭据未配置 (配置 ~/.npmrc 或设置 NPM_TOKEN)")
    return len(issues) == 0, issues


def prepare_python_sdk(version: str) -> bool:
    """准备 Python SDK 发布包 (生成 pyproject.toml)."""
    sdk_dir = SDK_DIRS["python"]
    pyproject = sdk_dir / "pyproject.toml"

    # 生成 pyproject.toml (如果不存在)
    if not pyproject.exists():
        content = f"""[build-system]
requires = ["setuptools>=61.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "zhs-platform-sdk"
version = "{version}"
description = "ZHS Platform API SDK (auto-generated from OpenAPI)"
readme = "README.md"
requires-python = ">=3.8"
license = {{text = "MIT"}}
authors = [
    {{name = "ZHS Team", email = "ops@zhs.local"}}
]
keywords = ["zhs", "fastapi", "openapi", "sdk"]
classifiers = [
    "Development Status :: 4 - Beta",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: MIT License",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.8",
    "Programming Language :: Python :: 3.9",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
]
dependencies = [
    "httpx>=0.24.0",
    "pydantic>=2.0.0",
    "python-dateutil>=2.8.0",
]

[project.urls]
Homepage = "https://github.com/zhs-platform/zhs-platform"
Repository = "https://github.com/zhs-platform/zhs-platform"
Documentation = "https://github.com/zhs-platform/zhs-platform"

[tool.setuptools.packages.find]
where = ["."]
include = ["zhs_platform*"]
"""
        pyproject.write_text(content, encoding="utf-8")
        print(f"  ✅ 生成 {pyproject.name}")

    # 确保 README.md 存在
    readme = sdk_dir / "README.md"
    if not readme.exists():
        readme.write_text(
            f"# ZHS Platform Python SDK\n\nAuto-generated from OpenAPI {version}.\n",
            encoding="utf-8",
        )

    return True


def publish_python(version: str, dry_run: bool = False) -> bool:
    """发布 Python SDK 到 PyPI."""
    print(f"\n[Python SDK] 发布版本: {version} (dry_run={dry_run})")

    ok, issues = check_python_prereqs()
    if not ok:
        # dry-run 模式下, 仅凭据问题可忽略, 其他问题仍需修复
        if dry_run:
            critical = [i for i in issues if "凭据" not in i and "twine" not in i]
            if critical:
                print("  ❌ 前置条件不满足:")
                for i in critical:
                    print(f"     - {i}")
                return False
            print("  ⚠️  dry-run 模式: 忽略凭据/twine 缺失")
        else:
            print("  ❌ 前置条件不满足:")
            for i in issues:
                print(f"     - {i}")
            return False

    sdk_dir = SDK_DIRS["python"]
    print(f"  ℹ️  SDK 目录: {sdk_dir}")

    # 准备发布包
    if not prepare_python_sdk(version):
        return False

    # 清理旧构建
    for d in ("build", "dist"):
        p = sdk_dir / d
        if p.exists():
            shutil.rmtree(p)

    # 构建
    try:
        print("  [1/3] 构建 sdist + wheel...")
        result = subprocess.run(
            [sys.executable, "-m", "build"],
            cwd=str(sdk_dir),
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            if dry_run and "No module named build" in (result.stderr or ""):
                print("  ⚠️  dry-run: build 模块未安装, 跳过实际构建")
                print("  ✅ pyproject.toml 已生成, dry-run 通过")
                return True
            print(f"  ❌ 构建失败: {result.stderr[-500:]}")
            return False
        print("  ✅ 构建成功")
    except subprocess.TimeoutExpired:
        print("  ❌ 构建超时 (120s)")
        return False
    except Exception as e:
        print(f"  ❌ 构建异常: {e}")
        return False

    # 检查产物
    dist_dir = sdk_dir / "dist"
    if not dist_dir.exists() or not list(dist_dir.glob("*")):
        print("  ❌ dist 目录为空, 构建失败")
        return False

    artifacts = list(dist_dir.glob("*"))
    print(f"  ℹ️  构建产物: {[a.name for a in artifacts]}")

    if dry_run:
        print("  [2/3] (dry-run) 跳过 twine check")
        print("  [3/3] (dry-run) 跳过 twine upload")
        print("  ✅ Dry-run 完成")
        return True

    # twine check
    try:
        print("  [2/3] twine check...")
        result = subprocess.run(
            ["twine", "check", str(dist_dir / "*")],
            cwd=str(sdk_dir),
            capture_output=True,
            text=True,
            shell=True,
            timeout=30,
        )
        if result.returncode != 0:
            print(f"  ❌ twine check 失败: {result.stderr}")
            return False
        print("  ✅ twine check 通过")
    except Exception as e:
        print(f"  ❌ twine check 异常: {e}")
        return False

    # twine upload
    try:
        print("  [3/3] twine upload to PyPI...")
        cmd = ["twine", "upload"] + [str(a) for a in artifacts]
        result = subprocess.run(
            cmd,
            cwd=str(sdk_dir),
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode != 0:
            print(f"  ❌ twine upload 失败: {result.stderr[-500:]}")
            return False
        print("  ✅ PyPI 发布成功")
        return True
    except subprocess.TimeoutExpired:
        print("  ❌ twine upload 超时 (300s)")
        return False
    except Exception as e:
        print(f"  ❌ twine upload 异常: {e}")
        return False


def prepare_typescript_sdk(version: str, sdk_name: str) -> bool:
    """准备 TypeScript SDK package.json."""
    sdk_dir = SDK_DIRS[sdk_name]
    pkg_file = sdk_dir / "package.json"

    if not pkg_file.exists():
        # 生成 package.json
        scope = "@zhs-platform"
        name = f"{scope}/{sdk_name.replace('typescript-', '')}"
        content = f"""{{
  "name": "{name}",
  "version": "{version}",
  "description": "ZHS Platform API SDK ({sdk_name}, auto-generated)",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {{
    "build": "tsc",
    "prepare": "npm run build"
  }},
  "keywords": ["zhs", "fastapi", "openapi", "sdk", "{sdk_name}"],
  "license": "MIT",
  "author": "ZHS Team <ops@zhs.local>",
  "repository": {{
    "type": "git",
    "url": "git+https://github.com/zhs-platform/zhs-platform.git"
  }},
  "homepage": "https://github.com/zhs-platform/zhs-platform",
  "devDependencies": {{
    "typescript": "^5.0.0"
  }},
  "publishConfig": {{
    "access": "public"
  }}
}}
"""
        pkg_file.write_text(content, encoding="utf-8")
        print(f"  ✅ 生成 {pkg_file.name} for {sdk_name}")

    # 确保 README.md
    readme = sdk_dir / "README.md"
    if not readme.exists():
        readme.write_text(
            f"# ZHS Platform {sdk_name} SDK\n\nAuto-generated from OpenAPI {version}.\n",
            encoding="utf-8",
        )

    return True


def publish_typescript(version: str, dry_run: bool = False) -> bool:
    """发布 TypeScript SDK 到 NPM."""
    print(f"\n[TypeScript SDK] 发布版本: {version} (dry_run={dry_run})")

    ok, issues = check_typescript_prereqs()
    if not ok:
        if dry_run:
            critical = [i for i in issues if "凭据" not in i and "npm" not in i.lower()]
            if critical:
                print("  ❌ 前置条件不满足:")
                for i in critical:
                    print(f"     - {i}")
                return False
            print("  ⚠️  dry-run 模式: 忽略凭据/npm 缺失")
        else:
            print("  ❌ 前置条件不满足:")
            for i in issues:
                print(f"     - {i}")
            return False

    results = []
    for ts_name in ("typescript-fetch", "typescript-axios"):
        sdk_dir = SDK_DIRS[ts_name]
        print(f"\n  --- {ts_name} ---")
        print(f"  ℹ️  SDK 目录: {sdk_dir}")

        # 先准备 package.json (dry-run 也要生成, 验证配置正确)
        if not prepare_typescript_sdk(version, ts_name):
            results.append((ts_name, False))
            continue

        if dry_run:
            print(f"  (dry-run) 跳过 npm publish for {ts_name}")
            # 验证 package.json 可加载
            import json as _json
            pkg_file = sdk_dir / "package.json"
            if pkg_file.exists():
                try:
                    pkg = _json.loads(pkg_file.read_text(encoding="utf-8"))
                    assert "name" in pkg and "version" in pkg
                    print(f"  ✅ package.json 验证通过 (name={pkg['name']}, version={pkg['version']})")
                    results.append((ts_name, True))
                except Exception as e:
                    print(f"  ❌ package.json 验证失败: {e}")
                    results.append((ts_name, False))
            else:
                results.append((ts_name, True))
            continue

        try:
            # npm install (如果有 package-lock.json)
            print(f"  [1/3] npm install...")
            result = subprocess.run(
                ["npm", "install", "--no-audit", "--no-fund"],
                cwd=str(sdk_dir),
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0:
                print(f"  ❌ npm install 失败: {result.stderr[-300:]}")
                results.append((ts_name, False))
                continue

            # npm build
            print(f"  [2/3] npm run build...")
            result = subprocess.run(
                ["npm", "run", "build"],
                cwd=str(sdk_dir),
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0:
                print(f"  ❌ npm run build 失败: {result.stderr[-300:]}")
                results.append((ts_name, False))
                continue

            # npm publish
            print(f"  [3/3] npm publish...")
            cmd = ["npm", "publish", "--access", "public"]
            result = subprocess.run(
                cmd,
                cwd=str(sdk_dir),
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0:
                print(f"  ❌ npm publish 失败: {result.stderr[-300:]}")
                results.append((ts_name, False))
                continue

            print(f"  ✅ {ts_name} NPM 发布成功")
            results.append((ts_name, True))
        except subprocess.TimeoutExpired:
            print(f"  ❌ {ts_name} 发布超时")
            results.append((ts_name, False))
        except Exception as e:
            print(f"  ❌ {ts_name} 发布异常: {e}")
            results.append((ts_name, False))

    return all(ok for _, ok in results)


def main() -> int:
    parser = argparse.ArgumentParser(description="多语言 SDK 发布 (PyPI + NPM)")
    parser.add_argument(
        "--lang",
        choices=["python", "typescript", "all"],
        default="all",
        help="发布语言",
    )
    parser.add_argument("--version", default="1.0.0", help="发布版本号")
    parser.add_argument("--check", action="store_true", help="仅检查前置条件")
    parser.add_argument("--dry-run", action="store_true", help="干跑模式 (不实际推送)")
    args = parser.parse_args()

    print("=" * 70)
    print("多语言 SDK 发布 (PyPI + NPM)")
    print(f"版本: {args.version} | 语言: {args.lang} | dry-run: {args.dry_run}")
    print("=" * 70)

    if args.check:
        print("\n[检查] Python SDK 前置条件:")
        ok_py, issues_py = check_python_prereqs()
        print(f"  {'✅' if ok_py else '❌'} Python: {'就绪' if ok_py else '未就绪'}")
        for i in issues_py:
            print(f"     - {i}")

        print("\n[检查] TypeScript SDK 前置条件:")
        ok_ts, issues_ts = check_typescript_prereqs()
        print(f"  {'✅' if ok_ts else '❌'} TypeScript: {'就绪' if ok_ts else '未就绪'}")
        for i in issues_ts:
            print(f"     - {i}")

        return 0 if (ok_py and ok_ts) else 1

    results = []
    if args.lang in ("python", "all"):
        results.append(("Python", publish_python(args.version, args.dry_run)))
    if args.lang in ("typescript", "all"):
        results.append(("TypeScript", publish_typescript(args.version, args.dry_run)))

    print("\n" + "=" * 70)
    print("发布结果:")
    for name, ok in results:
        print(f"  {'✅' if ok else '❌'} {name}")
    print("=" * 70)

    return 0 if all(ok for _, ok in results) else 1


if __name__ == "__main__":
    sys.exit(main())
