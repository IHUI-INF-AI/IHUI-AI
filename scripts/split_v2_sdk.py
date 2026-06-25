"""P15-1: 物理切分 v2-sdk/index.ts (5371 行) 为 9 个文件.

策略:
  1. 解析 v2-sdk/index.ts 提取所有 export async function
  2. 切分头部共享 (V2Response, BASE, request) 到 v2-sdk/core.ts
  3. 按域 (agents/courses/auth/user/chat/payment/content/admin) 生成 8 个桶文件
  4. v2-sdk/index.ts 改为 barrel, re-export 所有桶 + core
  5. 9 个桶 barrel (agents.ts 等) 改为从 ./<bucket> 物理路径 import, 而非 re-export
  6. 验证: Vite build + 9 个桶 barrel 子集 import 都能解析

附带修复: 原自动生成代码中每个函数都引用未定义的 `body, query`,
        切分时给所有函数加 `body?: any, query?: Record<string, unknown> = {}` 默认参数.
"""
import re
from collections import defaultdict
from pathlib import Path

# 2026-06-25 修复: 改用脚本自身位置计算 client 根, 避免硬编码 g:\1\client
# scripts/split_v2_sdk.py -> ../../client
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
SDK = _PROJECT_ROOT / "client" / "src" / "api" / "v2-sdk" / "index.ts"
SDK_DIR = SDK.parent

# 与 P14-5 桶保持一致
BUCKETS = {
    "core": [],
    "agents": ["agents"],
    "courses": ["course"],
    "auth": ["auth", "captcha", "sms", "login", "logout", "register", "token", "verify"],
    "user": ["user", "profile"],
    "chat": ["chat", "ask", "search", "ai", "llm"],
    "payment": ["pay", "finance", "point", "order", "coupon", "vip", "wallet", "invoice", "refund"],
    "content": ["cms", "circle", "topic", "post", "comment", "like", "favorite", "share",
                "tag", "category", "article", "news", "notice", "announce", "banner",
                "promotion", "ad", "about_us", "feedback", "complaint", "report"],
    "admin": ["admin", "system", "behavior", "stat", "dashboard", "config", "log",
              "audit", "tenant", "role", "perm", "menu", "dict", "file", "upload",
              "oss", "message", "notification", "email", "sms_", "push", "device",
              "version", "app", "web", "site", "page", "home", "header", "footer",
              "stock", "analyse", "tool", "tools", "helper", "common", "misc",
              "other", "default", "test", "demo", "sample"],
}

text = SDK.read_text(encoding="utf-8")
lines = text.split("\n")

