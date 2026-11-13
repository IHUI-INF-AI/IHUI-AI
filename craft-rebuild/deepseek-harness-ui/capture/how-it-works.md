<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# How it works

Deep mode: what the site's JavaScript is made of and what its start page did while we watched.

## Its JavaScript

Analysed 6 script(s) from http://127.0.0.1:3080/: 2 module(s), 54 endpoint(s), 0 route(s), bundled with vite.

Evidence ev_6b5364113bb694764fa0a161b2a51c7f3c6c38b810eef81c82d0bc067e47396d.

```json
{
  "api_operations": [],
  "app_kind": "unknown",
  "bundlers": [
    "vite"
  ],
  "edges": [
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#C:resize",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#X@28"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#C:scroll",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#X@28"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#E:resize",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#X@28"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#E:scroll",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#X@28"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#F:focus",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#B@132"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#a:click",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#El@57"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#ae.port1:message",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#V@44"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#b:error",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#b.addEventListener(error)@123"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#b:load",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#I@10"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#d:click",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#El@57"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#document:keydown",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#At@56"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#document:keydown",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#Ct@56"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#document:keydown",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#S@132"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#document:pointerdown",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#Ve@56"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#document:pointerdown",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#n@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e.ctx:internal/status",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#e.ctx.on(internal/status)@194"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e.defaultView:blur",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#l@36"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:animationstart",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#e.addEventListener(animationstart)@132"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:blur",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#r@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:compositionend",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#n@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:compositionstart",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#i@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:internal/commit",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#e.on(internal/commit)@20"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:internal/config",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#e.on(internal/config)@20"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:internal/plugin",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#e.on(internal/plugin)@20"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:internal/update",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#e.on(internal/update)@13"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:keydown",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#i@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:keyup",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#s@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:loader/entry-init",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#e.on(loader/entry-init)@20"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:loader/partial-dispose",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#e.on(loader/partial-dispose)@20"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:loader/patch-context",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#e.on(loader/patch-context)@20"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#g:keydown",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#_@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#h:error",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#h.onerror@196"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#h:load",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#h.onload@196"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#h:loadingdone",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#u@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#i.signal:abort",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#i.signal.addEventListener(abort)@194"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#i:finish",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#i.onfinish@132"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#i:scroll",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#h@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#i:scrollend",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#g@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#o:click",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#El@57"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#r:resize",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#i@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#r:scroll",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#i@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#s:touchend",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#u@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#s:touchstart",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#l@36"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#this:internal/config",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#this.on(internal/config)@10"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#this:internal/listener",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#this.on(internal/listener)@10"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#this:internal/update",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#this.on(internal/update)@10"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#u:keydown",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#w@52"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:blur",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#f@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:blur",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#kt@56"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:blur",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#window.addEventListener(blur)@132"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:focusin",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#window.addEventListener(focusin)@132"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:keydown",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#ce@56"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:keydown",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#u@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:keydown",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#window.addEventListener(keydown)@132"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:pointercancel",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#window.addEventListener(pointercancel)@194"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:pointerdown",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#w@52"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:pointerdown",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#window.addEventListener(pointerdown)@132"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:pointermove",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#window.addEventListener(pointermove)@194"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:pointerup",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#window.addEventListener(pointerup)@137"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:resize",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#C@10"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:resize",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#P@44"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:resize",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#ce@56"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:resize",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#g@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:resize",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#u@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:resize",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#ze@56"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:scroll",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#P@44"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:scroll",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#ce@56"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#window:scroll",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#u@2"
    },
    {
      "from": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#y:finish",
      "kind": "handled-by",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#y.onfinish@132"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$3@123",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#Rf@121"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$4@132",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#W0@132"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$4@132",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#de@123"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$4@132",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#hy@132"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$4@132",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#py@132"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$5@57",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#Is@57"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$5@57",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#S5@57"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$5@57",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#Ud@57"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$5@57",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#a@53"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$5@57",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#fn@57"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$5@57",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#r@2"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$@57",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#m0@59"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$@57",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#m@57"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$C@121",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#CC@121"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$a@121",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#W@59"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$f@121",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#W@59"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$g@121",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#W@59"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$h@59",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#Bt@59"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$h@59",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#Hu@56"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$h@59",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#Tr@59"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$h@59",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#a1@59"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$h@59",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#c0@59"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$h@59",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#ii@59"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$h@59",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#lt@123"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$h@59",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#ml@56"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$h@59",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#r@2"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$h@59",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#ri@59"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$h@59",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#ro@59"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$i@123",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#En@123"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$n@59",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#_h@59"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$n@59",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#at@59"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$n@59",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#r@2"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$n@59",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#vh@59"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$t@56",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#ce@56"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$u@132",
      "kind": "listens",
      "to": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e.defaultView:blur"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$u@132",
      "kind": "listens",
      "to": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:compositionend"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$u@132",
      "kind": "listens",
      "to": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:compositionstart"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$u@132",
      "kind": "listens",
      "to": "event:127.0.0.1:3080/assets/index-BgUyXZcc.js#e:keyup"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#$v@123",
      "kind": "calls",
      "to": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#_t@59"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#<anonymous@52>@52",
      "kind": "mentions",
      "to": "endpoint:http://www.w3.org/1999/xlink"
    },
    {
      "from": "fn:127.0.0.1:3080/assets/index-BgUyXZcc.js#<anonymous@52>@52",
      "kind": "mentions",
      "to": "endpoint:http://www.w3.org/XML/1998/namespace"
    },
    {

```

