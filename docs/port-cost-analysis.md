# 椤圭洰绔彛鍒嗘瀽涓庣淮鎶ゆ垚鏈紭鍖?
> **Workspace:** g:\IHUI-AI

---

**User**

鏈」鐩殑鍏ㄩ儴绔彛閮芥湁鍝簺  璇峰叏閮ㄦ繁搴﹁缁嗗垪鍑烘潵   骞朵笖鍒嗘瀽缁欐垜鐜板湪涓€濂椾唬鐮佺殑瀹為檯缁存姢鎴愭湰   杩樻湁鍙紭鍖栫殑鐐?
**Assistant**

鎴戞潵璋冪爺 IHUI-AI monorepo 鐨勪唬鐮佷綋绉拰缁存姢鎴愭湰鏁版嵁銆傝繖鏄竴涓函鐮旂┒浠诲姟,涓嶅仛浠讳綍浠ｇ爜淇敼銆?
璁╂垜鍏堝垱寤轰换鍔¤鍒?鐒跺悗骞惰鏀堕泦鍚勭被鏁版嵁銆?
鍏堟帰绱㈢洰褰曠粨鏋?纭瀛樺湪鍝簺绔?鐒跺悗骞惰杩愯缁熻鍛戒护銆?
鐩綍缁撴瀯娓呮櫚:8 涓?apps + 14 涓?packages銆傜幇鍦ㄥ苟琛岃繍琛岀粺璁″懡浠ゃ€傚厛鍋氫唬鐮佷綋绉粺璁?浠诲姟1),鐢ㄤ竴涓ぇ鑴氭湰涓€娆℃€у畬鎴愩€?
浠ｇ爜浣撶Н缁熻瀹屾垚(鎬昏 5774 鏂囦欢 / 969,388 琛?銆俛pps/desktop 鏄剧ず 0 鏂囦欢,闇€纭銆傚苟琛岃繍琛屽悗缁粺璁′换鍔°€?
骞惰杩愯 5 涓粺璁″懡浠?desktop 楠岃瘉銆佸畧闂ㄨ剼鏈?top5銆乸re-commit hook銆佷緷璧栬妯°€乮18n銆?
apps/desktop 涓昏鏄?Tauri(Rust)缁撴瀯,婧愮爜鍦?src-tauri銆傜户缁苟琛岃繍琛屽叾浠栫粺璁°€?
Task 2 瀹屾垚:95 涓?mjs 鑴氭湰,22936 琛屻€傜幇鍦ㄥ苟琛岃繍琛?pre-commit hook 璇诲彇銆佷緷璧栫粺璁°€乮18n 缁熻銆乨esktop 婧愮爜纭銆?
pre-commit hook 璇诲彇瀹屾垚:guardian-runner 鎵ц 40 椤?27 blocking + 11 warn + 2 info)+ lint-staged + 3 鏉′欢闂搁棬(16/16b/16c)銆傜户缁苟琛岃繍琛屼緷璧栥€乮18n銆丩LM provider銆佽矾鐢便€乨ocker+娴嬭瘯缁熻銆?
Task 4 瀹屾垚:8 涓?package.json,鍚堣 308 涓緷璧?198 dep + 110 dev,鏈幓閲?銆傜户缁苟琛岃繍琛?i18n銆丩LM provider銆佽矾鐢便€乨ocker+娴嬭瘯銆?
i18n 鏈?5 涓瑷€鏂囦欢,浣?zh-CN 椤跺眰 key 璁℃暟杩斿洖 0,闇€鎺掓煡缁撴瀯銆傚苟琛岃繍琛?zh-CN 缁撴瀯妫€鏌ャ€丩LM provider銆佽矾鐢便€乨ocker+娴嬭瘯銆?
zh-CN.json 鏄祵濂楃粨鏋?椤跺眰 key 濡?"skills")銆傞噸鏂拌鏁伴《灞?key,骞惰杩愯 LLM provider銆佽矾鐢便€乨ocker+娴嬭瘯銆?
i18n:5 璇█鏂囦欢,zh-CN.json 29044 琛屻€傞《灞?key 鏁?590 闇€楠岃瘉銆傚苟琛岃繍琛?zh-CN key 澶嶉獙銆丩LM provider銆佽矾鐢辩粺璁°€乨ocker+娴嬭瘯銆?
PowerShell 5.1 鐨?ConvertFrom-Json 瀵瑰ぇ JSON 鏈?bug銆傛敼鐢?node 绮剧‘璁℃暟,骞惰杩愯 LLM provider銆佽矾鐢便€乨ocker銆佹祴璇?TODO銆?
i18n 纭:5 璇█,zh-CN 椤跺眰 590 key / 閫掑綊 26791 key銆傚苟琛岃繍琛?LLM provider銆佽矾鐢便€乨ocker銆佹祴璇曘€乀ODO 缁熻銆?
Task 6 瀹屾垚:config.py 155 琛?24 涓?*_api_key + 7 涓?*_api_base(绾?24-27 涓?LLM provider)銆傜户缁苟琛岃繍琛岃矾鐢便€乨ocker銆佹祴璇曘€乀ODO 缁熻銆?
Task 7 瀹屾垚:API 璺敱 429 .ts / ai-service v1 8 .py / web 615 page.tsx銆傚苟琛岃繍琛?docker 鏈嶅姟銆佹祴璇曟枃浠躲€乀ODO 鏍囪缁熻銆?
root docker-compose.yml 杩斿洖 0 鏈嶅姟,闇€鎺掓煡銆傚苟琛岃繍琛?root compose 妫€鏌ャ€佹祴璇曟枃浠躲€乀ODO 鏍囪銆?
root compose 鏈?services 浣嗚鏁拌繑鍥?0(鍙兘姝ｅ垯闂)銆傚苟琛?閲嶈 root compose 鏈嶅姟銆佹祴璇曟枃浠躲€乀ODO 鏍囪銆?
root compose 鐨?`services:` 琛屾湭琚尮閰?鍙兘鏈夌紪鐮侀棶棰樸€傚苟琛?璋冭瘯 compose + 娴嬭瘯鏂囦欢 + TODO銆?
root compose 瀹為檯鏈?14 涓湇鍔?api, worker, web, ai-service, db, migrate, redis, jaeger, otel-collector, prometheus, grafana, node-exporter, loki, promtail)+ 1 network + 4 volumes銆傜姸鎬佹満澶辫触鏄?PS 5.1 榛樿缂栫爜闂銆傜幇鍦ㄥ苟琛岃繍琛屾祴璇曟枃浠?+ TODO 缁熻銆?
Task 9 瀹屾垚:468 涓祴璇曟枃浠?55 e2e + 282 api + 131 ai-service)銆傜幇鍦ㄧ粺璁?TODO/FIXME/HACK/XXX 鏍囪銆?
Task 10 瀹屾垚:TODO 563 / FIXME 16 / HACK 154 / XXX 1937 / 鍚堣 2670(XXX 鍙兘鍚ぇ灏忓啓涓嶆晱鎰熺殑璇尮閰?銆傛渶鍚庣‘璁?apps/desktop 婧愮爜(Tauri/Rust 缁撴瀯)銆?
apps/desktop 鏄?Tauri 搴旂敤:3 涓?.rs 鏂囦欢 / 950 琛?Rust 婧愮爜銆傛墍鏈夋暟鎹敹闆嗗畬姣曘€俛pi 璺敱 429 鍋忛珮,鍋氭渶鍚庝竴娆￠獙璇?+ 鏇存柊 todo銆?
鎵€鏈夋暟鎹敹闆嗗畬鎴愩€傛洿鏂颁换鍔＄姸鎬佸苟姹囨€绘姤鍛娿€?
# IHUI-AI Monorepo 浠ｇ爜浣撶Н涓庣淮鎶ゆ垚鏈皟鐮旀姤鍛?
绾爺绌朵换鍔?鏈慨鏀逛换浣曟枃浠躲€傛墍鏈夋暟鎹€氳繃 PowerShell `Get-ChildItem` + `Measure-Object` + `Select-String` 缁熻,鎺掗櫎 `node_modules`/`dist`/`.next`/`.turbo`/`build`/`.output`/`.venv`/`__pycache__`/`.git`/`target`/`*.lock`銆?
## 1. 鍚勭浠ｇ爜浣撶Н

婧愮爜鎵╁睍鍚?`.ts/.tsx/.js/.jsx/.mjs/.cjs/.py`

| 鐩綍 | 婧愮爜鏂囦欢鏁?| 鎬昏鏁?| 澶囨敞 |
|---|---|---|---|
| apps/web | 2576 | 335,429 | Next.js 15 鍓嶇,浣撶Н鏈€澶х |
| apps/api | 1166 | 273,688 | Fastify 5 鍚庣 |
| apps/ai-service | 335 | 118,692 | FastAPI AI 鏈嶅姟(Python) |
| apps/cli | 268 | 60,392 | CLI 宸ュ叿 |
| apps/desktop | 0 (TS/JS/Py) | 0 | Tauri 搴旂敤,婧愮爜涓?Rust:3 涓?.rs / 950 琛?|
| apps/extension | 86 | 10,251 | 娴忚鍣ㄦ墿灞?|
| apps/mobile-rn | 224 | 29,683 | React Native 绉诲姩绔?|
| apps/miniapp-taro | 551 | 59,594 | Taro 4 灏忕▼搴?|
| packages/* | 460 | 56,924 | 14 涓叡浜寘 |
| scripts | 108 | 24,735 | 瀹堥棬/宸ュ叿鑴氭湰 |
| **鍚堣** | **5774** (+3 .rs) | **969,388** (+950) | **绾?97 涓囪婧愮爜** |

## 2. 瀹堥棬鑴氭湰鏁伴噺涓庡鏉傚害(scripts/*.mjs)

- **鎬绘暟:95 涓?.mjs 鑴氭湰 / 22,936 琛?*
- (scripts 鐩綍鏁翠綋 108 鏂囦欢 / 24,735 琛?鍚?.ps1/.json 绛夊叾浠栫被鍨?

**Top 5(琛屾暟鏈€澶?:**

| 鎺掑悕 | 鏂囦欢 | 琛屾暟 |
|---|---|---|
| 1 | fix-i18n-deep.mjs | 1423 |
| 2 | audit-migration-frontend-routes.mjs | 888 |
| 3 | audit-migration-db-fields.mjs | 839 |
| 4 | audit-migration-api-routes-v2.mjs | 757 |
| 5 | audit-migration-i18n.mjs | 746 |

## 3. pre-commit hook 瀹堥棬椤规暟

璇诲彇 `g:\IHUI-AI\.husky\pre-commit`(85 琛?:

| 绫诲埆 | 鏁伴噺 | 璇存槑 |
|---|---|---|
| guardian-runner 鎵归噺妫€鏌?| 40 椤?| 27 blocking + 11 warn + 2 info |
| lint-staged | 1 椤?| 椤?5(eslint + prettier) |
| 鏉′欢 typecheck 闂搁棬 | 1 椤?| 椤?16(浠?apps/web staged) |
| 鏉′欢 database 閲嶅缓闂搁棬 | 1 椤?| 椤?16b(浠?packages/database/src staged) |
| 鏉′欢 RN global.css 鍚屾 | 1 椤?| 椤?16c(浠?mobile-rn/tokens.css staged) |
| **妫€鏌ョ偣鎬昏** | **44** | 鈥?|

## 4. 渚濊禆瑙勬ā(8 涓?package.json,鏈幓閲?

| 鍖?| dependencies | devDependencies | 鍚堣 |
|---|---|---|---|
| root package.json | 0 | 13 | 13 |
| apps/api | 61 | 21 | 82 |
| apps/web | 62 | 31 | 93 |
| apps/mobile-rn | 32 | 10 | 42 |
| apps/miniapp-taro | 21 | 14 | 35 |
| apps/cli | 14 | 7 | 21 |
| apps/extension | 8 | 12 | 20 |
| apps/desktop | 0 | 2 | 2 |
| **鍚堣(鏈幓閲?** | **198** | **110** | **308** |

> ai-service 涓?Python,鏃?package.json(鐢?pyproject.toml/requirements)銆?
## 5. i18n 璇█鏁板拰 key 鏁?
- **璇█鏂囦欢鏁?5 涓?*(apps/web/messages/):`en.json` / `ja.json` / `ko.json` / `zh-CN.json` / `zh-TW.json`
- **zh-CN.json(鍩哄噯璇█):**
  - 椤跺眰 key 鏁?**590**
  - 閫掑綊 key 鎬绘暟:**26,791**
  - 鏂囦欢琛屾暟:**29,044 琛?*
- 鍙?apps/miniapp-taro/src/i18n/zh-CN.ts 瀛樺湪(灏忕▼搴忕鐙珛 i18n)

## 6. LLM provider 鏁伴噺

璇诲彇 `g:\IHUI-AI\apps\ai-service\app\core\config.py`(155 琛?:

- **`*_api_key` 瀛楁:24 涓?*(鍞竴鍘婚噸)
- **`*_api_base` 瀛楁:7 涓?*(鍞竴鍘婚噸)

**24 涓?api_key provider**:agnes, aihorde, ainative, alibaba_intl, anthropic, bazaarlink, cerebras, cohere, gemini, groq, huggingface, inference_net, llm7, mistral, modal, nlp_cloud, nvidia, openai, openrouter, reka, routeway, scaleway, stepfun, zai

**7 涓?api_base**(鍏朵腑 kilo/ovh/pollinations 鏃?api_key,涓哄厤璐?provider):agnes, aihorde, kilo, llm7, ovh, pollinations, stepfun

> **LLM provider 绾?24-27 涓?*(24 涓渶 key + 3 涓粎 base 鐨勫厤璐?provider)銆?
## 7. 璺敱 / API 绔偣鏁?
| 绔?| 鏂囦欢绫诲瀷 | 鏁伴噺 | 璇存槑 |
|---|---|---|---|
| apps/api/src/routes | *.ts | 429(閫掑綊)/ 227(鐩存帴) | 鍚瓙鐩綍 admin/admin-extended/admin-sys/ai-vendors/community/learn/other/user/ws/__tests__ |
| apps/ai-service/app/api/v1 | *.py | 8 | AI 鏈嶅姟 v1 鎺ュ彛 |
| apps/web/app | page.tsx | 615(閫掑綊) | Next.js 椤甸潰(鍏ㄥ湪瀛愮洰褰?鐩存帴 0) |

## 8. Docker compose 鏈嶅姟鎬绘暟

| compose 鏂囦欢 | 鏈嶅姟鏁?| 鏈嶅姟鍚?|
|---|---|---|
| docker-compose.yml(鏍? | 14 | api, worker, web, ai-service, db, migrate, redis, jaeger, otel-collector, prometheus, grafana, node-exporter, loki, promtail |
| deploy/saas/docker-compose.yml | 3 | admin-api, prometheus, grafana |
| deploy/observability/docker-compose.observability.yml | 4 | otel-collector, jaeger, prometheus, grafana |
| **鍚堣** | **21** | 璺ㄦ枃浠舵湁閲嶅(prometheus/grafana/jaeger/otel-collector 鍦ㄥ鏂囦欢鍑虹幇) |

> 娉?鏍?compose 鍙︽湁 1 涓?network(ihui-net)+ 4 涓?volumes(pgdata/redisdata/prometheusdata/grafanadata),涓嶈鍏ユ湇鍔℃暟銆?
## 9. 娴嬭瘯鏂囦欢鏁?
| 娴嬭瘯鐩綍 | 妯″紡 | 鏁伴噺 |
|---|---|---|
| apps/web/e2e | *.spec.ts | 55 |
| apps/api/tests | *.test.ts | 282 |
| apps/ai-service/tests | test_*.py | 131 |
| **鍚堣** | 鈥?| **468** |

## 10. TODO/FIXME/HACK/XXX 鏍囪鏁?
鎵弿 15,279 涓簮鐮佹枃浠?.ts/.tsx/.js/.jsx/.mjs/.cjs/.py/.json/.yml/.yaml/.css/.md/.html/.vue/.rs/.go),鎺掗櫎鏋勫缓浜х墿:

| 鏍囪 | 鏁伴噺 |
|---|---|
| TODO | 563 |
| FIXME | 16 |
| HACK | 154 |
| XXX | 1937 |
| **鍚堣** | **2670** |

> 娉?Select-String 榛樿澶у皬鍐欎笉鏁忔劅,XXX 鏁?1937)鍙兘鍚皬鍐?`xxx` 鍙橀噺鍚?鍗犱綅绗﹁鍖归厤;TODO/FIXME/HACK 涓烘敞閲婃爣璁颁富涓讳綋銆?
---

## 缁存姢鎴愭湰鍏抽敭鎸囨爣姹囨€?
| 鎸囨爣 | 鏁板€?| 缁存姢鎴愭湰淇″彿 |
|---|---|---|
| 鎬绘簮鐮佽鏁?| ~97 涓囪(969,388 + 950 Rust) | 澶у瀷 monorepo |
| 婧愮爜鏂囦欢鏁?| 5,777 | 鈥?|
| 绔暟閲?| 8 绔?web/api/ai-service/cli/desktop/extension/mobile-rn/miniapp-taro) | 澶氱鍚屾璐熸媴閲?|
| 鍏变韩鍖呮暟閲?| 14 涓?packages/*) | 鈥?|
| 瀹堥棬鑴氭湰 | 95 涓?.mjs / 22,936 琛?| 瀹堥棬鍩虹璁炬柦搴炲ぇ |
| pre-commit 妫€鏌ョ偣 | 44 涓?27 blocking) | 鎻愪氦闂ㄦ楂?|
| 渚濊禆鎬绘暟(鏈幓閲? | 308(8 涓?package.json) | 鈥?|
| i18n 璇█鏁?| 5 璇█ / 590 椤跺眰 key / 26,791 閫掑綊 key | 缈昏瘧缁存姢閲忓ぇ |
| LLM provider | 24-27 涓?| 澶氬巶鍟嗗鎺?|
| API 璺敱鏂囦欢 | 429 .ts(api)+ 8 .py(ai-service) | 鍚庣鎺ュ彛闈㈠箍 |
| 鍓嶇椤甸潰 | 615 page.tsx | 鍓嶇椤甸潰澶?|
| Docker 鏈嶅姟 | 21(璺?3 compose 鏂囦欢) | 閮ㄧ讲缂栨帓澶嶆潅 |
| 娴嬭瘯鏂囦欢 | 468 | 娴嬭瘯瑕嗙洊闈㈠箍 |
| TODO 绫绘爣璁?| 2,670 | 鎶€鏈€轰俊鍙?XXX 鏁板惈璇尮閰嶉渶浜哄伐鐢勫埆) |

**璋冪爺缁撹**:IHUI-AI 鏄竴涓害 97 涓囪婧愮爜銆? 绔繛閫氥€?4 涓?pre-commit 妫€鏌ョ偣銆?5 涓畧闂ㄨ剼鏈€?4-27 涓?LLM provider銆? 璇█ i18n(26,791 key)銆?15 鍓嶇椤甸潰銆?29 API 璺敱銆?1 涓?Docker 鏈嶅姟銆?68 娴嬭瘯鏂囦欢鐨勫ぇ鍨嬪叏鏍?AI 骞冲彴 monorepo,缁存姢鎴愭湰涓昏闆嗕腑鍦ㄥ绔悓姝ャ€佸畧闂ㄥ熀纭€璁炬柦銆乮18n 缈昏瘧銆丩LM 鍘傚晢瀵规帴鍥涗釜缁村害銆?
# IHUI-AI 鍏ㄧ鍙ｆ竻鍗?+ 缁存姢鎴愭湰鍒嗘瀽

## 涓€銆佸叏閮ㄧ鍙ｆ繁搴︽竻鍗?
鏉冨▉鏉ユ簮:[docs/port-management.md](file:///g:/IHUI-AI/docs/port-management.md) + [scripts/check-port-registry.mjs](file:///g:/IHUI-AI/scripts/check-port-registry.mjs) + 瀹為檯閰嶇疆鏂囦欢浜ゅ弶楠岃瘉銆?
### 1.1 搴旂敤鏈嶅姟(8801-8809)

| 绔彛 | 鏈嶅姟 | 绔?| 瀹為檯閰嶇疆浣嶇疆 | strictPort | 鐘舵€?|
|---|---|---|---|---|---|
| 8801 | Web(Next.js 15 + Turbopack) | apps/web | [apps/web/package.json](file:///g:/IHUI-AI/apps/web/package.json) `next dev --turbopack -p 8801` | 鉁?| 鍦ㄧ敤 |
| 8802 | API(Fastify 5) | apps/api | [apps/api/src/index.ts#L11](file:///g:/IHUI-AI/apps/api/src/index.ts#L11) + `.env PORT=8802` | 鉁?| 鍦ㄧ敤 |
| 8803 | AI Service(FastAPI + LangGraph) | apps/ai-service | [apps/ai-service/app/core/config.py#L20](file:///g:/IHUI-AI/apps/ai-service/app/core/config.py#L20) `port=8803` | 鉁?| 鍦ㄧ敤 |
| 8804 | Taro H5(灏忕▼搴?H5 璋冭瘯) | apps/miniapp-taro | [apps/miniapp-taro/config/dev.ts](file:///g:/IHUI-AI/apps/miniapp-taro/config/dev.ts) `port:8804 strictPort:true` | 鉁?| 鍦ㄧ敤 |
| 8805 | Metro Bundler(React Native) | apps/mobile-rn | [apps/mobile-rn/package.json](file:///g:/IHUI-AI/apps/mobile-rn/package.json) `expo start --port 8805` | 鉁?| 鍦ㄧ敤 |
| 8806 | ~~Desktop Vite~~ | apps/desktop | [tauri.conf.json#L9](file:///g:/IHUI-AI/apps/desktop/src-tauri/tauri.conf.json#L9) `devUrl: http://localhost:8801` | 鈥?| **宸插簾寮?*(A 濂楀３:澶嶇敤 web 8801,涓嶅啀鐙珛绔彛) |
| 8807 | CLI(棰勭暀) | apps/cli | 鈥?| 鈥?| 棰勭暀鏈敤 |
| 8808 | Extension(棰勭暀) | apps/extension | 娴忚鍣ㄦ墿灞曡蛋 `chrome.runtime`,**涓嶇洃鍚鍙?* | 鈥?| 棰勭暀鏈敤(鎵╁睍鏃犵鍙ｉ渶姹? |
| 8809 | (棰勭暀鎵╁睍) | 鈥?| 鈥?| 鈥?| 绌烘Ы |

### 1.2 鍩虹璁炬柦(8810-8819)

| 绔彛 | 鏈嶅姟 | 瀹瑰櫒鍐呯鍙?| 閰嶇疆浣嶇疆 | 缁戝畾 |
|---|---|---|---|---|
| 8810 | PostgreSQL 15(pgvector) | 5432 | [docker-compose.yml#L228](file:///g:/IHUI-AI/docker-compose.yml#L228) `127.0.0.1:8810:5432` | 浠?localhost |
| 8811 | Redis 7 | 6379 | [docker-compose.yml#L266](file:///g:/IHUI-AI/docker-compose.yml#L266) `127.0.0.1:8811:6379` | 浠?localhost |
| 8812 | OTel Collector gRPC(OTLP) | 4317 | [docker-compose.yml#L302](file:///g:/IHUI-AI/docker-compose.yml#L302) `8812:4317` | 0.0.0.0 |
| 8813 | OTel Collector HTTP(OTLP) | 4318 | [docker-compose.yml#L301](file:///g:/IHUI-AI/docker-compose.yml#L301) `8813:4318` | 0.0.0.0 |
| 8814 | Jaeger UI | 16686 | [docker-compose.yml#L283](file:///g:/IHUI-AI/docker-compose.yml#L283) `8814:16686` | 0.0.0.0 |
| 8815 | Prometheus | 9090 | [docker-compose.yml#L337](file:///g:/IHUI-AI/docker-compose.yml#L337) `8815:9090` | 0.0.0.0 |
| 8816 | Grafana | 3000 | [docker-compose.yml#L366](file:///g:/IHUI-AI/docker-compose.yml#L366) `8816:3000` | 0.0.0.0 |
| 8817 | Node Exporter | 9100 | [docker-compose.yml#L387](file:///g:/IHUI-AI/docker-compose.yml#L387) `8817:9100` | 0.0.0.0 |
| 8818 | Loki | 3100 | [docker-compose.yml#L403](file:///g:/IHUI-AI/docker-compose.yml#L403) `8818:3100` | 0.0.0.0 |
| 8819 | (棰勭暀鎵╁睍) | 鈥?| 鈥?| 鈥?|

### 1.3 杈呭姪宸ュ叿(8820-8829)

| 绔彛 | 鏈嶅姟 | 瀹為檯閰嶇疆 | 鐘舵€?|
|---|---|---|---|
| 8820 | Storybook(docs 澹扮О) | [apps/web/package.json:24](file:///g:/IHUI-AI/apps/web/package.json#L24) **瀹為檯 `storybook dev -p 6006`** | 鈿狅笍 **docs/浠ｇ爜涓嶄竴鑷?*(瑙佸彲浼樺寲鐐?鈶? |
| 8821 | Promtail(鍐呴儴鍋ュ悍妫€鏌? | monitoring/promtail/promtail-config.yml | 鍦ㄧ敤 |
| 8822-8829 | (棰勭暀鎵╁睍) | 鈥?| 绌烘Ы |

### 1.4 SaaS 閮ㄧ讲(8830-8839)

| 绔彛 | 鏈嶅姟 | 閰嶇疆浣嶇疆 | 缁戝畾 |
|---|---|---|---|
| 8830 | Admin API(SaaS 鎵樼骞冲彴) | [deploy/saas/docker-compose.yml#L83-85](file:///g:/IHUI-AI/deploy/saas/docker-compose.yml#L83) `127.0.0.1:8830:8830` | 浠?localhost |
| 8831-8839 | (棰勭暀鎵╁睍) | 鈥?| 绌烘Ы |

### 1.5 钃濈豢閮ㄧ讲娈?8840-8849)鈥?娉ㄥ唽琛ㄥ０鏄庨鐣?
| 绔彛 | 鏈嶅姟 | 瀹為檯鍗犵敤 | 鐘舵€?|
|---|---|---|---|
| 8841 | CLI Agent Server | [apps/cli/src/commands/serve.ts:24](file:///g:/IHUI-AI/apps/cli/src/commands/serve.ts#L24) `--port <port> default '8841' strictPort` | 鈿狅笍 **鍗犵敤"钃濈豢閮ㄧ讲棰勭暀娈?,docs 鏈敞鍐?*(瑙佸彲浼樺寲鐐?鈶? |
| 8840/8842-8849 | (钃濈豢閮ㄧ讲棰勭暀) | 鈥?| 绌烘Ы |

### 1.6 瀹瑰櫒鍐呴儴绔彛(涓嶅彉,涓嶆槧灏勫埌瀹夸富)

| 瀹瑰櫒鍐呯鍙?| 鏈嶅姟 | 璇存槑 |
|---|---|---|
| 8080 | api | 鐢熶骇 API 瀹瑰櫒鍐?healthcheck 鐢? |
| 8081 | worker | BullMQ worker healthcheck |
| 3000 | web / grafana | Next.js standalone / Grafana 瀹瑰櫒鍐?|
| 8000 | ai-service | FastAPI 瀹瑰櫒鍐?[Dockerfile#L28](file:///g:/IHUI-AI/apps/ai-service/Dockerfile#L28) `EXPOSE 8000`) |
| 5432 | postgres | PostgreSQL 瀹瑰櫒鍐?|
| 6379 | redis | Redis 瀹瑰櫒鍐?|
| 4317/4318 | otel-collector | OTLP 鎺ユ敹 |
| 16686 | jaeger | Jaeger UI |
| 9090 | prometheus | Prometheus |
| 9100 | node-exporter | Node Exporter |
| 3100 | loki | Loki |
| 14250/14268/14269 | jaeger internal | gRPC/HTTP collector |
| 13133 | otel-collector | 鍐呴儴鍋ュ悍妫€鏌?|
| 9080 | promtail | 鍐呴儴鍋ュ悍妫€鏌?|
| 8888 | otel-collector | 鑷韩 metrics |

### 1.7 璞佸厤鐨勯潪 88xx 绔彛(check-port-registry.mjs 绗?36-59 琛岃眮鍏嶅垪琛?

SMTP(587/465/25)銆丠TTP/HTTPS(80/443)銆丼SH(22)銆丱llama(11434)銆丩M Studio(1234)銆丮CP transport(8765)銆丮CP OAuth 娴嬭瘯(18999)銆乤i-service 娴嬭瘯 mock(8001)銆佺敓浜?admin-api 鏃х鍙?8082)銆丄lertmanager(9093)銆乤i-feed-sources(6688)銆乂ite 榛樿(5173)銆丳rometheus 鏃ф槧灏?9091)銆乵ock SMTP(1025)銆?
### 1.8 绔彛鎬绘暟缁熻

| 绫诲埆 | 鏁伴噺 |
|---|---|
| 宸叉敞鍐?88xx(dev/瀹夸富) | **14 涓?*(8801-8805/8810-8818/8830/8841) |
| 棰勭暀 88xx 绌烘Ы | **20 涓?*(8806-8809/8819/8822-8829/8831-8839/8840/8842-8849) |
| 瀹瑰櫒鍐呴儴绔彛 | **16 涓?*(涓嶆槧灏? |
| 璞佸厤绗笁鏂?CI 绔彛 | **~17 涓?* |
| **娑夊強绔彛鎬绘暟** | **~67 涓?* |

---

## 浜屻€佷唬鐮佺淮鎶ゆ垚鏈垎鏋?鍩轰簬瀹炴祴鏁版嵁)

### 2.1 浠ｇ爜浣撻噺纭暟鎹?
| 缁村害 | 鏁板€?| 琛屼笟瀵规爣 |
|---|---|---|
| 鎬绘簮鐮佽鏁?| **~97 涓囪**(969,388 + 950 Rust) | 澶у瀷 monorepo(涓瀷浜掕仈缃戝叕鍙搁噺绾? |
| 婧愮爜鏂囦欢鏁?| **5,777** | 鈥?|
| 绔暟閲?| **8 绔?* | 鍏ㄦ爤 + 澶氱瑕嗙洊 |
| 鍏变韩鍖?| **14 涓?*(packages/*) | 鎶借薄灞傚 |
| 瀹堥棬鑴氭湰 | **95 涓?.mjs / 22,936 琛?* | 瀹堥棬鍩虹璁炬柦鑷韩搴炲ぇ |
| pre-commit 妫€鏌ョ偣 | **44 涓?*(27 blocking + 11 warn + 2 info + 4 椤圭嫭绔? | 鎻愪氦闂ㄦ鏋侀珮 |
| 渚濊禆鎬绘暟(鏈幓閲? | **308**(8 涓?package.json) | 渚濊禆鍥惧鏉?|
| i18n | **5 璇█ / 590 椤跺眰 key / 26,791 閫掑綊 key** | 缈昏瘧闈㈠法澶?|
| LLM provider | **24-27 涓?*(24 涓?key 瀛楁 + 3 涓尶鍚?base) | 鍘傚晢瀵规帴闈㈠箍 |
| API 璺敱 | **429 .ts**(api)+ **8 .py**(ai-service) | 鍚庣鎺ュ彛闈㈠箍 |
| 鍓嶇椤甸潰 | **615 涓?page.tsx** | 鍓嶇椤甸潰澶?|
| Docker 鏈嶅姟 | **21 涓?*(璺?3 涓?compose) | 閮ㄧ讲缂栨帓澶嶆潅 |
| 娴嬭瘯鏂囦欢 | **468**(55 e2e + 282 api + 131 ai-service) | 娴嬭瘯瑕嗙洊骞?|
| TODO/FIXME/HACK 鏍囪 | **~733**(563 TODO + 16 FIXME + 154 HACK) | 鎶€鏈€轰腑绛?|

### 2.2 缁存姢鎴愭湰鍥涜薄闄?
**馃敶 楂樻垚鏈尯(涓讳綋缁存姢璐熸媴)**

1. **澶氱鍚屾寮€鍙?*(AGENTS.md 搂9 寮哄埗鍏ㄧ杩為€?鈥?8 绔换涓€鏀瑰姩闇€璇勪及璺ㄧ褰卞搷,web 33 涓囪 + api 27 涓囪 + ai-service 12 涓囪涓夌鏈€閲嶃€?2. **瀹堥棬鍩虹璁炬柦鍙嶅悜缁存姢**鈥?95 涓畧闂ㄨ剼鏈?/ 22,936 琛?鑷韩灏辨槸 ~2.3 涓囪浠ｇ爜闇€瑕佺淮鎶?瀹堥棬鑴氭湰 bug 浼氶樆濉炴墍鏈?agent 鎻愪氦銆?3. **i18n 缈昏瘧鍚屾**鈥?26,791 涓€掑綊 key 脳 5 璇█ = ~13.4 涓囨潯缈昏瘧鏉＄洰,闈?AI 娴佹按绾跨淮鎶?浠讳竴 key 婕忕炕 鈫?parity 瀹堥棬闃诲銆?4. **LLM provider 閫傞厤**鈥?24-27 涓?provider,浠讳竴鎺ュ彛鍙樻洿(API base / 閴存潈 / 妯″瀷鍚?闇€澶氬淇敼 config.py + .env.example + docker-compose.yml銆?
**馃煛 涓垚鏈尯(鍙帶浣嗛渶鍏虫敞)**

5. **鍙娴嬫€ф爤**(7 涓洃鎺у鍣?Promtail + Loki + Grafana + Prometheus + Jaeger + OTel + NodeExporter)鈥?瀹屾暣 APM 閾捐矾,鏈湴鍚姩鑰楄祫婧?鐢熶骇缁存姢闇€涓撲汉銆?6. **鐢熶骇瀹夊叏瀹¤浜х墿**(JWT/DB/Redis 寮哄埗瀵嗙爜銆乵TLS銆丆ORS 涓ユ牸鏍￠獙)鈥?宸茶惤鍦?浣嗘瘡娆℃柊澧為厤缃」闇€鍚屾 .env.example + docker-compose + 鍚姩鏍￠獙涓夊銆?7. **娴嬭瘯濂椾欢**鈥?468 娴嬭瘯鏂囦欢,璺?3 璇█鏍?TS/Py/Rust),浠讳竴鏍堝崌绾ч渶閲嶈窇鍏ㄩ噺銆?
**馃煝 浣庢垚鏈尯(璁捐鑹ソ)**

8. **绔彛娉ㄥ唽琛?*鈥?鍗曚竴鏉冨▉鏂囨。 + 瀹堥棬鑴氭湰,鏂板绔彛娴佺▼娓呮櫚銆?9. **鍏变韩鍖呮娊璞?*鈥?14 涓?packages/* 澶嶇敤 UI/types/auth/database,鍑忓皯閲嶅浠ｇ爜銆?10. **Docker 鍖栭儴缃?*鈥?21 鏈嶅姟鍏ㄥ鍣ㄥ寲,鐜涓€鑷存€ч珮銆?
### 2.3 缁存姢鎴愭湰閲忓寲浼扮畻(绮楃畻)

鍋囪 1 鍚嶅伐绋嬪笀缁存姢 5 涓囪浠ｇ爜/骞?琛屼笟涓瀷椤圭洰缁忛獙鍊?:

- 涓讳綋浠ｇ爜(97 涓囪)鈫?**~19 浜哄勾** 绛夋晥缁存姢閲?- 瀹堥棬鑴氭湰(2.3 涓囪)鈫?**~0.5 浜哄勾** 绛夋晥缁存姢閲?- i18n(13.4 涓囨潯缈昏瘧)鈫?**~1 浜哄勾**(闈?AI 娴佹按绾垮凡闄嶈嚦 ~0.3 浜哄勾)
- 澶氱鍗忚皟寮€閿€ 鈫?**脳1.3 鍊嶇郴鏁?*(8 绔悓姝?

**绛夋晥鎬荤淮鎶ゆ垚鏈?绾?25-27 浜哄勾/骞?*(瀵瑰簲瀹為檯闇€ 3-4 鍚嶅叏鑱屽伐绋嬪笀 + AI agent 鍗忓悓)銆?
---

## 涓夈€佸彲浼樺寲鐐?鎸夋敹鐩?鎴愭湰鎺掑簭)

### 鈶?Storybook 绔彛 docs/浠ｇ爜涓嶄竴鑷淬€愪綆鎴愭湰楂樻敹鐩?绔嬪嵆鍙慨銆?
- **闂**:[docs/port-management.md 搂2.3](file:///g:/IHUI-AI/docs/port-management.md) 澹版槑 Storybook 鍦?8820,浣?[apps/web/package.json:24](file:///g:/IHUI-AI/apps/web/package.json#L24) 瀹為檯鏄?`-p 6006`(闈?88xx,杩濆弽娉ㄥ唽琛ㄨ鍒?銆?- **褰卞搷**:绔彛瀹堥棬鑴氭湰浼?warn,浣?docs 娌′汉鏀?寮€鍙戣€呭洶鎯戙€?- **淇**:浜岄€変竴 鈥斺€?  - A. 鏀逛唬鐮?`storybook dev -p 8820`(绗﹀悎娉ㄥ唽琛?
  - B. 鏀?docs 鎶?Storybook 绉诲嚭 88xx(鎵胯璞佸厤)
- **寤鸿 A**,5 鍒嗛挓鎼炲畾銆?
### 鈶?CLI serve 绔彛 8841 鍗犵敤"钃濈豢閮ㄧ讲棰勭暀娈?鏈敞鍐屻€愪綆鎴愭湰銆?
- **闂**:[apps/cli/src/commands/serve.ts:24](file:///g:/IHUI-AI/apps/cli/src/commands/serve.ts#L24) 鍗犵敤 8841,浣?[docs/port-management.md 搂2.4-2.5](file:///g:/IHUI-AI/docs/port-management.md) 浠嶅啓"8840-8849 钃濈豢閮ㄧ讲棰勭暀",涓?[check-port-registry.mjs 娉ㄥ唽琛╙(file:///g:/IHUI-AI/scripts/check-port-registry.mjs#L32) 鍚?8841-8849 浣嗘湭鏍囨敞 8841 瀹為檯鐢ㄩ€斻€?- **淇**:鍦?docs 搂2 鏂板"2.6 钃濈豢閮ㄧ讲 / CLI Agent(8840-8849)"灏忚妭,鏄惧紡娉ㄥ唽 8841 = CLI Agent Server銆?
### 鈶?棰勭暀绌烘Ы杩囧(20/34 = 59% 绌虹疆鐜?銆愪綆浼樺厛绾с€?
- 8807/8808/8809/8819/8822-8829/8831-8839/8840/8842-8849 鍏?20 涓┖妲姐€?- **鍒ゆ柇**:棰勭暀鏈韩鏄悎鐞嗚璁?娈典綅鏄犲皠渚夸簬鎵╁睍),浣?59% 绌虹疆鐜囪鏄庢墿寮犻€熷害浣庝簬瑙勫垝銆?- **寤鸿**:淇濈暀鐜扮姸(棰勭暀涓嶈€楁垚鏈?,浣?docs 搂2 鍙姞涓€鍙?绌烘Ы浣嶄负鏈潵 3 骞存墿灞曢鐣?闈炲綋鍓嶅€哄姟"銆?
### 鈶?8806 Desktop 搴熷純鍗犱綅銆愪綆浼樺厛绾с€?
- 8806 宸插簾寮?docs 鏍囨敞 ~~鍒犻櫎绾縹~),浣嗘敞鍐岃〃浠嶅崰浣嶃€?- **寤鸿**:淇濈暀 docs 鍗犱綅(鍘嗗彶杩芥函浠峰€?,浣?[check-port-registry.mjs 娉ㄥ唽琛╙(file:///g:/IHUI-AI/scripts/check-port-registry.mjs#L22-33) 鍙Щ闄?8806(宸蹭笉鍦ㄩ泦鍚堝唴,鏃犻渶鏀瑰姩)銆?
### 鈶?瀹堥棬鑴氭湰鍙悎骞躲€愪腑绛夋垚鏈腑绛夋敹鐩娿€?
- 95 涓?.mjs 涓湁澶ч噺 audit-migration-* 绯诲垪(fix-i18n-deep 1423 琛?+ 4 涓?audit-migration-* 鍏?3230 琛?銆?- **寤鸿**:鎶?audit-migration-* 鍚堝苟涓?1 涓?`audit-migration.mjs --target=frontend-routes|db-fields|api-routes|i18n`,鍑忓皯鑴氭湰鏁伴噺 + 鍏变韩鍏叡閫昏緫銆?- **椋庨櫓**:闇€閲嶆祴瀹堥棬琛屼负涓嶅洖褰掋€?
### 鈶?LLM provider 閰嶇疆瀛楁鎵佸钩鍖?鈫?瀛楀吀鍖栥€愪腑绛夋垚鏈珮鏀剁泭銆?
- [config.py:39-103](file:///g:/IHUI-AI/apps/ai-service/app/core/config.py#L39-103) 鏈?**24 涓?`*_api_key` + 7 涓?`*_api_base` 鎵佸钩瀛楁**,鏂板 provider 闇€鏀?3 澶?config.py + .env.example + docker-compose.yml)銆?- **寤鸿**:鏀逛负 `llm_providers: dict[str, ProviderConfig]` JSON 閰嶇疆,鏂板 provider 闆朵唬鐮佹敼鍔?鍙敼 .env)銆?- **鏀剁泭**:config.py 鍑忓皯 ~80 琛?.env.example 鍑忓皯 ~50 琛?鏂板 provider 鎴愭湰浠?3 澶勬敼鍔ㄩ檷鑷?0 澶勪唬鐮佹敼鍔ㄣ€?- **椋庨櫓**:闇€杩佺Щ鐜版湁 .env 閰嶇疆,鎻愪緵 backward-compat shim 1 涓増鏈€?
### 鈶?鍙娴嬫€ф爤绮剧畝璇勪及銆愪綆鎴愭湰璇勪及,涓垚鏈疄鏂姐€?
- 鏈湴寮€鍙戞槸鍚︾湡鐨勯渶瑕?7 涓洃鎺у鍣?Promtail + Loki + Grafana + Prometheus + Jaeger + OTel + NodeExporter)?
- **寤鸿**:鏈湴寮€鍙戞媶鍒?`docker-compose.dev.yml`(浠?db + redis)vs `docker-compose.observability.yml`(鍏ㄥ鐩戞帶),鎸夐渶鍚姩銆?- **鐜扮姸**:宸叉湁 `deploy/observability/docker-compose.observability.yml` 鐙珛鏂囦欢,浣嗘牴 compose 浠嶅寘鍚叏濂?鈥?鍙€冭檻鏍?compose 鎷?profile銆?
### 鈶?i18n 26,791 閫掑綊 key 蹇呰鎬у璁°€愰珮鎴愭湰楂樻敹鐩娿€?
- 26,791 涓€掑綊 key 涓彲鑳藉瓨鍦?杩戜箟閲嶅 / 宸插簾寮冮〉闈㈡畫鐣?key / 涓€娆℃€ф椿鍔?key銆?- **寤鸿**:鍐欒剼鏈娴?zh-CN.json 涓瓨鍦ㄤ絾浠ｇ爜涓?grep 涓嶅埌寮曠敤鐨?key",澶ф鐜囪兘鍒?10-20%銆?- **鏀剁泭**:缈昏瘧鍚屾鎴愭湰绛夋瘮涓嬮檷銆?- **椋庨櫓**:鍔ㄦ€佹嫾鎺?key(濡?`t(\`model.${id}\`)`)浼氳鎶?闇€浜哄伐鐢勫埆銆?
### 鈶?TODO/FIXME/HACK 733 澶勬妧鏈€烘竻鐞嗐€愭寔缁綆鎴愭湰銆?
- 563 TODO + 154 HACK + 16 FIXME,寤鸿姣忎釜杩唬娓呯悊 10-20 涓€?- **浼樺厛绾?*:HACK > FIXME > TODO(HACK 澶氫负涓存椂缁曡繃,椋庨櫓楂?銆?
### 鈶?澶氱瀹為檯鐢ㄦ埛璇勪及銆愭垬鐣ユ€с€?
- 8 绔腑 mobile-rn(224 鏂囦欢 / 2.9 涓囪)鍜?miniapp-taro(551 鏂囦欢 / 5.9 涓囪)鏄惁鏈夌湡瀹炵敤鎴?
- 鑻ユ煇绔暱鏈熸棤鐢ㄦ埛 鈫?鍙€冭檻鍐荤粨缁存姢(涓嶅垹浠ｇ爜,浣嗗仠姝?搂9 鍏ㄧ鍚屾瑕佹眰),鑺傜渷 ~30% 澶氱鍗忚皟鎴愭湰銆?- **鍒ゆ柇鏉?*:褰掑睘浜у搧鍐崇瓥,闈炴妧鏈喅绛栥€?
---

## 鍥涖€佷竴鍙ヨ瘽缁撹

**绔彛绠＄悊**:14 涓湪鐢?+ 20 涓鐣?+ 16 涓鍣ㄥ唴 + 17 涓眮鍏?璁捐瑙勮寖(鍗曚竴娉ㄥ唽琛?+ strictPort + 瀹堥棬鑴氭湰),涓昏鐟曠柕鏄?Storybook docs/浠ｇ爜涓嶄竴鑷?鈶?鍜?CLI 8841 鏈湪 docs 娉ㄥ唽(鈶?,5 鍒嗛挓鍙慨銆?
**缁存姢鎴愭湰**:~97 涓囪 / 8 绔?/ 95 瀹堥棬鑴氭湰 / 44 pre-commit 妫€鏌?/ 24 LLM provider / 5 璇█ i18n,绛夋晥绾?25-27 浜哄勾/骞?**鏍稿績璐熸媴鍦ㄥ绔悓姝?+ 瀹堥棬鍩虹璁炬柦 + i18n + LLM 閫傞厤鍥涚淮**,浼樺寲浼樺厛绾?鈶?LLM 瀛楀吀鍖?> 鈶?Storybook 涓€鑷存€?> 鈶?鍙娴嬫€ф爤绮剧畝)> 鈶?瀹堥棬鑴氭湰鍚堝苟)> 鈶?i18n key 瀹¤)銆?
---


