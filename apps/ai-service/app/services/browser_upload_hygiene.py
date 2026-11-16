# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器文件上传卫生 — 复现 Codex 26.1111 file uploads (file chooser 流)。

取证来源
--------
``.ihui-agent/tmp/goal-codex-r11/cua-browser-safety-and-tab-lifecycle.md`` §G::

    const chooserPromise = tab.playwright.waitForEvent("filechooser", { timeout: 10000 });
    await tab.playwright.locator('input[type="file"]').click();
    const chooser = await chooserPromise;
    await chooser.setFiles(["/absolute/path/to/file.txt"]);

    - 点文件输入/上传控件**前**就起 waitForEvent("filechooser")。
    - 有 input[type="file"] 优先用;只有当可见按钮/label 会打开 chooser 才点它。
    - setFiles 用**绝对路径**;多文件前用 chooser.isMultiple()。
    - **不要**找 locator.setInputFiles(...)(上传经 chooser 对象暴露)。
    - 先走 file chooser 流,再考虑回退 native picker。

对照 IHUI 缺口
--------------
``browser_file_delivery`` 只做**下载侧**交付卫生(下载判定 + 5s 轮询),
未覆盖**上传侧** file chooser 流卫生:
  - 点击前未预置 waitForEvent("filechooser") 会漏事件、悬死等 10s 超时;
  - 误用 locator.setInputFiles(...)(Codex 明令禁,上传经 chooser 暴露);
  - 多文件未先 isMultiple() 校验、相对路径未归一;
  - 回退 native picker 的顺序(先 chooser、后 native)。

设计要点(纯函数,零 IO)
------------------------
1. ``prearm_file_chooser``:点击前须先挂 waitForEvent → 预置/漏挂判定;
2. ``select_upload_control``:优先 input[type=file],可见按钮/label 仅当打开 chooser;
3. ``validate_upload_files``:绝对路径 + isMultiple + 非空 → setFiles 参数卫生;
4. ``choose_upload_api``:禁 setInputFiles,须走 chooser.setFiles;
5. ``plan_upload_fallback``:先 file chooser,后 native picker(升级顺序)。

与既有层关系
--------------
- ``browser_file_delivery``:下载侧;本模块补**上传侧** chooser 流卫生;
- ``interaction_tier`` / ``repl_discipline``:交互层级/REPL 纪律;本模块管上传专用序列;
- 调用方据判定决定实际 waitForEvent/点击/setFiles(本模块不真开浏览器)。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

# ── file chooser 预置 ──────────────────────────────────────────────────────


class ChooserPrearm(StrEnum):
    """点击前 waitForEvent("filechooser") 的预置状态。"""

    PREARMED = "prearmed"  # 点击前已挂事件
    NOT_PREARMED = "not_prearmed"  # 点击前未挂(会漏事件/悬死超时)


@dataclass(frozen=True)
class ChooserPrearmDecision:
    """file chooser 预置判定。"""

    state: str  # ``ChooserPrearm`` 之一
    allowed_to_click: bool
    detail: str


def prearm_file_chooser(*, event_armed_before_click: bool) -> ChooserPrearmDecision:
    """点击上传控件前须先挂 waitForEvent("filechooser")(纯函数)。

    Codex §G:"点文件输入/上传控件**前**就起 waitForEvent('filechooser')"。
    未预置则漏事件、悬死等超时。
    """
    if event_armed_before_click:
        return ChooserPrearmDecision(
            ChooserPrearm.PREARMED.value,
            True,
            "点击前已挂 waitForEvent('filechooser'):点击后可即时拿到 chooser 对象。",
        )
    return ChooserPrearmDecision(
        ChooserPrearm.NOT_PREARMED.value,
        False,
        "点击前未挂 waitForEvent('filechooser'):会漏事件、悬死等超时。先挂事件再点击。",
    )


# ── 上传控件选择 ───────────────────────────────────────────────────────────


class UploadControl(StrEnum):
    """上传控件选择顺序。"""

    INPUT_FILE = "input_file"  # input[type=file](优先)
    VISIBLE_OPENS_CHOOSER = "visible_opens_chooser"  # 可见按钮/label(仅当打开 chooser)
    NOT_AN_UPLOAD_TRIGGER = "not_upload_trigger"  # 不打开 chooser 的控件(不可点)


@dataclass(frozen=True)
class UploadControlDecision:
    """上传控件选择判定。"""

    control: str  # ``UploadControl`` 之一
    should_click: bool
    detail: str


def select_upload_control(
    *,
    has_input_file: bool,
    visible_control_opens_chooser: bool = False,
) -> UploadControlDecision:
    """上传控件选择:优先 input[type=file];可见控件仅当打开 chooser(纯函数)。

    Codex §G:"有 input[type='file'] 优先用;只有当可见按钮/label 会打开 chooser 才点它。"
    """
    if has_input_file:
        return UploadControlDecision(
            UploadControl.INPUT_FILE.value,
            True,
            "有 input[type='file']:优先点它(最可靠,直接触发 chooser)。",
        )
    if visible_control_opens_chooser:
        return UploadControlDecision(
            UploadControl.VISIBLE_OPENS_CHOOSER.value,
            True,
            "无 input[type=file],可见按钮/label 会打开 chooser:可点它(先挂 waitForEvent)。",
        )
    return UploadControlDecision(
        UploadControl.NOT_AN_UPLOAD_TRIGGER.value,
        False,
        "无 input[type=file] 且可见控件不打开 chooser:不可点,先找真正触发 chooser 的控件。",
    )