## Ten seconds of it

Watched http://127.0.0.1:3080/ for 10000ms: 0 request outline(s), 0 console entr(y/ies).

Evidence ev_8c39b90d0fd8e7d4d52835785ac110f22698dea625a9715f6e361f05a6ba30b1.

```json
{
  "accessibility": null,
  "console": {
    "count": 0,
    "entries": [],
    "has_text": false
  },
  "dom": {
    "attribute_names": [
      "aria-busy",
      "aria-expanded",
      "aria-haspopup",
      "aria-hidden",
      "aria-keyshortcuts",
      "aria-label",
      "aria-modal",
      "aria-multiline",
      "aria-selected",
      "as",
      "charset",
      "class",
      "clip-path",
      "clip-rule",
      "content",
      "contenteditable",
      "crossorigin",
      "cx",
      "cy",
      "d",
      "data-chain-overlay-fallback",
      "data-collapsed",
      "data-composer-card",
      "data-composer-dock",
      "data-composer-input",
      "data-composer-overlay",
      "data-composer-placeholder",
      "data-composer-seat",
      "data-content-phase",
      "data-context-menu-trigger",
      "data-conversation-content",
      "data-conversation-header-corner",
      "data-conversation-header-leading",
      "data-conversation-region",
      "data-conversation-scroll",
      "data-conversation-session",
      "data-dockkit-add-tab",
      "data-dockkit-drop-zones",
      "data-dockkit-empty",
      "data-dockkit-pane",
      "data-dockkit-pane-active",
      "data-dockkit-split-button",
      "data-dockkit-split-control",
      "data-dockkit-strip",
      "data-dockkit-strip-chrome",
      "data-dockkit-strip-fill",
      "data-dockkit-strip-tabs",
      "data-dockkit-surface",
      "data-ds-dark-theme",
      "data-ds-theme-source",
      "data-dsh-icon-sprite",
      "data-icon",
      "data-input-scroll",
      "data-inset",
      "data-lexical-editor",
      "data-modal-autofocus",
      "data-model-id",
      "data-phase",
      "data-placeholder",
      "data-plugin",
      "data-plugin-css",
      "data-provider-id",
      "data-rightbar-col",
      "data-rightbar-collapsed",
      "data-row-key",
      "data-shell-bottom",
      "data-shell-leading",
      "data-shell-overlay",
      "data-shortcut-modal",
      "data-sidebar-collapsed",
      "data-sidebar-drawer",
      "data-sidebar-mask",
      "data-sidebar-opener",
      "data-sidebar-right-expand",
      "data-sidebar-right-mode",
      "data-sidebar-right-panel",
      "data-sidebar-right-session",
      "data-sidebar-right-toggle",
      "data-sidebar-toggle",
      "data-signed-out",
      "data-slot",
      "data-window-drag",
      "disabled",
      "draggable",
      "fill",
      "fill-rule",
      "height",
      "hidden",
      "href",
      "id",
      "inert",
      "lang",
      "mask",
      "maskunits",
      "maxlength",
      "media",
      "multiple",
      "name",
      "opacity",
      "placeholder",
      "r",
      "rel",
      "role",
      "rx",
      "src",
      "stroke",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-miterlimit",
      "stroke-width",
      "style",
      "tabindex",
      "title",
      "transform",
      "type",
      "value",
      "viewbox",
      "width",
      "x",
      "xmlns",
      "y"
    ],
    "elements_by_name": {
      "base": 1,
      "body": 1,
      "button": 25,
      "circle": 16,
      "clippath": 2,
      "defs": 1,
      "div": 119,
      "g": 4,
      "h2": 1,
      "head": 1,
      "header": 1,
      "html": 1,
      "input": 2,
      "kbd": 5,
      "link": 9,
      "mask": 2,
      "meta": 5,
      "nav": 1,
      "p": 3,
      "path": 513,
      "rect": 25,
      "script": 12,
      "section": 1,
      "span": 49,
      "style": 157,
      "svg": 33,
      "symbol": 196,
      "title": 1,
      "use": 25
    },
    "text_nodes": 194,
    "total_nodes": 1408,
    "truncated": false
  },
  "dropped_events": 0,
  "frame_origins": ["http://127.0.0.1:3080"],
  "network": {
    "request_count": 0,
    "requests": []
  },
  "origin": "http://127.0.0.1:3080/",
  "resources": [
    {
      "mime_type": "text/javascript",
      "type": "Script",
      "url": "http://127.0.0.1:3080/plugins/??@deepseek-ai/dsh-client-modules/client.js&rev=63b923339a28"
    }
  ],
  "scripts": [
    {
      "length": 264,
      "source_map_url": null,
      "url": "http://127.0.0.1:3080/"
    },
    {
      "length": 46592,
      "source_map_url": "??@deepseek-ai/dsh-client-modules/client.js.map&rev=63b923339a28",
      "url": "http://127.0.0.1:3080/plugins/??@deepseek-ai/dsh-client-modules/client.js&rev=63b923339a28"
    },
    {
      "length": 738320,
      "source_map_url": "vendor-BUMdD3V7.js.map",
      "url": "http://127.0.0.1:3080/assets/vendor-BUMdD3V7.js"
    },
    {
      "length": 951974,
      "source_map_url": "index-BgUyXZcc.js.map",
      "url": "http://127.0.0.1:3080/assets/index-BgUyXZcc.js"
    },
    {
      "length": 2552831,
      "source_map_url": "??@deepseek-ai/dsh-client-ui-settings-subagent/client.js.map,@deepseek-ai/dsh-client-ui-settings-web-search/client.js.map,@deepseek-ai/dsh-client-ui-plan/client.js.map,@deepseek-ai/dsh-client-ui-user-questions/client.js.map,@deepseek-ai/dsh-client-ui-trajectory/client.js.map,@deepseek-ai/dsh-api-remote-access/client.js.map,@deepseek-ai/dsh-session-log-export/client.js.map,@deepseek-ai/dsh-client-file-upload/client.js.map,@deepseek-ai/dsh-api-remotes/client.js.map,@deepseek-ai/dsh-client-ui-deliverables/client.js.map,@deepseek-ai/dsh-typert-registry/client.js.map,@deepseek-ai/dsh-client-connection/client.js.map,@deepseek-ai/dsh-api-workspace-controller/client.js.map,@deepseek-ai/dsh-api-session-controller/client.js.map,@deepseek-ai/dsh-client-ui-directory-picker-native/client.js.map&rev=d88e09509dcc",
      "url": "http://127.0.0.1:3080/plugins/??@deepseek-ai/dsh-client-ui-settings-subagent/client.js,@deepseek-ai/dsh-client-ui-settings-web-search/client.js,@deepseek-ai/dsh-client-ui-plan/client.js,@deepseek-ai/dsh-client-ui-user-questions/client.js,@deepseek-ai/dsh-client-ui-trajectory/client.js,@deepseek-ai/dsh-api-remote-access/client.js,@deepseek-ai/dsh-session-log-export/client.js,@deepseek-ai/dsh-client-file-upload/client.js,@deepseek-ai/dsh-api-remotes/client.js,@deepseek-ai/dsh-client-ui-deliverables/client.js,@deepseek-ai/dsh-typert-registry/client.js,@deepseek-ai/dsh-client-connection/client.js,@deepseek-ai/dsh-api-workspace-controller/client.js,@deepseek-ai/dsh-api-session-controller/client.js,@deepseek-ai/dsh-client-ui-directory-picker-native/client.js&rev=d88e09509dcc"
    },
    {
      "length": 7129812,
      "source_map_url": "??@deepseek-ai/dsh-api-gateway/client.js.map,@deepseek-ai/dsh-client-ui-file-actions/client.js.map,@deepseek-ai/dsh-client-ui-context-menu/client.js.map,@deepseek-ai/dsh-client-ui-open-in-app/client.js.map,@deepseek-ai/dsh-api-job-controller/client.js.map,@deepseek-ai/dsh-api-terminal-controller/client.js.map,@deepseek-ai/dsh-api-workspace-files/client.js.map,@deepseek-ai/dsh-client-ui-settings-account/client.js.map,@deepseek-ai/dsh-client-hmr/client.js.map,@deepseek-ai/dsh-cordis-client-runner/client.js.map,@deepseek-ai/dsh-client-ui-theme/client.js.map,@deepseek-ai/dsh-client-locale/client.js.map,@deepseek-ai/dsh-client-shortcuts/client.js.map,@deepseek-ai/dsh-client-ui-shortcuts/client.js.map,@deepseek-ai/dsh-client-ui-layout/client.js.map,@deepseek-ai/dsh-client-ui-renderer/client.js.map,@deepseek-ai/dsh-client-ui-session/client.js.map,@deepseek-ai/dsh-client-resources/client.js.map,@deepseek-ai/dsh-client-ui-sidebar/client.js.map,@deepseek-ai/dsh-client-ui-sidebar-right/client.js.map,@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client.js.map,@deepseek-ai/dsh-client-ui-sidebar-terminal/client.js.map,@deepseek-ai/dsh-client-ui-sidebar-files/client.js.map,@deepseek-ai/dsh-client-ui-settings/client.js.map,@deepseek-ai/dsh-client-ui-settings-general/client.js.map,@deepseek-ai/dsh-client-ui-settings-models/client.js.map,@deepseek-ai/dsh-client-ui-plugin-manager/client.js.map,@deepseek-ai/dsh-client-ui-settings-plugin-inventory/client.js.map,@deepseek-ai/dsh-client-ui-conversation/client.js.map,@deepseek-ai/dsh-client-ui-approval/client.js.map,@deepseek-ai/dsh-message-quotes/client.js.map,@deepseek-ai/dsh-client-ui-chat/client.js.map,@deepseek-ai/dsh-client-ui-brand-official/client.js.map,@deepseek-ai/dsh-client-ui-attachment/client.js.map,@deepseek-ai/dsh-client-ui-file-drag/client.js.map,@deepseek-ai/dsh-client-ui-tool/client.js.map,@deepseek-ai/dsh-client-ui-cordis/client.js.map,@deepseek-ai/dsh-client-ui-workspace/client.js.map,@deepseek-ai/dsh-client-ui-workflow-run/client.js.map,@deepseek-ai/dsh-client-ui-input-trigger/client.js.map,@deepseek-ai/dsh-client-ui-commands/client.js.map,@deepseek-ai/dsh-client-ui-skill/client.js.map,@deepseek-ai/dsh-client-ui-subagent/client.js.map,@deepseek-ai/dsh-client-ui-reference/client.js.map,@deepseek-ai/dsh-client-ui-secret-mask/client.js.map,@deepseek-ai/dsh-client-ui-jobs/client.js.map,@deepseek-ai/dsh-client-ui-schedule/client.js.map,@deepseek-ai/dsh-client-ui-goal/client.js.map,@deepseek-ai/dsh-client-ui-message-feedback/client.js.map,@deepseek-ai/dsh-client-ui-model-selection/client.js.map,@deepseek-ai/dsh-client-ui-permission-presets/client.js.map,@deepseek-ai/dsh-client-ui-agent-preset/client.js.map,@deepseek-ai/dsh-client-ui-entry-customization/client.js.map,@deepseek-ai/dsh-client-ui-settings-session-log/client.js.map,@deepseek-ai/dsh-client-ui-settings-plugins/client.js.map,@deepseek-ai/dsh-client-ui-settings-shell/client.js.map,@deepseek-ai/dsh-client-ui-settings-agent-loop/client.js.map&rev=3f43bf9f8285",
      "url": "http://127.0.0.1:3080/plugins/??@deepseek-ai/dsh-api-gateway/client.js,@deepseek-ai/dsh-client-ui-file-actions/client.js,@deepseek-ai/dsh-client-ui-context-menu/client.js,@deepseek-ai/dsh-client-ui-open-in-app/client.js,@deepseek-ai/dsh-api-job-controller/client.js,@deepseek-ai/dsh-api-terminal-controller/client.js,@deepseek-ai/dsh-api-workspace-files/client.js,@deepseek-ai/dsh-client-ui-settings-account/client.js,@deepseek-ai/dsh-client-hmr/client.js,@deepseek-ai/dsh-cordis-client-runner/client.js,@deepseek-ai/dsh-client-ui-theme/client.js,@deepseek-ai/dsh-client-locale/client.js,@deepseek-ai/dsh-client-shortcuts/client.js,@deepseek-ai/dsh-client-ui-shortcuts/client.js,@deepseek-ai/dsh-client-ui-layout/client.js,@deepseek-ai/dsh-client-ui-renderer/client.js,@deepseek-ai/dsh-client-ui-session/client.js,@deepseek-ai/dsh-client-resources/client.js,@deepseek-ai/dsh-client-ui-sidebar/client.js,@deepseek-ai/dsh-client-ui-sidebar-right/client.js,@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client.js,@deepseek-ai/dsh-client-ui-sidebar-terminal/client.js,@deepseek-ai/dsh-client-ui-sidebar-files/client.js,@deepseek-ai/dsh-client-ui-settings/client.js,@deepseek-ai/dsh-client-ui-settings-general/client.js,@deepseek-ai/dsh-client-ui-settings-models/client.js,@deepseek-ai/dsh-client-ui-plugin-manager/client.js,@deepseek-ai/dsh-client-ui-settings-plugin-inventory/client.js,@deepseek-ai/dsh-client-ui-conversation/client.js,@deepseek-ai/dsh-client-ui-approval/client.js,@deepseek-ai/dsh-message-quotes/client.js,@deepseek-ai/dsh-client-ui-chat/client.js,@deepseek-ai/dsh-client-ui-brand-official/client.js,@deepseek-ai/dsh-client-ui-attachment/client.js,@deepseek-ai/dsh-client-ui-file-drag/client.js,@deepseek-ai/dsh-client-ui-tool/client.js,@deepseek-ai/dsh-client-ui-cordis/client.js,@deepseek-ai/dsh-client-ui-workspace/client.js,@deepseek-ai/dsh-client-ui-workflow-run/client.js,@deepseek-ai/dsh-client-ui-input-trigger/client.js,@deepseek-ai/dsh-client-ui-commands/client.js,@deepseek-ai/dsh-client-ui-skill/client.js,@deepseek-ai/dsh-client-ui-subagent/client.js,@deepseek-ai/dsh-client-ui-reference/client.js,@deepseek-ai/dsh-client-ui-secret-mask/client.js,@deepseek-ai/dsh-client-ui-jobs/client.js,@deepseek-ai/dsh-client-ui-schedule/client.js,@deepseek-ai/dsh-client-ui-goal/client.js,@deepseek-ai/dsh-client-ui-message-feedback/client.js,@deepseek-ai/dsh-client-ui-model-selection/client.js,@deepseek-ai/dsh-client-ui-permission-presets/client.js,@deepseek-ai/dsh-client-ui-agent-preset/client.js,@deepseek-ai/dsh-client-ui-entry-customization/client.js,@deepseek-ai/dsh-client-ui-settings-session-log/client.js,@deepseek-ai/dsh-client-ui-settings-plugins/client.js,@deepseek-ai/dsh-client-ui-settings-shell/client.js,@deepseek-ai/dsh-client-ui-settings-agent-loop/client.js&rev=3f43bf9f8285"
    }
  ],
  "scripts_truncated": false,
  "secret_redactions": 0,
  "storage_keys": null,
  "watch_ms": 10000,
  "websockets": {
    "connections": [],
    "frames": []
  }
}
```

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
