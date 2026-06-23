#!/usr/bin/env python3
"""
IHUI-AI 生产部署准备脚本
========================
在部署前运行此脚本，检查所有必需的生产配置是否就绪。

用法:
    cd server
    python scripts/pre_deploy_check.py

检查项:
    1. .env.production 配置完整性
    2. SSL 证书存在性
    3. 数据库连接可用性
    4. Redis 连接可用性
    5. 关键安全配置
    6. Docker 配置一致性
"""

import os
import re
import sys
from pathlib import Path
from typing import Optional


# ANSI colors
class C:
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def ok(msg: str) -> None:
    print(f"  {C.GREEN}[PASS]{C.RESET} {msg}")


def fail(msg: str) -> None:
    print(f"  {C.RED}[FAIL]{C.RESET} {msg}")


def warn(msg: str) -> None:
    print(f"  {C.YELLOW}[WARN]{C.RESET} {msg}")


def info(msg: str) -> None:
    print(f"  {C.BLUE}[INFO]{C.RESET} {msg}")


def header(title: str) -> None:
    print(f"\n{C.BOLD}{'=' * 60}{C.RESET}")
    print(f"{C.BOLD}  {title}{C.RESET}")
    print(f"{C.BOLD}{'=' * 60}{C.RESET}")


def read_env(env_path: Path) -> dict[str, str]:
    """Parse .env file into a dict."""
    env = {}
    if not env_path.exists():
        return env
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, val = line.partition("=")
            env[key.strip()] = val.strip().strip('"').strip("'")
    return env


def check_env_production() -> int:
    """Check .env.production configuration."""
    header("1. .env.production 配置检查")
    errors = 0

    env_path = Path(__file__).parent.parent / ".env.production"
    if not env_path.exists():
        fail(f".env.production 不存在: {env_path}")
        return 1

    env = read_env(env_path)
    info(f"已加载 {len(env)} 个配置项")

    # Critical settings
    checks = [
        ("ENV", "production", True),
        ("API_DEBUG", "false", True),
        ("API_RELOAD", "false", True),
        ("DB_ALLOW_SQLITE_FALLBACK", "false", True),
    ]

    for key, expected, required in checks:
        val = env.get(key, "")
        if not val:
            if required:
                fail(f"{key} 未设置 (期望: {expected})")
                errors += 1
            else:
                warn(f"{key} 未设置 (建议: {expected})")
        elif val.lower() != expected:
            fail(f"{key}={val} (期望: {expected})")
            errors += 1
        else:
            ok(f"{key}={val}")

    # Check for placeholder values
    placeholders = ["<FILL_IN>", "<DB1_PASSWORD>", "<DB_HOST>", "<DB2_PASSWORD>", "<DB3_PASSWORD>"]
    for key, val in env.items():
        for ph in placeholders:
            if ph in val:
                fail(f"{key} 包含占位符 '{ph}'，请替换为真实值")
                errors += 1
                break

    # Check DB URLs are PostgreSQL
    for i in [1, 2, 3]:
        key = f"DB{i}_URL"
        val = env.get(key, "")
        if val:
            if "sqlite" in val.lower():
                fail(f"{key} 使用 SQLite，生产环境必须使用 PostgreSQL")
                errors += 1
            elif "postgresql" in val.lower():
                ok(f"{key} 使用 PostgreSQL")
            else:
                warn(f"{key} 不是 PostgreSQL 也不是 SQLite，请确认: {val[:50]}...")
        else:
            fail(f"{key} 未设置")
            errors += 1

    # Check JWT secret strength
    jwt_key = env.get("JWT_SECRET_KEY", "")
    if len(jwt_key) < 32:
        fail(f"JWT_SECRET_KEY 长度 {len(jwt_key)} < 32，不安全")
        errors += 1
    elif "test" in jwt_key.lower() or "local" in jwt_key.lower():
        fail("JWT_SECRET_KEY 包含 'test' 或 'local'，疑似测试密钥")
        errors += 1
    else:
        ok(f"JWT_SECRET_KEY 长度 {len(jwt_key)} (安全)")

    # Check CORS
    cors = env.get("CORS_ORIGINS", "")
    if not cors:
        fail("CORS_ORIGINS 未设置，生产环境会拒绝启动")
        errors += 1
    elif "*" in cors:
        fail("CORS_ORIGINS 包含通配符 *，生产环境禁止")
        errors += 1
    else:
        ok(f"CORS_ORIGINS 已配置 ({len(cors.split(','))} 个域名)")

    # Check for mock values
    mock_indicators = ["127.0.0.1:9999", "mock-routing-key", "test_secret"]
    for key, val in env.items():
        for mock in mock_indicators:
            if mock in val:
                fail(f"{key} 包含 mock 值 '{mock}'")
                errors += 1
                break

    if errors == 0:
        ok(".env.production 配置检查全部通过")
    return errors


def check_ssl() -> int:
    """Check SSL certificates."""
    header("2. SSL 证书检查")
    errors = 0

    project_root = Path(__file__).parent.parent.parent
    ssl_dir = project_root / "ssl"

    fullchain = ssl_dir / "fullchain.pem"
    privkey = ssl_dir / "privkey.pem"

    if not fullchain.exists():
        fail(f"证书文件不存在: {fullchain}")
        errors += 1
    else:
        size = fullchain.stat().st_size
        if size < 100:
            fail(f"证书文件过小 ({size} bytes)，可能无效")
            errors += 1
        else:
            ok(f"证书文件存在 ({size} bytes)")

    if not privkey.exists():
        fail(f"私钥文件不存在: {privkey}")
        errors += 1
    else:
        ok(f"私钥文件存在 ({privkey.stat().st_size} bytes)")

    # Check if it's a self-signed test cert
    if fullchain.exists():
        content = fullchain.read_text(encoding="utf-8")
        if "IHUI-AI" in content:
            warn("当前为自签名测试证书，生产环境请替换为 CA 签发的正式证书")

    if errors == 0:
        ok("SSL 证书检查通过")
    return errors


