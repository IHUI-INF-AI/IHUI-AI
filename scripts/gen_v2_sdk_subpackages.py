"""P14-5: 拆分 v2 SDK 为 9 个子包, 生成 barrel 文件.

策略 (轻量级):
  - v2-sdk/index.ts 单文件 @ts-nocheck, 物理切 5300+ 行代价太高
  - 创建 9 个子包 barrel, 从 v2-sdk/index 重新导出对应前缀的函数
  - v2-business 改 import 路径到子包, 触发 esbuild tree-shaking
"""
import re
from pathlib import Path

# 2026-06-25 修复: 改用脚本自身位置计算 client 根, 避免硬编码 g:\1\client
# scripts/gen_v2_sdk_subpackages.py -> ../../client
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
SDK_FILE = _PROJECT_ROOT / "client" / "src" / "api" / "v2-sdk" / "index.ts"
OUT_DIR = _PROJECT_ROOT / "client" / "src" / "api" / "v2-sdk"

# 桶定义: 子包名 -> 关键词列表 (按 SDK 函数名前缀匹配)
BUCKETS = {
    "core": [],  # 不放函数, 共享类型
    "agents": ["agents"],
    "courses": ["course"],
    "auth": ["auth", "captcha", "sms"],
    "user": ["user", "profile"],
    "chat": ["chat", "ask", "search"],
    "payment": ["pay", "finance", "point", "order", "coupon", "vip", "wallet"],
    "content": ["cms", "circle", "topic", "post", "comment", "like", "favorite", "share", "tag", "category", "article", "news", "notice", "announce"],
    "admin": ["admin", "system", "behavior", "stat", "dashboard", "config", "log", "audit", "tenant", "role", "perm", "menu", "dict", "file", "upload", "oss", "captcha"],
}

# 1) 解析所有 export async function 名称
text = SDK_FILE.read_text(encoding="utf-8")
pattern = re.compile(r"^export async function (v2_v2_[a-zA-Z0-9_]+)\s*\(", re.MULTILINE)
fn_names = pattern.findall(text)
print(f"Total exports: {len(fn_names)}")

# 2) 分桶 (按函数名前缀 v2_v2_<keyword>_<rest>)
bucketed: dict[str, list[str]] = {b: [] for b in BUCKETS}
unmatched: list[str] = []

for name in fn_names:
    # 提取 v2_v2_<kw>_<rest> 中的 kw
    parts = name.split("_")
    # parts = ['v2', 'v2', '<kw>', ...]
    if len(parts) < 4:
        unmatched.append(name)
        continue
    kw = parts[2]
    placed = False
    for bucket, keywords in BUCKETS.items():
        if bucket == "core":
            continue
        if kw in keywords:
            bucketed[bucket].append(name)
            placed = True
            break
    if not placed:
        unmatched.append(name)

# 3) 把 unmatched 全部分到 admin (兜底)
bucketed["admin"].extend(unmatched)

# 4) 生成 9 个子包 barrel 文件
TEMPLATE = """// P14-5: v2 SDK 子包 - {bucket}
// 自动生成, 业务代码 import from '@/api/v2-sdk/{bucket}' 可触发 esbuild tree-shake
// 源: v2-sdk/index.ts 中的 {count} 个函数
/* eslint-disable */
// @ts-nocheck
export {{
{exports}
}} from '../v2-sdk/index'
"""

for bucket, names in bucketed.items():
    if bucket == "core":
        continue
    if not names:
        print(f"  [{bucket}] 0 functions, skip")
        continue
    names_sorted = sorted(set(names))
    exports_str = ",\n".join(names_sorted)
    content = TEMPLATE.format(
        bucket=bucket,
        count=len(names_sorted),
        exports=exports_str,
    )
    out = OUT_DIR / f"{bucket}.ts"
    out.write_text(content, encoding="utf-8")
    print(f"  [{bucket}] {len(names_sorted)} functions -> {out.name}")

# 5) core 子包: 只放类型/工具, 空 barrel
core_path = OUT_DIR / "core.ts"
core_path.write_text(
    "// P14-5: v2 SDK 子包 - core (共享类型, 当前 SDK 单体无单独 export, 占位)\n"
    "// 业务代码 import from '@/api/v2-sdk/core'\n"
    "export {}\n",
    encoding="utf-8",
)
print(f"  [core] 0 functions -> core.ts (placeholder)")

print("\nDone. Subpackages:", list(bucketed.keys()))
