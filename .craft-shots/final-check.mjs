// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

const base='http://127.0.0.1:9224';
const list=await (await fetch(base+'/json/list')).json();
const page=list.find(t=>t.type==='page'&&t.url.includes('4190'));
const ws=new WebSocket(page.webSocketDebuggerUrl);
let id=0;const pend=new Map();
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
await new Promise(r=>ws.onopen=r);
const errs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails?.text);
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
await send('Runtime.enable');
const ev=async x=>{const r=await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});return r.result?.result?.value;};
const R={};
R.结构=await ev(`(()=>{const q=s=>!!document.querySelector(s);return{aside:q('aside'),hero:document.body.innerText.includes('探索未至之境'),composer:q('[data-composer-input]'),send:q('[aria-label="发送"]'),dialog:q('[role="dialog"]'),workspace:document.body.innerText.includes('工作区')}})()`);
await ev(`(()=>{const d=document.querySelector('[role="dialog"]');if(!d)return 0;const b=[...d.querySelectorAll('button')];(b.find(x=>/知道了|开始|好的/.test(x.innerText))||b[b.length-1]).click();return 1})()`);
await new Promise(r=>setTimeout(r,400));
R.弹窗可关闭=await ev(`!document.querySelector('[role="dialog"]')`);
await ev(`(()=>{const t=document.querySelector('[data-composer-input]');const s=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;s.call(t,'验收消息');t.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
await new Promise(r=>setTimeout(r,300));
R.发送按钮可用=await ev(`!document.querySelector('[aria-label="发送"]')?.disabled`);
await ev(`document.querySelector('[aria-label="发送"]')?.click()`);
await new Promise(r=>setTimeout(r,500));
R.消息可渲染=await ev(`document.body.innerText.includes('验收消息')`);
await ev(`document.querySelector('button[aria-label*="深色"]')?.click()`);
await new Promise(r=>setTimeout(r,400));
R.深色主题=await ev(`document.documentElement.getAttribute('data-theme')==='dark'`);
R.JS异常=errs.length?errs.slice(0,3):'无';
console.log(JSON.stringify(R,null,2));
ws.close();
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
