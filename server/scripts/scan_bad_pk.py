"""一次性扫描所有 model 的主键类型, 找出不符合 String(32/64)/Integer 规范的."""
import inspect
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import BigInteger, Integer, SmallInteger, String

from app.database import Base


def main() -> int:
    import app.models  # noqa: F401
    all_models = []
    for name, obj in inspect.getmembers(app.models):
        if inspect.isclass(obj) and issubclass(obj, Base) and obj is not Base:
            all_models.append(obj)

    bad = []
    for cls in all_models:
        pk_cols = list(cls.__table__.primary_key.columns)
        if not pk_cols:
            continue
        for col in pk_cols:
            ct = col.type
            ok = (
                (isinstance(ct, String) and ct.length in (32, 64))
                or isinstance(ct, (Integer, BigInteger, SmallInteger))
            )
            if not ok:
                bad.append((cls.__name__, col.name, repr(ct)))

    print(f"扫描 {len(all_models)} 个 model, 违规主键: {len(bad)}")
    for name, col, tp in bad:
        print(f"  {name}.{col} = {tp}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
