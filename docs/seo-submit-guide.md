# SEO/GEO 站长平台提交清单(6 个平台,30 分钟完成)

> 目的:让搜索引擎和 AI 引擎知道 ihui.ai 存在,主动推送 sitemap,加速收录。
> 前置条件:ihui.ai 已部署可访问,https://ihui.ai/sitemap.xml 返回 200。
> 完成后效果:1-7 天内开始被各引擎收录,1 个月内长尾词开始有曝光。

---

## 提交进度追踪

| 平台 | 类型 | 优先级 | 状态 | 耗时 |
|------|------|--------|------|------|
| Google Search Console | 国际 SEO | P0 | ☐ | 10 min |
| Bing Webmaster Tools | 国际 SEO + AI | P0 | ☐ | 10 min |
| IndexNow 主动推送 | Bing/Yandex/Seznam | P0 | ☐ | 5 min |
| 百度搜索资源平台 | 国内 SEO + AI | P0 | ☐ | 5 min |
| 360 搜索站长平台 | 国内 SEO | P1 | ☐ | 3 min |
| 搜狗站长平台 | 国内 SEO | P1 | ☐ | 3 min |
| 头条搜索站长平台 | 国内 SEO | P1 | ☐ | 3 min |
| 神马搜索(移动) | 国内移动 SEO | P2 | ☐ | 3 min |

---

## 1. Google Search Console(P0,国际 SEO 核心)

**入口**:https://search.google.com/search-console

**步骤**:
1. 登录 Google 账号(没有就注册)
2. Add property → URL prefix → 输入 `https://ihui.ai`
3. 验证所有权(三选一,推荐 HTML 标签):
   - **HTML 标签**(推荐):复制 `<meta name="google-site-verification" content="XXX" />`,加到 `apps/web/app/layout.tsx` 的 metadata.verification 字段
   - HTML 文件:下载验证文件,放到 `apps/web/public/`,部署后访问 `https://ihui.ai/google-xxx.html`
   - DNS TXT:在域名 DNS 加 TXT 记录(最稳,但需要域名管理权限)
4. 验证通过后 → Sitemaps → 输入 `sitemap.xml` → Submit
5. 等 1-3 天看 "Coverage" 报告,确认索引页面数增长

**额外配置**:
- Settings → Crawl rate → Limit Googlebot crawl rate(避免被高频抓取压垮服务器,设为 0.1 requests/sec)
- Settings → URL inspection → 输入 `https://ihui.ai/` → Request indexing(首页加速收录)

**验证清单**:
- [ ] 已添加 property `https://ihui.ai`
- [ ] 所有权验证通过
- [ ] sitemap.xml 已提交,Status: Success
- [ ] URL inspection 首页 "Request indexing" 已点击

---

## 2. Bing Webmaster Tools(P0,国际 SEO + AI 检索核心)

**入口**:https://www.bing.com/webmasters

**为什么重要**:Bing 是 ChatGPT 搜索 / Microsoft Copilot / Perplexity 的主要后端索引源。Bing 收录 = ChatGPT 搜索能找到你。

**步骤**:
1. 登录 Microsoft 账号(没有就注册)
2. Add site → 输入 `https://ihui.ai`
3. 验证所有权(同 Google,推荐 HTML 标签 / meta verification)
4. 提交 sitemap:Site → Submit Sitemap → 输入 `https://ihui.ai/sitemap.xml`
5. URL submission:Configure My Site → URL Submission → 批量提交核心页面(首页/产品页/对比页)

**IndexNow 配置(关键,Bing 原生支持)**:
1. 生成 key:`node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`
2. 把 key 写到 `.env`: `INDEXNOW_KEY=<生成的 key>`
3. 把 key 文件放到 `apps/web/public/<key>.txt`(内容就是 key 本身,无换行)
4. 部署后验证:`curl https://ihui.ai/<key>.txt` 应返回 key 本身
5. 推送:`pnpm seo:indexnow`
6. 在 Bing Webmaster → URL Submission 查看推送进度

**验证清单**:
- [ ] 已添加 site `https://ihui.ai`
- [ ] 所有权验证通过
- [ ] sitemap.xml 已提交
- [ ] IndexNow key 已部署,`curl https://ihui.ai/<key>.txt` 返回 key
- [ ] `pnpm seo:indexnow` 推送成功(返回 200 或 202)

---

## 3. IndexNow 主动推送协议(P0,自动推送)