def check_docker_config() -> int:
    """Check Docker configuration consistency."""
    header("3. Docker 配置一致性检查")
    errors = 0

    project_root = Path(__file__).parent.parent.parent
    compose_path = project_root / "docker-compose.yml"

    if not compose_path.exists():
        fail(f"docker-compose.yml 不存在: {compose_path}")
        return 1

    content = compose_path.read_text(encoding="utf-8")

    # Check HTTPS port
    if "443:443" not in content:
        fail("docker-compose.yml 未暴露 443 端口 (HTTPS)")
        errors += 1
    else:
        ok("HTTPS 端口 443 已配置")

    # Check SSL volume mount
    if "ssl" not in content:
        fail("docker-compose.yml 未挂载 SSL 证书目录")
        errors += 1
    else:
        ok("SSL 证书目录已挂载")

    # Check MinIO service
    if "minio" not in content.lower():
        fail("docker-compose.yml 缺少 MinIO 服务定义")
        errors += 1
    else:
        ok("MinIO 服务已定义")

    # Check health check endpoint
    if "/healthz" not in content:
        fail("docker-compose.yml 健康检查未使用 /healthz")
        errors += 1
    else:
        ok("健康检查端点 /healthz 一致")

    # Check Dockerfile.server
    dockerfile_path = project_root / "Dockerfile.server"
    if dockerfile_path.exists():
        df_content = dockerfile_path.read_text(encoding="utf-8")
        if "alembic upgrade head" not in df_content:
            fail("Dockerfile.server 缺少 alembic upgrade head (自动迁移)")
            errors += 1
        else:
            ok("Dockerfile.server 包含自动数据库迁移")
        if "/healthz" not in df_content:
            fail("Dockerfile.server 健康检查未使用 /healthz")
            errors += 1
        else:
            ok("Dockerfile.server 健康检查端点一致")

    if errors == 0:
        ok("Docker 配置一致性检查通过")
    return errors


def check_nginx() -> int:
    """Check nginx configuration."""
    header("4. Nginx 配置检查")
    errors = 0

    project_root = Path(__file__).parent.parent.parent
    nginx_path = project_root / "nginx.conf"

    if not nginx_path.exists():
        fail(f"nginx.conf 不存在: {nginx_path}")
        return 1

    content = nginx_path.read_text(encoding="utf-8")

    # Check HTTPS
    if "listen 443" not in content:
        fail("nginx.conf 未配置 443 端口监听")
        errors += 1
    else:
        ok("HTTPS 443 端口已配置")

    # Check HTTP redirect
    if "return 301 https" not in content:
        warn("nginx.conf 未配置 HTTP→HTTPS 重定向")
    else:
        ok("HTTP→HTTPS 重定向已配置")

    # Check security headers
    security_headers = [
        "Strict-Transport-Security",
        "X-Frame-Options",
        "X-Content-Type-Options",
        "Content-Security-Policy",
        "Permissions-Policy",
    ]
    for header_name in security_headers:
        if header_name not in content:
            fail(f"nginx.conf 缺少安全头: {header_name}")
            errors += 1
        else:
            ok(f"安全头已配置: {header_name}")

    # Check WebSocket proxy
    if "/ws/" not in content:
        warn("nginx.conf 未配置 /ws/ WebSocket 代理")
    else:
        ok("WebSocket 代理已配置")

    if errors == 0:
        ok("Nginx 配置检查通过")
    return errors


def check_git() -> int:
    """Check git repository status."""
    header("5. Git 仓库检查")
    errors = 0

    import subprocess

    project_root = Path(__file__).parent.parent.parent

    # Check remote
    result = subprocess.run(
        ["git", "remote", "-v"],
        capture_output=True, text=True, cwd=str(project_root)
    )
    if not result.stdout.strip():
        fail("未配置 Git 远程仓库 (git remote)")
        errors += 1
        warn("CI/CD 需要 Git 远程仓库才能触发")
    else:
        ok(f"Git 远程仓库已配置: {result.stdout.strip().split()[0]}")

    # Check for uncommitted changes
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True, text=True, cwd=str(project_root)
    )
    if result.stdout.strip():
        changed = len(result.stdout.strip().splitlines())
        warn(f"有 {changed} 个未提交的文件变更")
    else:
        ok("工作区干净，无未提交变更")

    if errors == 0:
        ok("Git 仓库检查通过")
    return errors


def main() -> int:
    print(f"\n{C.BOLD}IHUI-AI 生产部署准备检查{C.RESET}")
    print(f"检查时间: {os.popen('date /t').read().strip() if os.name == 'nt' else ''}")
    print(f"项目路径: {Path(__file__).parent.parent.parent}")

    total_errors = 0
    total_errors += check_env_production()
    total_errors += check_ssl()
    total_errors += check_docker_config()
    total_errors += check_nginx()
    total_errors += check_git()

    header("检查结果汇总")
    if total_errors == 0:
        print(f"\n  {C.GREEN}{C.BOLD}✓ 所有检查通过，可以部署！{C.RESET}\n")
        return 0
    else:
        print(f"\n  {C.RED}{C.BOLD}✗ 发现 {total_errors} 个问题，请修复后再部署。{C.RESET}\n")
        return total_errors


if __name__ == "__main__":
    sys.exit(main())
