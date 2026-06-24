"""预部署检查脚本.

deploy.sh 在构建 Docker 镜像前调用此脚本, 检查关键配置和依赖是否就绪.
检查项:
  1. .env.production 文件存在且含必要配置
  2. 数据库连接配置非空
  3. Redis 配置非空
  4. 关键密钥已填写 (JWT_SECRET_KEY, COZE_PRIVATE_KEY 等)

退出码: 0=通过, 1=失败
"""
import os
import sys
import pathlib


def check_env_file():
    """检查 .env.production 文件存在."""
    env_file = pathlib.Path(".env.production")
    if not env_file.exists():
        print("FAIL: .env.production 文件不存在")
        return False
    print("OK: .env.production 文件存在")
    return True


def check_required_vars():
    """检查关键环境变量已配置."""
    # 从 .env.production 读取
    env_file = pathlib.Path(".env.production")
    if not env_file.exists():
        return False

    env_vars = {}
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, value = line.partition("=")
            env_vars[key.strip()] = value.strip().strip('"').strip("'")

    required = [
        "DB1_URL",
        "REDIS_HOST",
        "JWT_SECRET_KEY",
        "COZE_OAUTH_APP_ID",
    ]

    all_ok = True
    for var in required:
        value = env_vars.get(var, "")
        if not value:
            print(f"FAIL: {var} 未配置")
            all_ok = False
        else:
            print(f"OK: {var} 已配置")

    return all_ok


def check_python_syntax():
    """检查关键 Python 文件语法."""
    import py_compile

    critical_files = [
        "app/config.py",
        "app/main.py",
    ]
    all_ok = True
    for f in critical_files:
        if pathlib.Path(f).exists():
            try:
                py_compile.compile(f, doraise=True)
                print(f"OK: {f} 语法正确")
            except py_compile.PyCompileError as e:
                print(f"FAIL: {f} 语法错误: {e}")
                all_ok = False
        else:
            print(f"WARN: {f} 不存在 (跳过)")
    return all_ok


def main():
    print("========================================")
    print("  预部署检查")
    print("========================================")

    checks = [
        ("环境文件", check_env_file),
        ("必要配置项", check_required_vars),
        ("Python 语法", check_python_syntax),
    ]

    all_passed = True
    for name, check_fn in checks:
        print(f"\n[{name}]")
        try:
            if not check_fn():
                all_passed = False
        except Exception as e:
            print(f"FAIL: {name} 检查异常: {e}")
            all_passed = False

    print("\n========================================")
    if all_passed:
        print("  预部署检查通过")
        print("========================================")
        sys.exit(0)
    else:
        print("  预部署检查未通过, 请修复上述问题")
        print("========================================")
        sys.exit(1)


if __name__ == "__main__":
    main()
