# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器文件/下载交付卫生 — 统一实现 26.1111 cloud-shared-files + file uploads。

设计依据
--------
``内部规格``
§F(云共享文件)/ §G(File Uploads),明文按行为规格::

    交付文件:截图/下载/PDF/导出放共享目录;回复前轮询最多 5 秒等出现非空
      匹配文件。链接用 Markdown;截图内联 ![...](sandbox:...)。
    点击触发的下载:点击前起 waitForEvent("download"),完成后用返回 path,
      不猜文件名;path() 为 null 视为下载失败、不返回文件链接。
    截图:默认当前 viewport;只截一次,保存同一 JPEG 字节,唯一安全 .jpg 名;
      写盘 { mode: 0o600 }。
    禁:手动容器间传输命令、把文件写非共享目录、base64/data URL 编码文件、
      复用 emitImage 链接、同步未完成时重截/重下。5 秒后仍缺失/空 → 省略坏
      链接,保留有用结果,告知用户文件无法附上。

对照 IHUI 缺口
--------------
- browser_hub 无下载处理(grep download/file_chooser 全无);
- 无"交付前轮询 + 5 秒上限""path null 视失败""禁 base64/重截/重下"的可判定
  卫生规范。

设计要点(纯函数,零 IO)
------------------------
1. **下载结果判定** ``classify_download``:path 非空=成功;path null/空=失败
   (不返回链接);点击前必须先起 waitForEvent,否则判"未前置监听";
2. **交付轮询** ``poll_until_settled``:最多 5 秒等非空匹配文件;超时仍缺失/空
   → 省略坏链接(不猜文件名);
3. **截图交付卫生** ``check_screenshot_hygiene``:单次截图/唯一 .jpg 名/mode
   0600/内联走 Markdown;复用旧链接/重截/emitImage 当最终答复链接 = 违规;
4. **禁用编码** ``is_forbidden_encoding``:base64/data URL 编码文件 = 拒。

与既有层的关系
--------------
- 只做"交付卫生判定",不真下载/真写盘(那是 browser_hub / screenshot_service);
  调用方据判定决定实际落盘/返回链接;
- 与 ``browser_proof_of_work``(截图内嵌闸)、``browser_tab_lifecycle``(页面存活)
  互补:本模块守"文件交付的可判定健壮细节"。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class DownloadOutcome(StrEnum):
    """一次下载的判定结果(Codex:path null = 失败,不返回链接)。"""

    SUCCESS = "success"  # path 非空,用返回 path
    FAILED_NULL_PATH = "failed_null_path"  # path null/空 = 失败,不返回链接
    NOT_PREARMED = "not_prearmed"  # 点击前未起 waitForEvent("download")


# 交付轮询上限(Codex:最多 5 秒)
POLL_TIMEOUT_SECONDS = 5.0


@dataclass(frozen=True)
class DownloadDecision:
    """一次下载的处置决策。"""

    outcome: str  # ``DownloadOutcome`` 之一
    should_return_link: bool  # 是否应向用户返回文件链接
    detail: str


def classify_download(
    *,
    prearmed_wait: bool,
    download_path: str | None,
) -> DownloadDecision:
    """判定一次点击触发的下载(纯函数)。

    参数:
        prearmed_wait: 点击前是否已起 waitForEvent("download")。
        download_path: 下载完成返回的 path(None/空 = 失败)。
    """
    if not prearmed_wait:
        return DownloadDecision(
            outcome=DownloadOutcome.NOT_PREARMED.value,
            should_return_link=False,
            detail=(
                "点击触发的下载须在点击前起 waitForEvent('download');"
                "未前置监听会竞态丢事件,本次不返回链接。"
            ),
        )
    if not download_path or not str(download_path).strip():
        return DownloadDecision(
            outcome=DownloadOutcome.FAILED_NULL_PATH.value,
            should_return_link=False,
            detail="下载 path 为 null/空:视为下载失败,不返回文件链接、不猜文件名。",
        )
    return DownloadDecision(
        outcome=DownloadOutcome.SUCCESS.value,
        should_return_link=True,
        detail=f"下载成功,用返回 path(不猜文件名):{download_path}",
    )


@dataclass(frozen=True)
class PollOutcome:
    """交付轮询结果(Codex:最多 5 秒,超时仍缺失/空 → 省略坏链接)。"""

    settled: bool  # 是否在时限内等到非空匹配文件
    elapsed_seconds: float
    should_omit_link: bool  # 超时是否应省略坏链接
    detail: str


