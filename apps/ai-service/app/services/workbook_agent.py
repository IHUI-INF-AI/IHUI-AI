# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工作簿 agent 出口(2026-11-02 立,goal-b45 F 席)。

对标取证:`docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T8-sidecar-native-surface.md` §B
—— 对照件 Qoder 内置 `xlsx-sidecar.exe`(Rust,15,168 函数)把「工作簿」做成面向 agent 的
命令协议(14 枚命令,含 `save_archive` 写回 + `recalc_cells` 重算)。本仓这一格先补齐
**最小命令集 open / read_range / write_cells / close**(写回按非破坏式落新档),
`recalc_cells` 与 `convert_workbook` **未做** —— 原因与红线见下。

**判据零复制(AGENTS §0.6)**:归属、公式、形状三套判据全部住在
`apps/api/src/services/workbook-service.ts`,本模块只是它的 ai-service 客户端,
连一个 A1 正则都不在这里重写 —— 两份判据必然漂移,而漂移的那份永远是后来改的那份。

**跨端身份形态**(与 `knowledge_writer.py` 同族,但取其更严的那一格):
- 本席**不带** Bearer,统一走内部服务票:`app/core/internal_ticket.py:internal_service_headers`
  的唯一出口,scope 用既有封闭集里的 `"api-tools"`(`INTERNAL_TICKET_SCOPES` 两侧同笔、
  新增须两边改,本席不开新票种 —— 同 `tools/automation_tools.py:179` 的处置)。
- 主体 = 承载层注入的 `user_id`(MCP 侧的 `__user_id`),**body 里没有身份字段**:
  写入侧不许信客户端自报,读侧不许从工作簿内容/文件元数据反推主体(AGENTS §5 认证不等于授权)。
- 拿不到主体 ⇒ 一次请求都不发,具名 `PRINCIPAL_REQUIRED`(status=`refused`);有主体但一枚
  凭据都造不出来 ⇒ 同样一次不发,具名 `CREDENTIAL_UNAVAILABLE`(status=`unjudged`)。
  这两型合不起来:前者是"归属不明所以拒",后者是"本机没配钥匙"(原写法混成一团)。

**公式那一格的红线(本席最重要的一条)**:exceljs 无计算引擎,xlsx 里公式单元格带的是
上次存盘的缓存值。api 侧因此:① `read_range` 读到公式格**不回值**,只回 `state=
formula-uncomputed` + 公式原文;② 改动波及公式 ⇒ `recalcUnsupported=true`;
③ 目标格本身是公式 ⇒ 整批拒写(不把公式换成静态值)。本层把这三条**原样透传**,
不得在客户端"顺手补个值" —— 那正是 §0.3 说的「取不到真值拿旧值冒充」。

三态诚实(§0.3):失败信封的 `status` 只有两桶,且**不得折叠**:
- `unjudged` —— 上游/本层**没作出结论**:api 不可用(`UPSTREAM_UNAVAILABLE`)、
  根本没配凭据(`CREDENTIAL_UNAVAILABLE`)、2xx 但 data 壳不是对象
  (`UPSTREAM_REPLY_UNDETERMINED`)、句柄失效(`WORKBOOK_HANDLE_UNDETERMINED`)、
  原档字节读不到(`WORKBOOK_UNJUDGED`)。
- `refused` —— 上游**作出了否定结论**:归属不符、格式不支持、公式拒写、区域过大……
把前者折进后者 = 对外宣称"api 判过了",正是本仓最高频失效型。
归属不符 ⇒ 透传 api 的 404/403 具名码,不改写成"成功但空";
句柄失效 ⇒ 透传 `WORKBOOK_HANDLE_UNDETERMINED`,不猜它当时改了啥。
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

import httpx

from ..core.internal_ticket import (
    INTERNAL_TICKET_HEADER,
    INTERNAL_TOKEN_HEADER,
    internal_service_headers,
)

logger = logging.getLogger(__name__)

# 命令 → api 路径(与 routes/index.ts 的注册 prefix 合成;逐字对账锁在
# apps/api/tests/workbook-routes-registered.test.ts)
_COMMAND_PATHS: dict[str, str] = {
    "open": "/api/workbook/open",
    "read": "/api/workbook/read",
    "write": "/api/workbook/write",
    "save": "/api/workbook/save",
    "close": "/api/workbook/close",
}

_USER_ID_RE = re.compile(r"^[0-9a-fA-F-]{16,64}$")
_TIMEOUT_SECONDS = 30.0