**作用**:每次发布后自动通知 Bing / Yandex / Seznam "我的 URL 更新了",不需要等爬虫来抓。Bing 收录速度从 7 天缩短到 24h。

**配置见上方 Bing Webmaster Tools 第 3 步(IndexNow 配置)**。

**CI 集成**(推荐,自动化):
在 `.github/workflows/release.yml` 末尾加:

```yaml
- name: Notify IndexNow
  run: pnpm seo:indexnow
  env:
    INDEXNOW_KEY: ${{ secrets.INDEXNOW_KEY }}
    SITE_URL: https://ihui.ai
```

**手动推送**:
```bash
# 推送整个 sitemap
pnpm seo:indexnow

# 推送指定 URL
node scripts/notify-indexnow.mjs --urls https://ihui.ai/,https://ihui.ai/compare/ihui-vs-dify

# 推送其他站点的 sitemap(如 staging)
node scripts/notify-indexnow.mjs --sitemap https://staging.ihui.ai/sitemap.xml
```

**验证清单**:
- [ ] `.env.INDEXNOW_KEY` 已设置
- [ ] `apps/web/public/<key>.txt` 已部署
- [ ] `curl https://ihui.ai/<key>.txt` 返回 key
- [ ] `pnpm seo:indexnow` 返回 200/202
- [ ] (可选)CI workflow 已集成

---

## 4. 百度搜索资源平台(P0,国内 SEO + AI 检索核心)

**入口**:https://ziyuan.baidu.com

**为什么重要**:百度是国内搜索 + 文心一言 / 豆包等 AI 引擎的主要后端。百度收录 = 文心一言 / 豆包能找到你。

**步骤**:
1. 登录百度账号
2. 用户中心 → 站点管理 → 添加网站 → 输入 `https://ihui.ai`
3. 验证所有权(三选一,推荐 HTML 标签):
   - **HTML 标签**(推荐):复制 `<meta name="baidu-site-verification" content="XXX" />`,加到 layout.tsx metadata
   - 文件验证:下载验证文件,放到 `apps/web/public/`
   - CNAME 验证:DNS 加 CNAME(需域名管理权限)
4. 验证通过后 → 普通收录 → 提交 sitemap:`https://ihui.ai/sitemap.xml`
5. 链接提交 → API 推送(可选,加速):获取 token,写脚本主动推送 URL

**百度专属配置**:
- 死链提交:如果有过期页面,提交 `https://ihui.ai/dead-links.xml`(本站暂无)
- 主动推送:百度有专属 API,比 sitemap 快,但每次推送有配额。可选实现 `scripts/notify-baidu.mjs`(本仓库未实现,需要时再写)

**验证清单**:
- [ ] 已添加站点 `https://ihui.ai`
- [ ] 所有权验证通过
- [ ] sitemap.xml 已提交,状态"正常"
- [ ] 索引量开始增长(1-2 周后在 "索引量" 报告查看)

---

## 5. 360 搜索站长平台(P1)

**入口**:https://zhanzhang.so.com

**步骤**:
1. 登录 360 账号
2. 我的网站 → 添加网站 → `https://ihui.ai`
3. 验证所有权(HTML 标签 / 文件 / CNAME)
4. 数据监控 → sitemap → 提交 `https://ihui.ai/sitemap.xml`
5. 链接提交 → URL 提交(首页 + 核心页)

**验证清单**:
- [ ] 已添加站点
- [ ] 所有权验证通过
- [ ] sitemap.xml 已提交

---

## 6. 搜狗站长平台(P1)

**入口**:https://zhanzhang.sogou.com

**步骤**:
1. 登录搜狗账号
2. 用户中心 → 网站支持 → 添加网站 → `https://ihui.ai`
3. 验证所有权(HTML 标签 / 文件)
4. 提交 sitemap:用户中心 → 数据提交 → sitemap → `https://ihui.ai/sitemap.xml`
5. URL 提交:首页 + 核心页逐个提交

**验证清单**:
- [ ] 已添加站点
- [ ] 所有权验证通过
- [ ] sitemap.xml 已提交

---

## 7. 头条搜索站长平台(P1)

**入口**:https://zhanzhang.toutiao.com

**步骤**:
1. 登录头条账号
2. 我的网站 → 添加网站 → `https://ihui.ai`
3. 验证所有权(HTML 标签 / 文件 / DNS)
4. 数据提交 → sitemap → `https://ihui.ai/sitemap.xml`
5. URL 提交:首页 + 核心页

**验证清单**:
- [ ] 已添加站点
- [ ] 所有权验证通过
- [ ] sitemap.xml 已提交

