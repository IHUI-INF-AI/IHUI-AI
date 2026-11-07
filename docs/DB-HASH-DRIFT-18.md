<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# DB-HASH-DRIFT-18：18 条既有 hashDrift（补账前既有债，不随本轮补行增减）

- 立票日期：2026-11-07
- 范围：`drizzle.__drizzle_migrations` 中 `created_at` 已在账、但 `hash` 与当前迁移文件字节不同的 18 条。
- 与 `20261106150000`（id=1648）的区别：那 1 条是本窗口账本异动，由补行动作消解（19 → 18），**不在本票范围**。
- 判据来源：`node scripts/check-db-migration-gaps.mjs --json`；18 条在 `ihui_dev`（362 行）与 `ihui_replica_1107`（370 行）完全一致，`pending`/`lateGap` 口径不变。
- 处置原则：**不改写任何旧行 hash**；按 `scripts/migration-hash-drift-exempt.json` 的四档状态闭环，到期转红。

| # | id | tag | created_at | 账本 hash | 当前正文 hash | 状态 / 票号 | 为什么漂 |
|---|---|---|---|---|---|---|---|
| 1 | 539 | `0085_exam_wrong_unique` | 1707344000000 | `b86925ff305e9a4d3b9c5b2d9ed978d24e430e3fc24975b86c71a8d57b503c07` | `a702ec394bd07cc078b3bf02801e9aa56bb35f0a36a9e311e974da981a24564c` | rewrite-verified（`8362ac24fa`） | 唯一索引改写为幂等守卫，语义等价 |
| 2 | 569 | `0115_r82_seed_unique_indexes` | 1709936000000 | `aa4e1b6988310b849adb754c276c8e52e70bb9955a8cebacc2da6a35e9c32dbe` | `67d4832d2ef69cadd62a11d3dab9f0bb177bb8be34b2083ba284f32e82c1502c` | rewrite-verified（`8362ac24fa`） | 4 处唯一索引加幂等守卫，语义等价 |
| 3 | 575 | `0125_knowledge_graph` | 1710454400000 | `ab42e105ef9177e2037ee7252446ee3e802d7614bedfa0f8b6a180d06c4b8a28` | `604ea6231e33eea091b80a803f186688175319f118fdbe435317d13d65ab75e0` | rewrite-verified（`8362ac24fa`） | 2 处建表/索引加 IF NOT EXISTS，语义等价 |
| 4 | 710 | `20260913170000_cost_cents_numeric` | 1722204800000 | `fbff77c71ca50595a2868448d4dc9eb52a28d596db31e694a787adb4c866de68` | `4e70705604ac05c4ae8aa8b873d54c3045f0460028a810855a1d337af6cfc980` | pending（`DB-DRIFT-04`，2026-12-07） | 应用时刻字节未留存；git 只有改写后 blob |
| 5 | 727 | `20260917100000_admin_console_modules` | 1723587200000 | `b16eaac2f03b843f67c2faca3d6081e6c35d4a38a066185302136970199e0e75` | `3ec6bc79ebaaf20529933124a7df8808d3c00d244f91a7bd86c8754138cce747` | watermark-verified（`134c565dbd`） | 应用后注入 provenance watermark；旧 blob 去水印后逐字相同 |
| 6 | 729 | `20260919100000_edu_canteen` | 1789781361777 | `eb145e9b01ae23eb032345ffa7feb0faf4f45c31743816a4abc34b1c0b3f432c` | `587fc12e76291b4b2abec6318f65450122f176925d6f1be6573e178bf5b779b1` | watermark-verified（`104d3de918`） | 同上（去水印逐字相同） |
| 7 | 1533 | `20260919140000_user_emails` | 1789833776532 | `33d94911893bbcff2c77fe8a7e3aa7dfdde3e22fb189871ea975960fee6b79f1` | `c9d3227aa1a6d7488770fb20cbd0a08ce320fb91686d53a88a5309b5b87887ca` | watermark-verified（`0f3c27828d`） | 同上 |
| 8 | 1534 | `20260920110000_conversation_imports` | 1789873200000 | `5b3a23b3e22ed57994fbfbd58e97f3a2c25b078700318c58bce3a00e5f935eb8` | `bd2e024a9171ed5598d07ccabfe0054dc58187f2cfddd818df44b319e0098aca` | watermark-verified（`0f3c27828d`） | 同上 |
| 9 | 1535 | `20260920170000_agent_checkpoints` | 1789886400000 | `a686e704fd22998d214f564827acde1e9dee6f98aaa81ca8706e4626f74cee36` | `c19cee37e2e68c7b937b9fb2617b9fc727ec1087b6361ef65b7765d7ffd00255` | watermark-verified（`0f3c27828d`） | 同上 |
| 10 | 1541 | `20260924100000_chat_history_projection` | 1790215200000 | `90fd90822923463ff35bc2356cb8fa13911c007a60785e0fef1e18c841c5216a` | `9f4f785d14934be9093bfb9d3660605f8edf6eb2932a8836774c8e9a81ab8d75` | watermark-verified（`950723390e`） | 同上 |
| 11 | 1543 | `20260926100000_github_app_tables` | 1790388000000 | `2c9841f1e8d742c1632739a069dccbb71a9dcb9cc82a41cea77d352aa0307e8b` | `269cb50f88da508fb87d389034ec4fe2a0a46d9bbe99741a7f5d991ead22db5d` | watermark-verified（`0a4893fdc7`） | 同上 |
| 12 | 1555 | `20260930120000_edu_study_loops` | 1790769600000 | `cd4ddc12bb050c7497019d81c96a2617cc4ecb6613c7f2bcafdff9c09857e5b2` | `04e46b4e88f76659d220fd5deb9ee081466f14b8202da35509ace964653421e3` | pending（`DB-DRIFT-05`，2026-12-07） | 应用时刻早于首次提交 2h29m，从未提交工作树应用；无应用时刻快照 |
| 13 | 1556 | `20260930130000_points_mall_orders` | 1790773200000 | `41d468beab4e64ed48f3e6cfb41d7f017633ec953a326a438d0babb892cb65aa` | `8c3000be74bfbd97c358dbac1c8c5ea680a3dfd9d96c1ce3065b11383b18fd95` | watermark-verified（`69d1d0e71e`） | 同 watermark 类 |
| 14 | 1560 | `20261003020000_codebase_chunks_tenant_ttl` | 1790964000000 | `694f474dd6ea1929e16eafa8866c36aea4d22943d0bd9497b8447569cb578671` | `8645f5633dcf4ab3e6c40229491aa0b4beee7083300cb16bd8a135e0d26c820d` | pending（`DB-DRIFT-06`，2026-12-07） | 应用时刻早于首次提交 4h33m，同上 |
| 15 | 1600 | `20261018160000_agent_state_tables_runtime_reality` | 1792310400000 | `b91bcb638f32e9b542193cea31fd77af9955cd4d4ca4481e0e6a18e8596d31a6` | `ad664d985490066c1be2948f481a9fc732a31c898b70e7da56c40d0e5a2abb9d` | compensated（`20261107006000`） | 应用后两次改写均有独立提交；两列 DEFAULT 0 由 06000 撤销补偿 |
| 16 | 1612 | `20261023180000_relay_account_pool_owner` | 1792778400000 | `687796a50c2ac89e4d270a3f86519b567c9a302543b4ba0623ddc6692f0fe283` | `bf702c1d64c6cb0e5ff07a5c83c9aea1ae3bd71371d9b6e44a463605c126451a` | watermark-verified（`8e6f8fe101`） | 同 watermark 类 |
| 17 | 1624 | `20261027090000_default_user_avatar` | 1793064600000 | `5a4b85d24b9432f2815a2732648bc75e0e4467fb0b1cef87fd18d84ab6ada34d` | `db7e06a4a6453ecda7e4b7b0bf9bf1ef8ec63d6cba5fec39efbb349674a7c8b4` | pending（`DB-DRIFT-07`，2026-12-07） | 应用时刻历史 blob 未定位 |
| 18 | 1642 | `20261104120000_agent_team_collab` | 1793764800000 | `394ed8423ee3ef3701a1513eb30542a5965ac38e967a2afdd4313cf7db1ddb86` | `d487b1af0b26ee77a17055bb04347c21c602f29429c822e303be354ee36bf4ab` | rewrite-verified（`b300206291`） | 3 处 IF NOT EXISTS 加守卫，语义等价 |

