#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Gitee release 资产补齐(本机通道,2026-10-12 立):
CI 的 sync-gitee job 历史上只落地了 Windows 资产(0.1.50 实测 Gitee 仅 exe+sig),
macOS/Linux 安装包与签名包缺失 → 站点快照 resolve-desktop-download.mjs 的 gitee 优先
合并逻辑对这几件拿不到 Gitee 直链,下载页/更新 feed 只能回指 GitHub(国内直连被重置)。
本脚本把 GH release 缺失资产全量补到 Gitee release(幂等,同名跳过),补完后由
resolve-desktop-download.mjs 刷新快照即可让全平台下载走 Gitee。

  用法: python backfill-gitee-assets.py --tag desktop-v0.1.50 [--no-proxy] [--dry-run]
  下载: 默认走 gh-proxy.com 镜像(本机 GitHub release 直连被掐,2026-10-10 实证);
        --no-proxy 直连(海外机/代理正常时)。
  上传: 与 gitee-release-attach.py 同款 python urllib multipart(undici 401 教训同源)。
  临时落盘: .ihui-agent/tmp/backfill-gitee/(禁用 /tmp,Git Bash 下静默失败)。
环境变量: GITEE_TOKEN(必填;GITHUB_TOKEN 可选,仅用于提高 GH API 限流)
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

TOKEN = os.environ.get("GITEE_TOKEN", "")
GH_TOKEN = os.environ.get("GITHUB_TOKEN", "")
OWNER = os.environ.get("GITEE_OWNER", "JLSLSSZWHYXGS_0")
REPO = os.environ.get("GITEE_REPO", "IHUI-AI")
GH_REPO = os.environ.get("GITHUB_REPOSITORY", "IHUI-INF-AI/IHUI-AI")
PROXY_PREFIX = "https://gh-proxy.com/"
# 2026-10-12 修正:TMP_DIR 必须按 tag 分子目录 —— 旧实现全局平铺,而 tauri-action 的
# darwin 产物名(AI_universal.app.tar.gz / AI.app.tar.gz)不带版本号,0.1.50 的缓存
# 被 0.1.51 复用 ⇒ 错误内容传上 Gitee(签名对不上/旧包冒名,且 Gitee 同名直链永取
# 第一个、无法覆盖)。历史事故:0.1.51 补齐时两枚 darwin 包体 MISMATCH 实锤。
def tmp_dir_for(tag):
    return os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "..", "..", ".ihui-agent", "tmp", "backfill-gitee", tag)


