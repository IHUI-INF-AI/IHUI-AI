#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
"""release-desktop 的 Gitee 同步 job(2026-09-17 立):
1. 从 GitHub release(desktop-v*) 下载全平台安装包/更新签名
2. 找/建 Gitee 同名 release 并逐资产上传(同名跳过,幂等)
3. 生成 latest.json(url 全部指向 Gitee 直链,国内下载快)并更新 desktop-feed 分支
   → 更新器第一端点 https://gitee.com/<owner>/IHUI-AI/raw/desktop-feed/latest.json
环境变量:GITEE_TOKEN / GITEE_OWNER / TAG / GH_TOKEN / GITHUB_REPOSITORY
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

GH_TOKEN = os.environ["GH_TOKEN"]
GITEE_TOKEN = os.environ["GITEE_TOKEN"]
GITEE_OWNER = os.environ["GITEE_OWNER"]
TAG = os.environ["TAG"]
GH_REPO = os.environ["GITHUB_REPOSITORY"]
GITEE_REPO = "IHUI-AI"

# Gitee Release 附件的单文件硬上限(2026-10-17 实测实证:超限直接 400
#   {"message":"验证失败：文件大小已超出限制：100 MB"})。
# 这不是偶发故障、也不是 token 问题:桌面端自 0.1.68 起 webviewInstallMode 用
# offlineInstaller 内嵌 WebView2 运行时,Windows 安装包从 ~8MB 涨到 ~225MB,
# 于是「AI_x.y.z_x64-setup.exe」**结构性永远**传不上 Gitee。
# 后果:原实现把它计入 upload_failed ⇒ sys.exit(1) ⇒ 每次桌面发版该 job 恒红
# (AGENTS.md §12e 恒红门:与提交内容无关的红会逼人 --no-verify、连带废掉守门)。
# 而该 job 对用户零影响——Gitee 侧只是附件存档,**不是**更新器端点(见本文件末尾
# 第 5 节:客户端只认 aizhs.top 单端点)。故超限资产按「预期跳过」处理:不下载、
# 不重试、不记红,也不写进 feed(避免给出下载不了的地址)。
GITEE_ATTACH_LIMIT_BYTES = 100 * 1024 * 1024

# 2026-10-12:模块级 PLATFORM_MAP 已删除 —— 旧映射后缀与 tauri-action 实际产物名
# 对不上(两次实锤 mac/linux 全漏),正确映射已内联到 main()(带注释),勿在此复活。


def gh_api(path):
    req = urllib.request.Request(f"https://api.github.com{path}")
    req.add_header("Authorization", f"Bearer {GH_TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    try:
        return json.load(urllib.request.urlopen(req, timeout=60))
    except urllib.error.HTTPError as e:
        # 2026-09-18:TAG 传错(如 workflow_dispatch 下拿到分支名 main)时原实现直接
        # 抛裸 HTTPError,只有一长串 urllib 堆栈、看不到请求了哪个路径。这里回显 path。
        detail = e.read()[:300].decode("utf-8", errors="replace")
        raise SystemExit(f"[gh] GET {path} -> HTTP {e.code}: {detail}") from e


def gitee_api(path, method="GET", data=None):
    url = f"https://gitee.com/api/v5{path}"
    # token 必须挂在所有需要鉴权的方法上 —— 原实现只给 POST 加,于是 DELETE 会被当匿名
    # 请求(401),而下面的调用方只能看到 None、以为"啥也没发生"。GET 也一并带上(token
    # 存在时提高限流额度;Gitee 对公开读不拒绝带 token 的请求)。
    if GITEE_TOKEN:
        url += ("&" if "?" in url else "?") + f"access_token={GITEE_TOKEN}"
    req = urllib.request.Request(url, method=method)
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        req.add_header("Content-Type", "application/json")
    req.data = body
    try:
        resp = urllib.request.urlopen(req, timeout=120)
        # DELETE 成功是 204 空体:json.load 会抛异常,别让"删成功"变成异常分支。
        # 只 read 一次并存到 raw —— 先 read 再 read 会拿到空串(原写法会在
        # 204 分支里把 body 判成空、或让 json.loads 抛)。
        raw = resp.read()
        if resp.status in (204, 205) or not raw.strip():
            return {}
        return json.loads(raw)
    except urllib.error.HTTPError as e:
        print(f"[gitee] {method} {path} -> {e.code}: {e.read()[:200]}")
        return None


def gitee_upload(release_id, filepath, filename):
    url = (f"https://gitee.com/api/v5/repos/{GITEE_OWNER}/{GITEE_REPO}"
           f"/releases/{release_id}/attach_files?access_token={GITEE_TOKEN}")
    boundary = "ihui" + str(int(time.time()))
    data = open(filepath, "rb").read()
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
            f"filename=\"{filename}\"\r\nContent-Type: application/octet-stream\r\n\r\n").encode() \
        + data + f"\r\n--{boundary}--\r\n".encode()
    # 2026-10-13 深夜修:Gitee 大文件(79MB AppImage 实锤)写超时为慢性病,
    # 原实现单次尝试失败即放弃且调用处不检查返回值 ⇒ 资产永久缺角(下版才补)。
    # 改为 3 次指数退避重试;调用处对 False 记入失败清单并终验,重跑本 job 幂等补齐。
    for attempt in range(1, 4):
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
        try:
            r = urllib.request.urlopen(req, timeout=1800)
            print(f"[gitee] 上传 {filename}: {r.status}")
            return True
        except urllib.error.HTTPError as e:
            print(f"[gitee] 上传 {filename} 第{attempt}/3次失败: {e.code} {e.read()[:150]}")
        except Exception as e:
            print(f"[gitee] 上传 {filename} 第{attempt}/3次异常: {e}")
        time.sleep(20 * attempt)
    return False


def main():
    # 1. GitHub release 资产清单
    rel = gh_api(f"/repos/{GH_REPO}/releases/tags/{TAG}")
    assets = {a["name"]: a for a in rel.get("assets", [])}
    print(f"[gh] {TAG} 资产 {len(assets)} 个")

    # 2. 找/建 Gitee release
    grel = gitee_api(f"/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/tags/{TAG}")
    if grel is None:
        print("[gitee] 创建 release...")
        grel = gitee_api(f"/repos/{GITEE_OWNER}/{GITEE_REPO}/releases", "POST", {
            "tag_name": TAG, "name": f"IHUI AI Desktop {TAG}",
            "body": rel.get("body") or "Desktop bundles (Tauri 2)",
            "target_commitish": "main", "prerelease": False})
        if grel is None:
            sys.exit("Gitee release 创建失败")
    rid = grel["id"]
    gitee_assets = {a["name"] for a in (grel.get("assets") or [])}

    # 3. 上传缺的资产
    # 2026-10-12 修正 PLATFORM_MAP(0.1.50/0.1.51 两次实锤 mac/linux 全漏):
    #   tauri-action universal 构建的实际产物名是 AI_universal.app.tar.gz(不含
    #   aarch64/x64 字样),旧后缀 aarch64.app.tar.gz / x64.app.tar.gz 永不命中;
    #   linux 的 updater 产物是 .AppImage 本体(.AppImage.tar.gz 形态不存在)。
    #   universal 一份签名包覆盖 darwin 双键。
    need = {}
    for plat, suffix in [
        ("windows-x86_64", "-setup.exe"),
        ("darwin-aarch64", "universal.app.tar.gz"),
        ("darwin-x86_64", "universal.app.tar.gz"),
        # ⚠️ linux-x86_64 已从 Gitee 镜像范围**移除**(2026-10-17 实测定,勿加回):
        #   AppImage 82MB,从 Actions runner 上传到 Gitee 会 `The write operation timed out`
        #   (实测 0.1.75 连试三轮:一次写超时、两次跑到 30-40 分钟被 cancelled),
        #   而它是**偶发**的 —— 0.1.74 那份侥幸传成功过,所以曾误以为"能传"。
        #   失败的真实代价不是"少一个文件",而是:feed 里 linux 那条仍写成 gitee.com 直链
        #   ⇒ 指向 404 ⇒ **Linux 用户的自动更新直接坏掉**(比"没有国内镜像"严重得多)。
        #   ⇒ 现在 linux 不进 Gitee feed,Gitee 侧那份存档不再含 linux 键;
        #     站点 feed(真源)本就给 linux 走 github.com,客户端也只认 aizhs.top。
        #   Linux 用户照常更新,只是没有国内加速 —— 这是明确的取舍,不是遗漏。
    ]:
        mains = [n for n in assets if n.endswith(suffix)]
        if not mains:
            print(f"[warn] 平台 {plat} 在 GH release 无命中资产(后缀 {suffix})")
            continue
        main = sorted(mains)[-1]
        sig = main + ".sig"
        need[plat] = (main, sig if sig in assets else None)

    # 3--extra. 镜像 GH release 全部安装包资产(不只 feed 四键)——下载页的
    # dmg/deb/rpm 也走 Gitee 优先合并(0.1.51 曾因此回指 GitHub,backfill 兜底
    # 属人工通道,这里补成 CI 自动)。latest.json 排除(GH 版 url 指 github.com)。
    #
    # 2026-10-17:AppImage 一并排除(与上面 need 里的移除同因)——它 82MB,
    # 从 runner 传到 Gitee 会写超时,连试三轮都不稳(一次 write timeout、
    # 两次 30-40 分钟被 cancelled)。**留着它只会让整个 job 陪跑然后失败**,
    # 连带 Windows 那份也传不完。Linux 走 GitHub 直链即可。
    SKIP_MIRROR_SUFFIXES = (".AppImage",)
    upload_set = set()
    for plat, (main, sig) in need.items():
        upload_set.update(x for x in (main, sig) if x)
    for name in assets:
        if name == "latest.json" or name.endswith((".zip", ".tar.gz")):
            continue
        if name.endswith(SKIP_MIRROR_SUFFIXES):
            print(f"[gitee] {name} 属不镜像类型(AppImage 体积大且上传不稳),跳过")
            continue
        upload_set.add(name)

    # 3--extra-2. Gitee 单文件 100MB 硬上限:超限资产按「预期跳过」处理。
    # 判定用 GitHub API 给出的 size,避免白白下载 ~225MB 包体再被 Gitee 400 拒。
    oversize = {
        n for n in upload_set
        if int(assets.get(n, {}).get("size") or 0) > GITEE_ATTACH_LIMIT_BYTES
    }
    for n in sorted(oversize):
        print(f"[gitee] {n} ({assets[n]['size']} 字节) 超 Gitee 100MB 上限,"
              f"预期跳过(不影响其余资产与更新链路)")
    upload_set -= oversize

    # 3a. 下载所需文件到本地。
    #
    # 2026-10-17 改为**按需下载**(实测立因,这是本脚本最大的时间黑洞):
    #   原实现无条件下载 upload_set 里的**全部**资产,注释理由是"feed 生成也需要 sig"。
    #   但事实是:
    #     · 主包体**只在需要上传到 Gitee 时**才需要本地副本;
    #     · feed 只用 sig 的**文本内容**,sig 都是几百字节;
    #     · Gitee 已存在的资产不下载也得。
    #   于是 desktop-v0.1.75 那次:为了传 Windows exe(9.6MB)和写 feed,
    #   硬先把 79MB AppImage + 13MB dmg + 13MB app.tar.gz 全拉一遍(约 128MB),
    #   海外 runner 拉 GitHub 又是慢链路 ⇒ 单是下载就吃掉大半小时,feed 迟迟写不出去。
    #   ⇒ 现在只下"要上传的"+"sig 文本",大包已有就跳过。
    # 2026-10-12:临时目录按 TAG 分子目录 —— 跨 tag 平铺会让无版本号资产名
    # (AI_universal.app.tar.gz 等)把上一版内容当本版上传(backfill 实锤的冒名形态)。
    tmpdir = f"/tmp/backfill-gitee/{TAG}"
    os.makedirs(tmpdir, exist_ok=True)

    needed = set()
    for fname in upload_set:
        # 要上传且 Gitee 还没有 ⇒ 必须下载
        if fname not in gitee_assets:
            needed.add(fname)
    for _plat, (_main, _sig) in need.items():
        # sig 的文本内容 feed 要用,几百字节,一律取
        if _sig:
            needed.add(_sig)
    # 超限资产本来就被剔除过,这里再兜一层:永远不下载超限文件
    needed -= oversize

    skipped = sorted(set(upload_set) - needed)
    if skipped:
        print(f"[gh→tmp] 跳过下载(Gitee 已有且 feed 不需要正文): {skipped}")

    for fname in sorted(needed):
        local = f"{tmpdir}/{fname}"
        if os.path.exists(local):
            continue
        gh_url = assets[fname]["browser_download_url"]
        for attempt in range(1, 4):
            try:
                req = urllib.request.Request(gh_url)
                req.add_header("Authorization", f"Bearer {GH_TOKEN}")
                open(local, "wb").write(urllib.request.urlopen(req, timeout=1800).read())
                print(f"[gh→tmp] {fname}: {os.path.getsize(local)} 字节")
                break
            except Exception as e:
                print(f"[gh→tmp] {fname} 第{attempt}次失败: {e}")
                time.sleep(5)
        else:
            sys.exit(f"资产下载失败: {fname}")

    # 3b. 上传 Gitee 缺失的资产(幂等:已有同名跳过)
    # 2026-10-13:上传失败不再静默吞——记入失败清单,全部尽力后统一终验,
    # 有缺口则以非零退出(重跑本 job 幂等补齐),让 job 红 ≠ 资产悄悄缺角。
    #
    # 2026-10-17 排序修复(实测立因):原来按文件名 sorted() 上传,**字母序把
    # 79MB 的 AppImage 排在最前面**,于是一个海外 runner 传国内 Gitee 的慢链路
    # 把预算全烧在 Linux 包上 —— desktop-v0.1.75 实测卡了一小时,Windows 的
    # 9.6MB exe 一次都没轮到(资产表停在 rpm 五个文件)。而 **Windows 才是国内
    # 主力平台**,Linux 包在国内几乎没有下载量。
    # ⇒ 改成按"国内下载价值"排序:Windows 主包 → 各平台 sig → 其余;
    #   并给单个文件加传输预算,超预算的留到下次重跑(幂等),不许它拖死整批。
    def _upload_rank(name):
        if name.endswith("-setup.exe"):
            return 0  # Windows 主包:最高优先
        if name.endswith(".sig"):
            return 1  # 签名体积小,先补齐(更新器/feed 依赖)
        if name.endswith((".AppImage", ".dmg", ".deb", ".rpm", ".app.tar.gz")):
            return 3  # 其余平台主包:体量大,排最后
        return 2

    ordered = sorted(upload_set, key=lambda n: (_upload_rank(n), n))
    print(f"[gitee] 上传顺序(按国内下载价值排): {ordered}")
    upload_failed = []
    for fname in ordered:
        if fname in gitee_assets:
            print(f"[gitee] {fname} 已存在,跳过上传")
            continue
        # 按需下载后,不在 needed 里的文件没有本地副本 —— 这种情况只可能是"Gitee 已有"
        # (上面已 continue),所以走到这里的必然已下载。仍显式判一次:
        # 宁可记进失败清单让人看见,也不让 FileNotFoundError 把整批掐死。
        if not os.path.exists(f"{tmpdir}/{fname}"):
            print(f"[gitee] {fname} 本地无副本(按需下载未取),跳过(下一轮幂等补齐)")
            upload_failed.append(fname)
            continue
        if not gitee_upload(rid, f"{tmpdir}/{fname}", fname):
            upload_failed.append(fname)
            continue
        gitee_assets.add(fname)
    if upload_failed:
        # 两种成因要分清,别混成一句含糊的"上传失败":
        #   · 没本地副本 ⇒ 3a 的按需下载漏了该文件(真异常,该红);
        #   · 上传 3 次仍失败 ⇒ Gitee 侧拒绝/网络问题(重跑幂等可补)。
        missing = [n for n in upload_failed if not os.path.exists(f"{tmpdir}/{n}")]
        detail = f"上传失败: {sorted(set(upload_failed) - set(missing))}"
        if missing:
            detail += f";3a 未下载到: {sorted(missing)}"
        sys.exit(f"[gitee] {detail}(重跑本 job 可幂等补齐)")

    # 4. 生成 latest.json(url → Gitee 直链)
    # 超限资产(Gitee 无该文件)不得进 feed:否则 platforms 里那条 URL 指向不存在的
    # 附件 ⇒ 客户端下载 404。跳过它的平台,而不是给一条死链。
    platforms = {}
    for plat, (main, sig) in need.items():
        if sig is None:
            print(f"[feed] {plat} 无 .sig,跳过")
            continue
        if main in oversize:
            print(f"[feed] {plat} 主包 {main} 未镜像 Gitee(超限),跳过该平台(不写死链)")
            continue
        # 第二道:主包可能因上传失败/被跳而未真正落到 Gitee —— 这时写进 feed 就是死链。
        # 原实现只看 oversize,是个洞(实测 0.1.74 的 windows 是超限被跳过,侥幸对了;
        # 但换成"上传失败"就会写出 404 地址)。以 gitee_assets 为准再判一次。
        if main not in gitee_assets:
            print(f"[feed] {plat} 主包 {main} 未成功落到 Gitee,跳过该平台(不写死链)")
            continue
        sig_content = open(f"{tmpdir}/{sig}").read().strip()
        platforms[plat] = {
            "signature": sig_content,
            "url": f"https://gitee.com/{GITEE_OWNER}/{GITEE_REPO}/releases/download/{TAG}/{main}",
        }
    if not platforms:
        # 全部平台都被跳过(理论上只有单平台且其主包超限时才发生)。这不是失败:
        # Gitee feed 只是附件存档,用户更新走 aizhs.top/GitHub,缺一份存档不该判红。
        print("[feed] 无任何平台可写入 Gitee feed(全部超限跳过),跳过 feed 写入(非失败)")
        return
    latest = {
        "version": TAG.replace("desktop-v", ""),
        "notes": f"IHUI AI Desktop {TAG} — 国内直连更新(Gitee)",
        "pub_date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "platforms": platforms,
    }
    content_b64 = __import__("base64").b64encode(
        json.dumps(latest, indent=2, ensure_ascii=False).encode()).decode()

    # 5. 更新器 feed(2026-09-17 终极:release 附件方案)
    # 旧 desktop-feed 分支方案已废弃——仓库「单分支守门」会删该分支,且 Gitee contents API
    # 的 PUT 行为不稳。改写 desktop-updater-feed release 的 latest.json 附件(幂等替换),
    # 与 gitee-release-attach.py(本机发版路径)一致。
    # 注:Gitee 侧该 release 只是附件存档,**不是**更新器端点(客户端 2026-10-05 起只认
    # aizhs.top 单端点);GitHub feed 维护已随该拍板删除,这里不再提任何 GitHub 端点。
    try:
        content_b64 = __import__("base64").b64encode(
            json.dumps(latest, indent=2, ensure_ascii=False).encode()).decode()
        FEED_TAG = "desktop-updater-feed"
        rel = gitee_api(f"/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/tags/{FEED_TAG}")
        if not (rel and rel.get("id")):
            rel = gitee_api(f"/repos/{GITEE_OWNER}/{GITEE_REPO}/releases", "POST", {
                "tag_name": FEED_TAG, "name": "Desktop updater feed(更新 feed 固定端点)",
                "body": "自动化维护:latest.json 随每次桌面端发版更新。请勿手动删除。",
                "target_commitish": "main", "prerelease": False})
        if not (rel and rel.get("id")):
            print("[gitee] feed release 创建失败(feed 附件跳过)")
            raise SystemExit(0)

        # 2026-10-17 修(实测立因):原实现只在 **feed release 首次创建时** 才 attach
        # latest.json,已存在就 `print("已存在,跳过")` 直接走人 ——
        # 于是这个附件从创建那天起**内容永远冻结**。实测:desktop-updater-feed 里
        # 的 latest.json 停在 version=0.1.74、且 platforms 里**没有 windows-x86_64**
        # (因为 0.1.74 的 exe 超 100MB 传不上 Gitee,写 feed 时被跳过)。
        # 而它正是"国内可达的那份 feed",冻结等于国内用户永远看不到新版本。
        # ⇒ 改成:先 POST attach(新增同名附件),再删掉所有**旧**同名附件,保证只剩一份最新。
        #   Gitee 允许同名附件共存(所以不能只 attach,否则越积越多、客户端可能取到旧的);
        #   DELETE /releases/{id}/attach_files/{file_id} 返回 204 即真删(2026-09-24 已实证)。
        existing = {a.get("name"): a.get("id") for a in (rel.get("assets") or [])}
        boundary = "ihui" + str(int(__import__("time").time() * 1000))
        header = (
            "--%s\r\nContent-Disposition: form-data; name=\"file\"; "
            "filename=\"latest.json\"\r\nContent-Type: application/json\r\n\r\n" % boundary
        )
        body = header.encode() + json.dumps(
            latest, indent=2, ensure_ascii=False).encode() + (
            "\r\n--%s--\r\n" % boundary).encode()
        req = urllib.request.Request(
            f"https://gitee.com/api/v5/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/{rel['id']}/attach_files?access_token={GITEE_TOKEN}",
            data=body, method="POST")
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
        r = urllib.request.urlopen(req, timeout=300)
        print(f"[gitee] feed latest.json 已更新(v{latest.get('version')}): {r.status}")

        # 删掉旧同名附件(刚上传的那份除外),只留最新一份。
        # 为什么必须删:同名附件在 Gitee 可共存,`/releases/download/<tag>/latest.json`
        # 这个固定 URL 会解析到其中之一 —— 留着旧的等于"更新了但可能还是读到旧版"。
        #
        # ⚠️ 关键细节(2026-10-17 实测定):release 对象里的 assets **只有 name 和
        # browser_download_url,没有 id**(实测字段就这两个),所以不能按 release.assets 删。
        # 真正带 id 的是 `/releases/{id}/attach_files` 这个接口(实测返回
        # {"id":3412225,"name":"latest.json",...}) —— 删除必须走它列出来的 id。
        # 失败不阻塞(下一轮幂等再清),但会把数量打出来便于对账。
        try:
            listed = gitee_api(
                f"/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/{rel['id']}/attach_files") or []
            dup = [a for a in listed if a.get("name") == "latest.json" and a.get("id")]
            if len(dup) > 1:
                # 保留 id 最大的那份(刚上传的),其余删除
                dup.sort(key=lambda a: a.get("id") or 0)
                for stale in dup[:-1]:
                    gitee_api(
                        f"/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/{rel['id']}"
                        f"/attach_files/{stale['id']}",
                        "DELETE",
                    )
                    print(f"[gitee] 已清旧 feed 附件 id={stale['id']}")
            else:
                print(f"[gitee] feed 附件只剩 1 份(id={dup[0]['id'] if dup else '无'}),无需清理")
        except Exception as e:
            print(f"[gitee] 清旧 feed 附件异常(不阻塞): {e}")
        print("[done] Gitee feed 附件已处理(非更新器端点,仅存档)")
    except Exception as e:
        print(f"[gitee] feed 更新异常(不阻塞): {e}")


if __name__ == "__main__":
    main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