**责任划分**

- 已验证闭环 13 条：rewrite-verified 4 + watermark-verified 9 + compensated 1（evidence 提交号已记在豁免清单），无需再修。
- 未闭环 4 条，责任人、修法与验收如下（dueAt 均为 `2026-12-07`）：

| 票号 | tag | 谁 | 12-07 前修什么 | 修完怎么验（两条都要过） |
|---|---|---|---|---|
| `DB-DRIFT-04` | `20260913170000_cost_cents_numeric` | 该迁移作者（2026-09-13 提交人）+ 发布负责人 | 从 git blob / 备份 / 构建产物中找回**应用时刻**的迁移正文并存档到 `D:/DevEnv/backups/drift-evidence/` | ① `Get-FileHash -Algorithm SHA256 <存档文件>` == 账本 hash `fbff77c7…de68`；② `node scripts/check-db-migration-gaps.mjs --json` 仍为 `pending=0 / lateGap=7 / hashDrift=18`，且豁免清单该条 state 改为 `rewrite-verified`/`watermark-verified` 并填 evidence 提交号 |
| `DB-DRIFT-05` | `20260930120000_edu_study_loops` | 提交 `36529fc3f6` 的作者 + DB 负责人 | 同上（该条应用时刻早于首次提交 2h29m，需从推送前的本地/CI 工件找） | 同上，账本 hash `cd4ddc12…e5b2` |
| `DB-DRIFT-06` | `20261003020000_codebase_chunks_tenant_ttl` | 提交 `96df1af7c7` 的作者 + DB 负责人 | 同上（应用早于首次提交 4h33m） | 同上，账本 hash `694f474d…8671` |
| `DB-DRIFT-07` | `20261027090000_default_user_avatar` | DB 负责人 + 该迁移作者 | 定位应用时刻历史 blob（本地/PG 备份/构建缓存均可） | 同上，账本 hash `5a4b85d2…a34d` |

- 到期未交付：该条 state 转 `unexplained`（红），由 DB 负责人在下一次发布评审说明。**到期即到期**：不得把到期条目改写成/挪进「已豁免」清单来关闭，也不得延长 `dueAt` 以维持绿色。
- 本票不改账本、不改旧 hash；只负责把这 18 条从「口头已知」升级为「逐条可查」。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