# 「未判定」与「上游作出了否定结论」必须分桶(AGENTS §0.3:没判绝不写成判过)。
# 前两枚是 api 自己具名的未判定码(workbook-service.ts 的 fail(...)),后三枚是本客户端
# 自己造的未判定态。把它们折进 `refused` = 对外宣称"api 判过了",这正是本仓最高频失效型。
_UNJUDGED_CODES: frozenset[str] = frozenset(
    {
        "WORKBOOK_HANDLE_UNDETERMINED",
        "WORKBOOK_UNJUDGED",
        "UPSTREAM_UNAVAILABLE",
        "CREDENTIAL_UNAVAILABLE",
        "UPSTREAM_REPLY_UNDETERMINED",
    }
)


def api_base_url() -> str:
    """apps/api 基址:与 api_tools_bridge 同序(env 覆盖 → settings → 8802 兜底)。"""
    override = os.environ.get("API_INTERNAL_BASE_URL", "").strip() or os.environ.get(
        "API_SERVICE_URL", ""
    ).strip()
    if override:
        return override.rstrip("/")
    from ..core.config import settings

    return str(getattr(settings, "api_service_url", "http://localhost:8802")).rstrip("/")


def _secret() -> str:
    """内部通道常驻密钥(与兄弟模块同源;票签不出来时靠它走兼容窗)。"""
    return (
        os.environ.get("AI_CALLBACK_SECRET", "").strip()
        or os.environ.get("INTERNAL_SERVICE_TOKEN", "").strip()
    )


def outbound_headers(user_id: str | None) -> tuple[dict[str, str], str | None]:
    """(出站鉴权头, 阻断码):阻断码为 None 才允许发请求;头一律经 internal_ticket 唯一出口。

    "不发"有两型,必须具名分开(原先只有一枚 `internal_headers` 返回 `{}`,两型混成一团):
    - `PRINCIPAL_REQUIRED` —— 主体缺失/形态非法。这是**作出了结论**(拒)。
    - `CREDENTIAL_UNAVAILABLE` —— 票签不出、常驻密钥又为空。这时
      `internal_service_headers` 只会剩一枚 `x-user-id`:非空、但零凭据。原写法把它当
      "有头"发出去,api 回 401,客户端再读成 `HTTP_401`(像"这个人没权限"),而真问题是
      "本机没配凭据"—— 失效方向必须是多要一次定向说明,不是拿语义错码冒充判过(§0.3/§0.10)。
    """
    uid = str(user_id or "").strip()
    if not uid or not _USER_ID_RE.fullmatch(uid):
        return {}, "PRINCIPAL_REQUIRED"
    headers = internal_service_headers(uid, "api-tools", legacy_token=_secret())
    if INTERNAL_TICKET_HEADER not in headers and INTERNAL_TOKEN_HEADER not in headers:
        return {}, "CREDENTIAL_UNAVAILABLE"
    return headers, None


