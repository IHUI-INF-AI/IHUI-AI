// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 报告版式(一段 CSS 字符串,随文档内联下发 ⇒ 零外链)。
 *
 * 三档媒体查询各管一件事,对应三条超越轴:
 *   ① `prefers-color-scheme: dark` 变量换面 —— 对侧两份报告实测 hasDark=false;
 *   ② `@media print` 收掉交互件与阴影、锁分页 —— 对侧 hasPrintStyle=false;
 *   ③ 文案全部由渲染层注入(本文件零文案,故不存在硬编码中文)。
 * 圆角只从 RADIUS_CSS_PX 取档、色值只从 DOC_* 取,禁止在此自造 hex(AGENTS §4)。
 */
import {
  DOC_BG,
  DOC_BG_CARD,
  DOC_BG_CARD_DARK,
  DOC_BG_DARK,
  DOC_BG_HOVER,
  DOC_BG_HOVER_DARK,
  DOC_BORDER,
  DOC_BORDER_DARK,
  DOC_BORDER_HARD,
  DOC_BRAND,
  DOC_BRAND_LIGHT,
  DOC_BRAND_SOFT,
  DOC_DANGER,
  DOC_PAGE_BG,
  DOC_TEXT_BODY,
  DOC_TEXT_DARK,
  DOC_TEXT_MUTED,
  DOC_TEXT_STRONG,
  RADIUS_CSS_PX,
} from '@ihui/design-tokens'

/** 档位角色:卡片→lg、控件/chip→md、分节面板→xl(与 RADIUS_ROLES 同档,不另立数字) */
const CARD_RADIUS = RADIUS_CSS_PX.lg
const CONTROL_RADIUS = RADIUS_CSS_PX.md
const PANEL_RADIUS = RADIUS_CSS_PX.xl

