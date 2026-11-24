# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""SAG2 OCR 探针：用**退化样本**量"扫描件到底能不能读"，而不是只证明"引擎装上了"。

为什么单列一个脚本
------------------
`tests/test_sag2_media_ocr.py` 能证明管道通、缺件原因具名、失败被隔离，
但**证明不了"真能认字"**——那需要带已知标准答案的样本。本探针补这件事：

1. 合成 A4 页（标题 + 正文，含年份/金额/人名等可判实体）；
2. 按档位退化：干净截图 → 轻度扫描 → 倾斜+噪声 → 失焦模糊 → 手机翻拍
   → JPEG 低质 → 72dpi 低分辨率；另加一张双栏版面；
3. 逐档算 **CER**（去空白标点后 Levenshtein / 参考答案长度）与关键实体命中；
4. 端到端：把扫描件登记进文件夹 → 增量扫描入库 → 自然语言查询，看答案文档排名。

诚实口径（写进输出的 ``caveats``，避免"看起来很好"）
----------------------------------------------------
* 样本是**合成退化**，不是真实纸张扫描/手机拍照：不同扫描仪的坏点分布、
  装订阴影、页面弯曲、印章遮挡都没有覆盖，别把这里的 CER 外推到"真实合同"；
* 单档单次 CER 会被随机种子与几何变换叠加影响，``--seeds 3`` 才给区间；
* 双栏版面按行读会**串栏**（引擎行为）。探针只如实报左右栏句子是否各自完整，
  不做分栏重排——按 x 聚类切栏的阈值风险大于收益，会把单栏文档拆乱。

用法::

    python scripts/sag2_ocr_probe.py
    python scripts/sag2_ocr_probe.py --seeds 3 --json G:/tmp/ocr-probe.json
