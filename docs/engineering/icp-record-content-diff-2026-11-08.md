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

结论:共享屏不是“值不同”,而是**在 label1 插入公网安备号后,label1–label5 的标签与值整体错开一位**。判定为**值集合多了一项“公网安备号”、标签集合多了一项“备案范围”且后者没有值**;槽位总数仍是 6。两种改法与取舍:

- 改法 A(保持 6 行、删公网安备值):会丢掉公网安备号(合规要素),**排除**;
- 改法 B(补“公网安备号”标签、撤掉无值的“备案范围”行):公网安备号与备案时间都保留、内容零改动、只新增 1 个 shared 标签键。**采用 B**。

引入历史:`git log -S "吉公网安备"` 定位 `62b61b5816`(2026-10-31,icp-record 从 1 字段扩为 6 字段表 + 复制备号 + 查询 + 脚注);该提交前此屏只有 1 个字段,之后只有样式类提交、无配对修复 ⇒ **所有含该提交的 RN 构建都一直错**,不是最近才退化。

### 1.1 修后实际渲染(共享屏与 RN 壳,6 组标签/值)

| # | 标签键 / 文案 | 值 |
| --- | --- | --- |
| 1 | `icpRecord.label0` / 备案号 | 吉ICP备2025027274号-7A(内容待定) |
| 2 | `icpRecord.labelPublicSecurity` / 公网安备号 | 吉公网安备22010502000999号(内容待定) |
| 3 | `icpRecord.label1` / 备案主体 | 吉林省爱智汇人工智能科技有限公司 |
| 4 | `icpRecord.label2` / 主体类型 | 企业 |
| 5 | `icpRecord.label3` / 备案时间 | 2026-01-15(内容待定) |
| 6 | `icpRecord.label4` / 备案链接 | aizhs.top |

`icpRecord.label5`(备案范围)共享源没有对应值,**本屏不渲染**;web 侧保留该行。RN 壳 `apps/mobile-rn/src/screens/IcpRecordScreen.tsx` 只注入 `t/onBack/onCopy/onQuery/colorScheme`,不覆盖行数据,因此渲染与上表一致。

## 2. 结构差异

| 区块 | web | 共享屏 | 备注 |
| --- | --- | --- | --- |
| 卡片标题 | CardTitle + Globe 图标,文案 `icpRecordCardTitle` | 页头 title + BackChevron,文案 `icpRecord.title` | 位置与文案都不同 |
| 备案号 | 只在 6 行表里出现 1 次 | 顶部复制卡 1 次 + 表内 label0 1 次 | 已修:无 `onCopy` 时**整个复制卡不渲染**(不是只隐藏 hint);RN 壳传 `onCopy` ⇒ 卡片仍渲染,行为不变 |
| 提示区 | 底部 Card + ShieldCheck,`icpRecordNotice`(“本平台已依法完成ICP备案登记…”) | 底部纯文本 `icpRecord.footer`(“以上信息来自工信部备案查询系统”) | 文案与形态都不同 |
| 查询 CTA | 无独立按钮,链接在行内 | 底部按钮 `icpRecord.query`,无 `onQuery` 时不渲染 | 按决定不注入,按钮自然消失 |
| 返回 | `<BackButton/>` 不渲染 DOM,只向顶栏注册返回意图(`router.back()`,无历史降级 `fallbackHref='/'`) | 页头 `BackChevron onPress=onBack`,`t('common.back')` | 共享屏有等价返回控件;裸 `router.back()` 会丢无历史降级 |

## 3. `t` 映射

web 侧把共享屏键映射到现有 `settings.icpRecord*` 键;仅新增 1 个 web 键 `settings.icpRecordFooter`(footer 在共享屏不是 prop、无条件渲染 ⇒ 必需):

| 共享屏键 | web 键 |
| --- | --- |
| `icpRecord.title` | `settings.icpRecordTitle` |
| `icpRecord.label0` | `settings.icpRecordNumber` |
| `icpRecord.labelPublicSecurity` | **无对应键(内容待定)** |
| `icpRecord.label1` | `settings.icpRecordEntity` |
| `icpRecord.label2` | `settings.icpRecordEntityType` |
| `icpRecord.label3` | `settings.icpRecordTime` |
| `icpRecord.label4` | `settings.icpRecordUrl` |
| `icpRecord.label5` | `settings.icpRecordScope`(共享屏本次不渲染,保留供后续) |
| `icpRecord.footer` | `settings.icpRecordFooter`(**新增,唯一新增键**) |
| `common.back` | `common.back`(从非 `settings` 命名空间取) |
| `icpRecord.copyHint` | 不注入 `onCopy` ⇒ 卡片不渲染 ⇒ 无需映射 |
| `icpRecord.query` | 不注入 `onQuery` ⇒ CTA 不渲染 ⇒ 无需映射 |

## 4. 等待拍板的三点(机主口径)

1. 备案号是否带 `-7A`(web 不带,共享屏带)。
2. 是否补“公网安备”独立槽位;若补,标签/值顺序怎么排(共享屏当前是错位的,不能照搬)。
3. 备案时间取 `2025-11-21`(web)还是 `2026-01-15`(共享屏)。

附带需要一起拍的:标题用“备案登记信息”还是“ICP备案信息”;底部提示用 notice 还是 footer 文案;`footer` 是否允许映射到 `icpRecordNotice`。

## 5. 本页明确不做的

- 不选边、不改任一侧的内容常量;
- 内容三事实(`-7A` / 公网安备号 / 备案时间)仍待机主,不许自己选;
- 页面 diff 已出草案 `docs/engineering/icp-record-adoption-2026-11-08.diff`,标注**内容待定 / 勿合入主干**,线上 web 页未改;
- 草案明确保留的退让:共享屏行值只有 `<Text>`,没有行内 `<a>` 渲染位,替换后 `备案链接` 外链会丢,不满足“web 行内外链保留”;未为此改共享屏,所以草案不落地。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
