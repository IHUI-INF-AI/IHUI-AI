# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 供应链:全链钉版(2026-11-01 起,把顶部原先那三段"生产部署前应改为…"的 TODO 真正做掉)。
# 所有取值都是**现读实测**得到,不是凭记忆填的:
#   - python:3.12-slim 的镜像索引 digest 取自 hub.docker.com tag 元数据
#     (media_type=application/vnd.oci.image.index.v1+json,多架构索引那一条,不是某个 arch 的子 digest)
#   - uv 0.12.1 = 本机 `uv --version` 现读(锁文件的解析语义会随 uv 版本漂 ⇒ uv 自身必须钉)
#   - nodesource setup_20.x 的 sha256 与 3907 字节 = 本次实际下载后算出
#   - typescript-language-server 6.0.2 / typescript 7.0.2 = `npm view ... version` 现读
# 升级姿势:换 tag 时**同批**换 digest 并重新量 hash,两处不一致就会构建失败(有意)。
FROM python:3.12-slim@sha256:aa943ce411423c7582288f18707ff66eddcbaeb510502d747a72aeb34f30d159 AS builder
WORKDIR /app
RUN pip install --no-cache-dir uv==0.12.1

# 冻结依赖安装 —— 与 Node 侧 4 枚 Dockerfile 早已在用的 `pnpm install --frozen-lockfile`
# 是同一条纪律,本镜像此前是唯一例外:`uv pip install --system .` **完全不看**仓库里那份
# uv.lock,构建时 PyPI 上解析到什么就装什么 ⇒ 一次上游误发布/投毒直接进镜像,且同一份
# 源码两次构建产出两个镜像。现在按 uv.lock 导出后装(实测该导出:164 条需求全部 `==`
# 精确、每条都带 sha256、未钉版 0)并启用 hash 校验。
#
# `--no-emit-project` 是必要的一步:不加它,导出的第 3 行就是 `-e .`(实测),于是这条
# 命令会把"本项目"也当成一个带 hash 的依赖去装 ⇒ 构建当场失败。项目本体仍单独装一次
# (下面 `--no-deps .`),保持与改动前**完全相同**的运行时布局(app 在 site-packages 里可
# 导入,hatchling 需要源码 ⇒ app/ 照旧复制),这一枚只换依赖来源,不动任何运行语义。
COPY pyproject.toml uv.lock ./
COPY app/ ./app/
RUN uv export --frozen --no-dev --no-emit-project --format requirements.txt -o /tmp/requirements.frozen.txt \
    && uv pip install --system --no-cache-dir --no-deps --require-hashes -r /tmp/requirements.frozen.txt \
    && rm -f /tmp/requirements.frozen.txt \
    && uv pip install --system --no-cache-dir --no-deps .

FROM python:3.12-slim@sha256:aa943ce411423c7582288f18707ff66eddcbaeb510502d747a72aeb34f30d159 AS runner
WORKDIR /app
# `curl <远程脚本> | bash` 这一型是"把网上取到的字节直接交给解释器执行":CDN、DNS、代理
# 任意一处被下手,就是**构建期**在装配流水线里跑别人的代码,而且是静默的。改成
# 落盘 → 校验 sha256 → 再执行。脚本一有变化构建即红:这是有意的取舍 ——
# 宁可在构建期响亮失败,也不要"某天镜像里多了别人的一段逻辑"。
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource-setup.sh \
    && echo '2c4c6683a17b6f4128898a7b521e3c8bb725a99ffaf1b5e32ac97c6fa7d381be  /tmp/nodesource-setup.sh' | sha256sum -c - \
    && bash /tmp/nodesource-setup.sh \
    && rm -f /tmp/nodesource-setup.sh \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*
# LSP 依赖:typescript-language-server 供 /api/v1/lsp/* 端点 subprocess 调用。
# 钉到具体版本(同上:未钉版的全局 npm 安装=每次构建取"当时最新")。
RUN npm install -g --no-audit --no-fund typescript-language-server@6.0.2 typescript@7.0.2
RUN useradd -m -u 1001 aiuser
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --chown=aiuser:aiuser . .
USER aiuser
EXPOSE 8803
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8803", "--limit-concurrency", "3000"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
