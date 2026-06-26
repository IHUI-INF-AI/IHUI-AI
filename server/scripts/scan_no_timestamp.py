"""扫描所有 model 中哪些缺 TimestampMixin."""
import inspect
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import DateTime

from app.database import Base
from app.models.base import TimestampMixin


def main() -> int:
    import app.models  # noqa: F401
    models = []
    for name, obj in inspect.getmembers(app.models):
        if inspect.isclass(obj) and issubclass(obj, Base) and obj is not Base:
            models.append(obj)

    no_ts = []
    for cls in models:
        if cls.__dict__.get("__tablename__") is None:
            continue
        if not issubclass(cls, TimestampMixin):
            has_created = "created_at" in cls.__table__.columns
            has_updated = "updated_at" in cls.__table__.columns
            if not (has_created and has_updated):
                no_ts.append((cls.__name__, has_created, has_updated))

    print(f"扫描 {len(models)} 个 model, 缺 TimestampMixin: {len(no_ts)}")
    for name, c, u in no_ts:
        print(f"  {name}  (created_at={c}, updated_at={u})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