# ── setFiles 参数卫生 ──────────────────────────────────────────────────────


class UploadFilesError(StrEnum):
    """setFiles 参数卫生错误分类。"""

    OK = "ok"  # 通过
    NOT_ABSOLUTE = "not_absolute"  # 相对路径(须绝对路径)
    EMPTY = "empty"  # 空文件列表
    TOO_MANY_WITHOUT_MULTI = "too_many_without_multi"  # 多文件但 isMultiple 为 False


@dataclass(frozen=True)
class UploadFilesDecision:
    """setFiles 参数卫生判定。"""

    status: str  # ``UploadFilesError`` 之一
    valid_paths: tuple[str, ...]
    error_detail: str | None


def validate_upload_files(
    paths: list[str],
    *,
    is_multiple: bool,
) -> UploadFilesDecision:
    """setFiles 参数卫生:绝对路径 + isMultiple + 非空(纯函数)。

    Codex §G:"setFiles 用**绝对路径**;多文件前用 chooser.isMultiple()。"
    """
    if not paths:
        return UploadFilesDecision(UploadFilesError.EMPTY.value, (), "文件列表为空:不调 setFiles。")
    bad = [p for p in paths if not (len(p) >= 3 and p[1:3] in (":\\", ":/") or p.startswith("/"))]
    if bad:
        return UploadFilesDecision(
            UploadFilesError.NOT_ABSOLUTE.value,
            (),
            f"含相对路径 {bad!r}:setFiles 须绝对路径。",
        )
    if len(paths) > 1 and not is_multiple:
        return UploadFilesDecision(
            UploadFilesError.TOO_MANY_WITHOUT_MULTI.value,
            (),
            f"传 {len(paths)} 个文件但 chooser.isMultiple() 为 False:先校验 isMultiple 再传。",
        )
    return UploadFilesDecision(
        UploadFilesError.OK.value,
        tuple(paths),
        f"setFiles 参数卫生通过({len(paths)} 个绝对路径,isMultiple={is_multiple})。",
    )


# ── 上传 API 选择 ──────────────────────────────────────────────────────────


class UploadApi(StrEnum):
    """上传 API 选择(chooser 对象暴露,禁 setInputFiles)。"""

    CHOOSER_SET_FILES = "chooser_set_files"  # chooser.setFiles(正确)
    LOCATOR_SET_INPUT_FILES = "locator_set_input_files"  # locator.setInputFiles(违规)


@dataclass(frozen=True)
class UploadApiDecision:
    """上传 API 选择判定。"""

    api: str  # ``UploadApi`` 之一
    allowed: bool
    detail: str


def choose_upload_api(*, use_locator_set_input_files: bool) -> UploadApiDecision:
    """上传经 chooser 对象暴露,禁 locator.setInputFiles(纯函数)。

    Codex §G:"**不要**找 locator.setInputFiles(...)(上传经 chooser 对象暴露)。"
    """
    if use_locator_set_input_files:
        return UploadApiDecision(
            UploadApi.LOCATOR_SET_INPUT_FILES.value,
            False,
            "locator.setInputFiles(...) 违规:上传经 chooser 对象暴露,须用 chooser.setFiles。",
        )
    return UploadApiDecision(
        UploadApi.CHOOSER_SET_FILES.value,
        True,
        "chooser.setFiles([...]):正确的上传 API。",
    )


# ── 上传回退顺序 ───────────────────────────────────────────────────────────


class UploadFallback(StrEnum):
    """上传回退升级顺序(先 chooser,后 native)。"""

    FILE_CHOOSER = "file_chooser"  # 先走 file chooser 流
    NATIVE_PICKER = "native_picker"  # chooser 失败才回退 native


@dataclass(frozen=True)
class UploadFallbackDecision:
    """上传回退顺序判定。"""

    path: str  # ``UploadFallback`` 之一
    detail: str


def plan_upload_fallback(*, chooser_failed: bool) -> UploadFallbackDecision:
    """上传升级顺序:先 file chooser,后 native picker(纯函数)。

    Codex §G:"先走 file chooser 流,再考虑回退 native picker。"
    """
    if chooser_failed:
        return UploadFallbackDecision(
            UploadFallback.NATIVE_PICKER.value,
            "file chooser 流失败:可回退 native picker(升级顺序在 chooser 之后)。",
        )
    return UploadFallbackDecision(
        UploadFallback.FILE_CHOOSER.value,
        "先走 file chooser 流(优先),未失败不回退 native picker。",
    )


__all__ = [
    "ChooserPrearm",
    "ChooserPrearmDecision",
    "prearm_file_chooser",
    "UploadControl",
    "UploadControlDecision",
    "select_upload_control",
    "UploadFilesError",
    "UploadFilesDecision",
    "validate_upload_files",
    "UploadApi",
    "UploadApiDecision",
    "choose_upload_api",
    "UploadFallback",
    "UploadFallbackDecision",
    "plan_upload_fallback",
]
