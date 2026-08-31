// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { ALL_CSS_KEYS } from './css-config'
import type { TreeNode } from './design-types'

/** 构造 iframe srcDoc:用户 HTML + 暗黑适配 + 选/改 style + 树节点定位 注入脚本。 */
function buildSrcDoc(html: string, isDark: boolean): string {
  const bg = isDark ? '#0a0a0a' : '#ffffff'
  const fg = isDark ? '#f5f5f5' : '#111111'
  // camelCase → kebab-case for getComputedStyle keys
  const propsJson = JSON.stringify(ALL_CSS_KEYS)
  const script = `<script data-ihui-injected="true">(function(){
document.documentElement.style.background='${bg}';
document.documentElement.style.color='${fg}';
var PROPS=${propsJson};
function toKebab(s){return s.replace(/([A-Z])/g,function(m){return '-'+m.toLowerCase();});}
var selected=null;
var dragging=null;
var dragStarted=false;
var suppressClick=false;
var dragThreshold=3;
var guideOverlay=null;
function gs(el){var s={};var cs=getComputedStyle(el);PROPS.forEach(function(p){var k=toKebab(p);s[p]=cs.getPropertyValue(k);});return s;}
function notify(){if(selected){parent.postMessage({__ihui:true,type:'select',elementId:selected.id||'',tagName:selected.tagName,text:(selected.textContent||'').slice(0,80),style:gs(selected)},'*');}}
function highlight(el){if(selected) selected.style.outline='';selected=el;selected.style.outline='2px solid hsl(142 71% 45%)';selected.scrollIntoView({block:'center',behavior:'smooth'});notify();}
function ensureOverlay(){if(!guideOverlay){guideOverlay=document.createElement('div');guideOverlay.setAttribute('data-ihui-injected','true');guideOverlay.style.cssText='position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:99999;';document.body.appendChild(guideOverlay);}return guideOverlay;}
function renderGuides(guides){var ov=ensureOverlay();ov.innerHTML='';for(var i=0;i<guides.length;i++){var g=guides[i];var line=document.createElement('div');line.style.cssText='position:absolute;background:#ef4444;';if(g.type==='h'){line.style.left=g.start+'px';line.style.top=g.position+'px';line.style.width=(g.end-g.start)+'px';line.style.height='1px';}else{line.style.left=g.position+'px';line.style.top=g.start+'px';line.style.width='1px';line.style.height=(g.end-g.start)+'px';}ov.appendChild(line);}}
function clearGuides(){if(guideOverlay){guideOverlay.innerHTML='';}}
function collectSiblings(el){var sibs=[];var p=el.parentElement;if(!p)return sibs;var ch=p.children;for(var i=0;i<ch.length;i++){var c=ch[i];if(c===el)continue;if(c.tagName==='SCRIPT'||c.tagName==='STYLE')continue;if(c.getAttribute&&c.getAttribute('data-ihui-injected')==='true')continue;var r=c.getBoundingClientRect();if(r.width<=0||r.height<=0)continue;sibs.push({id:c.id||('el'+i),x:r.left,y:r.top,width:r.width,height:r.height});}return sibs;}
document.addEventListener('click',function(e){
if(suppressClick){e.preventDefault();e.stopPropagation();suppressClick=false;return;}
e.preventDefault();e.stopPropagation();
highlight(e.target);
},true);
document.addEventListener('mousedown',function(e){
var el=e.target;
if(el===document.body||el===document.documentElement)return;
if(el.tagName==='SCRIPT'||el.tagName==='STYLE')return;
if(el.getAttribute&&el.getAttribute('data-ihui-injected')==='true')return;
var pos=getComputedStyle(el).position;
if(pos==='static'){el.style.position='relative';}
dragging={el:el,startX:e.clientX,startY:e.clientY,origLeft:el.offsetLeft,origTop:el.offsetTop,id:el.id||'',snapOffsetX:0,snapOffsetY:0};
dragStarted=false;
},true);
document.addEventListener('mousemove',function(e){
if(!dragging)return;
var dx=e.clientX-dragging.startX;
var dy=e.clientY-dragging.startY;
if(!dragStarted){if(Math.abs(dx)<dragThreshold&&Math.abs(dy)<dragThreshold)return;dragStarted=true;}
e.preventDefault();
dragging.el.style.left=(dragging.origLeft+dx+dragging.snapOffsetX)+'px';
dragging.el.style.top=(dragging.origTop+dy+dragging.snapOffsetY)+'px';
var myRect=dragging.el.getBoundingClientRect();
parent.postMessage({__ihui:true,type:'drag-move',elementId:dragging.id,rect:{id:dragging.id,x:myRect.left,y:myRect.top,width:myRect.width,height:myRect.height},others:collectSiblings(dragging.el)},'*');
},true);
document.addEventListener('mouseup',function(e){
if(!dragging)return;
if(dragStarted){
e.preventDefault();
suppressClick=true;
var clone=document.body.cloneNode(true);
var injected=clone.querySelectorAll('[data-ihui-injected="true"]');
for(var i=0;i<injected.length;i++){injected[i].parentNode.removeChild(injected[i]);}
parent.postMessage({__ihui:true,type:'drag-end',html:clone.innerHTML},'*');
clearGuides();
}
dragging=null;
dragStarted=false;
},true);
window.addEventListener('message',function(e){
var d=e.data;if(!d||d.__ihui!==true)return;
if(d.type==='update-style'){if(selected){Object.keys(d.style).forEach(function(k){selected.style.setProperty(toKebab(k),d.style[k]);});}return;}
if(d.type==='reset-style'){if(selected){PROPS.forEach(function(p){selected.style.removeProperty(toKebab(p));});notify();}return;}
if(d.type==='scroll-to-element'){
var target=null;
if(d.elementId){target=document.getElementById(d.elementId);}
else if(d.tagName){var els=document.getElementsByTagName(d.tagName);target=els[d.index]||els[0];}
if(target){highlight(target);}
return;
}
if(d.type==='render-guides'){renderGuides(d.guides||[]);return;}
if(d.type==='clear-guides'){clearGuides();return;}
if(d.type==='apply-snap'){if(dragging&&dragStarted){var cr=dragging.el.getBoundingClientRect();var dX=d.x-cr.left;var dY=d.y-cr.top;dragging.snapOffsetX+=dX;dragging.snapOffsetY+=dY;var cl=parseFloat(dragging.el.style.left)||0;var ct=parseFloat(dragging.el.style.top)||0;dragging.el.style.left=(cl+dX)+'px';dragging.el.style.top=(ct+dY)+'px';}return;}
});
})();<\/script>`
  return html + script
}

