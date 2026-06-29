"""Alembic configuration for database migrations."""
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

from app.database import Base, engine1, engine2, engine3

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    优先级:
      1. 如果 alembic.cfg 显式设置了 sqlalchemy.url (CI / alembic_ci 注入),
         用注入的 engine, 不走 engine1 (生产 PG).
      2. 否则默认用 engine1 (生产 PG).
    """
    injected_url = config.get_main_option("sqlalchemy.url")
    if injected_url and not injected_url.startswith("postgres"):
        from sqlalchemy import create_engine
        connectable = create_engine(injected_url, pool_pre_ping=True)
    else:
        # 生产: 根据环境变量选择引擎
        import os
        db_choice = os.environ.get("ALEMBIC_DATABASE", "ai").lower()
        engine_map = {"ai": engine1, "center": engine2, "course": engine3}
        connectable = engine_map.get(db_choice, engine1)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