export function buildAgentReportCss(): string {
  return `:root{
  color-scheme:light;
  --rp-page:${DOC_PAGE_BG};
  --rp-surface:${DOC_BG};
  --rp-card:${DOC_BG_CARD};
  --rp-card-hover:${DOC_BG_HOVER};
  --rp-ink:${DOC_TEXT_STRONG};
  --rp-body:${DOC_TEXT_BODY};
  --rp-muted:${DOC_TEXT_MUTED};
  --rp-line:${DOC_BORDER};
  --rp-line-hard:${DOC_BORDER_HARD};
  --rp-accent:${DOC_BRAND};
  --rp-accent-soft:${DOC_BRAND_SOFT};
  --rp-accent-light:${DOC_BRAND_LIGHT};
  --rp-danger:${DOC_DANGER};
  --rp-track:${DOC_BG_HOVER};
  --rp-bar:${DOC_BRAND};
  --rp-panel-radius:${PANEL_RADIUS};
}
@media (prefers-color-scheme:dark){
  :root{
    color-scheme:dark;
    --rp-page:${DOC_BG_DARK};
    --rp-surface:${DOC_BG_CARD_DARK};
    --rp-card:${DOC_BG_CARD_DARK};
    --rp-card-hover:${DOC_BG_HOVER_DARK};
    --rp-ink:${DOC_TEXT_DARK};
    --rp-body:${DOC_TEXT_DARK};
    --rp-line:${DOC_BORDER_DARK};
    --rp-line-hard:${DOC_BORDER_DARK};
    --rp-accent:${DOC_BRAND_LIGHT};
    --rp-accent-soft:${DOC_BG_HOVER_DARK};
    --rp-track:${DOC_BG_HOVER_DARK};
    --rp-bar:${DOC_BRAND_LIGHT};
  }
}
*{box-sizing:border-box}
body{
  margin:0;
  background:var(--rp-page);
  color:var(--rp-body);
  font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;
}
main{max-width:980px;margin:0 auto;padding:24px 20px 40px}
h1{margin:0;font-size:22px;line-height:1.3;color:var(--rp-ink)}
h2{margin:0 0 12px;font-size:16px;color:var(--rp-ink)}
section{
  margin-top:20px;
  padding:16px;
  background:var(--rp-surface);
  border:1px solid var(--rp-line);
  border-radius:var(--rp-panel-radius);
}
.head{background:var(--rp-card)}
.meta{margin:6px 0 0;font-size:12px;color:var(--rp-muted)}
.readout{font-variant-numeric:tabular-nums;white-space:nowrap}
.grid{display:flex;flex-wrap:wrap;gap:10px}
.cell{
  flex:1 1 148px;
  min-width:148px;
  padding:10px 12px;
  background:var(--rp-card);
  border:1px solid var(--rp-line);
  border-radius:${CARD_RADIUS};
}
.cell .k{display:block;font-size:12px;color:var(--rp-muted)}
.cell .v{display:block;margin-top:4px;font-size:18px;color:var(--rp-ink)}
.chip{
  display:inline-block;
  padding:1px 8px;
  font-size:12px;
  border-radius:${CONTROL_RADIUS};
  background:var(--rp-accent-soft);
  color:var(--rp-ink);
}
.chip[data-severity="high"]{background:var(--rp-danger);color:${DOC_BG}}
.chip[data-severity="medium"]{background:var(--rp-accent);color:${DOC_BG}}
.steps{list-style:none;margin:8px 0 0;padding:0}
.step{
  display:flex;
  align-items:center;
  gap:10px;
  padding:6px 8px;
  border-radius:${CONTROL_RADIUS};
}
.step:nth-child(2n){background:var(--rp-card)}
.step .id{flex:0 0 26px;font-size:12px;color:var(--rp-muted)}
.step .name{flex:0 0 210px;overflow-wrap:anywhere;color:var(--rp-ink)}
.track{
  position:relative;
  flex:1 1 auto;
  height:10px;
  background:var(--rp-track);
  border-radius:${CONTROL_RADIUS};
}
.bar{
  position:absolute;
  inset:0 auto 0 0;
  background:var(--rp-bar);
  border-radius:${CONTROL_RADIUS};
}
.bar[data-state="unmeasured"]{background:var(--rp-card-hover)}
.step .ms{flex:0 0 96px;text-align:right;font-size:12px}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:4px}
.toolbar input{
  flex:1 1 180px;
  min-width:120px;
  padding:6px 8px;
  font:inherit;
  color:var(--rp-ink);
  background:var(--rp-surface);
  border:1px solid var(--rp-line-hard);
  border-radius:${CONTROL_RADIUS};
}
button{
  padding:6px 10px;
  font:inherit;
  color:var(--rp-ink);
  background:var(--rp-card);
  border:1px solid var(--rp-line-hard);
  border-radius:${CONTROL_RADIUS};
  cursor:pointer;
}
button:hover{background:var(--rp-card-hover)}
ul.plain{list-style:none;margin:0;padding:0}
ul.plain li{margin-top:8px;padding:8px 10px;background:var(--rp-card);border-radius:${CONTROL_RADIUS}}
.finding .detail{margin-left:8px;font-size:12px;color:var(--rp-muted)}
dl.glossary{margin:0}
dl.glossary dt{margin-top:10px;color:var(--rp-ink);font-size:13px}
dl.glossary dd{margin:2px 0 0;font-size:13px;color:var(--rp-body)}
.gapbox{background:var(--rp-accent-soft)}
footer{margin-top:22px;font-size:12px;color:var(--rp-muted)}
@media print{
  :root{
    color-scheme:light;
    --rp-page:${DOC_BG};
    --rp-surface:${DOC_BG};
    --rp-card:${DOC_BG_CARD};
    --rp-track:${DOC_BG_HOVER};
    --rp-ink:${DOC_TEXT_STRONG};
    --rp-body:${DOC_TEXT_BODY};
  }
  body{font-size:11px}
  main{max-width:none;padding:0}
  section{border:1px solid ${DOC_BORDER};break-inside:avoid;page-break-inside:avoid}
  .toolbar,button{display:none}
  .bar[data-state="unmeasured"]{background:${DOC_BORDER_HARD}}
}
`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
