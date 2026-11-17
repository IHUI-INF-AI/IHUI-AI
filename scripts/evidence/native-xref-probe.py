# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""原生二进制轻量交叉引用取证（PE / x86-64）。

用途：对超大原生二进制（数百 MB，如 Electron 打包的 Rust 引擎 codex.exe）做
「单符号 / 单字符串」取证，**不必全量 Ghidra auto-analysis**。R52/R53 实战提炼：
全量分析对 382MB PE 在 1200s 内无法完成，而本工具秒级完成同等的交叉引用定位。

方法（四步，见 docs/engineering/round11-reverse/R53-*.md §1）：
  1. 解析 PE 段表，建立各段 VA <-> fileoff 映射（纯手算，无 pefile 依赖）；
  2. 在文件里 `grep -abo` 风格定位目标字符串的 fileoff，换算 VA（默认取 .rdata）；
  3. 线性扫 .text 段内 RIP-relative LEA（`48/4C 8D` + modrm `mod=00 rm=101` disp32），
     算每条引用的目标 VA 与目标串 VA 比对；
  4. （可选）对每个命中点 objdump 定向反汇编，看引用语境（序列化块 / 分支 / 表驱动）。

用法：
  python scripts/evidence/native-xref-probe.py <binary> --string <s1> [--string <s2> ...]
      [--disasm] [--max-disasm 64] [--json]
  # 例（codex.exe steer/回滚 因果取证）：
  python scripts/evidence/native-xref-probe.py "C:/.../codex.exe" \
      --string active_turn_not_steerable --string thread_rollback_failed --disasm

输出：每组字符串的 VA、引用它的 .text 代码地址（LEA 指令 VA）、成对距离，
      `--disasm` 时附每个命中点的反汇编语境。`--json` 输出结构化结果供脚本消费。

