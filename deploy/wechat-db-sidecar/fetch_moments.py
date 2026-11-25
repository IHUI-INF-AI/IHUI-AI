#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""微信 4.x 朋友圈本地库 sidecar（默认关闭，显式授权后由桥调用）。

只读边界：
- 通过可选依赖 `wechatauto-replica` 读取微信 4.x 本地 SQLCipher 库；
- 不写微信数据库、不发送消息、不点 UI、不截图；
- 输出 stdout JSON，由桥决定是否入库/展示；
- 依赖包不 vendor 进本仓，安装在独立 venv；本文件只做字段适配。

安全边界：会读取 Weixin.exe 进程内存中的数据库密钥。仅在本人授权账号、
本机离线环境使用；不得把输出上传到不受控服务。默认不启用。
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import os
import re
from typing import Any

# qpic 对过期/不可见票据返回的统一占位图，不能当真实图片写入。
PLACEHOLDER_SHA256 = '1b8214ac4449461450d94a808d42e658d6aaac13581554e6776a8e2b83d75125'


def _iso(ts: int) -> str | None:
    if not ts:
        return None
    try:
        return dt.datetime.fromtimestamp(int(ts), tz=dt.timezone.utc).isoformat()
    except Exception:
        return None


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _is_placeholder(data: bytes) -> bool:
    return hashlib.sha256(data).hexdigest() == PLACEHOLDER_SHA256


def _url_set(items: list[dict[str, Any]]) -> list[str]:
    out: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        url = html.unescape(_text(item.get("url")))
        if url and url not in out:
            out.append(url)
    return out