def poll_until_settled(
    *,
    matched_file_size: int | None,
    elapsed_seconds: float,
    timeout_seconds: float = POLL_TIMEOUT_SECONDS,
) -> PollOutcome:
    """判定一次交付轮询(纯函数):非空匹配文件出现即 settled。

    参数:
        matched_file_size: 匹配文件的字节数(None = 未出现;0 = 空,不算)。
        elapsed_seconds: 已轮询秒数。
        timeout_seconds: 上限(默认 5 秒)。
    """
    nonempty = matched_file_size is not None and matched_file_size > 0
    if nonempty:
        return PollOutcome(
            settled=True,
            elapsed_seconds=elapsed_seconds,
            should_omit_link=False,
            detail="非空匹配文件已出现,可返回链接。",
        )
    if elapsed_seconds >= timeout_seconds:
        return PollOutcome(
            settled=False,
            elapsed_seconds=elapsed_seconds,
            should_omit_link=True,
            detail=(
                f"轮询 {timeout_seconds} 秒后仍缺失/空:省略坏链接,保留有用结果,"
                "告知用户文件无法附上。"
            ),
        )
    return PollOutcome(
        settled=False,
        elapsed_seconds=elapsed_seconds,
        should_omit_link=False,
        detail="文件尚未出现且未超时,继续轮询(最多 5 秒)。",
    )


# ── 截图交付卫生(Codex §F) ─────────────────────────────────────────────────


class ScreenshotViolation(StrEnum):
    """截图交付违规项(Codex 禁用清单)。"""

    REUSED_LINK = "reused_link"  # 复用旧 emitImage 链接当最终答复链接
    RE_Screenshot = "re_screenshot"  # 同步未完成时重截
    BASE64_ENCODED = "base64_encoded"  # base64/data URL 编码文件
    NOT_SINGLE_JPEG = "not_single_jpeg"  # 未保存同一 JPEG 字节/非唯一 .jpg 名
    WRONG_MODE = "wrong_mode"  # 未以 mode 0o600 写盘


VIOLATIONS: tuple[str, ...] = tuple(v.value for v in ScreenshotViolation)


@dataclass(frozen=True)
class ScreenshotHygiene:
    """一次截图交付的卫生检查结果。"""

    ok: bool
    violations: tuple[str, ...]
    detail: str


def check_screenshot_hygiene(
    *,
    is_single_shot: bool,
    is_jpeg_unique_name: bool,
    file_mode: int | None,
    is_emitimage_final_link: bool,
    reused_old_link: bool,
    encoded_base64: bool,
    sync_complete: bool = True,
) -> ScreenshotHygiene:
    """检查一次截图交付是否合规(Codex §F 禁用清单,纯函数)。

    合规:只截一次 / 唯一安全 .jpg 名 / mode 0o600 / 内联走 Markdown /
    不复用 emitImage 链接 / 不 base64 编码 / 同步完成后不再重截。
    """
    v: list[str] = []
    if not is_single_shot:
        v.append(ScreenshotViolation.RE_Screenshot.value)
    if not is_jpeg_unique_name:
        v.append(ScreenshotViolation.NOT_SINGLE_JPEG.value)
    if file_mode is None or file_mode != 0o600:
        v.append(ScreenshotViolation.WRONG_MODE.value)
    if is_emitimage_final_link:
        v.append(ScreenshotViolation.REUSED_LINK.value)
    if reused_old_link:
        v.append(ScreenshotViolation.REUSED_LINK.value)
    if encoded_base64:
        v.append(ScreenshotViolation.BASE64_ENCODED.value)
    if not sync_complete:
        v.append(ScreenshotViolation.RE_Screenshot.value)
    if v:
        return ScreenshotHygiene(
            ok=False,
            violations=tuple(dict.fromkeys(v)),
            detail=f"截图交付违规: {'; '.join(v)}。",
        )
    return ScreenshotHygiene(
        ok=True,
        violations=(),
        detail="截图交付合规:单次/唯一 .jpg/mode 0600/内联 Markdown/无违规编码。",
    )


def is_forbidden_encoding(method: str) -> bool:
    """判定文件交付方式是否属禁用编码(Codex:禁 base64/data URL 编码文件)。"""
    key = (method or "").strip().lower()
    return key in {"base64", "data_url", "dataurl", "data-uri", "data_uri"}


__all__ = [
    "DownloadOutcome",
    "POLL_TIMEOUT_SECONDS",
    "DownloadDecision",
    "classify_download",
    "PollOutcome",
    "poll_until_settled",
    "ScreenshotViolation",
    "VIOLATIONS",
    "ScreenshotHygiene",
    "check_screenshot_hygiene",
    "is_forbidden_encoding",
]