# ---------- 1) 提取所有 export async function 的定义块 ----------
# 按行扫描, 找 export async function 开头, 然后找匹配的 }, 跳过模板字符串里的 {}
functions: list[dict] = []
i = 0
n = len(lines)
while i < n:
    line = lines[i]
    stripped = line.strip()
    # 找 export async function 行
    if not (stripped.startswith("export async function ") or stripped.startswith("export function ")):
        i += 1
        continue
    # 抓函数名 + 参数 (可能跨多行)
    sig = stripped
    if "(" not in sig or ")" not in sig or "{" in sig and sig.find("{") < sig.rfind(")"):
        # 参数可能跨行: 继续读直到找到 ) {
        j = i
        sig_buf = [stripped]
        while "{" not in sig_buf[-1] or sig_buf[-1].count(")") == 0:
            j += 1
            if j >= n:
                break
            sig_buf.append(lines[j].strip())
        sig = " ".join(sig_buf)
    # 解析函数名
    m_name = re.match(r"export (?:async )?function (v2_v2_[a-zA-Z0-9_]+)\s*\(", sig)
    if not m_name:
        i += 1
        continue
    name = m_name.group(1)
    # 解析 params (从 name(... 开始 到 ) 结束, 可能在 sig 多行合并中)
    # 找 ( 在 name 后面
    name_pos = sig.find(name)
    p_open = sig.find("(", name_pos + len(name))
    if p_open < 0:
        i += 1
        continue
    # 找匹配的 )
    depth = 0
    p_close = -1
    for ci, ch in enumerate(sig[p_open:]):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                p_close = p_open + ci
                break
    if p_close < 0:
        i += 1
        continue
    params = sig[p_open + 1 : p_close].strip()
    # 找 body 起点: 第一个 { 在 ) 之后
    brace_pos = sig.find("{", p_close)
    if brace_pos < 0:
        i += 1
        continue
    # 从 brace_pos 开始, 逐字符匹配 {} (跳过模板字符串和字符串字面量)
    body_start_in_line = i  # 在原 lines 中的行号
    # 找到 } 结束位置 (考虑模板字符串)
    pos = brace_pos
    depth = 0
    in_str = None  # ', ", `
    in_comment = False
    cur_line = sig
    line_idx = i
    body_chars = []
    finished = False
    while not finished:
        while pos < len(cur_line):
            ch = cur_line[pos]
            nxt = cur_line[pos + 1] if pos + 1 < len(cur_line) else ""
            if in_comment:
                body_chars.append(ch)
                if ch == "*" and nxt == "/":
                    body_chars.append(nxt)
                    pos += 2
                    in_comment = False
                    continue
                pos += 1
                continue
            if in_str:
                body_chars.append(ch)
                if ch == "\\":
                    body_chars.append(nxt)
                    pos += 2
                    continue
                if ch == in_str:
                    in_str = None
                pos += 1
                continue
            if ch == "/" and nxt == "*":
                in_comment = True
                body_chars.append(ch)
                body_chars.append(nxt)
                pos += 2
                continue
            if ch == "/" and nxt == "/":
                # 行注释到行尾
                while pos < len(cur_line):
                    body_chars.append(cur_line[pos])
                    pos += 1
                break
            if ch in ("'", '"', "`"):
                in_str = ch
                body_chars.append(ch)
                pos += 1
                continue
            if ch == "{":
                depth += 1
                body_chars.append(ch)
                pos += 1
                continue
            if ch == "}":
                depth -= 1
                body_chars.append(ch)
                pos += 1
                if depth == 0:
                    finished = True
                    break
                continue
            body_chars.append(ch)
            pos += 1
        if finished:
            break
        line_idx += 1
        if line_idx >= n:
            break
        cur_line = lines[line_idx]
        body_chars.append("\n")
        pos = 0
    body = "".join(body_chars)
    # 函数结束的行
    end_line = line_idx
    # 收集前导 doc 注释 (从 i 向前找到 /** 开始)
    doc_lines = []
    j = i - 1
    # 先找到上一个非空行 (即函数定义或文件头)
    while j >= 0 and lines[j].strip() == "":
        j -= 1
    # 如果上一个非空行是 */, 说明有 doc, 继续往前找 /**
    if j >= 0 and lines[j].strip() == "*/":
        while j >= 0:
            doc_lines.insert(0, lines[j])
            if lines[j].strip().startswith("/**"):
                break
            j -= 1
    doc = "\n".join(doc_lines)
    if doc and not doc.endswith("\n"):
        doc += "\n"
    functions.append({
        "name": name,
        "params": params,
        "doc": doc,
        "body": body,
        "end_line": end_line,
    })
    i = end_line + 1

print(f"Total functions extracted: {len(functions)}")

# ---------- 2) 分桶 ----------
bucketed: dict[str, list[dict]] = defaultdict(list)
unmatched: list[dict] = []
for fn in functions:
    parts = fn["name"].split("_")
    kw = parts[2] if len(parts) >= 4 else ""
    placed = False
    for bucket, keywords in BUCKETS.items():
        if bucket == "core":
            continue
        for k in keywords:
            # 完整词匹配, 避免 'ad' 匹配 'admin' 这种
            if kw == k or kw.startswith(k + "_") or fn["name"].split("_v2_")[1].split("_")[0] == k:
                bucketed[bucket].append(fn)
                placed = True
                break
        if placed:
            break
    if not placed:
        unmatched.append(fn)

# unmatched 全部进 admin
bucketed["admin"].extend(unmatched)

for b, fns in bucketed.items():
    print(f"  [{b}] {len(fns)} functions")

