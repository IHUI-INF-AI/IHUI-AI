#!/usr/bin/env python3
"""
预部署检查脚本 - 封版上线前自动化验证
检查项: .env.production 配置完整性 / SSL 证书 / Docker 配置 / Nginx 配置 / Git 仓库
"""
import os
import sys
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

def check_env_production():
    """检查 .env.production 配置完整性"""
    print("\n[1] 检查 .env.production 配置...")
    env_file = BASE_DIR / ".env.production"
    if not env_file.exists():
        print("  FAIL: .env.production 不存在")
        return False

    content = env_file.read_text(encoding="utf-8")
    checks = {
        "ENV=production": "ENV 必须为 production",
        "postgresql": "数据库必须使用 PostgreSQL",
        "DB_ALLOW_SQLITE_FALLBACK=false": "生产环境禁止 SQLite fallback",
        "JWT_SECRET_KEY=": "JWT 密钥必须配置",
        "REDIS_PASSWORD=": "Redis 密码必须配置",
        "ZHIPU_API_KEY=": "智谱 API Key 必须配置",
        "MINIO_ACCESS_KEY=": "MinIO Access Key 必须配置",
    }

    all_pass = True
    for key, desc in checks.items():
        if key in content:
            # 检查是否有占位符
            line = [l for l in content.split("\n") if l.startswith(key.split("=")[0])]
            if line and "<" in line[0] and ">" in line[0]:
                print(f"  WARN: {desc} (仍含占位符)")
                all_pass = False
            else:
                print(f"  PASS: {desc}")
        else:
            print(f"  FAIL: {desc}")
            all_pass = False

    # 检查是否有弱密钥
    if "JWT_SECRET_KEY=your" in content or "JWT_SECRET_KEY=test" in content:
        print("  FAIL: JWT_SECRET_KEY 使用了弱密钥")
        all_pass = False

    return all_pass


def check_ssl_certificates():
    """检查 SSL 证书"""
    print("\n[2] 检查 SSL 证书...")
    ssl_dir = BASE_DIR.parent / "ssl"
    if not ssl_dir.exists():
        print("  WARN: ssl/ 目录不存在 (生产部署前需创建)")
        return False

    fullchain = ssl_dir / "fullchain.pem"
    privkey = ssl_dir / "privkey.pem"

    all_pass = True
    if fullchain.exists():
        print(f"  PASS: {fullchain.name} 存在")
    else:
        print(f"  FAIL: {fullchain.name} 不存在")
        all_pass = False

    if privkey.exists():
        print(f"  PASS: {privkey.name} 存在")
    else:
        print(f"  FAIL: {privkey.name} 不存在")
        all_pass = False

    return all_pass


def check_docker_config():
    """检查 Docker 配置一致性"""
    print("\n[3] 检查 Docker 配置...")
    compose_file = BASE_DIR.parent / "docker-compose.yml"
    if not compose_file.exists():
        print("  FAIL: docker-compose.yml 不存在")
        return False

    content = compose_file.read_text(encoding="utf-8")
    checks = {
        "443:443": "前端必须暴露 443 端口 (HTTPS)",
        "ssl:/etc/nginx/ssl:ro": "前端必须挂载 SSL 证书",
        "healthcheck": "所有服务必须有 healthcheck",
        "minio": "MinIO 服务必须配置",
        "aizhs-net": "必须使用 aizhs-net 网络",
        "/healthz": "健康检查端点必须为 /healthz",
    }

    all_pass = True
    for key, desc in checks.items():
        if key in content:
            print(f"  PASS: {desc}")
        else:
            print(f"  FAIL: {desc}")
            all_pass = False

    return all_pass


def check_nginx_config():
    """检查 Nginx 配置"""
    print("\n[4] 检查 Nginx 配置...")
    nginx_file = BASE_DIR.parent / "nginx.conf"
    if not nginx_file.exists():
        print("  FAIL: nginx.conf 不存在")
        return False

    content = nginx_file.read_text(encoding="utf-8")
    checks = {
        "listen 443 ssl": "必须监听 443 SSL",
        "server_tokens off": "必须隐藏 nginx 版本号",
        "Strict-Transport-Security": "必须配置 HSTS",
        "X-Frame-Options": "必须配置 X-Frame-Options",
        "X-Content-Type-Options": "必须配置 X-Content-Type-Options",
        "proxy_pass http://backend:8000": "必须反向代理到后端",
        "return 301 https": "必须 HTTP 重定向到 HTTPS",
        "gzip on": "必须启用 gzip 压缩",
    }

    all_pass = True
    for key, desc in checks.items():
        if key in content:
            print(f"  PASS: {desc}")
        else:
            print(f"  FAIL: {desc}")
            all_pass = False

    return all_pass


def check_git_remote():
    """检查 Git 远程仓库"""
    print("\n[5] 检查 Git 仓库...")
    import subprocess
    try:
        result = subprocess.run(
            ["git", "remote", "-v"],
            capture_output=True, text=True, cwd=str(BASE_DIR.parent)
        )
        if "origin" in result.stdout:
            print("  PASS: Git 远程仓库已配置")
            return True
        else:
            print("  FAIL: Git 远程仓库未配置")
            return False
    except Exception:
        print("  WARN: 无法检查 Git 配置")
        return False


def main():
    print("=" * 60)
    print("  智汇AI 预部署检查 - 封版上线验证")
    print("=" * 60)

    results = []
    results.append(("env_production", check_env_production()))
    results.append(("ssl_certificates", check_ssl_certificates()))
    results.append(("docker_config", check_docker_config()))
    results.append(("nginx_config", check_nginx_config()))
    results.append(("git_remote", check_git_remote()))

    print("\n" + "=" * 60)
    print("  检查结果汇总")
    print("=" * 60)

    all_pass = True
    for name, passed in results:
        status = "PASS" if passed else "FAIL"
        print(f"  [{status}] {name}")
        if not passed:
            all_pass = False

    print("=" * 60)
    if all_pass:
        print("  所有检查通过! 可以部署!")
        sys.exit(0)
    else:
        print("  存在未通过项, 请修复后再部署!")
        sys.exit(1)


if __name__ == "__main__":
    main()
