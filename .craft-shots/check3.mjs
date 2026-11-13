const base='http://127.0.0.1:9223';
const list=await (await fetch(base+'/json/list')).json();
const page=list.find(t=>t.type==='page' && t.url.includes('4183'));
const ws=new WebSocket(page.webSocketDebuggerUrl);
let id=0; const pend=new Map();
const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
await new Promise(r=>ws.onopen=r);
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});return r.result?.result?.value;};

// 完整交互流
console.log("1) 侧栏文本:", await ev(`document.querySelector('aside')?.innerText.slice(0,120)`));
console.log("2) 错误捕获:", await ev(`(()=>{const e=[];window.__errs=e;window.addEventListener('error',x=>e.push(x.message));return 'hooked'})()`));
// 关弹窗
await ev(`(()=>{const d=document.querySelector('[role="dialog"]');if(!d)return 'no-dialog';
  const btns=[...d.querySelectorAll('button')];const b=btns.find(x=>/知道了|开始|好的|继续/.test(x.innerText))||btns[btns.length-1];b.click();return b?.innerText||'clicked'})()`);
await new Promise(r=>setTimeout(r,500));
console.log("3) 弹窗已关:", await ev(`!document.querySelector('[role="dialog"]')`));
// 输入
await ev(`(()=>{const t=document.querySelector('[data-composer-input]');if(!t)return'no-input';
  const s=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
  s.call(t,'测试消息');t.dispatchEvent(new Event('input',{bubbles:true}));return 'typed'})()`);
await new Promise(r=>setTimeout(r,300));
console.log("4) 发送按钮可用:", await ev(`!document.querySelector('[aria-label="发送"]')?.disabled`));
await ev(`document.querySelector('[aria-label="发送"]')?.click()`);
await new Promise(r=>setTimeout(r,600));
console.log("5) 消息已渲染:", await ev(`document.body.innerText.includes('测试消息')`));
console.log("6) JS 报错:", await ev(`JSON.stringify(window.__errs||[])`));
// 深色
await ev(`(()=>{const b=document.querySelector('button[aria-label*="深色"]');if(!b)return'no-btn';b.click();return'clicked'})()`);
await new Promise(r=>setTimeout(r,500));
console.log("7) 深色生效:", await ev(`document.documentElement.getAttribute('data-theme')==='dark' || getComputedStyle(document.body).backgroundColor`));
ws.close();
