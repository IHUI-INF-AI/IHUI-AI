# zhs-platform CI Status

## GitHub Actions
- ✅ MySQL 8.0 service
- ✅ Redis 7 service
- ✅ Python 3.12
- ✅ pytest with coverage
- ✅ ruff lint
- ✅ Docker build & push (main only)

## Local 快速跑
```bash
cd zhs-platform
pip install "bcrypt<4.0"
pip install -e .
pip install pytest httpx

# 跑测试
pytest tests/ -v

# 启动应用
uvicorn app.main:app --reload

# 生成 DDL
python alembic/gen_init_sql.py
```

## 测试覆盖
- `test_auth.py` — JWT + 密码 (5 用例)
- `test_payments.py` — 微信 V3 + 支付宝 RSA2 (2 用例)
- `test_token_service.py` — 5 类流水枚举 + DB 检查
- `test_agents.py` — Rule/Task model + Router + 7 厂商