def _reject(
    code: str,
    message: str,
    http_status: int | None = None,
    detail: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """统一失败信封:`status` 按 code 分「未判定 / 拒了」两桶,调用方不得再折叠。"""
    out: dict[str, Any] = {
        "ok": False,
        "status": "unjudged" if code in _UNJUDGED_CODES else "refused",
        "errorCode": code,
        "error": message,
    }
    if http_status is not None:
        out["httpStatus"] = http_status
    if detail:
        out["detail"] = detail
    return out


_BLOCK_MESSAGES: dict[str, str] = {
    "PRINCIPAL_REQUIRED": "缺少宿主注入的调用者身份(__user_id):工作簿面必须归属到人",
    "CREDENTIAL_UNAVAILABLE": (
        "本进程签不出内部票且未配 AI_CALLBACK_SECRET/INTERNAL_SERVICE_TOKEN:"
        "一次请求都不发 ⇒ 未判定(不得把它读成'无权限',也不得读成'查过了')"
    ),
}


# api 侧在 detail 里带 `reason`(exceljs 抛出的原文)。那句话对运维有用,对模型没用,
# 而这条通道的收件人是模型 ⇒ 只投影结构位,原始异常文本不外泄(AGENTS 附条款「三面投影」)。
_DETAIL_DROP_KEYS: frozenset[str] = frozenset({"reason"})


def _project_detail(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    kept = {k: v for k, v in raw.items() if k not in _DETAIL_DROP_KEYS}
    return kept or None


class WorkbookAgent:
    """工作簿命令面的 ai-service 客户端(单例 workbook_agent)。"""

    async def _post(self, command: str, body: dict[str, Any], user_id: str | None) -> dict[str, Any]:
        path = _COMMAND_PATHS[command]
        headers, blocked = outbound_headers(user_id)
        if blocked is not None:
            return _reject(blocked, _BLOCK_MESSAGES[blocked])
        url = f"{api_base_url()}{path}"
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                resp = await client.post(url, headers=headers, json=body)
        except httpx.HTTPError as exc:
            logger.warning("workbook_agent 请求失败 %s: %s", path, exc)
            return _reject(
                "UPSTREAM_UNAVAILABLE",
                f"apps/api 不可达({type(exc).__name__}):本次 {command} 结果未确认,不得当作已执行",
            )
        try:
            payload: Any = resp.json() if resp.content else {}
        except ValueError:
            payload = {}
        if resp.status_code >= 400:
            # api 侧具名错误码原样透传,不改写、不降级成"成功但空"
            payload_map = payload if isinstance(payload, dict) else {}
            code = str(payload_map.get("errorCode") or f"HTTP_{resp.status_code}")
            message = str(
                payload_map.get("message") or f"api 返回 HTTP {resp.status_code}(回体不是 JSON:未判定)"
            )
            return _reject(code, message, resp.status_code, _project_detail(payload_map.get("detail")))
        # 成功面的 data **必须是对象**:拿不到就明写未判定。
        # 原来这里写 `data if isinstance(data, dict) else {}`,于是读回一个空 cells 列表,
        # 上层把"没拿到壳"当成"这个区域是空的"—— §0.3 禁的正是这一型(用空结果冒充查过了)。
        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            return _reject(
                "UPSTREAM_REPLY_UNDETERMINED",
                f"apps/api 的 {command} 回 2xx 但 data 不是对象:无法判定本次读到什么 ⇒ 未判定",
                resp.status_code,
            )
        return {"ok": True, "status": "ok", "data": data}

    async def open_workbook(self, *, file_id: str, user_id: str | None) -> dict[str, Any]:
        """open:打开**已存在**的工作簿(按 api 侧 storage 文件 id)。"""
        fid = str(file_id or "").strip()
        if not fid:
            return _reject("MISSING_PARAMS", "缺少 file_id(工作簿必须是已存在的文件 id)")
        out = await self._post("open", {"fileId": fid}, user_id)
        if not out["ok"]:
            return out
        data = out["data"]
        return {
            "ok": True,
            "status": "ok",
            "handle": data.get("handle"),
            # fileId 由 api 侧回(OpenWorkbookData.fileId):句柄到底绑的是哪份档,
            # 必须由上游说出来、由调用方核,而不是让上层拿"我刚传了什么"当凭据。
            "fileId": data.get("fileId"),
            "name": data.get("name"),
            "sha256": data.get("sha256"),
            "sheets": data.get("sheets"),
            "formulaCellCount": data.get("formulaCellCount"),
            "hasFormulas": data.get("hasFormulas"),
            "formulaScanTruncated": data.get("formulaScanTruncated"),
            "protocolVersion": data.get("protocolVersion"),
            "note": (
                "公式单元格只回公式原文不回当前值;本面无公式重算(recalc 未实现)。"
                if data.get("hasFormulas")
                else "本工作簿未检出公式。"
            ),
        }

    async def read_range(
        self, *, handle: str, sheet: str, cell_range: str, user_id: str | None
    ) -> dict[str, Any]:
        """read_range:按 A1 形态区域回格;公式格的值由 api 侧扣住,本层不补。"""
        missing = [
            k
            for k, v in (("handle", handle), ("sheet", sheet), ("range", cell_range))
            if not str(v or "").strip()
        ]
        if missing:
            return _reject("MISSING_PARAMS", f"缺少必填参数: {', '.join(missing)}")
        out = await self._post(
            "read",
            {
                "handle": str(handle).strip(),
                "sheet": str(sheet),
                "range": str(cell_range).strip(),
            },
            user_id,
        )
        if not out["ok"]:
            return out
        data = out["data"]
        cells = data.get("cells") if isinstance(data.get("cells"), list) else []
        return {
            "ok": True,
            "status": "ok",
            "sheet": data.get("sheet"),
            "range": data.get("range"),
            "cellCount": data.get("cellCount"),
            "formulaCellCount": data.get("formulaCellCount"),
            "cells": cells,
            "protocolVersion": data.get("protocolVersion"),
        }

    async def write_cells(
        self,
        *,
        handle: str,
        sheet: str,
        cells: Any,
        user_id: str | None,
        name: str | None = None,
    ) -> dict[str, Any]:
        """write_cells:写格 + **立即非破坏式落新档**(write 之后 save,不留"改了没存"的悬态)。

        拒写形态由 api 单源给出:目标格是公式 ⇒ 整批拒(`WORKBOOK_FORMULA_OVERWRITE`);
        改动波及公式 ⇒ `recalcUnsupported` 原样透传,不改写、不补数。

        `cells` 刻意收 `Any`(形状判据住在 api,本层只做**能否定形**这一格):原写法由承载层
        先把非数组折成 `[]` 再传进来,于是"模型给了个对象"被报成"cells 不能为空"——
        结论是另一种,修的方向也就被带偏了(§0.3:没判/判不成形的绝不写成别的结论)。
        """
        missing = [k for k, v in (("handle", handle), ("sheet", sheet)) if not str(v or "").strip()]
        if missing:
            return _reject("MISSING_PARAMS", f"缺少必填参数: {', '.join(missing)}")
        if not isinstance(cells, list):
            return _reject(
                "WORKBOOK_INVALID_INPUT",
                f"cells 必须是数组 [{ '{address, value}' }],本次收到 {type(cells).__name__}"
                "(未发出任何请求;形状判据单源在 apps/api)",
            )
        if not cells:
            return _reject(
                "MISSING_PARAMS",
                "cells 必须是非空数组:[{address, value}](形状与合法性由 api 侧单源判)",
            )
        write = await self._post(
            "write",
            {"handle": str(handle).strip(), "sheet": str(sheet), "cells": cells},
            user_id,
        )
        if not write["ok"]:
            return write
        wdata = write["data"]

        save = await self._post(
            "save",
            {
                "handle": str(handle).strip(),
                **({"name": str(name).strip()} if str(name or "").strip() else {}),
            },
            user_id,
        )
        if not save["ok"]:
            # 写进了内存模型但新档没落:必须明说,不得把半边成功报成整单成功
            return {
                "ok": False,
                "status": save.get("status", "refused"),
                "subStatus": "written_not_saved",
                "errorCode": save.get("errorCode", "SAVE_FAILED"),
                "error": f"已写入会话模型(未落新档):{save.get('error')}",
                "writtenCells": wdata.get("writtenCells"),
                "recalcUnsupported": wdata.get("recalcUnsupported"),
                "staleFormulaCells": wdata.get("staleFormulaCells"),
                "hasFormulas": wdata.get("hasFormulas"),
                "formulaScanTruncated": wdata.get("formulaScanTruncated"),
            }
        sdata = save["data"]
        return {
            "ok": True,
            "status": "ok",
            "writtenCells": wdata.get("writtenCells"),
            "savedFileId": sdata.get("savedFileId"),
            "savedName": sdata.get("name"),
            "savedBytes": sdata.get("bytes"),
            "sourceFileId": sdata.get("sourceFileId"),
            # 非破坏式的**凭据**在原档前后两次 sha(api 侧 SaveWorkbookData 本来就回这三键);
            # 只回一个 sourceUntouched=true 等于让调用方信客户端自报 —— 原样搬出来才可核。
            "sourceSha256Before": sdata.get("sourceSha256Before"),
            "sourceSha256After": sdata.get("sourceSha256After"),
            "sourceUntouched": sdata.get("sourceUntouched"),
            "recalcUnsupported": sdata.get("recalcUnsupported"),
            "staleFormulaCells": sdata.get("staleFormulaCells"),
            "hasFormulas": sdata.get("hasFormulas"),
            "formulaScanTruncated": sdata.get("formulaScanTruncated"),
            "protocolVersion": sdata.get("protocolVersion"),
            "note": (
                "原档未被覆盖,改动落在 savedFileId 这份**新档**;"
                "若 recalcUnsupported=true,列出的公式格**没有重算**,读到的仍是旧缓存。"
            ),
        }

    async def close_workbook(self, *, handle: str, user_id: str | None) -> dict[str, Any]:
        """close:释放会话。之后再拿这个句柄一律「未判定」,不猜它当时改了啥。"""
        if not str(handle or "").strip():
            return _reject("MISSING_PARAMS", "缺少 handle")
        out = await self._post("close", {"handle": str(handle).strip()}, user_id)
        if not out["ok"]:
            return out
        data = out["data"]
        return {
            "ok": True,
            "status": "closed",
            "closed": data.get("closed"),
            "savedFileIds": data.get("savedFileIds"),
            "protocolVersion": data.get("protocolVersion"),
        }


workbook_agent = WorkbookAgent()

__test__ = {
    "outbound_headers": outbound_headers,
    "reject": _reject,
    "unjudged_codes": _UNJUDGED_CODES,
    "command_paths": _COMMAND_PATHS,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
