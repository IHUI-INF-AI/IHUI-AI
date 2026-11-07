<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# settings/icp-record 内容口径对照(待机主拍板)

用途:把 web 与共享屏两边的完整文案/数据摊平,一次拍完。**本页只对照,不改代码、不选边。**

来源:

- web:`apps/web/app/(main)/settings/icp-record/page.tsx:23-33`;文案 `packages/i18n/messages/web/zh-CN.json` 的 `settings.icpRecord*`
- 共享屏:`packages/app/src/features/icp-record/IcpRecordScreen.tsx:16-25`;文案 `packages/i18n/messages/shared/zh-CN.json` 的 `icpRecord.*`

## 1. 逐槽位对照

| 槽位 | web 键 / 值 | 共享屏键 / 值 | 差异性质 |
| --- | --- | --- | --- |
| 标题 | `settings.icpRecordCardTitle` = 备案登记信息 | `icpRecord.title` = ICP备案信息 | 文案不同(同义) |
| 备案号 | `settings.icpRecordNumber` = 吉ICP备2025027274号 | `icpRecord.label0` = 备案号 → 吉ICP备2025027274号**-7A** | 值差异(后缀 `-7A`) |
| 备案主体 | `settings.icpRecordEntity` = 备案主体 → 吉林省爱智汇人工智能科技有限公司 | `icpRecord.label1` = **备案主体** → **吉公网安备22010502000999号** | **标签与值错位**;且 web 无公网安备槽位 |
| 主体类型 | `settings.icpRecordEntityType` = 主体类型 → 企业 | `icpRecord.label2` = **主体类型** → **吉林省爱智汇人工智能科技有限公司** | **标签与值错位** |
| 备案时间 | `settings.icpRecordTime` = 备案时间 → 2025-11-21 | `icpRecord.label3` = **备案时间** → **企业** | **标签与值错位**;日期本身也不同 |
| 备案链接 | `settings.icpRecordUrl` = 备案链接 → https://beian.miit.gov.cn(行内外链,新标签打开) | `icpRecord.label4` = **备案链接** → **aizhs.top**(纯文本) | 值不同(完整 URL vs 域名)+ 交互不同(外链 vs 文本) |
| 备案范围 | `settings.icpRecordScope` + `icpRecordScopeValue` = 互联网信息服务 | `icpRecord.label5` = **备案范围** → **2026-01-15** | **标签与值错位**;web 的“互联网信息服务”在共享屏没有落点 |
| 公网安备 | 无此槽位、无此文案 | 值存在(`吉公网安备22010502000999号`),但无独立槽位(塞进 label1) | web 缺槽位;共享屏插行后导致 1–5 行整体错位 |

结论:共享屏不是“值不同”,而是**在 label1 插入公网安备号后,label1–label5 的标签与值整体错开一位**;RN 端当前应显示“备案主体: 吉公网安备… / 主体类型: 吉林省… / 备案时间: 企业 / 备案链接: aizhs.top / 备案范围: 2026-01-15”。这一屏在 RN 上疑似本来就是错的,不只是与 web 分叉。

## 2. 结构差异

| 区块 | web | 共享屏 | 备注 |
| --- | --- | --- | --- |
| 卡片标题 | CardTitle + Globe 图标,文案 `icpRecordCardTitle` | 页头 title + BackChevron,文案 `icpRecord.title` | 位置与文案都不同 |
| 备案号 | 只在 6 行表里出现 1 次 | 顶部复制卡 1 次 + 表内 label0 1 次 | 未注入 `onCopy` 时卡片仍渲染,只是 Tappable disabled、hint 隐藏 → **多一行重复的备案号** |
| 提示区 | 底部 Card + ShieldCheck,`icpRecordNotice`(“本平台已依法完成ICP备案登记…”) | 底部纯文本 `icpRecord.footer`(“以上信息来自工信部备案查询系统”) | 文案与形态都不同 |
| 查询 CTA | 无独立按钮,链接在行内 | 底部按钮 `icpRecord.query`,无 `onQuery` 时不渲染 | 按决定不注入,按钮自然消失 |
| 返回 | `<BackButton/>` 不渲染 DOM,只向顶栏注册返回意图(`router.back()`,无历史降级 `fallbackHref='/'`) | 页头 `BackChevron onPress=onBack`,`t('common.back')` | 共享屏有等价返回控件;裸 `router.back()` 会丢无历史降级 |

## 3. `t` 映射(零键改动方案)

web 侧 `useTranslations('settings')` 的现有键直接映射到共享屏键,不新增/不改 i18n 键:

| 共享屏键 | web 现有键 |
| --- | --- |
| `icpRecord.title` | `settings.icpRecordTitle` |
| `icpRecord.label0` | `settings.icpRecordNumber` |
| `icpRecord.label1` | `settings.icpRecordEntity` |
| `icpRecord.label2` | `settings.icpRecordEntityType` |
| `icpRecord.label3` | `settings.icpRecordTime` |
| `icpRecord.label4` | `settings.icpRecordUrl` |
| `icpRecord.label5` | `settings.icpRecordScope` |
| `common.back` | `common.back`(已有;需另取一个非 `settings` 命名空间的 t) |
| `icpRecord.copyHint` | 不注入 `onCopy` ⇒ 不渲染 ⇒ 无需映射 |
| `icpRecord.query` | 不注入 `onQuery` ⇒ 不渲染 ⇒ 无需映射 |
| `icpRecord.footer` | **无对应键**;要映射到 `settings.icpRecordNotice` 属语义替换,需拍 |

## 4. 等待拍板的三点(机主口径)

1. 备案号是否带 `-7A`(web 不带,共享屏带)。
2. 是否补“公网安备”独立槽位;若补,标签/值顺序怎么排(共享屏当前是错位的,不能照搬)。
3. 备案时间取 `2025-11-21`(web)还是 `2026-01-15`(共享屏)。

附带需要一起拍的:标题用“备案登记信息”还是“ICP备案信息”;底部提示用 notice 还是 footer 文案;`footer` 是否允许映射到 `icpRecordNotice`。

## 5. 本页明确不做的

- 不选边、不改任一侧的常量或 i18n 键;
- 不在内容拍板前落 `settings/icp-record` 的接屏 diff(否则等于替机主选了数据);
- 不为共享屏新增可选 prop(返回、复制、查询都按现有契约处理)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
