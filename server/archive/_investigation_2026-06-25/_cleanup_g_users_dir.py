"""递归删除 G:\\Users 空目录链 + 验证 G 盘根状态."""
import os

dirs = [
    "G:/Users/Administrator/AppData/Local/Temp",
    "G:/Users/Administrator/AppData/Local",
    "G:/Users/Administrator/AppData",
    "G:/Users/Administrator",
    "G:/Users",
]
for d in dirs:
    if os.path.exists(d):
        try:
            entries = os.listdir(d)
            if not entries:
                os.rmdir(d)
                print(f"已删除空目录: {d}")
            else:
                print(f"非空, 跳过: {d} ({len(entries)} 项)")
        except OSError as e:
            print(f"删除失败 {d}: {e}")
    else:
        print(f"不存在: {d}")

# 最终验证
print()
print("=== 最终 G 盘根目录状态 ===")
for p in ["G:/1", "G:/dev", "G:/tmp", "G:/pw-output", "G:/Users"]:
    label = "存在" if os.path.exists(p) else "不存在"
    print(f"  {p}: {label}")