def _comment_rows(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        content = _text(item.get("content"))
        if not content:
            continue
        rows.append(
            {
                "username": _text(item.get("username")),
                "nickname": _text(item.get("nickname")),
                "content": content,
                "createTime": int(item.get("create_time") or 0) or None,
                "commentId": _text(item.get("comment_id")) or None,
                "refCommentId": _text(item.get("ref_comment_id")) or None,
            }
        )
    return rows


def _like_names(items: list[dict[str, Any]]) -> list[str]:
    names: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = _text(item.get("nickname")) or _text(item.get("username"))
        if name and name not in names:
            names.append(name)
    return names


def _like_ids(items: list[dict[str, Any]]) -> list[str]:
    ids: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        uid = _text(item.get("username"))
        if uid and uid not in ids:
            ids.append(uid)
    return ids


def _map_feed(feed: dict[str, Any]) -> dict[str, Any]:
    images = feed.get("images") if isinstance(feed.get("images"), list) else []
    videos = feed.get("videos") if isinstance(feed.get("videos"), list) else []
    likes = feed.get("likes") if isinstance(feed.get("likes"), list) else []
    comments = feed.get("comments") if isinstance(feed.get("comments"), list) else []

    media_urls = _url_set(images) + [u for u in _url_set(videos) if u not in _url_set(images)]
    media_entries = [
        {
            "kind": "image",
            "url": html.unescape(_text(item.get("url"))),
            "md5": _text(item.get("md5")),
            "width": int(item.get("width") or 0),
            "height": int(item.get("height") or 0),
            "size": int(item.get("size") or 0),
        }
        for item in images
        if isinstance(item, dict)
    ] + [
        {
            "kind": "video",
            "url": html.unescape(_text(item.get("url"))),
            "md5": _text(item.get("md5")),
            "width": int(item.get("width") or 0),
            "height": int(item.get("height") or 0),
            "size": int(item.get("size") or 0),
        }
        for item in videos
        if isinstance(item, dict)
    ]

    author_id = _text(feed.get("username")) or None
    author_name = _text(feed.get("nickname")) or _text(feed.get("username"))
    comments_rows = _comment_rows(comments)
    like_users = _like_names(likes)
    has_media = bool(media_urls or media_entries)
    has_likes = bool(like_users)
    has_comments = bool(comments_rows)

    fields = {
        "media": has_media,
        "likes": has_likes,
        "comments": has_comments,
        "authorIdentity": bool(author_id),
        "reason": None
        if has_media and has_likes and has_comments and author_id
        else "数据库路线：部分动态本身无图/无赞/无评论，按真实记录逐条标记",
    }

    return {
        "id": _text(feed.get("id")) or _text(feed.get("tid")) or "",
        "authorId": author_id,
        "authorName": author_name,
        "authorResolved": bool(author_id),
        "content": _text(feed.get("text")),
        "mediaUrls": media_urls,
        "media": media_entries,
        "imageCount": len(images),
        "videoCount": len(videos),
        "createdAt": int(feed.get("create_time") or 0) or None,
        "createdAtIso": _iso(int(feed.get("create_time") or 0)),
        "source": "db",
        "page": None,
        "likes": has_likes,
        "likeUsers": like_users,
        "likeUserIds": _like_ids(likes),
        "comments": has_comments,
        "commentsData": comments_rows,
        "commentTexts": [row["content"] for row in comments_rows],
        "fields": fields,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-dir", default=os.environ.get("BRIDGE_DB_DIR", ""))
    parser.add_argument("--account", default=os.environ.get("BRIDGE_DB_ACCOUNT", ""))
    parser.add_argument("--workdir", default=os.environ.get("BRIDGE_DB_WORKDIR", ""))
    parser.add_argument("--limit", type=int, default=int(os.environ.get("BRIDGE_DB_LIMIT", "0")))
    parser.add_argument("--media-dir", default=os.environ.get("BRIDGE_DB_MEDIA_DIR", ""))
    parser.add_argument("--download-media", action="store_true")
    parser.add_argument(
        "--local-cache-only",
        action="store_true",
        default=os.environ.get("BRIDGE_DB_MEDIA_LOCAL_ONLY") == "1",
        help="只导出微信本地 Sns 缓存命中，未命中不访问 qpic URL",
    )
    args = parser.parse_args()
    # 只读本地缓存本身就是导出媒体的一种模式：不强制用户再叠一个
    # --download-media，否则 BRIDGE_DB_MEDIA_LOCAL_ONLY=1 会静默不落盘。
    if args.local_cache_only:
        args.download_media = True

    try:
        from wechatauto import MomentDB, WeChatDB

        db_dir = args.db_dir.strip() or None
        account = args.account.strip() or None
        workdir = args.workdir.strip() or None
        if media_dir := (args.media_dir.strip() or None):
            os.makedirs(media_dir, exist_ok=True)
        db = WeChatDB(db_dir=db_dir, account=account, workdir=workdir)
        md = MomentDB(db)
        limit = max(0, int(args.limit))
        feeds = md.get_moments(limit=limit)
        moments = [_map_feed(feed) for feed in feeds]

        # 可选：从 qpic URL 拉取媒体；只写用户指定目录，不写微信目录。
        # URL 背后的票据可能已过期；qpic 返回 120x120「暂时无法查看」占位图时
        # 必须拒绝写盘，不能把占位图当成真实照片。
        downloaded = 0
        download_errors = 0
        cache_hits = 0
        cache_misses = 0
        if args.download_media and media_dir:
            import urllib.request

            for moment in moments:
                target = os.path.join(media_dir, re.sub(r"[^0-9A-Za-z._-]", "_", moment["id"]))
                downloaded_any = False
                for media in moment.get("media") or []:
                    url = media.get("url")
                    md5 = media.get("md5") or ""
                    ext = ".mp4" if media.get("kind") == "video" else ".jpg"
                    path = os.path.join(target, f"{md5 or 'media'}{ext}")
                    if os.path.exists(path) and md5:
                        try:
                            if _is_placeholder(open(path, "rb").read()):
                                os.remove(path)
                            else:
                                downloaded_any = True
                                downloaded += 1
                                cache_hits += 1
                                continue
                        except OSError:
                            pass
                    # 优先读微信本地 Sns 缓存：用户看过的图能绕过已过期 URL。
                    local = None
                    if md5:
                        try:
                            local = md.find_local_media(
                                md5,
                                "video" if media.get("kind") == "video" else "image",
                                size=int(media.get("size") or 0),
                                width=int(media.get("width") or 0),
                                height=int(media.get("height") or 0),
                            )
                        except Exception:
                            local = None
                    if local:
                        try:
                            data = md.decrypt_cache(local)
                            if data and not _is_placeholder(data):
                                os.makedirs(target, exist_ok=True)
                                with open(path, "wb") as fh:
                                    fh.write(data)
                                downloaded += 1
                                cache_hits += 1
                                downloaded_any = True
                                media["mediaDownloaded"] = True
                                media["mediaDownloadSource"] = "cache"
                                media["mediaLocalPath"] = path
                                continue
                        except Exception:
                            pass
                    if args.local_cache_only:
                        cache_misses += 1
                        media["mediaDownloadError"] = (
                            "本地 Sns 缓存未命中；local-cache-only 未发起 URL 下载"
                        )
                        continue
                    if not url:
                        download_errors += 1
                        continue
                    try:
                        req = urllib.request.Request(
                            url,
                            headers={
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0)",
                                "Referer": "https://szmmsns.qpic.cn/",
                            },
                        )
                        data = urllib.request.urlopen(req, timeout=20).read()
                        if not data or _is_placeholder(data):
                            download_errors += 1
                            continue
                        os.makedirs(target, exist_ok=True)
                        with open(path, "wb") as fh:
                            fh.write(data)
                        downloaded += 1
                        downloaded_any = True
                        media["mediaDownloaded"] = True
                        media["mediaDownloadSource"] = "qpic"
                        media["mediaLocalPath"] = path
                    except Exception:
                        download_errors += 1
                        continue
                if downloaded_any:
                    moment["mediaLocalDir"] = target
                    moment["mediaDownloaded"] = True
                elif moment.get("media"):
                    moment["mediaDownloadError"] = (
                        "本地 Sns 缓存未命中；local-cache-only 未发起 URL 下载"
                        if args.local_cache_only
                        else "本地缓存未命中且 qpic 票据过期/返回占位图，未写入本地"
                    )

        output = {
            "ok": True,
            "mode": "db",
            "driver": "db",
            "source": "db",
            "account": db.account,
            "wxid": db.wxid,
            "total": len(moments),
            "fetched": len(moments),
            "pages": 0,
            "maxPages": 0,
            "stopReason": "no-more-data",
            "limitReached": False,
            "occludedBy": None,
            "reason": "本地 sns.db 只读导出；图片/点赞/评论/作者身份来自数据库真实字段",
            "fields": {
                "media": any(m["fields"]["media"] for m in moments),
                "likes": any(m["fields"]["likes"] for m in moments),
                "comments": any(m["fields"]["comments"] for m in moments),
                "authorIdentity": any(m["fields"]["authorIdentity"] for m in moments),
                "reason": None,
            },
            "downloadMedia": bool(args.download_media and media_dir),
            "localCacheOnly": bool(args.local_cache_only),
            "downloadedMedia": downloaded,
            "mediaCacheHits": cache_hits,
            "mediaCacheMisses": cache_misses,
            "mediaDownloadErrors": download_errors,
            "moments": moments,
        }
        print(json.dumps(output, ensure_ascii=False, separators=(",", ":")))
        return 0
    except Exception as e:  # noqa: BLE001 - sidecar 边界：只返回真实错误，不伪造数据
        print(
            json.dumps(
                {
                    "ok": False,
                    "mode": "db",
                    "driver": "db",
                    "source": "db",
                    "stopReason": "error",
                    "reason": f"DB sidecar 失败：{type(e).__name__}: {e}",
                    "moments": [],
                },
                ensure_ascii=False,
            )
        )
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