/** 用 DOMParser 解析 HTML 字符串生成组件树(同步,无 postMessage 复杂度)。 */
function parseHtmlToTree(html: string): TreeNode {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return { tagName: 'body', id: '', className: '', index: 0, children: [] }
  }
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    return walkElement(doc.body)
  } catch {
    return { tagName: 'body', id: '', className: '', index: 0, children: [] }
  }
}

/** 递归遍历 Element 生成 TreeNode(跳过 script/style 等非可视化节点)。 */
function walkElement(el: Element, index = 0): TreeNode {
  const SKIP_TAGS = new Set(['script', 'style', 'head', 'meta', 'link', 'title'])
  const children: TreeNode[] = []
  let sameTagCounter = 0
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase()
    if (SKIP_TAGS.has(tag)) continue
    const myIndex = sameTagCounter++
    children.push(walkElement(child, myIndex))
  }
  return {
    tagName: el.tagName.toLowerCase(),
    id: el.id ?? '',
    className: typeof el.className === 'string' ? el.className : '',
    index,
    children,
  }
}

/** 把 rgb()/rgba() 转 #hex,便于 <input type="color"> 回填;非颜色值原样返回。 */
function normalizeColorHex(v: string): string {
  if (!v) return ''
  const m = v.match(/rgba?\(([^)]+)\)/i)
  if (!m || !m[1]) return v
  const parts = m[1].split(',').map((s) => s.trim())
  if (parts.length < 3) return v
  const toHex = (n: string) => {
    const num = parseFloat(n)
    if (Number.isNaN(num)) return '00'
    return Math.max(0, Math.min(255, Math.round(num)))
      .toString(16)
      .padStart(2, '0')
  }
  return '#' + toHex(parts[0] ?? '0') + toHex(parts[1] ?? '0') + toHex(parts[2] ?? '0')
}

/** 从带单位字符串中提取数字部分(用于 number 输入回填)。 */
function extractNumber(v: string): string {
  if (!v) return ''
  const m = v.match(/^-?\d*\.?\d+/)
  return m ? m[0] : ''
}

export { buildSrcDoc, parseHtmlToTree, normalizeColorHex, extractNumber }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
