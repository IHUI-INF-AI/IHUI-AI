"""扫描 FastAPI app 中所有重复的 operation_id."""
import sys

sys.path.insert(0, r"G:\IHUI-AI\server")
os = __import__("os")
os.chdir(r"G:\IHUI-AI\server")
os.environ.setdefault("ENV", "test")
os.environ.setdefault("SKIP_SCHEMA_INIT", "1")

from collections import Counter
from app.main import create_app

app = create_app()
ops = []
for r in app.routes:
    if hasattr(r, "operation_id") and r.operation_id:
        m = ",".join(sorted(r.methods)) if hasattr(r, "methods") and r.methods else "WS"
        ops.append((r.operation_id, r.path, m))
c = Counter([o[0] for o in ops])
dup = {k: v for k, v in c.items() if v > 1}
if dup:
    print(f"DUPLICATE OPERATION IDs ({len(dup)}):")
    for op_id, cnt in dup.items():
        print(f"  {op_id} (x{cnt})")
        for oid, path, m in ops:
            if oid == op_id:
                print(f"    -> [{m}] {path}")
else:
    print(f"NO duplicate operation IDs ({len(ops)} total ops)")