def gh_api(path):
    req = urllib.request.Request(f"https://api.github.com{path}")
    if GH_TOKEN:
        req.add_header("Authorization", f"Bearer {GH_TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    return json.load(urllib.request.urlopen(req, timeout=60))


def gitee_api(p, method="GET", data=None):
    url = f"https://gitee.com/api/v5{p}"
    if method in ("GET", "POST"):
        url += ("&" if "?" in url else "?") + f"access_token={TOKEN}"
    req = urllib.request.Request(url, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode()
    try:
        r = urllib.request.urlopen(req, timeout=120)
        body = r.read().decode()
        return (json.loads(body) if body.strip() else None)
    except urllib.error.HTTPError as e:
        print(f"[gitee] {method} {p} -> {e.code}: {e.read().decode()[:200]}")
        return None


def gitee_upload(rid, filepath, filename):
    url = (f"https://gitee.com/api/v5/repos/{OWNER}/{REPO}"
           f"/releases/{rid}/attach_files?access_token={TOKEN}")
    boundary = "ihui" + str(int(time.time() * 1000))
    data = open(filepath, "rb").read()
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
            f"filename=\"{filename}\"\r\nContent-Type: application/octet-stream\r\n\r\n").encode() \
        + data + f"\r\n--{boundary}--\r\n".encode()
    # 2026-10-17 加重试(实测立因):原实现**一次就放弃**,于是 79MB 的 AppImage
    # 只要撞上一次写超时就整批失败 —— 实测 desktop-v0.1.75 的补齐就是这么挂的:
    #   TimeoutError: The write operation timed out
    #   urllib.error.URLError: <urlopen error The write operation timed out>
    # 而**这不是大小限制**:0.1.74 的同名 AssetImage 在 Gitee 上完整存在(82,901,496 字节,
    # 与 GitHub 逐字节同值)⇒ 79MB 是能传的,只是偶发写超时。
    # ⇒ 与 sync-gitee.py 的 gitee_upload 对齐:3 次指数退避,并如实回报失败。
    last = ""
    for attempt in range(1, 4):
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
        try:
            r = urllib.request.urlopen(req, timeout=1800)
            print(f"[gitee] 上传 {filename}: {r.status}")
            return True
        except urllib.error.HTTPError as e:
            last = f"{e.code} {e.read()[:150]}"
            print(f"[gitee] 上传 {filename} 第{attempt}/3次失败: {last}")
        except Exception as e:
            last = str(e)
            print(f"[gitee] 上传 {filename} 第{attempt}/3次异常: {e}")
        if attempt < 3:
            time.sleep(20 * attempt)
    print(f"[gitee] 上传 {filename} 最终失败: {last}")
    return False


def download(url, dest):
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(url, method="GET")
            r = urllib.request.urlopen(req, timeout=1800)
            tmp = dest + ".part"
            with open(tmp, "wb") as f:
                while True:
                    chunk = r.read(1 << 20)
                    if not chunk:
                        break
                    f.write(chunk)
            os.replace(tmp, dest)
            print(f"[dl] {os.path.basename(dest)}: {os.path.getsize(dest)} 字节")
            return True
        except Exception as e:
            print(f"[dl] {os.path.basename(dest)} 第{attempt}次失败: {e}")
            time.sleep(5)
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", required=True)
    ap.add_argument("--no-proxy", action="store_true", help="GitHub 下载不走 gh-proxy 镜像")
    ap.add_argument("--dry-run", action="store_true", help="只打印将补哪些资产,不下载不上传")
    ap.add_argument("--map", action="append", default=[],
                    help="上传改名:GH资产名=上传用名(可多次)。用于给 Gitee 上传"
                         "带版本号的新名副本(Gitee 同名直链永取第一个,坏件无法覆盖,"
                         "只能以新名上传正确内容并让快照指向新名)")
    args = ap.parse_args()
    if not TOKEN:
        sys.exit("ERROR: 缺 GITEE_TOKEN 环境变量")
    TMP_DIR = tmp_dir_for(args.tag)

    # 1. GH release 资产清单
    rel = gh_api(f"/repos/{GH_REPO}/releases/tags/{args.tag}")
    gh_assets = {a["name"]: a["browser_download_url"] for a in rel.get("assets", [])}
    print(f"[gh] {args.tag} 资产 {len(gh_assets)} 个")

    # 2. Gitee release(找/建)
    grel = gitee_api(f"/repos/{OWNER}/{REPO}/releases/tags/{args.tag}")
    if not grel or not grel.get("id"):
        if args.dry_run:
            sys.exit(f"[dry-run] Gitee 无 {args.tag} release,将需要创建")
        grel = gitee_api(f"/repos/{OWNER}/{REPO}/releases", "POST", {
            "tag_name": args.tag, "name": f"IHUI AI Desktop {args.tag}",
            "body": rel.get("body") or "Desktop bundles (Tauri 2)",
            "target_commitish": "main", "prerelease": False})
        if not grel or not grel.get("id"):
            sys.exit("Gitee release 创建失败")
    rid = grel["id"]
    have = {a["name"] for a in (grel.get("assets") or [])}
    print(f"[gitee] release id={rid},已有资产 {sorted(have)}")

    # 3. 计算缺失集(源码自动包 zip/tar.gz 不在 GH 资产里,不涉)
    # latest.json 刻意排除:GH 侧版本 url 全指 github.com,补到 Gitee 只会误导
    # (客户端更新端点是 aizhs.top 单端点,仓库快照才是真源,见 release-desktop 注释链)。
    missing = {n: u for n, u in gh_assets.items() if n not in have and n != "latest.json"}
    # --map 改名上传:目标名不在 Gitee 即视为缺失(源内容取 GH 同名资产)
    rename = {}
    for m in args.map:
        if "=" not in m:
            sys.exit(f"--map 形态错误(应为 GH资产名=上传用名): {m}")
        src, dst = m.split("=", 1)
        if src not in gh_assets:
            sys.exit(f"--map 源资产不在 GH release: {src}")
        rename[dst] = src
        if dst not in have:
            missing[dst] = gh_assets[src]
    if not missing:
        print("[done] Gitee 资产已齐,无需补")
        return
    if not missing:
        print("[done] Gitee 资产已齐,无需补")
        return
    print(f"[plan] 待补 {len(missing)} 个: {sorted(missing)}")
    if args.dry_run:
        return

    # 4. 下载缺失资产(gh-proxy 镜像,断点不续传但整文件 3 次重试)
    os.makedirs(TMP_DIR, exist_ok=True)
    local = {}
    for name, url in sorted(missing.items()):
        dest = os.path.join(TMP_DIR, name)
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            print(f"[dl] {name}: 沿用本地已有 ({os.path.getsize(dest)} 字节)")
        else:
            dl_url = url if args.no_proxy else PROXY_PREFIX + url
            if not download(dl_url, dest):
                sys.exit(f"下载失败,中止: {name}")
        local[name] = dest

    # 5. 上传 Gitee(local 的键即上传用名(--map 时为 dst 新名);同名跳过)
    #
    # 2026-10-17:原实现**不看返回值**,上传失败也照样往下走并以 0 退出 ——
    # 于是"缺了文件但 job 是绿的",下一次没人知道要补。现在收集失败清单,
    # 全部尽力后统一终验:有缺口就非零退出(重跑幂等补齐)。
    upload_failed = []
    for name, path in sorted(local.items()):
        if name in have:
            print(f"[gitee] {name} 已存在,跳过")
            continue
        if not gitee_upload(rid, path, name):
            upload_failed.append(name)
    if upload_failed:
        sys.exit(f"[gitee] 以下资产重试 3 次后仍上传失败: {sorted(upload_failed)}"
                 f"(重跑本 workflow 可幂等补齐)")
        have.add(name)
        time.sleep(2)
    print(f"[done] {args.tag} 补齐完成,当前 Gitee 资产 {len(have)} 个")


if __name__ == "__main__":
    main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