"""

from __future__ import annotations

import argparse
import asyncio
import io
import json
import os
import sys
import tempfile
import time
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.sag2_lexical import ocr_text  # noqa: E402
from app.services.sag2_lexical.folder_ingest import FolderIngest  # noqa: E402
from app.services.sag2_lexical.service import Sag2LexicalService  # noqa: E402

try:  # 生成样本需要 PIL；极简部署未装时整脚本降级为"无法判定"，不伪装成功。
    import numpy as np
    from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

    PIL_READY = True
except ImportError:  # pragma: no cover - 依赖缺失时的诚实降级路径
    PIL_READY = False

TITLE = "关于开展向量检索试点的通知"
BODY: tuple[str, ...] = (
    "各部门：",
    "经董事会决议，2025 年度研发额度定为 800 万元，",
    "由王工牵头负责向量检索项目。",
    "第三季度实际支出 940 万元，超上限 140 万元。",
    "请于 2026 年 12 月 31 日前提交复盘报告。",
    "联系人：李工  电话：010-8888 6666",
)
REFERENCE = TITLE + "".join(BODY)

#: 可判实体：两项业务词、一个人名、三个金额/年份、一个动作词。
KEYWORDS: tuple[str, ...] = ("向量检索", "王工", "800", "940", "140", "2026", "复盘")

LEFT_SENT = "甲方应按季度提交支出明细并由财务部门复核签章"
RIGHT_SENT = "乙方负责系统运维与数据备份故障响应不超过四小时"

FONT_CANDIDATES: tuple[str, ...] = (
    r"C:\Windows\Fonts\simsun.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/PingFang.ttc",
)

#: 档位 → 退化参数。档名直接进 JSON，读的人不用猜"mild 到底多 mild"。
PROFILES: dict[str, dict[str, float]] = {
    "screenshot": {"rotate": 0.0, "noise": 0.0, "blur": 0.0, "contrast": 1.0, "scale": 1.0},
    "scan-mild": {"rotate": 0.8, "noise": 6.0, "blur": 0.6, "contrast": 0.94, "scale": 1.0},
    "scan-tilt3-noise22": {"rotate": 3.0, "noise": 22.0, "blur": 1.6, "contrast": 0.7, "scale": 1.0},
    "scan-blur2.5": {"rotate": 1.0, "noise": 8.0, "blur": 2.5, "contrast": 0.85, "scale": 1.0},
    "phone-tilt5-noise30": {"rotate": 5.0, "noise": 30.0, "blur": 1.2, "contrast": 0.6, "scale": 1.0},
    "fax-jpeg25": {"rotate": 1.0, "noise": 6.0, "blur": 0.8, "contrast": 0.9, "scale": 1.0, "jpeg": 25},
    "scan-72dpi": {"rotate": 0.6, "noise": 6.0, "blur": 0.5, "contrast": 0.95, "scale": 0.48},
}

CAVEATS: tuple[str, ...] = (
    "合成退化样本，不是真实纸张扫描/手机拍照；扫描仪坏点、装订阴影、页面弯曲、印章遮挡未覆盖。",
    "单档单次 CER 受随机种子与几何变换叠加影响，区间需 --seeds>=3。",
    "双栏版面按行读会串栏（引擎行为）；探针只报左右栏是否各自完整，不做分栏重排。",
    "耗时含首次引擎/模型加载，不能直接当稳态单页成本。",
)


def _font_path(size: int) -> str | None:
    for path in FONT_CANDIDATES:
        if not os.path.exists(path):
            continue
        try:
            ImageFont.truetype(path, size)
        except Exception:  # noqa: BLE001 - 字体存在但损坏/不支持就换下一个
            continue
        return path
    return None


def _normalize(text: str) -> str:
    """只留字母/数字/汉字：排版空白与标点差异不该算成识别错误。"""
    return "".join(ch for ch in text if ch.isalnum())


def _levenshtein(a: str, b: str) -> int:
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _cer(reference: str, hypothesis: str) -> float:
    ref, hyp = _normalize(reference), _normalize(hypothesis)
    if not ref:
        return 1.0
    return _levenshtein(ref, hyp) / len(ref)


def _render(profile: dict[str, float], font_path: str, *, seed: int) -> Any:
    """按档位渲染一页 A4（150dpi 基准；72dpi 档按 scale 缩版面而不是缩大图）。"""
    scale = profile["scale"]
    width, height = int(1240 * scale), int(1754 * scale)
    image = Image.new("L", (width, height), 255)
    draw = ImageDraw.Draw(image)
    title_size = max(10, int(38 * scale))
    body_size = max(8, int(28 * scale))
    title_font = ImageFont.truetype(font_path, title_size)
    body_font = ImageFont.truetype(font_path, body_size)
    draw.text((int(140 * scale), int(150 * scale)), TITLE, font=title_font, fill=0)
    y = int(260 * scale)
    for line in BODY:
        draw.text((int(140 * scale), y), line, font=body_font, fill=0)
        y += int(62 * scale)

    rotate = profile["rotate"]
    if rotate:
        image = image.rotate(rotate, resample=Image.Resampling.BICUBIC, fillcolor=250)
    blur = profile["blur"]
    if blur:
        image = image.filter(ImageFilter.GaussianBlur(blur))
    array = np.asarray(image, dtype=np.float32)
    noise = profile["noise"]
    if noise:
        array = np.asarray(array + np.random.default_rng(seed).normal(0.0, noise, array.shape), dtype=np.float32)
    # 纸底压到 246 左右再按档位拉对比：模拟扫描仪对白纸的灰度响应，而不是纯白底黑字。
    array = 246.0 - (246.0 - array) * 1.06
    image = Image.fromarray(np.clip(array, 0, 255).astype(np.uint8), mode="L")
    image = ImageEnhance.Contrast(image).enhance(profile["contrast"]).convert("RGB")
    jpeg_quality = profile.get("jpeg")
    if jpeg_quality:
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=int(jpeg_quality))
        buffer.seek(0)
        image = Image.open(buffer).convert("RGB")
    return image


def _render_twocol(font_path: str) -> Any:
    """双栏版面：左右两栏各自成句，OCR 按行切就会串栏。"""
    image = Image.new("L", (1240, 1754), 255)
    draw = ImageDraw.Draw(image)
    draw.text((120, 120), "合同要点", font=ImageFont.truetype(font_path, 36), fill=0)
    y = 220
    for line in ("甲方应按季度提交支出明细，", "并由财务部门复核签章。"):
        draw.text((120, y), line, font=ImageFont.truetype(font_path, 26), fill=0)
        y += 56
    y = 220
    for line in ("乙方负责系统运维与数据备份，", "故障响应不超过四小时。"):
        draw.text((650, y), line, font=ImageFont.truetype(font_path, 26), fill=0)
        y += 56
    image = image.rotate(1.0, resample=Image.Resampling.BICUBIC, fillcolor=250)
    image = image.filter(ImageFilter.GaussianBlur(0.7))
    array = np.asarray(image, dtype=np.float32)
    array = np.asarray(array + np.random.default_rng(7).normal(0.0, 10.0, array.shape), dtype=np.float32)
    array = 246.0 - (246.0 - array) * 1.06
    image = Image.fromarray(np.clip(array, 0, 255).astype(np.uint8), mode="L")
    return ImageEnhance.Contrast(image).enhance(0.88).convert("RGB")


def _keyword_hits(text: str) -> int:
    flat = _normalize(text)
    return sum(1 for word in KEYWORDS if _normalize(word) in flat)


def _probe_images(tmpdir: str, font_path: str, seeds: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for name, profile in PROFILES.items():
        cers: list[float] = []
        hits: list[int] = []
        elapsed: list[float] = []
        parser_seen = ""
        reasons: list[str] = []
        last_text = ""
        for seed in range(1, seeds + 1):
            image = _render(profile, font_path, seed=seed)
            path = os.path.join(tmpdir, f"{name}-{seed}.png")
            image.save(path, dpi=(150, 150))
            started = time.perf_counter()
            text, parser, reason = ocr_text.ocr_image(path)
            elapsed.append((time.perf_counter() - started) * 1000.0)
            parser_seen = parser
            if text is None:
                reasons.append(reason)
                cers.append(1.0)
                hits.append(0)
                continue
            last_text = text
            cers.append(_cer(REFERENCE, text))
            hits.append(_keyword_hits(text))
        ordered = sorted(cers)
        rows.append(
            {
                "case": name,
                "profile": profile,
                "parser": parser_seen,
                "reason": ";".join(sorted(set(reasons))) if reasons else "",
                "runs": seeds,
                "cer": {
                    "min": round(ordered[0], 4),
                    "median": round(ordered[len(ordered) // 2], 4),
                    "max": round(ordered[-1], 4),
                },
                "keyword_best": f"{max(hits)}/{len(KEYWORDS)}",
                "keyword_worst": f"{min(hits)}/{len(KEYWORDS)}",
                "ms_median": round(sorted(elapsed)[len(elapsed) // 2], 1),
                "text_head": last_text[:90],
            }
        )
    return rows


def _probe_twocol(tmpdir: str, font_path: str) -> dict[str, Any]:
    path = os.path.join(tmpdir, "twocol.png")
    _render_twocol(font_path).save(path, dpi=(150, 150))
    text, parser, reason = ocr_text.ocr_image(path)
    if text is None:
        return {"case": "twocol", "parser": parser, "reason": reason}
    flat = _normalize(text)
    return {
        "case": "twocol",
        "parser": parser,
        "left_intact": _normalize(LEFT_SENT) in flat,
        "right_intact": _normalize(RIGHT_SENT) in flat,
        "reading_order": [line for line in text.splitlines() if line.strip()][:6],
    }


def _probe_pdf(tmpdir: str, font_path: str) -> dict[str, Any]:
    """多页扫描件 PDF（整页位图合成，真无文本层）→ 栅格化 → 逐页 OCR。"""
    pages = [
        _render(PROFILES["scan-mild"], font_path, seed=1),
        _render(PROFILES["scan-tilt3-noise22"], font_path, seed=2),
    ]
    pdf_path = os.path.join(tmpdir, "scans.pdf")
    pages[0].save(pdf_path, save_all=True, append_images=pages[1:], resolution=150.0)
    started = time.perf_counter()
    text, parser, reason = ocr_text.ocr_pdf(pdf_path)
    elapsed = (time.perf_counter() - started) * 1000.0
    if text is None:
        return {"case": "pdf-2pages", "parser": parser, "reason": reason, "ms": round(elapsed, 1)}
    return {
        "case": "pdf-2pages",
        "parser": parser,
        "reason": reason,
        "ms": round(elapsed, 1),
        "cer": round(_cer(REFERENCE + REFERENCE, text), 4),
        "keyword_hits": f"{_keyword_hits(text)}/{len(KEYWORDS)}",
    }


def _probe_pipeline(tmpdir: str, corpus: str, font_path: str) -> dict[str, Any]:
    """端到端：登记 → 扫描 → 查询。证明"扫描件进得来、查得到"，不只是"单函数能识别"。"""
    os.makedirs(corpus, exist_ok=True)
    _render(PROFILES["scan-mild"], font_path, seed=1).save(
        os.path.join(corpus, "notice.png"), dpi=(150, 150)
    )
    _render(PROFILES["scan-tilt3-noise22"], font_path, seed=2).save(
        os.path.join(corpus, "notice-page.pdf"), resolution=150.0
    )
    service = Sag2LexicalService()
    ingestor = FolderIngest(service, state_path=os.path.join(tmpdir, "state.json"))
    registered = ingestor.register(corpus, include=[".png", ".pdf"])
    started = time.perf_counter()
    scan = ingestor.scan(corpus)
    scan_ms = (time.perf_counter() - started) * 1000.0
    queries: list[dict[str, Any]] = []
    for query in ("向量检索项目第三季度支出多少", "王工牵头的是哪个项目"):
        result = asyncio.run(service.retrieve(query)).to_dict()
        top = (result.get("results") or [{}])[0]
        queries.append(
            {
                "query": query,
                "status": result.get("status"),
                "top_path": os.path.basename(str(top.get("path", ""))),
                "top_score": top.get("score"),
            }
        )
    return {
        "registered": registered.get("registered"),
        "scan_ms": round(scan_ms, 1),
        "changed": scan.get("changed"),
        "failed": scan.get("failed"),
        "errors": scan.get("errors"),
        "queries": queries,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="SAG2 OCR 探针（退化样本 + 端到端）")
    parser.add_argument("--seeds", type=int, default=1, help="每个档位的随机种子数（>=3 给区间）")
    parser.add_argument("--json", default="", help="把结构化读数写到这个路径")
    parser.add_argument("--keep", default="", help="保留生成的样本到这个目录（默认临时目录，跑完即删）")
    args = parser.parse_args(argv)

    engines = ocr_text.available_engines()
    payload: dict[str, Any] = {
        "engines": list(engines),
        "caveats": list(CAVEATS),
        "reference_chars": len(_normalize(REFERENCE)),
        "images": [],
        "twocol": {},
        "pdf": {},
        "pipeline": {},
    }
    if not PIL_READY:
        print("no-pil: 生成样本需要 Pillow，当前环境未安装 —— 无法判定，不是失败")
        return 0
    if not engines:
        print(f"no-ocr-engine: {ocr_text.ocr_available().get('reason')}")
        print('提示：uv pip install -e ".[ocr]"（模型随包，无需 tesseract 二进制）')
        return 0

    font_path = _font_path(38)
    if font_path is None:
        print("no-cjk-font: 找不到可用的 CJK 字体，无法生成带标准答案的样本")
        return 0

    workdir = args.keep or tempfile.mkdtemp(prefix="sag2-ocr-probe-")
    os.makedirs(workdir, exist_ok=True)
    print(f"engines={list(engines)} font={font_path} workdir={workdir}")
    payload["images"] = _probe_images(workdir, font_path, max(1, args.seeds))
    for row in payload["images"]:
        print(
            f"{row['case']:<22} parser={row['parser']:<10} "
            f"CER={row['cer']['min']:.4f}/{row['cer']['median']:.4f}/{row['cer']['max']:.4f} "
            f"kw={row['keyword_worst']}-{row['keyword_best']} ms={row['ms_median']}"
        )
    payload["twocol"] = _probe_twocol(workdir, font_path)
    print(
        f"twocol left_intact={payload['twocol'].get('left_intact')} "
        f"right_intact={payload['twocol'].get('right_intact')}"
    )
    payload["pdf"] = _probe_pdf(workdir, font_path)
    print(f"pdf {payload['pdf']}")
    payload["pipeline"] = _probe_pipeline(workdir, os.path.join(workdir, "corpus"), font_path)
    print(f"pipeline {payload['pipeline']}")

    if args.json:
        target = os.path.abspath(args.json)
        os.makedirs(os.path.dirname(target) or ".", exist_ok=True)
        with open(target, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
        print(f"wrote {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