纪律（§0）：本工具只**取证**、不改动二进制；结论须结合反汇编语境判定，
不得仅凭「字符串相邻」冒充因果（R52 教训）。零第三方依赖（标准库 mmap/struct）。
"""

from __future__ import annotations

import argparse
import json
import mmap
import struct
import subprocess
import sys

# REX.W 前缀 + 0x8D（LEA），modrm mod=00 rm=101 => RIP-relative disp32
_LEA_REX = (0x48, 0x4C)
_LEA_OPCODE = 0x8D


def parse_pe_sections(data: bytes) -> list[dict]:
    """解析 PE 段表，返回每段 {name, vma, fileoff, vsize, rawsize}。

    仅读 DOS header -> PE header -> optional header -> section table，不加载全文件。
    """
    if data[:2] != b"MZ":
        raise ValueError("不是 PE 文件（缺 MZ 头）")
    e_lfanew = struct.unpack_from("<I", data, 0x3C)[0]
    if data[e_lfanew:e_lfanew + 4] != b"PE\x00\x00":
        raise ValueError("不是 PE 文件（缺 PE 签名）")
    coff = e_lfanew + 4
    num_sections = struct.unpack_from("<H", data, coff + 2)[0]
    opt_size = struct.unpack_from("<H", data, coff + 16)[0]
    opt = coff + 20
    magic = struct.unpack_from("<H", data, opt)[0]
    if magic == 0x20B:  # PE32+
        image_base = struct.unpack_from("<Q", data, opt + 24)[0]
    elif magic == 0x10B:  # PE32
        image_base = struct.unpack_from("<I", data, opt + 28)[0]
    else:
        raise ValueError(f"未知 optional header magic: {magic:#x}")
    sec_tab = opt + opt_size
    sections = []
    for i in range(num_sections):
        off = sec_tab + i * 40
        name = data[off:off + 8].split(b"\x00", 1)[0].decode("ascii", "ignore")
        vsize, vaddr, rawsize, rawptr = struct.unpack_from("<IIII", data, off + 8)
        sections.append({
            "name": name,
            "vma": vaddr + image_base,
            "fileoff": rawptr,
            "vsize": vsize,
            "rawsize": rawsize,
        })
    return sections


def fileoff_to_va(sections: list[dict], fileoff: int) -> tuple[int, str] | None:
    """fileoff -> (VA, 段名)；落在某段的 rawsize 范围内才认。"""
    for s in sections:
        if s["fileoff"] <= fileoff < s["fileoff"] + s["rawsize"]:
            return s["vma"] + (fileoff - s["fileoff"]), s["name"]
    return None


def find_string_fileoffs(data: bytes, needle: bytes, limit: int = 8) -> list[int]:
    """定位字符串在文件里的全部出现偏移（find 循环，非 grep）。

    取全部出现、**不做** token 边界过滤——错误码表常把变体连体存储（如
    ``...mptsactive_turn_not_steerablethread_rollback_failed...``），此时目标串前一字节
    是别的 token 尾字符。若加「前一字节须非标识符」过滤会把这类真实出现全滤掉（R54
    实测 bug）。语境甄别交给调用方（结合反汇编 + 成对距离），不在偏移采集层猜。
    """
    offs, i = [], data.find(needle)
    while i != -1 and len(offs) < limit:
        offs.append(i)
        i = data.find(needle, i + 1)
    return offs


def scan_rip_rel_lea(text: bytes, text_vma: int, targets: dict[int, str]) -> list[dict]:
    """扫 .text 内 RIP-relative LEA，返回命中 {insn_va, target_va, string}。"""
    hits = []
    n = len(text)
    i = 0
    while i < n - 7:
        if text[i] in _LEA_REX and text[i + 1] == _LEA_OPCODE:
            modrm = text[i + 2]
            if (modrm >> 6) == 0 and (modrm & 7) == 5:
                disp = struct.unpack_from("<i", text, i + 3)[0]
                insn_end_va = text_vma + i + 7
                target = insn_end_va + disp
                if target in targets:
                    hits.append({
                        "insn_va": insn_end_va - 7,
                        "target_va": target,
                        "string": targets[target],
                    })
        i += 1
    return hits


def disasm_context(binary: str, va: int, window: int = 0x80) -> str:
    """objdump 定向反汇编 [va-window/2, va+window/2]，返回文本；objdump 缺失返回空。"""
    try:
        start = va - window // 2
        end = va + window // 2
        out = subprocess.run(
            ["objdump", "-d",
             f"--start-address={start:#x}", f"--stop-address={end:#x}", binary],
            capture_output=True, text=True, timeout=120,
        )
        return out.stdout if out.returncode == 0 else f"(objdump 失败: {out.stderr.strip()[:200]})"
    except FileNotFoundError:
        return "(objdump 不可用，跳过反汇编)"
    except subprocess.TimeoutExpired:
        return "(objdump 超时)"


def main() -> int:
    ap = argparse.ArgumentParser(description="原生二进制轻量交叉引用取证（PE x86-64）")
    ap.add_argument("binary", help="目标 PE 文件路径")
    ap.add_argument("--string", action="append", required=True,
                    help="要取证的目标字符串（可多次）")
    ap.add_argument("--disasm", action="store_true", help="对每个命中点 objdump 反汇编语境")
    ap.add_argument("--max-disasm", type=int, default=64,
                    help="反汇编命中的上限（防海量命中刷屏），默认 64")
    ap.add_argument("--max-occurrences", type=int, default=8,
                    help="每个字符串最多取前 N 处出现，默认 8")
    ap.add_argument("--json", action="store_true", help="输出结构化 JSON")
    args = ap.parse_args()

    with open(args.binary, "rb") as f:
        data = f.read()

    sections = parse_pe_sections(data)
    text_sec = next((s for s in sections if s["name"] == ".text"), None)
    if text_sec is None:
        print("错误：未找到 .text 段", file=sys.stderr)
        return 2

    result: dict = {"binary": args.binary, "strings": {}}

    # 目标串 VA -> 名字 映射（供扫描）
    target_map: dict[int, str] = {}
    per_string: dict[str, list] = {}
    for s in args.string:
        needle = s.encode("ascii")
        offs = find_string_fileoffs(data, needle, args.max_occurrences)
        entries = []
        for off in offs:
            va_sec = fileoff_to_va(sections, off)
            if va_sec is None:
                continue
            va, sec = va_sec
            target_map[va] = s
            entries.append({"fileoff": off, "va": va, "section": sec})
        per_string[s] = entries
        result["strings"][s] = {"occurrences": entries, "xrefs": []}

    # 扫 .text
    with open(args.binary, "rb") as f:
        mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
    text = mm[text_sec["fileoff"]: text_sec["fileoff"] + text_sec["rawsize"]]
    mm.close()

    hits = scan_rip_rel_lea(text, text_sec["vma"], target_map)
    for h in hits:
        result["strings"][h["string"]]["xrefs"].append(h)

    # 成对距离（同一区里两串 LEA 的间距，辅助判「同码表相邻」vs「分散控制流」）
    by_string = {s: sorted(x["insn_va"] for x in result["strings"][s]["xrefs"])
                 for s in args.string}
    if len(by_string) >= 2:
        names = list(by_string)
        a_name, b_name = names[0], names[1]
        deltas = []
        for a in by_string[a_name]:
            # 找同区里最近的一枚 b
            near = [b for b in by_string[b_name] if abs(b - a) < 0x1000]
            if near:
                b = min(near, key=lambda b: abs(b - a))
                deltas.append({"a": a_name, "b": b_name, "a_va": a, "b_va": b,
                               "delta": b - a})
        result["pair_deltas"] = deltas

    # 反汇编语境
    if args.disasm:
        count = 0
        for s in args.string:
            for x in result["strings"][s]["xrefs"]:
                if count >= args.max_disasm:
                    break
                x["disasm"] = disasm_context(args.binary, x["insn_va"])
                count += 1

    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        # 人读格式
        total_xrefs = sum(len(v["xrefs"]) for v in result["strings"].values())
        print(f"二进制: {args.binary}")
        print(f"目标串 {len(args.string)} 个，RIP-relative LEA 引用命中 {total_xrefs} 条\n")
        for s, v in result["strings"].items():
            print(f"=== {s} ===")
            for occ in v["occurrences"]:
                print(f"  string VA=0x{occ['va']:X} ({occ['section']} off={occ['fileoff']})")
            for x in v["xrefs"]:
                print(f"    LEA @ 0x{x['insn_va']:X} -> 0x{x['target_va']:X}")
            if not v["xrefs"]:
                print("    (无 LEA 引用命中；可能经 mov 基址+偏移或表间接引用)")
            print()
        for d in result.get("pair_deltas", []):
            print(f"成对距离: {d['a']} @0x{d['a_va']:X} <-> {d['b']} @0x{d['b_va']:X}"
                  f"  delta={d['delta']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