# ---------- 3) 写 v2-sdk/core.ts (共享 V2Response + BASE + request) ----------
core_ts = """// P15-1: v2 SDK 共享层 (request / 响应包装 / BASE)
export interface V2Response<T = unknown> {
  code: string;
  msg: string;
  data: T | null;
  total?: number;
}

export const BASE = '/api/v2';

export async function request<T = unknown>(
  method: string,
  path: string,
  body?: any,
  query?: Record<string, unknown>,
): Promise<V2Response<T>> {
  const url = new URL(BASE + path, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const r = await fetch(url.toString(), init);
  if (!r.ok) throw new Error(`v2 ${method} ${path} -> ${r.status}`);
  return (await r.json()) as V2Response<T>;
}
"""
(SDK_DIR / "core.ts").write_text(core_ts, encoding="utf-8")
print("Wrote core.ts (shared request)")

# ---------- 4) 写 8 个桶文件 (每个含 import + 函数定义) ----------
def render_fn(fn: dict) -> str:
    """渲染单个函数, 修复原 'body, query' 未定义 bug."""
    name = fn["name"]
    params = fn["params"].strip()
    # 处理末尾孤立的逗号 (避免 body?: any, + ,query... 双逗号)
    params = params.rstrip(",").strip()
    # 给所有函数补默认参数 (避免 body/query 未定义)
    # 注意: 有默认值时不能用 ?, 改为 query: Record<string, unknown> = {}
    if not params:
        new_params = "body?: any, query: Record<string, unknown> = {}"
    elif "body" not in params and "query" not in params:
        new_params = params + ", body?: any, query: Record<string, unknown> = {}"
    elif "body" not in params:
        new_params = params + ", body?: any"
    elif "query" not in params:
        new_params = params + ", query: Record<string, unknown> = {}"
    else:
        new_params = params

    body = fn["body"]
    # body 已包含 {...} 外层
    return f"""{fn['doc']}export async function {name}({new_params}) {body}"""

for bucket, fns in bucketed.items():
    if bucket == "core":
        continue
    if not fns:
        # 空桶: 只放 placeholder
        (SDK_DIR / f"{bucket}.ts").write_text(
            f"// P15-1: v2 SDK 子包 - {bucket} (空桶, 等待新端点)\n"
            f"export {{}} from './core'\n",
            encoding="utf-8",
        )
        continue

    rendered = "\n\n".join(render_fn(fn) for fn in fns)
    content = f"""// P15-1: v2 SDK 子包 - {bucket} ({len(fns)} 个函数, 物理切分)
// 物理实现, 业务 import 路径: import * as {bucket} from '@/api/v2-sdk/{bucket}'
// esbuild 可 tree-shake 掉未使用的桶
import {{ request }} from './core'

{rendered}
"""
    (SDK_DIR / f"{bucket}.ts").write_text(content, encoding="utf-8")
    print(f"Wrote {bucket}.ts ({len(fns)} functions)")

# ---------- 5) 改 v2-sdk/index.ts 为 barrel ----------
barrel = """// P15-1: v2 SDK 顶层 barrel
// 业务代码: import { v2Agents, v2Courses } from '@/api/v2-business'
// 子包直接 import: import * as agents from '@/api/v2-sdk/agents'
export * from './core'
export * as agents from './agents'
export * as courses from './courses'
export * as auth from './auth'
export * as user from './user'
export * as chat from './chat'
export * as payment from './payment'
export * as content from './content'
export * as admin from './admin'
"""
SDK.write_text(barrel, encoding="utf-8")
print("Rewrote v2-sdk/index.ts as barrel")

# ---------- 6) 改 9 个桶 barrel 文件 (P14-5 生成的) ----------
# 把它们从 re-export 改为 re-export * (这样当物理文件已经切分后, 直接转发)
for bucket in BUCKETS:
    barrel_file = SDK_DIR / f"{bucket}.ts"  # 物理同名, 实际是 barrel
    if barrel_file.exists():
        content = barrel_file.read_text(encoding="utf-8")
        # 如果是 re-export 模式, 保持 (因为它们现在和物理文件同名, barrel 会在 build 时被物理覆盖)
        # 实际上 P14-5 生成的 barrel 在 build 时会被新写的物理文件覆盖

print("\nDone. Subpackages physical split complete.")