---

## 8. 神马搜索(移动端,P2)

**入口**:https://zhanzhang.sm.cn

**为什么放 P2**:神马是 UC 浏览器内置搜索引擎,移动端流量为主。如果你的目标用户主要在 PC 端,可跳过。

**步骤**:
1. 登录神马账号
2. 添加网站 → `https://ihui.ai`
3. 验证所有权(HTML 标签 / CNAME)
4. 提交 sitemap

---

## 完成后自检(1 周后)

### 收录情况检查

| 检查项 | 命令 / 入口 | 期望结果 |
|--------|-------------|----------|
| Google 收录 | `site:ihui.ai` in Google | 30+ 页面被索引 |
| Bing 收录 | `site:ihui.ai` in Bing | 30+ 页面被索引 |
| 百度收录 | `site:ihui.ai` in 百度 | 10+ 页面被索引 |
| 360 收录 | `site:ihui.ai` in 360 | 5+ 页面被索引 |
| 搜狗收录 | `site:ihui.ai` in 搜狗 | 5+ 页面被索引 |
| 头条收录 | `site:ihui.ai` in 头条搜索 | 5+ 页面被索引 |

### AI 引擎检索测试

直接在以下 AI 引擎搜索 "IHUI AI" / "ihui ai 全栈" / "dify 替代 开源",看是否能命中:

| AI 引擎 | 入口 | 期望 |
|---------|------|------|
| ChatGPT 搜索 | https://chatgpt.com | 能搜到 ihui.ai |
| Perplexity | https://perplexity.ai | 能引用 ihui.ai |
| Claude | 直接问 "ihui ai 是什么" | 能基于网页回答 |
| 文心一言 | https://yiyan.baidu.com | 能搜到 |
| 豆包 | https://doubao.com | 能搜到 |
| Kimi | https://kimi.moonshot.cn | 能搜到 |
| DeepSeek | https://chat.deepseek.com | 联网搜索能命中 |

### 验证所有权 meta 标签

完成上述 6 个平台后,`apps/web/app/layout.tsx` 的 metadata.verification 字段应包含:

```typescript
verification: {
  google: 'XXX',
  other: {
    'baidu-site-verification': 'XXX',
    'msvalidate.01': 'XXX', // Bing
    '360-site-verification': 'XXX',
    'sogou_site_verification': 'XXX',
    'toutiao-site-verification': 'XXX',
    'shenma-site-verification': 'XXX',
  },
},
```

---

## 常见问题

**Q: 提交后多久能被收录?**
- Google:1-3 天(主动推送 IndexNow 后 24h)
- Bing:1-7 天(IndexNow 后 24h)
- 百度:1-2 周(国内引擎普遍慢)
- 360/搜狗/头条:2-4 周

**Q: 为什么提交了还是搜不到?**
- 检查 robots.txt 是否屏蔽了搜索引擎(本站已放行所有 AI 爬虫 ✅)
- 检查 sitemap.xml 是否 200 可访问
- 检查页面是否有 `<meta name="robots" content="noindex">`(本站无 ✅)
- 检查是否有外部 backlinks(0 backlinks 的站点收录极慢,见 docs/marketing/ 的发帖文案)

**Q: AI 引擎(ChatGPT/Claude/Perplexity)多久能检索到?**
- AI 引擎不主动收录,依赖搜索引擎索引 + 自己的爬虫
- Bing 收录后,ChatGPT 搜索 / Copilot 通常 1-2 周内能命中
- Google 收录后,Gemini 通常 1-2 周内能命中
- 百度收录后,文心 / 豆包通常 2-4 周内能命中
- 加速方式:**外部 backlinks**(在 Reddit / Hacker News / 知乎 / 掘金发帖,被 AI 爬虫抓到后加速收录)

**Q: IndexNow 推送后多久 Bing 收录?**
- 通常 24h 内,极端情况 72h
- 在 Bing Webmaster → URL Submission 查看状态
- 如果 7 天还没收录,检查 keyLocation 是否可访问

---

## 后续维护

- **每次发布后**:运行 `pnpm seo:indexnow` 主动推送
- **每周**:查看 Google Search Console + Bing Webmaster 的索引量 / 点击量报告
- **每月**:更新 sitemap.ts 的 PAGES 列表(新增页面 / 删除下线页面)
- **每季度**:审查 robots.txt 是否需要新增 AI 爬虫 UA(2026-07 已配置 20+ 主流 AI 爬虫)
