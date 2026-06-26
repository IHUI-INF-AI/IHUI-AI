"""扫描所有 model 中本应是 Integer(分) 但用了 Float/Numeric 的金额/分数字段."""
import inspect
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import BigInteger, Float, Integer, Numeric, SmallInteger, String

from app.database import Base

# 来自 test_field_migration.py 的同一份白名单
AMOUNT_FIELDS = {
    "price", "original_price", "total_score", "score", "amount",
    "total_amount", "pay_amount", "payment_amount", "discount_amount",
    "product_fee", "invoice_amount", "average_score", "cost",
    "sale_price", "refund_amount", "withdrawal_amount",
}


def main() -> int:
    import app.models  # noqa: F401
    models = []
    for name, obj in inspect.getmembers(app.models):
        if inspect.isclass(obj) and issubclass(obj, Base) and obj is not Base:
            models.append(obj)

    bad = []
    for cls in models:
        for col in cls.__table__.columns:
            lname = col.name.lower()
            if lname in AMOUNT_FIELDS:
                if isinstance(col.type, (Float, Numeric)):
                    bad.append((cls.__name__, col.name, repr(col.type)))

    print(f"扫描 {len(models)} 个 model, 违规金额字段: {len(bad)}")
    for name, col, tp in bad:
        print(f"  {name}.{col} = {tp}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
