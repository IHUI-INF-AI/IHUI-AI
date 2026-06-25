"""CORS middleware configuration -- actual config is in main.py (安全: 生产禁止通配符).

历史 setup_cors() 函数因存在不安全默认 (allow_origins=['*'] + allow_credentials=True)
且从未被调用, 已移除以避免误用. 新增 CORS 配置请直接修改 main.py create_app().
"""
