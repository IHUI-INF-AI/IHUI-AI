// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * UI 路由清单（自动生成，请勿手改）。
 *
 * 由 apps/web/scripts/generate-ui-routes.mjs 扫描 app 下的 page.tsx 生成；
 * 运行： node apps/web/scripts/generate-ui-routes.mjs
 * 供 src/lib/ui-action-registry.ts 校验 navigate 动作的跳转目标。
 */
// IHUI-GEN-PIN-BEGIN
// generator: apps/web/scripts/generate-ui-routes.mjs
// sourceCommit: 4d5507b9ba192afc88256176cbbc5fef20e27cd5
// inputsSha256: 6d40ddcda37b129f3916244b825121cb1287d0ad31b5383677f5416088726a66
// input: apps/web/app/(auth)/apple/callback/page.tsx f328ceb139ed3b61c0e79bc671e93885a6c1e1b6b7c356febbc97f3255da2075
// input: apps/web/app/(auth)/callback/page.tsx 3d3cf195c8dcb8ec142e08a1d50b9016687a48c3503839f0db0dff7f9bbce67e
// input: apps/web/app/(auth)/forgot-password/page.tsx ebf3e4b50c09d9871131b9fbdc5cddb79c0f9c73bc5775c5ce56dd08a0fa2443
// input: apps/web/app/(auth)/google/callback/page.tsx cde1e4556035c25e575647a27a27b2d58eef2f65726a875747af87d31f0a9cba
// input: apps/web/app/(main)/a2a/page.tsx f4e49ffe7a1795abdf5306d3e7963abd6c4e48512611591d477d6363373db7d5
// input: apps/web/app/(main)/about/page.tsx 77066fe715cd30ab340e2a6719814911bea5dcee3260f9616e5a7d134cf8daa5
// input: apps/web/app/(main)/activities/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/activities/page.tsx cd28bf8d451ccba687c8fbf7660cced361ee71fe5202d57506becb54e82d9afb
// input: apps/web/app/(main)/admin/about-us/page.tsx 55b72a34d24181eeb68a62d8a03802dbeab5ada11c99233f9103fd365c26077e
// input: apps/web/app/(main)/admin/advertise/page.tsx 7655d4fd65530388b3a4028f34abd21960c56350583d6d8a07d8654293a86385
// input: apps/web/app/(main)/admin/agent-rule/page.tsx c6f33af281bdfa806240bd1ab964e6a6498b6435eb46befa9411347f26bb8e13
// input: apps/web/app/(main)/admin/agent-rules/page.tsx 2ad727e983c396f77e40706cd3dee8490c66a532d322bad0210a8fa084eb598e
// input: apps/web/app/(main)/admin/agent-task/page.tsx 274817f24793240d3eef1c863250b96a90112b1063bab2ad6c97772b3a494d17
// input: apps/web/app/(main)/admin/agents/categories/page.tsx 40c74741e58932e27eaf7dd3a8406da9256ba48f5980d19d101fee3901d77a95
// input: apps/web/app/(main)/admin/agents/examine/page.tsx 740d4358bcaf34c84d7f53926846e59c0acdeb5d7b57328932c6dffbd6f121db
// input: apps/web/app/(main)/admin/agents/page.tsx a3773f5e5d8fc1c5c7e038b114abadbe5967a55a4eda46711b83278ca3aa7cf9
// input: apps/web/app/(main)/admin/agents/settlement/page.tsx cdfe0187d53420e28057335fc554f9954d6bb5ada53c0264cecc26cc4c228d8c
// input: apps/web/app/(main)/admin/agreements/page.tsx 3dd482894368242d346524e29b81fb7de90ae33ac2715e23c5a34a9a665cab18
// input: apps/web/app/(main)/admin/ai-cost/page.tsx e1cae85b22a9be67cb74388a2bd43691c2c9570c9d281dfd819bed10664d0671
// input: apps/web/app/(main)/admin/ai-feed/page.tsx 51a36b580feef89f884455bee100fa9ed5fc8a45107db2a6737835ff7b30c47b
// input: apps/web/app/(main)/admin/ai-gc/page.tsx 0a421c2f7a2e2417334b66c29ac9882e109685d7f370be6ef676206299ae02ee
// input: apps/web/app/(main)/admin/ai-metrics/page.tsx ca664786ca80c6b832bccbf7bc3e510230c2995d5f6550203be7636830ab6a2b
// input: apps/web/app/(main)/admin/ai-models/page.tsx d040f6a5dbc4d6e109d1a85a81bf0f752ebb754daf7ee52712c1f50f5e6420a5
// input: apps/web/app/(main)/admin/ai-pricing/page.tsx 449d45ad21248ec02daba32e79d0659e19c067fdcb713de2ec33726e3ec7033f
// input: apps/web/app/(main)/admin/ai-skills/page.tsx f7ecefd78d6ced58516553afe7995db1a76223756e45934c7162dae96ce8a79c
// input: apps/web/app/(main)/admin/ai-world/sites/page.tsx ebb3646f5dd28c7c7459b8f5a1a1930604ef2e941c37c33d561a4995ab192dfa
// input: apps/web/app/(main)/admin/announcements/page.tsx b7664aff8ea9defb85a3fbbd8f22ff7b14b2447be69bd6c04a88b22847c3ab72
// input: apps/web/app/(main)/admin/api-debug/page.tsx 9da5141c93e6e3634a2bb78fbbcda82b020a3ad5a2b4e0f6c3fd2c114c8c891a
// input: apps/web/app/(main)/admin/api-groups/page.tsx 2fba1979bff65b72ed377c2a60311f93313c3a912d5a1ec0796acf140eee791b
// input: apps/web/app/(main)/admin/api-logs/page.tsx b85cd4a21156bfe629a7f1af409d6e7dfc38df8db2d7537b474e9b87c7bce600
// input: apps/web/app/(main)/admin/api-platform/apps/page.tsx 7b4be535b52d4622b1dbd84756abf3f955476725c5f80109b83ed699ec8cac51
// input: apps/web/app/(main)/admin/api-platform/billing/page.tsx 9ee9f9295b8ee01db611dc59051d8baa3f080a1da7f33dc2ef753d365302364f
// input: apps/web/app/(main)/admin/api-platform/packages/page.tsx 0cd150beecd1a23470b13d848ae6488694ac2202443bb18d8c914980f6b55b31
// input: apps/web/app/(main)/admin/api-platform/usage/page.tsx ca2b81b8414189ca1432878dfd1df18d4093ea69314fcc86df8e5043affe4a4b
// input: apps/web/app/(main)/admin/api-usage/page.tsx 46576e1ade44c04ba9ff4b726cc04abc5218f178ab7f21a67ab5067bdd11e368
// input: apps/web/app/(main)/admin/articles/page.tsx 0058e2ad7e710739999c0f3bb4155158e482748393c7a6345cfa94b25386d5b9
// input: apps/web/app/(main)/admin/asks/page.tsx e7a3b003ae9e5e11bcdd654505beca0a03a6adb8ecac10b96808abcb49b20f9d
// input: apps/web/app/(main)/admin/auth-accounts/page.tsx cafad6ffb70767d4f03609cbb5d99ae768bd9de00373c99bd560aec9edf08ffa
// input: apps/web/app/(main)/admin/auth-dept/page.tsx 981e8b048a357fe59614c0c41ab6d99f42360bee83bc51f48d9ee5bf0830b054
// input: apps/web/app/(main)/admin/auth-find-info/page.tsx ecd3281706699a25ba944ad1cfe6d835c217785f9ba3a7df2e59fa3c8347ec21
// input: apps/web/app/(main)/admin/auth-role/page.tsx 58689c07de3002493780dad858c6a43d40fb01ef378cc21ea6d209373ea8adfd
// input: apps/web/app/(main)/admin/auth-user-vip/page.tsx 61e0c63b06bd9f31c8a4d5fc8aca72bcb55c4adb788136a4cf0017bdf44cfa90
// input: apps/web/app/(main)/admin/auth-veri-codes/page.tsx 00d4aef40013866a9dae40c418d5627fb41c527b01932005b2250e4695e470be
// input: apps/web/app/(main)/admin/backend-health/page.tsx c688fc9d0159c5549d5801468ee7c718e274720e2601840d8316dc88e0166535
// input: apps/web/app/(main)/admin/backup-jobs/page.tsx 79216fb324f946db44877f98a385f1c80c464f46f6a91dbe0b9860401d3afbb1
// input: apps/web/app/(main)/admin/behavior-analytics/page.tsx abc8f9d72ff5f0d0aea4469e796fcc40fdf429848d0e85f592d6fa09e6477a41
// input: apps/web/app/(main)/admin/behavior/page.tsx fbad8fa75a39a9ecbd9a8518cc466f41f07b1142d61bbae3186bb66235cfe960
// input: apps/web/app/(main)/admin/bi-dashboard/page.tsx aec10d92955b7a53efbd47ae32984cec0b4e1f5c8b66118eddbe10a9539b7d84
// input: apps/web/app/(main)/admin/carousel/page.tsx 5b53ae2f2e57338156d64a1d917340df7a069c03819c5c8a1dd4a01071b1fd0d
// input: apps/web/app/(main)/admin/certificate/page.tsx 6dc14c334c1d6591cc7efb3f210ad7585d7c096640fec841c5e8cde5d7b3fa48
// input: apps/web/app/(main)/admin/certificate/templates/page.tsx 6e8f16f9deea1dce5b93278edfc2a0dd49aae97c5cf31c65d10ec35928e82b32
// input: apps/web/app/(main)/admin/channel-quota/page.tsx d3029c7fc40365e35cdbc91b7a3d5772d22a2c8a3893b138b70827f5d35a71f1
// input: apps/web/app/(main)/admin/circles/dynamics/page.tsx 7be4ccfd83876538b9ceaee17b2d153f29045a7666d3500aa58f7ae69121732f
// input: apps/web/app/(main)/admin/circles/page.tsx 7aebfdf181fb070d580ebd7c194cc2795278b403bfadc007f4f6aa56fd522024
// input: apps/web/app/(main)/admin/clawdbot/analytics/page.tsx 46c37356ca3570a75e161140abb623caa10789efead20147f62fed8607729d39
// input: apps/web/app/(main)/admin/clawdbot/bots/page.tsx b34414ed5f9dbf554761683bce5d2d1de0de829901329fe2afbdb66813b6ab90
// input: apps/web/app/(main)/admin/clawdbot/health/page.tsx 222d97a4c1ddb06fe20fe1a02b423d4a72bf1f66cd0fe6ae231b615b32b50177
// input: apps/web/app/(main)/admin/clawdbot/messages/page.tsx 6710f9320d396f238179d8b93c0cc24dad4b16c76f73b366c0edeacfe817ddf1
// input: apps/web/app/(main)/admin/clawdbot/page.tsx d0e612d2acf8a4316ba142d8d0050b3e0734a18eb2b4872cfcd5b261e771e6e7
// input: apps/web/app/(main)/admin/clawdbot/permissions/page.tsx fd09ca8e632f36d85f282ff9d8f311ab7d44361f3434729ef9e6168f83133f48
// input: apps/web/app/(main)/admin/clawdbot/sessions/page.tsx 7f5783cbc9b54a465499aaf6a273ad6e2f51594cf74c520d3d8c529c1465f43b
// input: apps/web/app/(main)/admin/clawdbot/tools/page.tsx c5ccdf7a37da20c1365be0957477e9e95ac79a777a369b04f5f11095136757bf
// input: apps/web/app/(main)/admin/comment-logs/page.tsx fbb74ae557a2b19680984dae3901f942f05395d068cbeaa51eccd5a524c12763
// input: apps/web/app/(main)/admin/comments/page.tsx 01b8c96a9e409307adb9ceeb151b4695b9d4f311fa830682416154d3678eb324
// input: apps/web/app/(main)/admin/configs/page.tsx c86729068bc21d122827752c39699b00389fd4cb32fc072f97a44e2c4f25757f
// input: apps/web/app/(main)/admin/contact/page.tsx 2dac37b414a76dcbdd6ed605f15027f5f501b5afcfc00fca64d760ff8df7e12e
// input: apps/web/app/(main)/admin/crew/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/crew/page.tsx 3f3587a0a1c42b80c0ffc1750f031e5c3d56c26154417fc7199a6df2deea6cbf
// input: apps/web/app/(main)/admin/customer-service/page.tsx 99a41e33dec2b3e57c39a37a0856a8a9e5e9098dc23de7c91fda2784a576615a
// input: apps/web/app/(main)/admin/dashboard-stat/page.tsx e495a89e81b35450afd3886b31e9adfe4e1797ddd876a94158e4457121b69964
// input: apps/web/app/(main)/admin/database-optimization/page.tsx 6c94de84a4c6082f7a8ffa617dc0cbb955c1df6ff84a247696fb937546dd4326
// input: apps/web/app/(main)/admin/demand-audit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/demand-audit/page.tsx da825262ceb33f29946fa6f3237cb2ebe46855110e8a05a46ac1b5b5c7e8d82e
// input: apps/web/app/(main)/admin/demand-square/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/demand-square/page.tsx 54b9be311f56e0a866b3e137eb6a61921243b8261c281f812cda02327e62a848
// input: apps/web/app/(main)/admin/deploy-diagnosis/page.tsx 5837afdd8e5504c93692fc578a8436d61ec0ec4919fc246bee5a035704a83b58
// input: apps/web/app/(main)/admin/developer-link/page.tsx 5cd84c4e6d843bf2e7be9c062c50460996df31a3ccdbf814aafd2ae24c645bf0
// input: apps/web/app/(main)/admin/developer/page.tsx 233a52e1df22758571737359f8aa83c4daac429228e3aa341908c9597467c583
// input: apps/web/app/(main)/admin/dict/page.tsx 7e2cde3eee7d029913d35a04f905e76762f724cba566e4a451639f0ef0fd6545
// input: apps/web/app/(main)/admin/distribution/orders/page.tsx 33245dd731e85cb177b98ccc489079a4a7a496b6350cbcf861ec44514f2ebabf
// input: apps/web/app/(main)/admin/distribution/page.tsx d5bb87842622d0a223d62d2a0d0caeb887adb9aca9f98d571d52fd6dfade423e
// input: apps/web/app/(main)/admin/distribution/rules/page.tsx 0b78a7c8b8bd4c805f9411f8766958ad1ebda5134ddb3bcbc96b2fe4b41dca7a
// input: apps/web/app/(main)/admin/distribution/settlements/page.tsx 94c1534289e602e6aba083ab9721083ab36974c7bbbdc6804b918ae23017bf6b
// input: apps/web/app/(main)/admin/distribution/withdrawals/page.tsx 03dee692b9cbdd10f6ccd96d6ca1f0e85d8041b492d7f0cedd5dfad87d3aaa41
// input: apps/web/app/(main)/admin/docs/page.tsx cffa1c8fddb6f6fa0f9eddb64d18c9c0ce679c8c9293b5866388d89379b5304d
// input: apps/web/app/(main)/admin/downloads/page.tsx 8819060090a817f13cc5f5a7dccc075694b0901af5f868996a1d0b7f943b0a05
// input: apps/web/app/(main)/admin/edu-settings/page.tsx b3bf808dde4ef393df9314cb2ffaeea6d7399c7e86c7383f2857e6d7325a0a52
// input: apps/web/app/(main)/admin/edu/answer/card/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/edu/answer/online/page.tsx 8c99692e08728c4a547fb37dcd811436d2f91ce3021c4b6b9d3d0fa8dc335af9
// input: apps/web/app/(main)/admin/edu/answer/page.tsx 6c81013b5d68c42d4325bb962aa4b8658d4c2927621f80fd1cd0bad151534037
// input: apps/web/app/(main)/admin/edu/answer/programming/page.tsx 434b35c5ba3e325d88027b49fd8ab4d154db745e17c4aaeec05bef86fe19a54d
// input: apps/web/app/(main)/admin/edu/certificate/issued/page.tsx 97a81c6de073a2f9936c8de58ce42460b2ae3323a33a85e55bd962b5edf85f46
// input: apps/web/app/(main)/admin/edu/certificate/page.tsx 263027abb53427eba13c7a2cfe6f6427b8158b1d20ed83a2d68de33e10d1e992
// input: apps/web/app/(main)/admin/edu/certificate/templates/page.tsx 2e010bdb3c38c3d4b8bd2522e14107e8595f51fe3a112a57afcb6526a3bb6fff
// input: apps/web/app/(main)/admin/edu/class/members/page.tsx 9294f9c78063b68bc40d106c0c6bb1a14c0899e8becadc011e5563cb5ddb7f0c
// input: apps/web/app/(main)/admin/edu/class/page.tsx 1c4cbf1bdc3380642eced8248a5f073226704390487f2b2e14e8fc2a905753fd
// input: apps/web/app/(main)/admin/edu/class/schedule/page.tsx 4b856f3dec2c1b437ab95e91be7fed34f1b789cb8ab3de0fbb6badb5ed797e0e
// input: apps/web/app/(main)/admin/edu/course/audit/page.tsx 9450f189f9bdb8bbb02004e29e9f2e0d19749b53717a79db437efbdd8f1e7ea1
// input: apps/web/app/(main)/admin/edu/course/categories/page.tsx 608758dcbfbc37295f866563fd9ad19ccfb3f034e43b68b10fe5989ab7a45a6e
// input: apps/web/app/(main)/admin/edu/course/chapters/page.tsx b9e339444d47523bf273b083940f4db53d21977f618b041f76227150362cd69a
// input: apps/web/app/(main)/admin/edu/course/page.tsx 2865d1d0b7fee6c57d4583af531ce1ce9f71fa16cb300d88be4e69e781fbe8f4
// input: apps/web/app/(main)/admin/edu/course/pay/page.tsx 82f64786cfc72af3b6525e2306aa2b2c15b1706d6eb3cc9829a1a6f1f6f0cdf4
// input: apps/web/app/(main)/admin/edu/course/platform-log/page.tsx c8f77167fd5e4765e8bbb0fa341ef60b36dcc114f62f963be475705e92949d4d
// input: apps/web/app/(main)/admin/edu/course/trash/page.tsx e161ff1e82de271ff99179efa14014bf011b3de75b9ac0c51a860a5f1398c899
// input: apps/web/app/(main)/admin/edu/exam/arrangements/page.tsx 91bd5586531beba9e949218ef5605ed98bdfd3598e514021cb345a4a99754eb5
// input: apps/web/app/(main)/admin/edu/exam/categories/page.tsx ad1ba26d9b126a51f57d71cadcaac86350d2561f5ad27347e98ad260481e6915
// input: apps/web/app/(main)/admin/edu/exam/grades/page.tsx 6cf668dc36cec604c46e0058d317e3291207179c539a95ae4fc1f9de7cc11fdc
// input: apps/web/app/(main)/admin/edu/exam/page.tsx eff0889e3f676e8c4c79b28da42eb5c5911316e6b2c1c8a99934b079c611c884
// input: apps/web/app/(main)/admin/edu/exam/papers-manual/page.tsx 3f348b1a8cdaf19e86ece12adcc54fdcf2ffc4ebe9cfd1420ac4619368280ab3
// input: apps/web/app/(main)/admin/edu/exam/papers-random/page.tsx 6f0f8c827121f4ce898e2aa9f3b8240d0f6e654e8892acdb1719e84c767f65a5
// input: apps/web/app/(main)/admin/edu/exam/papers-template/page.tsx 8219f5f1660b1093afa1d62e1154db2a0f659a36e99ae2ec892e4c718798c707
// input: apps/web/app/(main)/admin/edu/exam/questions/[type]/page.tsx 85511830b4645b36d7610541fb8a42196d64ecee166ccccadea4af53402b668c
// input: apps/web/app/(main)/admin/edu/exam/questions/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/edu/exam/ranking/page.tsx 65ce5d688a0c34fb965f18cd1a82f8e27c4971545a0a9577ff7048f3ee5346f4
// input: apps/web/app/(main)/admin/edu/exam/records/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/edu/finance/invoices/page.tsx b9500ec08cb5e123ffd84425715a9931dde039e3ae8a77fd14ce0050cff60d7e
// input: apps/web/app/(main)/admin/edu/finance/page.tsx 6a8936a5ad00dc85f3708d79b339a6781b7942a034f6b11190cdad045602f22f
// input: apps/web/app/(main)/admin/edu/finance/statistics/page.tsx 0adb75fdff36b8487a249b7bf29446b84679798a225546969dfa1ead2f993411
// input: apps/web/app/(main)/admin/edu/learn/community/page.tsx 42d512aa7e20ab723aa639f7c991ade08dc9d14ec5f11127e81373321dd738a0
// input: apps/web/app/(main)/admin/edu/learn/homework/page.tsx 47d33b98fb9c06fb4a72ce07d349348e5d1aeeefcfc3ee9deed6203f35d9d1eb
// input: apps/web/app/(main)/admin/edu/learn/live/page.tsx a433380c33edea66ec385ee6ff67023ad1c1f87a3c5e979a78ab4fc78d932067
// input: apps/web/app/(main)/admin/edu/learn/maps/page.tsx cc66afa89627874fa9f9f709fd4c6ab55ee4dd007cb7dfcf6a89a9cadf3a7d5a
// input: apps/web/app/(main)/admin/edu/learn/materials/page.tsx e2a08bf9d232306f9cca4d7f5449fe6eec2e04b80fb85e38617b8d56326d09c6
// input: apps/web/app/(main)/admin/edu/learn/page.tsx 97e6c593246ade7a2e698575cb5ce7011bdf471e34960e3561a3b7161b1f9ff9
// input: apps/web/app/(main)/admin/edu/learn/plan/page.tsx 82777d93eb433dabdf9b5f86d0484850621dcd40f60ce7072338e75ef48d931b
// input: apps/web/app/(main)/admin/edu/learn/progress/page.tsx 2b2f3aa09f1b9a27108d2d941b6b1e700925f559376f52fe543deb48954b2cbf
// input: apps/web/app/(main)/admin/edu/learn/ranking/page.tsx c9e4a8b2d4ecb27db40bdf507d6456915c857ee9923df0ffb929b2597dff4f63
// input: apps/web/app/(main)/admin/edu/learn/recorded/page.tsx 9c72eafc28ecb5c5e524597b466544e8a6d55c110575e37d43617ef0dfc321f0
// input: apps/web/app/(main)/admin/edu/learn/records/page.tsx 4d0ff00689dfaa1cfa622246d580f6fe0e94239b19d6f887f3a851f45ea87541
// input: apps/web/app/(main)/admin/edu/learn/remind/page.tsx 63c53558edc1403614b8b6ae5c8c2e51c2f5d38c8b3e6836d0b8c03d145d59ca
// input: apps/web/app/(main)/admin/edu/learn/signup-batch/page.tsx 0fdd78ee6ebd237a1552dd2c66dc41a7c06190e39f6c69530d4648ce31721eb0
// input: apps/web/app/(main)/admin/edu/learn/signup-batchlesson/page.tsx 0b24d55a09f5c18fb5443ae1f3b135f0616a34a3b09fd8486682b59b0634263a
// input: apps/web/app/(main)/admin/edu/learn/topics/page.tsx e72840f1202cf6688c9e7ba70ae17eaf67857d944e430f61c790899b339d1bfe
// input: apps/web/app/(main)/admin/edu/organization/page.tsx 04d82e9a313bee25bcb0b74df55e72524f5b0b4e7765926d52976eb01080fd8a
// input: apps/web/app/(main)/admin/edu/page.tsx 165f6a541a5e33ab0c079cfbe0b73a869dd6c0e581821530321bd91441147b55
// input: apps/web/app/(main)/admin/edu/platform/page.tsx 691eb7fec8231dcb10fc46547fcf53307a98cd1fd8b03fd6cdeaed1d4ccf0366
// input: apps/web/app/(main)/admin/edu/reports/companystudy/page.tsx 332b2fc4b6d7aa88c5c3902c627e41ef869b3c50d085542ece04396b0a777c35
// input: apps/web/app/(main)/admin/edu/reports/lessonstudy/page.tsx c9fe9e7f68b9cbe193394cf96335e65bf4490fb24042af043b46d76cfe1b2979
// input: apps/web/app/(main)/admin/edu/reports/memberstudy/page.tsx 5ffff7d081f45347583dab20322678955029cca056b9edf6421126389166ae5b
// input: apps/web/app/(main)/admin/edu/reports/signup/page.tsx 4a65731681cfe84082f88b885a5112b7fa888498ad9806c958c3bb9787cf9ce0
// input: apps/web/app/(main)/admin/edu/student/detail/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/edu/student/levels/page.tsx 9f395a9ef75ce3bb039d2d8f27c10ae4d9f38a9356dc44c2c496dc59a77fa62a
// input: apps/web/app/(main)/admin/edu/student/page.tsx 2e824f3f6980e1e669aa2c82d427dc8efd2293f5dc47097da6c844f60e77a931
// input: apps/web/app/(main)/admin/edu/teacher/detail/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/edu/teacher/page.tsx 7b7f1140f8e8c2897a27c07d365f62bb15f22a9cc7394afd0119e7ccb9fb0d67
// input: apps/web/app/(main)/admin/edu/teacher/review/page.tsx 5a87149441818f10e4ae19c653e995ff1c6f5d5cc508db3129d43e8a4ef2b2f0
// input: apps/web/app/(main)/admin/edu/user-platform/page.tsx 4c0dc433f19e61b447dedd4b22aba1e3d2fe79009424ab9cc71c2630ece5f21e
// input: apps/web/app/(main)/admin/edu/zhs-identity/page.tsx 1ca81ffbe55fcaa474429b5551b07d4c780620dcd6872ef2661febd2de17829c
// input: apps/web/app/(main)/admin/error-dashboard/page.tsx 4e85fc57c46513ecdcb16314b5d8c3035396a9bdfac34d2c0eba3560f54848d6
// input: apps/web/app/(main)/admin/event-bus-monitor/page.tsx 85a5520dad2a29cc52a2b2cb4eea7c4aad9a339b0da522e6c34b971a0c63da20
// input: apps/web/app/(main)/admin/events/page.tsx 4acf3b613ea3ea82531ca24269978dac330fc18aae310169a5bbfbc3b4e3a0b6
// input: apps/web/app/(main)/admin/exam-marking/page.tsx 1fdb5a1e78ccfce4a969495e5c401ccd94c6c59f66fd7a3a4c1b4ab5be118e92
// input: apps/web/app/(main)/admin/exam/categories/page.tsx 163ac24e26aa4dcefd23ba2fc6d7ede84c2e149524faf2e92a1e1cdcfdf3b36f
// input: apps/web/app/(main)/admin/exam/page.tsx c17fbde2106303907f3139a30fff39641a9ded4071e956b6cebeadbbdd16a104
// input: apps/web/app/(main)/admin/exam/questions/page.tsx 66edcb2907e55a9a47d1d60a878233400949c085414f803b81c61bf99098e66b
// input: apps/web/app/(main)/admin/exam/records/page.tsx 66edcb2907e55a9a47d1d60a878233400949c085414f803b81c61bf99098e66b
// input: apps/web/app/(main)/admin/exchange-rates/page.tsx 36b9d5221907a89ceae71074f3920f64895991adc2707d64fe7499f0c26f0e0b
// input: apps/web/app/(main)/admin/feedbacks/page.tsx 56da79722f9d609c8af1449c341238e5d79575cfbb64725e6acc1d28c1b916f1
// input: apps/web/app/(main)/admin/github-app/page.tsx 8f5826403a19c4debfc22e1d553b8e5ee6b8162fdb4bba851b184a2c848e4bd1
// input: apps/web/app/(main)/admin/gray-release/page.tsx 6958b20cf23e6f4ac370c8b15f50dc81e91e23d401d0be533ff70018b25a2684
// input: apps/web/app/(main)/admin/help/page.tsx 01020bc827e01c1ac285d043a4bd2425f525c0ac85fc47bb5cded862380301b3
// input: apps/web/app/(main)/admin/home-schema/page.tsx de6d4e389cdd3a5b8ab512a8c299af7621bc82853422a34d22d4faeb91123f1f
// input: apps/web/app/(main)/admin/i18n-dashboard/compare/page.tsx 1bdf0d4e0d2bfc4969d91b8ecad6e2109ceb4dc3b1b9d77e1e9c4b92fb6d40ca
// input: apps/web/app/(main)/admin/i18n-dashboard/missing/page.tsx ab0fee35316e5cd371bb9ea7331ab85b22d67abab39edf7574b06257252a4423
// input: apps/web/app/(main)/admin/i18n-dashboard/page.tsx 9a880b4656e429495a967ab0d8a27a43287a286044085ef1cb5a64b439ac570e
// input: apps/web/app/(main)/admin/identity-proportion/page.tsx 79c77ee56fb0ef15420c7b7e6a4fb7175905aaa7b1ef6d35965a42015bd1c83d
// input: apps/web/app/(main)/admin/im-channels/page.tsx 186fbc488dcad0bab1a1ad4b7c7ea52355a0dc43c16e5089c65ac6058a17f467
// input: apps/web/app/(main)/admin/integrations/page.tsx e3eccaaf880aabdcaf7981e0afa63010e150de4d1f3957ac7ae7c60a9afb4a8f
// input: apps/web/app/(main)/admin/invoices/applications/page.tsx 58035621c352a5fb8a0f3ed852c35a8d197aceb445d962b57933ef6a9de6d1fb
// input: apps/web/app/(main)/admin/invoices/page.tsx 0b77dc0f15772eb9186a77c48b99567863f4901d837af148dfdfff57364cafca
// input: apps/web/app/(main)/admin/invoices/titles/page.tsx 063ea99bdd2372e45bc096b7baf60c977d4ab868c129a7c509029a42a5c3c04d
// input: apps/web/app/(main)/admin/knowledge-rag/page.tsx d24b2d9c3b25fa262c4d515eae697279110e4885dcb995bcea2ccca8dd3d8a77
// input: apps/web/app/(main)/admin/learn/categories/page.tsx 0d2b714130597f2c09e1a5ffa7d450d35162f6fac05914d93566764d3d5dd38a
// input: apps/web/app/(main)/admin/learn/chapters/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/learn/page.tsx 701818f754e8ca93bcbe9f58052a2f7b047e00430e624188494015b56e262c31
// input: apps/web/app/(main)/admin/learn/signups/page.tsx 244a2f558b2ce6731047972bf807e16959736f0a76ba4187d5d26c2af2d18ce8
// input: apps/web/app/(main)/admin/learn/topic/category/page.tsx fc4481496d62b49328069ddb4c8b1d57a0404bb33475a89a9c9d3b55a3830c34
// input: apps/web/app/(main)/admin/live/categories/page.tsx 76b9dfef0f3792d38bf96b90b0ce351245819d2d933618afbb1f6eae30164f47
// input: apps/web/app/(main)/admin/live/lecturers/page.tsx 99ea36ae43f7840daeafaea78c215eedfcf1881321589d15e39c2f17f54844ac
// input: apps/web/app/(main)/admin/live/page.tsx 85961c5c9591c9a1f2bd2833b9981e7a12bbc0a5fbfd589f11ad715a8ec7a3da
// input: apps/web/app/(main)/admin/login-logs/page.tsx 83cd501f61baf887a8efb60b51daa8ed8a516cf742357681c28973c9df4d4434
// input: apps/web/app/(main)/admin/logs/page.tsx 27f0ab740b560a1be58ef2d3d4424149a26ac286aac3a17a76d5f2ea673c6f34
// input: apps/web/app/(main)/admin/lottery/page.tsx 2d56ce694eb51b2969608bf5f64d362ca979165764ff492b789129e76e0858b9
// input: apps/web/app/(main)/admin/member-groups/page.tsx 22c936a495a236dd5651acbbdefce57f73a940a1771e5c56c034fb13f9aeebf9
// input: apps/web/app/(main)/admin/member/blacklist/page.tsx 174862a3d1196806a795aabd5ba723acd15e08bc421d1cbcb5a1929113b9a02e
// input: apps/web/app/(main)/admin/member/companies/page.tsx 3f71d19acf9c3c26776c3b25c6474e9b3141a9a9bebea6510b6967708faf46e0
// input: apps/web/app/(main)/admin/member/company-types/page.tsx 3c56c39c74ac343fc70fc3b8184c7acc530aa0c0f918ba3549dbf4d15a128b80
// input: apps/web/app/(main)/admin/member/departments/page.tsx 0c0fa140d3ff2ed40121d049750262aaf006b5afe5bdf8ccc7b8c242671c1803
// input: apps/web/app/(main)/admin/member/logs/page.tsx 905ad5ced1e399405765a4ea4726a564617e34e5850f94b31a01ae6f7d33a430
// input: apps/web/app/(main)/admin/member/permissions/page.tsx b9d1724f2676fadf9580fcb1ccb0277677bb91648ee55d1ebc1969f2c0db1adf
// input: apps/web/app/(main)/admin/member/roles/page.tsx 09cf77209f2fec13fbf16f65ba55f5d3724a9eba428279426cf2a2c99bfa7e80
// input: apps/web/app/(main)/admin/member/unaudited/page.tsx c46b97d51983a19994d6798d74e64e4ea239ca6a4d4c50488808680f514092c3
// input: apps/web/app/(main)/admin/member/users/page.tsx 27b7a9171df4dca285ad1437dd2314e0840c2a64bdffa1a9b388837c97a53a04
// input: apps/web/app/(main)/admin/members/levels/page.tsx e506dc5d008fc9aecfe59386f37c7cf2ef450989973b6f4da0f3a073dfa76362
// input: apps/web/app/(main)/admin/members/page.tsx 46269e89f869bf480359dd43520e3043a0168bc37aa0866322a15dd9b4e718d7
// input: apps/web/app/(main)/admin/menu-permission/page.tsx 3ba55691bca785ff724a51ed76066e48347249700560d949fd55a82256c04e0b
// input: apps/web/app/(main)/admin/menu/page.tsx dc6d5e73574cefd16cd8eeb4b05bddc89706969c82488b47fb40ad0f87f24b44
// input: apps/web/app/(main)/admin/message-overview/page.tsx e72520e5d925e775cd594425d9b3b5e7fe7418595ca6a29935ca93df86ec5989
// input: apps/web/app/(main)/admin/message-templates/page.tsx 734490917bf284182a82ebb8f2d72480d8b20000667bdc69c2a2f838d1e5a064
// input: apps/web/app/(main)/admin/meta-learner/page.tsx 314a360c61909c1596a9ecab8534625edde931543fcc0713aba30bb9402cdc68
// input: apps/web/app/(main)/admin/mobile-adapter/page.tsx 1ecdd2eb82de1867e2f77049b9969ca4cc39df480c824aed0d42cec90bac7c43
// input: apps/web/app/(main)/admin/model-pricing/page.tsx 5d05fc52421b2d85db0a879701b67d7479a284cd0918b8674e66a3f7243faa55
// input: apps/web/app/(main)/admin/monitor/alerts/page.tsx 5bde614fb2694347ecf278d23fb86f5ce188ce0f59e7b113e5ea07aa9f1adcdb
// input: apps/web/app/(main)/admin/monitor/dashboard/page.tsx 324189db7105e01ebb6eb56b295d16aa02bfe18a709c1d7ed166cdad97ec7974
// input: apps/web/app/(main)/admin/monitor/funnel/page.tsx 0063e5e3d9e508014ab9c58f4310b825c867f5775b3f277a088b3f236ea67fe5
// input: apps/web/app/(main)/admin/monitoring-dashboard/page.tsx c717bd0089fa2ef649facb0f028ca410ec5493cc992c9124c2e860886acafcd4
// input: apps/web/app/(main)/admin/news/categories/page.tsx 9435286baf4a33389619cc8b41914da958edfd53f9079c6962ce74ea7b00d2c7
// input: apps/web/app/(main)/admin/news/page.tsx 7d0127c4117f7c5168bc51fc4164aa98f9a249f01e700fbe4c7670f9bc5b9854
// input: apps/web/app/(main)/admin/notification-channels/page.tsx 8c5334e00a86124e4a18cece162c279333df247993c8261f00378e205cccbe35
// input: apps/web/app/(main)/admin/notification-dispatch/page.tsx a15048121de8a402fda493a17744a2aacdf7540c9029835bbd9eb2d14fe516fc
// input: apps/web/app/(main)/admin/notification-logs/page.tsx 36c20bac55920bb4e156b0d6b9603e362640eaa81120186529c5080060d5a76a
// input: apps/web/app/(main)/admin/notification-preferences/page.tsx bc80f1b9242b89749b74e31520c868d26b7750c3926a0794f37dbdfd5a192201
// input: apps/web/app/(main)/admin/oauth-apps/page.tsx 972060269ac7af5912a465022ae3446de8525d1878bfbb9d58c3ad9d48fb7361
// input: apps/web/app/(main)/admin/oauth-audit-dashboard/page.tsx fef6305519a0bdceefb320268b5ee08137a4cf2566113bf2e2f1fd8c0c6fbef6
// input: apps/web/app/(main)/admin/oauth/apps/page.tsx 58b348b7edc1e93176ab6a7d11e48de46fcfb6bcedd9857a27dd6f29cc65af6b
// input: apps/web/app/(main)/admin/oauth/audit/page.tsx 909dddf499230623c654436af700b058e75aac89bea044c251abd7778bc18a4a
// input: apps/web/app/(main)/admin/oauth/tokens/page.tsx 121e9a053fbf2ea9dd85335274388cb63fbe94cc8226440bb95b37c0c9eb57f4
// input: apps/web/app/(main)/admin/online-users/page.tsx 9f24ab8b623949333457034b29176c2e255041c513a343e3237c5a49885e0bde
// input: apps/web/app/(main)/admin/operlog/page.tsx e1e1a0837b9581914aeeae63da4c8af3b2714a7f2359d1633f022e73ebb867a8
// input: apps/web/app/(main)/admin/orders/page.tsx 2a3ebca2eaf05134f4236f64f8478071bdd7e7df008e9a5f121aefdd8669649a
// input: apps/web/app/(main)/admin/oss-config/page.tsx 851ec7d736b7cbc90b7c68c6aeecacd0eaf57b00b24c6da7ec65f7a414af0bfa
// input: apps/web/app/(main)/admin/oss/files/page.tsx b3d9236c2934d5b00a7e0147a4bb7956567c2de2cd142bdd8534fe70086d1241
// input: apps/web/app/(main)/admin/oss/page.tsx c903c571eaed560242862a2bd2ebbb01303b79bcaf46a5694360b00e4533d03b
// input: apps/web/app/(main)/admin/page.tsx 2253e63232dbadf74677193db857d458e5916dbfce160c8a08e79ccef2a98d93
// input: apps/web/app/(main)/admin/performance-dashboard/page.tsx 4cf7d2391e8b585f604adc1208d449566ba02236f9407808d14e6a340d2b138a
// input: apps/web/app/(main)/admin/permissions/page.tsx 2b1a71130fed9ab70f77ec1d462ef11b2edfb7007d019eeda6c1740dfc2ba5ff
// input: apps/web/app/(main)/admin/plugins-stats/page.tsx cccdd40c8102b6f4eb6322b02e588ab0d31b892dfd8441e71b3a9b01a8b1ed39
// input: apps/web/app/(main)/admin/point/page.tsx 3626c1ab7239a6ec11735a7881f35e52af228fcdb92354f321c574d7682e0f73
// input: apps/web/app/(main)/admin/point/records/page.tsx 6e23425b04632b6b5d561c050e5bae2617e0240da34d0956fe4fcc4317df967b
// input: apps/web/app/(main)/admin/point/rules/page.tsx bc211aec23e54cbcdc583546419e70bd852d96ae82774f04f75a915bc08e7400
// input: apps/web/app/(main)/admin/points-mall/page.tsx c5ac749fadeabdb3ed3ab194c14b40e4fa96711179ff6943e0f4ddc5147fa52a
// input: apps/web/app/(main)/admin/post/page.tsx f34c0c6c09cb40d262c3df7dcb3ace9677163868f72a0f1ab770b9c7ec119b34
// input: apps/web/app/(main)/admin/private-letters/page.tsx c17fc6adbee303e311c340b776de5a55ac23d4d737a489493831e8077dcbafc3
// input: apps/web/app/(main)/admin/product-identity/page.tsx 008f6bd92501abac6e7c24f91524a9916ded7a41ffd8d72ddec38131e50fef10
// input: apps/web/app/(main)/admin/projects/page.tsx 2c9218810976590bd4e13113cc71d4c962d921b9815189084740f0571c8a0fcb
// input: apps/web/app/(main)/admin/promotion-rule/page.tsx c893d26c3b06db6ec265d3e314bd7273e95150c9f3372ce341c1c99641c7abe6
// input: apps/web/app/(main)/admin/providers-health/page.tsx 90b85b077649fd374f15e048a2800491ead74f99a856da639cb172cbd01f75d5
// input: apps/web/app/(main)/admin/realname-audit/page.tsx e7fd4adb00d6d615f6ae90a177ee73f548d2210261c785e95e14f4e77d1bdee8
// input: apps/web/app/(main)/admin/recommendation-config/page.tsx bff5b3265cacd6c2c5b3144707cc35ebe80fa7adf64c3bffa9365c064277a5ab
// input: apps/web/app/(main)/admin/redis-monitor/page.tsx 58042aac5969aa0a373dce251befe7c249e373c927d9c293b270cbbc5a157c04
// input: apps/web/app/(main)/admin/refund/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/refund/page.tsx 13bd5a43d297515adc44db50087688c030fa6803d813fd24566e77ae234c922b
// input: apps/web/app/(main)/admin/relay-param-ops/page.tsx 95345ef579b2347237c132978c02d6c94b463eba241ddb2f46c285454df0af0c
// input: apps/web/app/(main)/admin/relay/alert-rules/page.tsx c5250e319f4c322abadbe2d6cb0a059995993966d87e19177e960aa16cd0910e
// input: apps/web/app/(main)/admin/relay/capacity/page.tsx e764a1fd7100863cdad16da8a5011b5951ca304f6eb4fb5735296e70e1263060
// input: apps/web/app/(main)/admin/relay/channels/page.tsx ee2621001ff5858411a40cc5c8d71dc36aece49b8278adb7947d53e8d860ca3e
// input: apps/web/app/(main)/admin/relay/data-management/page.tsx 9ce40a61a6327be0f50263866cfd00cca09e2056247983772d405b34e70c3062
// input: apps/web/app/(main)/admin/relay/discovery/page.tsx d3aa41665db9583e8b3227d4800cbbbe48b93f90865bafa0abd5b42d49de4b2c
// input: apps/web/app/(main)/admin/relay/enterprise/page.tsx 12fa694c506d39306897e211dae6b78b12098b367e9e6859b222f2d597470397
// input: apps/web/app/(main)/admin/relay/error-rules/page.tsx 61daaa22f2f5706ce15714774bb453873470df2e3084bfd16d8e39724e073f1e
// input: apps/web/app/(main)/admin/relay/insights/page.tsx 8ca1cbe7294fa173596a5c1e90b0205ed6ace75b1b184c3cb3cecb9adef2a35d
// input: apps/web/app/(main)/admin/relay/key-pool/page.tsx 0ce643110c43ce62f3f87aeaa15bdb3044457f636358e6920573c21aa77073be
// input: apps/web/app/(main)/admin/relay/key-scheduling/page.tsx 9e3cc8ebfcc1f1e4df8340b56e5c9c04b8b3a58e69d283f868bc8c55388fb570
// input: apps/web/app/(main)/admin/relay/logs/page.tsx 61d35eeeab2acb7e0b0c689c03d8415054fe0674e9124f5f7041d839b075a192
// input: apps/web/app/(main)/admin/relay/models/page.tsx 04c26b367bd57c0c036a4ad3d0f118276bbd6cb116af2a60f887b0b44a5aeeef
// input: apps/web/app/(main)/admin/relay/overview/page.tsx 453f04dadeb0c49386215d6be5fba3144f8567c0269f5bce10876ca1311899e7
// input: apps/web/app/(main)/admin/relay/page.tsx 16a6441584e28e0c12e371ef572fc091d21e5585dabcd4ef760d00d78a37e8c0
// input: apps/web/app/(main)/admin/relay/peak-pricing/page.tsx 0c608fb3759043839e6cc1d4246d908fb8e8fd079fbc6ab3025e98447461e911
// input: apps/web/app/(main)/admin/relay/plugins/page.tsx f2c489e7a2fce2f01b53cc7a2273014b1efcd4f14f16b0e68303b6b43381632d
// input: apps/web/app/(main)/admin/relay/prompt-audit/page.tsx 4710fa796ffb01c4d2e73291edf5ef89376cd92e79e333b649c1bf7bd0cd7da8
// input: apps/web/app/(main)/admin/relay/user-attributes/page.tsx 819867f2e2efea28a4a78ff7c72fe25ff3316b21540f2f209a0f41f8727d3d76
// input: apps/web/app/(main)/admin/resource-product/page.tsx 3e3f0fe50d3afc39991e7ca530634c996ca8496f42f7bca8b2608491b0027051
// input: apps/web/app/(main)/admin/resource-tag/page.tsx 8713454be6610b3a9775d40217b653c2ee840d518a7251a0780065b258ef2b45
// input: apps/web/app/(main)/admin/resources/categories/page.tsx bbc7568e1792cc5e8fee5293d21a89ab1141f799dd407e926ffac0483aa19395
// input: apps/web/app/(main)/admin/resources/page.tsx 813c0b98122e8316c8174bd03b0ad9f33196ea75a9aab99bd2480a18e865437f
// input: apps/web/app/(main)/admin/resources/product-categories/page.tsx bbfd19465cad1e507ef6fc882ec98bfc10d7c0c2c1d6c075ff54d4e79f334f63
// input: apps/web/app/(main)/admin/resources/products/page.tsx 3e5369d6962fd2d55edb83da54c0e6394b298db70b4ef7b26c9fbeec19f83ee3
// input: apps/web/app/(main)/admin/resources/tags/page.tsx ef4e4a481d01f269b0919aa8070fe07877709330f3a3867f588668cf5c55e1c6
// input: apps/web/app/(main)/admin/revenue-stat/page.tsx 035db306fef7f84c9f849884b4d0d71086d70443744c23e7df45e258ba4ba01f
// input: apps/web/app/(main)/admin/roles/auth-user/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/roles/page.tsx c276431c77ffebfe684c465a8fff0f2523cc9af85071eb8739c8e5b06af74855
// input: apps/web/app/(main)/admin/roles/select-user/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/saas/[slug]/backups/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/admin/saas/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/admin/saas/certificates/page.tsx 36022730143ead334e3e296f99b46a76cd758afd5a2f9ea87751584f30b3f99a
// input: apps/web/app/(main)/admin/saas/metrics/page.tsx fa603275b498336afb9a55857ff60b34451f440d4bbd50071392818f1a8a69d7
// input: apps/web/app/(main)/admin/saas/page.tsx e51dd6f9afd8e675015eba0e36bc822b38cf2564ce75181a310a33fff3e7e857
// input: apps/web/app/(main)/admin/schedule/logs/page.tsx ceff5f7dd2aa30be28fcc557d1ac6fb382a2b8bdf6e0eb724c7aa0b02b24bb4d
// input: apps/web/app/(main)/admin/schedule/page.tsx d7f99823e9c4b3dfcd4bb6a2cb3d627518323e4a864367d9d1394f96220f4318
// input: apps/web/app/(main)/admin/search-hot-words/page.tsx db2a20662b69b08d0f687f222ce61795967e638bc89ebb72010219edd89d705a
// input: apps/web/app/(main)/admin/security/anomalies/page.tsx e7cacdbf7d26c307406f571f8b980f802e6b801bc85aa686a2633458b3034cae
// input: apps/web/app/(main)/admin/security/ip-reputation/page.tsx 26e71d56af43399ef833a80851c42e777a687d0b41edcb058380e79a0045fcf6
// input: apps/web/app/(main)/admin/security/threat-dashboard/page.tsx ed3e87b83c899e32364c9e40af08222ebc96d898c27ed81628d926c0cbfa8e4f
// input: apps/web/app/(main)/admin/sensitive-word/page.tsx 0d15dcaffc998f506a0cefac114247e070ea7ba3af4b5df71925b0e7b2b5f33b
// input: apps/web/app/(main)/admin/sensitive-words/page.tsx 24c834c3553ab5eff63fe469398f6d740b950f1c4993cde3e371a646c91daefd
// input: apps/web/app/(main)/admin/shop/funds/page.tsx e41f5e98322a0a435d541696c3c0d4f9da686eaa197206764517fd67772b6297
// input: apps/web/app/(main)/admin/shop/payments/page.tsx 99d2b46df4c9a7fb4a1b40016b170b2c3aff587d5df69f9edea253307aaa966b
// input: apps/web/app/(main)/admin/shop/products/page.tsx 2c4fbbe523c3b390e6b707c841e0f3c89e6b0515446c8aee292f408bd61e755e
// input: apps/web/app/(main)/admin/shop/withdrawals/page.tsx 68d35c3456954e82efbd20a8d603f4d8eb5bac3a087c82e6b969ca9bae03c4cb
// input: apps/web/app/(main)/admin/signin-rule/page.tsx e5031203d54a27bca7833422ea4cb7ab201a71326d06f0a5eedf1a082c50bb29
// input: apps/web/app/(main)/admin/skill-batch/page.tsx 2f75906c0ec8e004fd1d1ef0f1d7fc13318e80e0605365f3a9e8f7e8d494b95d
// input: apps/web/app/(main)/admin/skill-categories/page.tsx 33419ea0a873857fbb7067fed6d37b009d53ffe523135287b90f366147b21f6e
// input: apps/web/app/(main)/admin/skill-stats/page.tsx 991e25cff285e901c0c8bbabb82af26832e6570b578daf67686f407f320d8c51
// input: apps/web/app/(main)/admin/skill-versions/page.tsx c493386851d7f28c74a1fd134874040d25215fa6937f8f2b86d4c7ec7297b538
// input: apps/web/app/(main)/admin/skills/page.tsx 430306a7968473f7ec0b93764700de97b39ae472d93971813ed2b8d880f3f8e2
// input: apps/web/app/(main)/admin/sms-receive/page.tsx 22d526dc368f8e104a1f70f8363f68681c84a4526b536f6c95ee08f9961b036c
// input: apps/web/app/(main)/admin/sms/page.tsx ff30a4a5b8afec377a29408fa94a0762359ce539e85f4fe004e2202fbcd60e29
// input: apps/web/app/(main)/admin/statistics/page.tsx 898fca9b97d952ff402eee5071f4c0b343e5689de461991ca0c51b2ab2a48c76
// input: apps/web/app/(main)/admin/system/login-logs/page.tsx d76bda3e9f6917e87f94262ed5047c30c71b3cc9a0266ad03b3478b8581ff7ce
// input: apps/web/app/(main)/admin/system/monitor/page.tsx f68d9fa49ae2e330c95afe513f949efb489b6c0a6496f9a76510a1302acdf495
// input: apps/web/app/(main)/admin/system/operation-logs/page.tsx b6dba796f083a4605bcd09c814c44266b1f9dade5d20434de2e8ae5d6e4b1d16
// input: apps/web/app/(main)/admin/system/tasks/log/page.tsx 0486b94e423cf0502977e37446646ff57e41879c60a9a8c4f89f553394c7f74e
// input: apps/web/app/(main)/admin/system/tasks/page.tsx 8bc7b3cfef20838e838953ae9d19b91a54881349bf6419afa80574fad92763f1
// input: apps/web/app/(main)/admin/tags/page.tsx 4d08afee29537e144399c80d0d9c966d57359770f4bbb93a56de4c545d2c4342
// input: apps/web/app/(main)/admin/task-developer/page.tsx 0b4262280373d1fbe4275197dd29da6974546603b2970616c3c9da53694ed595
// input: apps/web/app/(main)/admin/tax/page.tsx 738d3e93d888ea14aba818e5ec058c7437bb8e4e12e618721d4128d8b933da99
// input: apps/web/app/(main)/admin/theme/assets/page.tsx 6dae20c1398b594f4840e2829545c3218e6fafdb211cb02a5614d133033173f6
// input: apps/web/app/(main)/admin/theme/colors/page.tsx 1c3c7270d4df8f7c822d2b0d0df72d9c76340fff65e9217efa9991aab2c28c88
// input: apps/web/app/(main)/admin/theme/create/page.tsx 7714e8a63afd747b9b6faf6896260ff0e2f317223edc996541969319dd50b55d
// input: apps/web/app/(main)/admin/theme/dark-mode/page.tsx feef6f2f73c424ab5712d47760bd9ec49232d5887b8fa99d094833d0199f48e5
// input: apps/web/app/(main)/admin/theme/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/theme/export/page.tsx f1f9bbfac262f5fe1490e4c6c750ba86b20d3cb7622a687f2214b213eb128d80
// input: apps/web/app/(main)/admin/theme/fonts/page.tsx ec018a239d3007ae7e5ed2abcec2bccbc06c4676df22448decc3fa3e36901d9d
// input: apps/web/app/(main)/admin/theme/page.tsx e182ff1de535a5f0ac4e29f41dc1f4dd854598bcdc75db67b14b4ceb539b22b7
// input: apps/web/app/(main)/admin/theme/presets/page.tsx aa3a4ea9d27de8788794906d4249945503aae4cfde20b8a05a6f2bb1220758b8
// input: apps/web/app/(main)/admin/ticket-reply/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/ticket/page.tsx 7ee61d2ce61e3b5026f5426eb3efdf2fbb2b6f13aaf9a4f55b87380cdcf05fe6
// input: apps/web/app/(main)/admin/tool/gen/page.tsx aa59c400331ceecebbcb522dfe9995d251142cf7ab60a5d68e21e06488f98a19
// input: apps/web/app/(main)/admin/topup-config/page.tsx 3532efe10c2d2dfca84e816d17daf31ff0d0d12731f10f6238a708208ee6201d
// input: apps/web/app/(main)/admin/unauthorized/page.tsx 8112ee7327fede15cb59b07715b70674f0bf0ada8fd33eb090ea54246d1a75fb
// input: apps/web/app/(main)/admin/user-agent-audio/page.tsx 262afe74e2aca66e0272de1e8d3faeb079fd51b5dab6b71403b989123b435640
// input: apps/web/app/(main)/admin/user-agent-context/page.tsx 58c7dbcd579455289fcf699c2bd1fb77b1e1b7ddba60ea70b6d330e32c5ad77b
// input: apps/web/app/(main)/admin/user-agent-image/page.tsx c27b92a56d718b6736aded255947277e1756758e65b2a7a05719f0683a3e878e
// input: apps/web/app/(main)/admin/user-center/page.tsx 0b501a4c395d4abb2cccc4437944e5b323dcc4f5333421c84f1c637376d4bea9
// input: apps/web/app/(main)/admin/user-margin/page.tsx b03ce43390424496b763eb69a821b0afcd3be7a0d606cda2a5aa2586a483ac80
// input: apps/web/app/(main)/admin/user-stat/page.tsx e03b94cc20ba7b5fa7a02e90665d490959df397b75bd6436aa24731797b0ce65
// input: apps/web/app/(main)/admin/users/page.tsx b56741efbad48ac8b0ab17b50fca5084190d82cf4c908a4002b862f538323be3
// input: apps/web/app/(main)/admin/variables/page.tsx 5b7984cdbb2b5cf26a38909f39ee4b5ad6bfadcf355a2d3c60a92b7781173dbb
// input: apps/web/app/(main)/admin/video-logs/page.tsx eb24231b39b21bb928cbe9f4b2016beb7d7aafad0febb04952c50051ae669cb6
// input: apps/web/app/(main)/admin/visit-tracking/page.tsx b379cb4942a38d73491c307dbe188a5c15589249a8d1fe4ae780708a65674024
// input: apps/web/app/(main)/admin/visit-trend/page.tsx 489241d5c372cfff542ea832afaa36b95fd998fecc9163c2bb1e2f030fa0c01d
// input: apps/web/app/(main)/admin/wallet/page.tsx 78ad624d2200933c17d122539c25ab9f5d2d666d9e6f77bfdb33ad0bb40d5d9d
// input: apps/web/app/(main)/admin/withdrawal/page.tsx d30e11544048d8b94322674d1863feb44e56f92a1dd4506eca662887e5b1236b
// input: apps/web/app/(main)/admin/workflows/page.tsx c6bf295bb43d4076341a37b109bdd1c63e1c40eeffe0118d791d4a7c1c4bd8f5
// input: apps/web/app/(main)/admin/zhs-activity/page.tsx 5be84abca8364aec50d3907ec4104181559beb5fb644fcb3df458af8932c5461
// input: apps/web/app/(main)/admin/zhs-agent/page.tsx 3be8bf47ad25765d52ab5f9ca9c3001d81d6f947db8fe3c45ba2a47cc35c4fd0
// input: apps/web/app/(main)/admin/zhs-user/page.tsx 43c119f499014e3fd7cbdb1ebeb3c330a74203e5533a3e9bceba09e5d5734765
// input: apps/web/app/(main)/agent-canvas/page.tsx 1b33f7ec304881b404c28d68d8c69b41e41d60d3866828ff2c9c2fbe7decb232
// input: apps/web/app/(main)/agent-kanban/page.tsx 407708aa64c2e3312a29b075597f5186a32517d3c250659b2a5c20e08839af12
// input: apps/web/app/(main)/agent-plan/page.tsx b9bfb43736fa7955ec0aef8ff68c5bf1122fd3eedbe520f3e5adac1361974473
// input: apps/web/app/(main)/agent-plan/progress/page.tsx 21b7839e14b2c8667fc0ed12cdb697e102c7c0476ecbe315e9a401019f18c7d2
// input: apps/web/app/(main)/agent-runtime/page.tsx 78ac0c1c1beb518e3b3f15af77f172c0da0f40498a60cf610178ceb3992b9d41
// input: apps/web/app/(main)/agent-step-recorder/page.tsx deaa7ae5968442939c5e7feaf80059f40b82180fd3f17a625e9065ddedddfdfe
// input: apps/web/app/(main)/agent-teams/page.tsx 31187390c8a6379974a3261bbc8be4562afae6ddfa44b3c5e4204d1cdf15bf9d
// input: apps/web/app/(main)/agent-timeline/page.tsx 69f2497b967c5406e33b30706bd6890c961596be184bfe985637b6ccc7fb1d3e
// input: apps/web/app/(main)/agent-workbench/page.tsx 1ff81c8bf8483e9ba640934aafced9f4169da527e6779a8eaedaf9d9804f86d0
// input: apps/web/app/(main)/agents/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/agents/categories/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/agents/categories/page.tsx 61ca4ea4caf7f29084071aafc95dc3949b26eab9c9deda1a73340f6b20ab07ae
// input: apps/web/app/(main)/agents/create/page.tsx 68119a8ed6864dfe3b64a9e7d695de41227790286895d244bd10da5f24aac1ef
// input: apps/web/app/(main)/agents/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/agents/featured/page.tsx 57ac1c75f17d93d31842ffa45514f67f402740bf46c41747fd075bef90268802
// input: apps/web/app/(main)/agents/my/page.tsx 5aabb885d2f226b4cd0b684279e1a1807a46cb838a25b8915ca8476ff7a1eb34
// input: apps/web/app/(main)/agents/page.tsx 71db76f2fd7ae1d5c358cf3173ed1e935bc114b29e500a3212422f7c7290e9bb
// input: apps/web/app/(main)/agents/stats/page.tsx cd63c11c8c036b7cfbfb57a17f3de0e398670904506e42562e8efaeaaa9e666f
// input: apps/web/app/(main)/agreement/[type]/page.tsx 2fdfa2b9b1de35ab72faab4733c4743b37f0845e976b32661cfc06d5e85159db
// input: apps/web/app/(main)/agreement/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/ai-career/page.tsx 1c89910a8b3dc9b409ebd96886e752eae4c31da606a7642cb1da69577766efca
// input: apps/web/app/(main)/ai-generation/page.tsx a910eeb39c53b9c6c3280ba8cda7662d1d9814e8b7541e57754142faa28a2dbd
// input: apps/web/app/(main)/ai-generation/video-tasks/page.tsx 103979c1f1168d345fd82e1235b1afec798d37513569c5d37edbc2714ab58ad5
// input: apps/web/app/(main)/ai-news/page.tsx c9d13918b45feff87376005332735215d78d980e7a9da40d1690efcfbffe9ec7
// input: apps/web/app/(main)/ai-skills/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/ai-skills/page.tsx 84e608aed20bceae83d3bd6e3a54da8967657bff065bf6a4091fe87692ec8e7b
// input: apps/web/app/(main)/ai-world/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/ai-world/create/page.tsx 3483cc9f4378efedf9593077dd1a3057add57f2cf3e175d03eb2c3b3c6765967
// input: apps/web/app/(main)/ai-world/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/ai-world/favorites/page.tsx b8c1bb62212cc2a4f50cd3ae0b81300aa6dd99661b97b3f7acb3bff73a270669
// input: apps/web/app/(main)/ai-world/history/page.tsx d578639940597fb240daf8c965891747548b9d1c7c0f830b2c39b5efc4cdb1ab
// input: apps/web/app/(main)/ai-world/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/ai-world/share/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/announcements/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/announcements/page.tsx ba5e078eb93f70a81142ce56686263c8989644e5ea4fded269206835e3c31e8d
// input: apps/web/app/(main)/api-test/page.tsx 8a511e7fcaa1610b369b4032a7bb22e9b45b62c33bca45689eae2243f98189ba
// input: apps/web/app/(main)/app-permissions/page.tsx 5016d3200c07b40d6fe01ac3808d8e0592491e5f5da38d913d658a114a99a573
// input: apps/web/app/(main)/article/page.tsx 3be8cc21f72dd604fb3eb6600b920077394f24997281f4444f6ea429ac8dd74d
// input: apps/web/app/(main)/articles/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/articles/edit/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/articles/hot/page.tsx 4f28218a219bc41235a83e50d6978a121705486074f229803a4fd519f64697e2
// input: apps/web/app/(main)/articles/page.tsx 52d3c0a836d8d55f4d8b477063d55401313cb0179528af9e69ec973da97b3d4b
// input: apps/web/app/(main)/ask/page.tsx 78a7b752303eaca2fbdc8d28229eb7f3def29c9cf10b8c15119d06d5d05301d2
// input: apps/web/app/(main)/asks/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/asks/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/asks/edit/page.tsx 1bfcf3cdca785cba1065fc4422223172d274b0784c260844a007956cdf40e13d
// input: apps/web/app/(main)/asks/page.tsx 1c9d4df95e8354dcdf2f044b7affadeb88f2e50f921659683becb115f155cee1
// input: apps/web/app/(main)/automations/page.tsx a05df43cd7bb048bdee10e5a74556bc561ef737c314039f7977d9db3411054e8
// input: apps/web/app/(main)/available-channels/page.tsx d0f2f3006c18ddbf8bf97b97786b224e4c3135e7f33d9642a33df88d92c92eae
// input: apps/web/app/(main)/bi-dashboard/page.tsx b41abfcaf529a78a016a261447cac60eb3e5b38fa4d5f1f4c41826b395c2a7f6
// input: apps/web/app/(main)/blog/[slug]/page.tsx 8d3c0ec31ad018cbdb11472742cfc92165532cfb811e0e9e5839a6c45f53a6e6
// input: apps/web/app/(main)/blog/page.tsx 6d321f3ecc8b875053b770e47294d00d96ae27f077fc9e70af3fab765ef0324d
// input: apps/web/app/(main)/business-card/edit/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/business-card/favorites/page.tsx 4a4e7693f6128f46c5bcf2ee9916d2e13e4b256dac6a7019e59b8c686d13073b
// input: apps/web/app/(main)/business-card/page.tsx 50ef5021c2e4cbd0b399027a3d86d4244cb26dd69789307db611fb6c2b850066
// input: apps/web/app/(main)/business-card/share/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/business-license/page.tsx 44349580b71ee4ca4050496bdbf07ce1ffe51bdfd984ea57c829c423f0507c05
// input: apps/web/app/(main)/capability-market/page.tsx 9e89193db363da5deaf464c9761bc0492a1b267424452762a75f8d6ec65df25a
// input: apps/web/app/(main)/carte/page.tsx 5718f2c73c6abd28989cfc70e0a44cb190726861a62355f89bd6423bc8601236
// input: apps/web/app/(main)/certificate/[id]/page.tsx 5dcc5b5105320a0545f6b5cee21fa59b7e585f99d35b43760a431322aff0dae0
// input: apps/web/app/(main)/certificate/download/page.tsx 758d042060b866f303c60e642accb992466671417ef7e62306df50249d5e03bf
// input: apps/web/app/(main)/certificate/page.tsx 3e6b9961ae96c8315007d9aa35fe4dc023e4c8461ae154d3b864e09a57643c00
// input: apps/web/app/(main)/certificate/verify/page.tsx b4b16d5a3c23ab4ab1ff48951693a7ee36d5cd2b6354c751d8a7d05aa5962151
// input: apps/web/app/(main)/channel-status/page.tsx cd96a600eeba925827c9f73793fb4458e3585216ee01365efaf23e47378b5319
// input: apps/web/app/(main)/chat/favorites/page.tsx 77989807ba94cd6b6ff5c14470ae4bbc0073ce188d3f6d23e2215d824ea0879e
// input: apps/web/app/(main)/chat/history/page.tsx be394a92b1246223fb4c23b8898a692fa669ba7c96cd286ec6bee7b76e6f2880
// input: apps/web/app/(main)/chat/page.tsx 7ff91c5f4f40017030972dbfbae86adedb44ef2ed596e7251e2cec681f0c49b1
// input: apps/web/app/(main)/chat/settings/page.tsx ac7b78cfb765452ecca82c101a7b659847744af0d2bf9a750e0e0f464edcf561
// input: apps/web/app/(main)/chat/share/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/chat/templates/page.tsx d4171e1f2cb0c2069094468b9138c299e62f00f4c43426ce5cf35846528c26d8
// input: apps/web/app/(main)/checkin/page.tsx 42cbc02d7a63bbd65b22a4501a0738dd0885340968a9741b1c640aa97b2b06df
// input: apps/web/app/(main)/circles/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/circles/page.tsx 5dc5b147cc4e060a352c51f9480deb7b0063dfeae971c07933cd0a4fbbfd9cdd
// input: apps/web/app/(main)/circles/post/page.tsx c0fe168de566874d24fbcc1208b6f93b142e9f2dc6c2874b51f422a9eed6dc57
// input: apps/web/app/(main)/cloud-agent/page.tsx d0fdf66eab368c19e4158b4427237157f60017c0e067d49447ddda6b398b49ae
// input: apps/web/app/(main)/cloud-run/page.tsx 33ecf8d6d2bf8844eb45d5d7257fd2b6bbdc0c891acc33382a8bbf94ffbaa13c
// input: apps/web/app/(main)/comments/page.tsx 5096f0a5b23058e67ccf1eb811f205bbb72e8b4b8b3b2b33fd46b01ceb589696
// input: apps/web/app/(main)/commission/plan/page.tsx 0b14e046a6eedd2c3554c70824341f767e2b945779c854bdd67274a77632b0ac
// input: apps/web/app/(main)/compare/ihui-vs-autogen/page.tsx a421b6d7c596ea3c7c245ce15a2af9f12b36c86f3db6a44da0cd89a0a85c417c
// input: apps/web/app/(main)/compare/ihui-vs-bolt-new/page.tsx d6422afa1ca4f55f5f22fe17b3276ec8f53cf75b967dbb70b460077a8b41f09f
// input: apps/web/app/(main)/compare/ihui-vs-claude-code/page.tsx 44ebbfa729369e1f35ece8a6da185a4ccb282965ddecea0263289c4fb9f27fff
// input: apps/web/app/(main)/compare/ihui-vs-copilot-studio/page.tsx 5645209e40ea6694290a379f95db520077c0d8c9855a99b1ebd0855660e07703
// input: apps/web/app/(main)/compare/ihui-vs-coze/page.tsx 87cd819596d12963231db9be9ef9421f271d0fec1a8e87eea6d4050b30e5e676
// input: apps/web/app/(main)/compare/ihui-vs-crewai/page.tsx 69fe10a8c19ec1ae24443ce13cf11cf715d68921f078ece38e286cc19c066713
// input: apps/web/app/(main)/compare/ihui-vs-cursor/page.tsx 9c786b9e65df3b71e61061b67822e060fe6446024363fb13162c09f430783862
// input: apps/web/app/(main)/compare/ihui-vs-deepseek-platform/page.tsx 7f46a2ddcae74f56d315410a63d1833cfad70142371784ac68815b9fb76e5878
// input: apps/web/app/(main)/compare/ihui-vs-devin/page.tsx 68729a0f9d33b634f8c0180e499ba60f72272fcaacc6ae0b9dd5648861b04547
// input: apps/web/app/(main)/compare/ihui-vs-dify/page.tsx 1d35c21bf505df7825b853627d30168c2db981445a1e9e01b24abb0f4138f8e3
// input: apps/web/app/(main)/compare/ihui-vs-doubao/page.tsx 64af8821833c5dd83ae5631d69514a41d75c364938e5d0b64bca07e6567304ab
// input: apps/web/app/(main)/compare/ihui-vs-ernie/page.tsx ae17ef7c0e295137324214647a407ea930c2a53f088110a32e2ca026531ea883
// input: apps/web/app/(main)/compare/ihui-vs-fastgpt/page.tsx eeddfd8b298aee39dd289d3e2ecfb054f8f7aba01faadac880ec9a36ad8c80b9
// input: apps/web/app/(main)/compare/ihui-vs-flowise/page.tsx 69ddbaafa808866db09fd6fd2b099022e512dfd096317094b27c1d4c369c72e4
// input: apps/web/app/(main)/compare/ihui-vs-github-copilot/page.tsx 43d55c2214ca8fc80e6b2061abb7e4a9c4679640d9bfed18cd151fd2d3957e6b
// input: apps/web/app/(main)/compare/ihui-vs-kimi-platform/page.tsx 97427c7c5cfadc4cd896084ebc63530dc901874de104ccb4b2240c31333139a6
// input: apps/web/app/(main)/compare/ihui-vs-langchain/page.tsx 8118dce470ab244228f3e1eea796c7af63493db9624ed2973ccf068b21dcf2e7
// input: apps/web/app/(main)/compare/ihui-vs-llamaindex/page.tsx ab787802345c0fd57c96cc7ac91bdae2b9a8f2135b54f7495fe23614c80b00c7
// input: apps/web/app/(main)/compare/ihui-vs-lovable/page.tsx 6208a3344485d157d358ff3ed1b1fcb52850d81137127969ef41f678a6115fea
// input: apps/web/app/(main)/compare/ihui-vs-make/page.tsx 288a9133ca8c8226ee574c199ea0f1aa1a41abdfc321e8bdf42032d2fa7b3625
// input: apps/web/app/(main)/compare/ihui-vs-manus/page.tsx 0a36b99a6e666105fd8eedfca746e24ef72259b9c15cfb354f1ad16629798176
// input: apps/web/app/(main)/compare/ihui-vs-minimax/page.tsx 1dfa5c340dfe1bce15a03c5946f2cf9cbbd1f218164e97c74a8a9b6499f0692f
// input: apps/web/app/(main)/compare/ihui-vs-n8n/page.tsx 0df3f24d57e7e9a5f6d42abaa99ae9c43b838b93a6e30c3c52a50d732bffca13
// input: apps/web/app/(main)/compare/ihui-vs-openai-agent/page.tsx 7b8ad2b79f70ce0dddd25169bce53d4bd964fa1194434c7b41388d451c6c4105
// input: apps/web/app/(main)/compare/ihui-vs-qwen-platform/page.tsx c282fca94b11bd2de4777752ba2ff27cc72d9e72db21a47b6d05fe27e03a2315
// input: apps/web/app/(main)/compare/ihui-vs-relevance-ai/page.tsx 3509c1b67dc1d54d45222067da8ac142ac97ad142d7be523654926312f8e5618
// input: apps/web/app/(main)/compare/ihui-vs-replit-agent/page.tsx 8ccabf724f467b71b41c886c9d4d980c885ab6efa88cb209a6d32c7cf2a5d3bc
// input: apps/web/app/(main)/compare/ihui-vs-spark/page.tsx 04cdfc19a4e3ee5d09c9ec9e4aac32d14f5fbb878ea07820d7cb04e5fcd58fa5
// input: apps/web/app/(main)/compare/ihui-vs-stack-ai/page.tsx cf78dac51bfc40359344a8502428747b749ca098ce5f0a8cafc77ea73e88f3d9
// input: apps/web/app/(main)/compare/ihui-vs-typebot/page.tsx e55b0f341c391d2548386039caf98476065b4bdf753d97c33572b5825392319f
// input: apps/web/app/(main)/compare/ihui-vs-v0-dev/page.tsx 41bdb493948028cbaa141b3640cbabefd650b58f901f1152dce331c52925f23f
// input: apps/web/app/(main)/compare/ihui-vs-voiceflow/page.tsx 44e88d0bdc8b03648b5693887262573b6a424b4e3d43d2b38f30005559b0c494
// input: apps/web/app/(main)/compare/ihui-vs-windsurf/page.tsx 54871c56d2d229d232261acb7cc96b99dbcd6a75561bd6088969b5d77c1e7518
// input: apps/web/app/(main)/compare/ihui-vs-wordware/page.tsx 4b332eccedee387ec7a30c2a9d0d479586f99b08a1b573317a516ab7ee0e89c8
// input: apps/web/app/(main)/compare/ihui-vs-zapier-ai/page.tsx c4210a88a577b129c6810e77cf431137d4d33d0f44237b52f4820d4c1cfdaa8f
// input: apps/web/app/(main)/compare/ihui-vs-zhipu/page.tsx a964a42f99d5ed8055e2b58b91d0f87e2a43c2b9d153d4260634a4192e047e4b
// input: apps/web/app/(main)/compare/page.tsx bf845b3ec9f8f8a948d167de0abb09ee38e3f335eb4df039f1c41b30bee5f832
// input: apps/web/app/(main)/computer-use/page.tsx a6629ca7608f9a6a054e931b27ac16456b6a5038bf2b884e016f653e1f705b6d
// input: apps/web/app/(main)/connectors/page.tsx efe0c3dfc82f0add7377bd131e6fd6497ec9868e79b7366b241042d79c9994f0
// input: apps/web/app/(main)/contact/page.tsx d0cb65c2c24df77cddd00f8e82bd9d5bf8ac39850a4fa0423c645a111f91ac7f
// input: apps/web/app/(main)/context-compaction/page.tsx 71c0c574c0b38d2b9e98b5b8d810636a2d9cdf90858ca2b281bd043cb6360c71
// input: apps/web/app/(main)/context/compression/page.tsx 644adda83b696838ffff0a855df86563df58de1d4e4f7364c1cc2ac8fbddbde4
// input: apps/web/app/(main)/context/mentions/page.tsx 33f9d8f107aac86dd1ba3b06f51e0bc8f0449c73a333e7681ccc019c678aef6d
// input: apps/web/app/(main)/context/page.tsx 0a4e3dc055748025a5baddb061bc0016583c5c66fc2d2f2e16cc52c6e09ca4e0
// input: apps/web/app/(main)/context/visualization/page.tsx fdbd02e54b7e614749a68cb8b3cce585e1b71407d891f80dde618ee5e29743ef
// input: apps/web/app/(main)/cost-dashboard/page.tsx d1f46bb165ead4eca60ffd84e1dfbbf73c564b67e63faf23982dd2837f0bd515
// input: apps/web/app/(main)/dashboard/page.tsx 811f42bce3ee198be01608c2232625759b6f1e8cb4f858cc2bd8de5c2dda9022
// input: apps/web/app/(main)/deep-research/page.tsx e47692d5c452b2cc904cf16702810eb8faf723d741f07a810a34d81a50bc5b9c
// input: apps/web/app/(main)/design-system/page.tsx e2a38caae54802fe2145bc39ce0878275686ad755931024b87ba6f4dee417e97
// input: apps/web/app/(main)/design/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/developer/api-docs/page.tsx a4e15a15f5b611a94de9db514f7cd1f4dbcf3bea898249203b1c4a5711b34bbc
// input: apps/web/app/(main)/developer/billing/page.tsx 2f84351f99e2d42894b2238d4dde12bc168bedaa874dfd04efe80c5d9c774d21
// input: apps/web/app/(main)/developer/capabilities/page.tsx 408bb101025192ac59d591272fed30fefe5ae11f401e1abf500ae39deb432039
// input: apps/web/app/(main)/developer/conversations/page.tsx 48b3a8f6e098e7d82ed97944f0a63673eb5922fb1cda053ad9fa9f07ed9fc756
// input: apps/web/app/(main)/developer/enterprise/page.tsx 6922e5135c57d6565c814de3ed36b9cc4855b721ad277b6a1424d65643bc9243
// input: apps/web/app/(main)/developer/error-codes/page.tsx d9e553018d8c80277a9c78081d06fb82cb55f94dc86200919e5789bbf26131e8
// input: apps/web/app/(main)/developer/ide/page.tsx d736ab882ef1c6c4080135b303532359e67866559107a5de66d31746b001bf41
// input: apps/web/app/(main)/developer/keys/page.tsx 8bf0974f97e53ca84fc5573315e81d69eb29e34fa3d929409fd1c68f77a3b0c4
// input: apps/web/app/(main)/developer/limits/page.tsx 1ac29e3e2d481502e97c597a5fc7a74459241c95656b4703e8141b129c4fab9c
// input: apps/web/app/(main)/developer/logs/page.tsx 2d3716650d4b11d29d78a6e3cb8e7fc9f04cdb3d4d003a6c9e81d422aee5f6c0
// input: apps/web/app/(main)/developer/notifications/page.tsx b12ebecc40bb20b4d87c4ee9c11ec58cca30dd69e4da54efe6c203717efa547a
// input: apps/web/app/(main)/developer/page.tsx 058d223c910b0e6b113e86d58a7c5892f8110e31508fd90f988248c6ed9f80a6
// input: apps/web/app/(main)/developer/pricing/page.tsx 98ff5a53b9448a91c64ec733e291aea8f124e35458fba949d11d8ac943aa1b42
// input: apps/web/app/(main)/developer/relay/benefits/page.tsx f813cbff15df911f4c0a3f64a719e522d8a6d2300db2f5c167de4df8d41b8be8
// input: apps/web/app/(main)/developer/relay/keys/page.tsx f2d0ea12bf9aa9c36a54f319cd7ba314271ba15c80f2e021b5de8c3855ea909f
// input: apps/web/app/(main)/developer/relay/page.tsx b72fdd176284596649261256ae2455a3dc604bcc5addd6dde234d7027c3b4539
// input: apps/web/app/(main)/developer/relay/subscriptions/page.tsx e604f24708ede8fba0fb5d4f0781586ba3454688a4e6d25e289c6c26aade04cc
// input: apps/web/app/(main)/developer/relay/usage/page.tsx a3feba28b60c1e5f80ea4b6e58d752bb74a47eb06046967e10caee50d38b00dd
// input: apps/web/app/(main)/developer/sandbox/page.tsx b51a55d5ede1d81eab406d9f979b52dabb6e9717d5a67cebb5ae00e0192b030c
// input: apps/web/app/(main)/developer/settings/page.tsx d90cba0cd252a6265d3da5369612f703db147ae3fa8726f963659d7400623a3e
// input: apps/web/app/(main)/developer/subscription/page.tsx b85d8737850fa4f6ea6f67f5f1741e3d4aa9c30e6e6d6548b5e718c28bc59683
// input: apps/web/app/(main)/developer/team/page.tsx c10640ef8eca3064e8e86b17c2029e8274853bf0a001a3e9ba990f0ebb0785d1
// input: apps/web/app/(main)/developer/versions/page.tsx be4762ed76b27557865984697dddfbd2b5504c77ac9cb91e72d3ada34c4d7242
// input: apps/web/app/(main)/developer/webhooks/page.tsx 4fe4df69722473359394e06a1051965a22dbfa54b2d7959983912068c0816caf
// input: apps/web/app/(main)/developers/page.tsx e4a6a847e564c28bb1671478df1925f636facf1e3373d3f391d398746b165fba
// input: apps/web/app/(main)/distribution/commission/page.tsx 2c2116c042db73108440b45a8345a628112bf1d6c5d92c22afc5ffb451717c8b
// input: apps/web/app/(main)/distribution/company/page.tsx a8d07b15e8190e4f7ddbb185ddaaf8fddd6320a4215028a56a1ba0759a508b4d
// input: apps/web/app/(main)/distribution/orders/page.tsx 24cd8a2f3aa56f417ecc808cfd8f458c0d4c2cfcdd559345a83ee237cd8b37f5
// input: apps/web/app/(main)/distribution/page.tsx 91077acce2041ef9cdaf3388881a9da614d149a021b83bad2758911e9739fd19
// input: apps/web/app/(main)/distribution/referrer/page.tsx 24d7feec451c24bf45d18a820ca547a1bacc2edd3b5673f7392192f9ee26c988
// input: apps/web/app/(main)/distribution/team/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/distribution/team/page.tsx 5d40e5e4cff4c690f5e6d7dd873692bda35dc5da9e9c565ca41d0dc5ee5938f8
// input: apps/web/app/(main)/distribution/token/page.tsx 8bfb3c9f9f585b43edf7f1c2e58d3e4964d7baa5817536dcb6b8b6ce32ca9fa4
// input: apps/web/app/(main)/distribution/withdraw/page.tsx e2541a0013ad37f0f9280b484091e5d104b9fed60562c44504de1669454a9324
// input: apps/web/app/(main)/distribution/withdraw/records/page.tsx 50c79fc214bbc60b17e37d72d57651118aac2b7b44cf3193f554658c8f41cd6f
// input: apps/web/app/(main)/docs/agent/page.tsx 616ad3ee4bad92929d88740051c3a81a97aa37d632d4ed7d5738b81cddd67c62
// input: apps/web/app/(main)/docs/api/page.tsx e6b144b58f17f44f4b7e7becddb3a6e3d75da16fc00a02b408c5a0b4ca4bbe04
// input: apps/web/app/(main)/docs/manual/account/page.tsx eeddd845998c59a125bd38ef36a74fbde0ecbcc3cbb2eafcf56653d20e4b372d
// input: apps/web/app/(main)/docs/manual/agent/page.tsx d851a7a52e96032e76bc3df47ab8b58cd34eda7068905eb84c5a3eca4342d35b
// input: apps/web/app/(main)/docs/manual/ai-chat/page.tsx b12a6a5044917e3e78674f5e858cb8f40f8958ad09e7972158fba65a72f5b534
// input: apps/web/app/(main)/docs/manual/billing/page.tsx 98ee487950221d87214407128aa6ad56c93d473001f6e7178a58b07b8d35648c
// input: apps/web/app/(main)/docs/manual/faq/page.tsx 7f71580457fe4b15dffe0f391f2c98dfed9aabf2dc0a87567485e69b6a9c77f8
// input: apps/web/app/(main)/docs/manual/getting-started/page.tsx 4c3c1d2c5ed0961f63191cd2288d21e50d43c011cf4d6b714287f795bcdfc162
// input: apps/web/app/(main)/docs/manual/knowledge-base/page.tsx 71a4e6bf2e1eacf24f39a745a623b24629ecc14506ddf7735882c358027f0ff7
// input: apps/web/app/(main)/docs/manual/page.tsx da4966e85a19b3c43fba8d2a8a218a5a524910508e9666594eb498467deb4d98
// input: apps/web/app/(main)/docs/mcp/page.tsx c01641b0f3f753c7ab241dee1a7726b5f8db407b4268acf845408a5f9dc77975
// input: apps/web/app/(main)/docs/models/page.tsx 2299cb049c2037fc1cb1d7eaf4c0685aa85904dcfb3029cf0fae94896f943f13
// input: apps/web/app/(main)/docs/page.tsx 5171c27744cec113fb51a0bd4af43cc2d9b97706a905dc5786dff6e025875ee5
// input: apps/web/app/(main)/docs/quickstart/page.tsx 032c7e5b7bfd1815563872766443ef1ffdcd0198c4e4e72efee1df018b01bfcf
// input: apps/web/app/(main)/docs/rag/page.tsx 7068c2669b264c88bd22a2bfad49b1ad3ab9cc1f4ae6d75f1e1b52c1546d7ad2
// input: apps/web/app/(main)/docs/self-host/page.tsx acaf955ab00bf364e37cc6dd09fafa9eecff7eef62c00d5a5c704684981da8de
// input: apps/web/app/(main)/docs/team/page.tsx bee28fd41360c5248ccf820f890a935e845aa38b78508fca7823347ae4ca197b
// input: apps/web/app/(main)/docs/workflow/page.tsx 14526433eb12c6152ddfe2f803c39285703f9aacc773c325d5c3a97b5a7ace79
// input: apps/web/app/(main)/download/[platform]/page.tsx 29c09bfe66fe88490d96225e75520205325a1f604f7c22e786cbb362a1c25495
// input: apps/web/app/(main)/download/page.tsx 59bc8557ed62a53fa3608ec75132263f58a438dd8c09e066e49f8a07bb726c04
// input: apps/web/app/(main)/drama/page.tsx 6704dccb37b05a64ebed3fe367a3012e732aa44edd7c6acc059d8e0ca7f81b76
// input: apps/web/app/(main)/earnings/page.tsx bcd684632476e990828d2b178b70194619c1616b469454bee87151b2d9ff36ba
// input: apps/web/app/(main)/ecosystem/connectors/[key]/page.tsx 8393c69c5ff681ca5d2aa9dd26f6c2474d62f0e1af2f9eba3c138003af32eb69
// input: apps/web/app/(main)/ecosystem/expert-packs/[slug]/page.tsx 098fab45a09bd2cf6ceecccf47cef0ed94dff9daa2efc87dc98ee3ec6ba51d7d
// input: apps/web/app/(main)/ecosystem/expert-packs/page.tsx b3874012bca5399c92bc75fb664ca004babb2448ab83f7853548e1aede67dec7
// input: apps/web/app/(main)/ecosystem/page.tsx f0dbfb332b9a6d22dde55a80d763e3aacf88436996ad4b44a76eadab0e95ea88
// input: apps/web/app/(main)/edu-ai/aigc-tools/page.tsx ab228facf49225eddd435a01b7851d2c23225c8ad9e8cf63b8761a0572a12ef4
// input: apps/web/app/(main)/edu-ai/certification/page.tsx ed640bbab114df3f5eb2758d035d665f9f8700a8bb65c36cb5216002f041f620
// input: apps/web/app/(main)/edu-ai/courses/page.tsx 716769245fb512f5c53362e1ecd5520102655a4a7f0cdf4fbac045c5f6c6b7b1
// input: apps/web/app/(main)/edu-ai/map/page.tsx 0d7e373ab858a4033c4154bebcb8f5b0d52ac0359be1db88fb95a8748f1f6aef
// input: apps/web/app/(main)/edu-ai/marking/page.tsx fb67bd7f20ab8219cb2875f856b511b83bd1b9a0cec5cdb08fed01be1ba08a65
// input: apps/web/app/(main)/edu-ai/outbound/page.tsx f23a758b10ae9b4640be528b910b1684fe461ed39cc7b6be47b0d3f91f589825
// input: apps/web/app/(main)/edu-ai/page.tsx b9b0cda9b604916f23f82f1b13c0f5e8d93ba97624e5b111f7b0cf524aa47a2f
// input: apps/web/app/(main)/edu-ai/policy/page.tsx a62ea2dfd5ec1f46a8ecaa9422a251496896aa791c27982794ed9279fbed5d22
// input: apps/web/app/(main)/edu-ai/tbox/page.tsx a73bd274b20cd9021082bf74c5599da47f0b126d375ac3a3ae2a5a41b153d751
// input: apps/web/app/(main)/edu-ai/video-compose/page.tsx 065af6a9cf1d774b1041d7fcc93db4d3ff5fcd293037e7b7960282a2845a09c2
// input: apps/web/app/(main)/edu-ai/voice/page.tsx 3669d0061e95de4588ea2f547b439f49b9d05ba59549200a54d7012759307139
// input: apps/web/app/(main)/edu-points/page.tsx 23ac296753f5b566799ebef161ec4eb294e5609201eb0156f165f2c660c37870
// input: apps/web/app/(main)/edu/certificates/[id]/page.tsx 30c76c078af2e8d4b7be7c0b2bc032d8e6bef02caa9c6852d6bdd187dc173fcb
// input: apps/web/app/(main)/edu/certificates/page.tsx 53dae18588908c650922f113a1159344e3129b6d9993ef248c469d95a52c950a
// input: apps/web/app/(main)/edu/courses/[id]/learn/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/edu/courses/[id]/page.tsx 3e8b1025fc51b722335ad922830d0eb9363a75759bf9b11aafbf7cb5db4704be
// input: apps/web/app/(main)/edu/courses/page.tsx 85a8f858c53077a481e8a11de4c70ed968b6e717af84f4558d122cd2bb86ec9c
// input: apps/web/app/(main)/edu/dashboard/page.tsx b3e3c0296feda7155f8a88488a14b5230f1925eeda199b3ec9a2659c6a5976e8
// input: apps/web/app/(main)/edu/edu-management/attendance/page.tsx ee249673237ea43b362e64ac999eea54c1e170455eb5433939a3fc06835a38ad
// input: apps/web/app/(main)/edu/edu-management/enrollment/page.tsx 43d8feb0ea77f479f2286c0c521c47a6b741482ecdb4da81a06e0417437f7c08
// input: apps/web/app/(main)/edu/edu-management/finance/page.tsx 32a6b007d18dd468eb4e18dfbe24d26c0ae3c2ed4a6ee8c5b2b4ee6cf4d45674
// input: apps/web/app/(main)/edu/edu-management/grades/page.tsx 995cbff800387b67319592f4b6ef107859ff49a08f1e944bf8092c45c8d557c7
// input: apps/web/app/(main)/edu/edu-management/grades/trend/[studentId]/page.tsx bc6a04718ae14638d59ed11026b720cb0706d9b6b1009a08362b9486c21ff94a
// input: apps/web/app/(main)/edu/edu-management/homework/page.tsx 8a544efa39c6f7c569f8ebba0a92c54a670ad7c29bb295ef6c88698a9a29dfba
// input: apps/web/app/(main)/edu/edu-management/meal/page.tsx ea4914934ab197f538efa5d015633b5a91e1e20b2ae3a847cbcb15a15d663e43
// input: apps/web/app/(main)/edu/edu-management/procurement/page.tsx 4743176d06fcfeb7ec42fc176910f1b9b02d67b10e9576203f158fcabdff6de9
// input: apps/web/app/(main)/edu/edu-management/schedule/page.tsx edc3e82d2bf1937a626b427ad7e3f718ca46b4af479809ff6e1498a6ffe3978c
// input: apps/web/app/(main)/edu/edu-management/scheduling/page.tsx 5ee1d0f6e76fb0e6bd806814d02a02d914c30a18f754e2def172d3c39a856864
// input: apps/web/app/(main)/edu/edu-management/study-plan/page.tsx a694a3bcf917afe21dab9bf015fcc45374464695a31d9812080d144a00503899
// input: apps/web/app/(main)/edu/exam/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/edu/exam/[id]/result/page.tsx fd23d193dee43ff51841125e799a6c64265e22b0499200947c6404d12b2e2954
// input: apps/web/app/(main)/edu/exam/page.tsx ce424730b9d496dc64f31d777d4b5fccabb43f2ff481e4c30acb6d80dd682f6d
// input: apps/web/app/(main)/edu/notes/page.tsx ff80e76162c5fdbc3b4e3fda006983289ed130e4a3d77a48748e0a40d733db80
// input: apps/web/app/(main)/edu/page.tsx 5676e95679d2502f6cd77fd60b3b482af8b4cd19de696436b62fb18f3c71c222
// input: apps/web/app/(main)/edu/parent/bind/page.tsx 1ff4509ef475d84819ae19755cf6cc663e2101f1b782b8c0a167c6cdbe4b7915
// input: apps/web/app/(main)/edu/parent/children/[childId]/attendance/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/courses/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/grades/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/meals/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/study-plans/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/page.tsx eec377a81f2c2cd3d01e70dd0ab89796109f779ee2465723461d8d1e5f84e57e
// input: apps/web/app/(main)/edu/progress/page.tsx 2180ad8ab74ed09743c6a0663168d2b9dd00640e2c1e539da2752478a5e38539
// input: apps/web/app/(main)/edu/qa/page.tsx 94380512f4c4d903894a10aadbb04f209949a08ec8052cd612f4e373b4264077
// input: apps/web/app/(main)/edu/schedule/page.tsx ecc0809a736647cca619aa21f42add2dd15dbe611bb21c714a645a7e96c973b2
// input: apps/web/app/(main)/edu/shop/page.tsx 999d0ebf49b3d84916ea60d228adc92962d1f8f199c76cb7901b09e10a49eaec
// input: apps/web/app/(main)/en/use-cases/ai-design/page.tsx 263f5d399f0d9d9dbce8c184ebef0de76fbb039af1cab41b56ea6f2f98ac991a
// input: apps/web/app/(main)/en/use-cases/ai-edu/page.tsx 05470bce15e79c0e0c4e2f4742d9372bbeb075c99786e82ea9c53cfc164d370c
// input: apps/web/app/(main)/en/use-cases/ai-marketing/page.tsx 6644fe26f92c8902918b244553fd6bd1f5b9cf13cf89b1e65eb15b9afccf33a9
// input: apps/web/app/(main)/en/use-cases/ai-research/page.tsx 6d1e45c057143d3798db1ee88b25be83b5bba42b9f5dd5b4c12ed9cc654ae50b
// input: apps/web/app/(main)/en/use-cases/ai-translation/page.tsx 319ef03753663e6fd4f55f5e87a9449a7c5d51ed88d53803fbb7a8fcbc6a761f
// input: apps/web/app/(main)/enterprise/inquiry/page.tsx aa20b6854cdfc1f1f0f2614c4b5e3e21eaba22a79345ba034c58b3f110901353
// input: apps/web/app/(main)/enterprise/page.tsx e92a22969539402162bd1794714526c8d2c5e84cad577a2d26bc1ab7a35a86f9
// input: apps/web/app/(main)/exam/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/exam/[id]/result/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/exam/page.tsx bae8aa5c1ab9752e84ffb4b9ec55c18fd3c35eb46b1bb72a8c34b04eafe9507c
// input: apps/web/app/(main)/exam/wrong-questions/page.tsx ff39d19d1746d89712fc10ed75d3fb55af766a6b3c536c8450970476b4d019f7
// input: apps/web/app/(main)/faq/page.tsx 340204418a12d33f01f6b30c7e8f7eb3ee65729d4a4484c5dc083a92a8e7e29d
// input: apps/web/app/(main)/favorites/page.tsx 2b0b12df5e7a220d5230848bf200751177aa18acac4dac696365eb5ce6264419
// input: apps/web/app/(main)/feature-center/agents/page.tsx fcf5e297611b6b02765b613931396c9b9665cb1028b13dcc5094cafffe38f7c2
// input: apps/web/app/(main)/feature-center/apis/page.tsx ea2e628ab627b98aa65fdb23af046125fe39e6701df82dfad8fe271db40ebabc
// input: apps/web/app/(main)/feature-center/documents/page.tsx 2ce7e67ef26bea8de23d91e16ce1a2cdc5102ae31a299a70947980857d530336
// input: apps/web/app/(main)/feature-center/models/page.tsx c7dea6c91b30310fd646b881e7ffec4ce0af71f4e8fb725e83eee8dadb32d5ee
// input: apps/web/app/(main)/feature-center/page.tsx 68f2a2f0142c71dd38e34ecc42eea2dec54a4d74b1ece10f30e21da65f333783
// input: apps/web/app/(main)/feature-center/sdks/page.tsx fdd8f6d0b5fe6c3c837d55b355d9fa344dc6344c648c2f042ece9fef5038a233
// input: apps/web/app/(main)/feedback/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/feedback/page.tsx e15690927679e5461828bda020a9ee3cf115a6523c1b7f642222a1838e7d94f8
// input: apps/web/app/(main)/figma-import/page.tsx c018d10bdfbb79eadff56bfd84038fe3429f4163a41f4964ca6610c5b5b3a8ea
// input: apps/web/app/(main)/following/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/free-ai/page.tsx 14251afe2b1cbca09b1bd672b0d3d4283992db241dbd30d8075e0418c6bc0edd
// input: apps/web/app/(main)/fund-data/page.tsx aa6ba0993b263ba7ecfe8c14d37a1581294beb10f47697868a4154ff99619078
// input: apps/web/app/(main)/groups/page.tsx 4aeb1e321c7f73aa377eedc4f43f3a5c34b7d264391de61f6ee74d9a05eb8d4e
// input: apps/web/app/(main)/help/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/help/page.tsx 8d18c7e744dfd0440889c2a34c15f7b13da6823c1bdfeafedc275aeb91116eae
// input: apps/web/app/(main)/home/page.tsx c363a3b298783696813c1ff6c01ea43d10ac6a57a18ffeb7a2aabf1356e1c93a
// input: apps/web/app/(main)/hooks/page.tsx c7aed66054b4f50815c7b49434e711bb1b5049c02878b5f1521d6499f663936e
// input: apps/web/app/(main)/image-gen/favorites/page.tsx fe6da38e3ea96f9ce2bbb97e3cefd7a79f7f641059582fdca95bae5a9e20444d
// input: apps/web/app/(main)/image-gen/gallery/page.tsx 3901e17d6eb7edebdc8a80522149fa1577d47e942fffa539afe1becc812d2f8d
// input: apps/web/app/(main)/image-gen/history/page.tsx 7bce789ffbd45cfd718247ff9318d1a925e2dffcfca21b330b1dd0120375e1d8
// input: apps/web/app/(main)/image-gen/page.tsx 98b982b9bbc437d15e0c7b032135c12142b483e15d6b9dd85599b755c47e3269
// input: apps/web/app/(main)/image-gen/templates/page.tsx 5ba3db0eca92631a684638be31195f0878d6cc5d261e23478919c76fdfaf812a
// input: apps/web/app/(main)/invitations/page.tsx b49bf85bdbc2ef46a97f5b8759ede18188f25be2926b2c4f72608a74a92f6051
// input: apps/web/app/(main)/invoices/page.tsx 308d4d880f67fd68329aacc33fdfad1a34d6c37fc67b75b69dd9669ccf1a54be
// input: apps/web/app/(main)/ja/use-cases/ai-design/page.tsx 8452396b9d8fc66193cf910ae811301b2328161d20f550c5d2b08f76417da25d
// input: apps/web/app/(main)/ja/use-cases/ai-edu/page.tsx a9d832c7fd955900396c25209eb3dbb46b2b8f69ce7b22ecb7d72ea5dc5bebe9
// input: apps/web/app/(main)/ja/use-cases/ai-marketing/page.tsx e91b6c7b5dcff2f09487b38c9b0e61d8393b68e2796d96084b9b1b914facaa45
// input: apps/web/app/(main)/ja/use-cases/ai-research/page.tsx af952bcfc00945a52e7cbf0419204055948969248a0372030eafb81d0f3a82a9
// input: apps/web/app/(main)/ja/use-cases/ai-translation/page.tsx 712ac32d6d64016250fe443a11142a1bd09d7976d51223408813b8ec40a833cb
// input: apps/web/app/(main)/knowledge-base/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-base/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-base/edit/page.tsx 1d04bde0610f4c7319774f284d27a07f8d8d531b2a993e75e349720a955411d4
// input: apps/web/app/(main)/knowledge-base/page.tsx f6806ee60537bd39671f905b3171c899e396efbfda870dad928109339179efb1
// input: apps/web/app/(main)/knowledge-base/search/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/knowledge-cards/page.tsx addc1947b2ed950b16547c04fe60a3e82a57725acb1f7fa3ece79bdc276fb673
// input: apps/web/app/(main)/knowledge-graph/page.tsx e679cd28483642d31de6adef373b273003d6fc7c1e7d7573739406a4da039b8b
// input: apps/web/app/(main)/knowledge-planet/page.tsx 34c4344a5c5061c8ee13222841632ef3df124c69c362ad1ef2c44408818e1832
// input: apps/web/app/(main)/knowledge-rag/[id]/chunks/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-rag/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-rag/manage/page.tsx 7522e1a780de6f005880d5225b0c1062b87b27a42027a19cfe44c2f2d355e847
// input: apps/web/app/(main)/knowledge-rag/page.tsx 6dfc4d7cc321632603972c3204042ba467caa290660e748886d9ef5166c8843c
// input: apps/web/app/(main)/knowledge/page.tsx 6b1f20d5928c23db671cd532beb1209888dab8d135ddb11c8e53b559e5ac213d
// input: apps/web/app/(main)/ko/use-cases/ai-design/page.tsx a5f7536cff6a0d2643b548732c81111ea332ad9b8e4bc21e2d8b83c8bab358fc
// input: apps/web/app/(main)/ko/use-cases/ai-edu/page.tsx 164729e25695c24d2f5307b6efe22195a4b6697e38ead2bdfb21f24caedb3497
// input: apps/web/app/(main)/ko/use-cases/ai-marketing/page.tsx 59a63cc6b956f82ff3dc12a16a73bd0a04688f440fc985870ec9a2e7e373b3bb
// input: apps/web/app/(main)/ko/use-cases/ai-research/page.tsx 158eb86d9c8d1af8bfbde617dc1858fc7b5ff14f77eab73db5d773f6b77f43fd
// input: apps/web/app/(main)/ko/use-cases/ai-translation/page.tsx f061c98fc5dd4daaefd7958a782288b54f18aaf0a0517e817013f9970e64a1f4
// input: apps/web/app/(main)/learn/[id]/homework/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/[id]/rate/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/buyconfirm/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/learn/map/page.tsx aae01026f21df4f66bc5d3c789ecbb88a898b87aaf0b158d4f63d7cab1222c79
// input: apps/web/app/(main)/learn/page.tsx 64dbacd29a673c22029eeddc1f29f07b0aa58194cb46f6b4cde1b4ca0f680331
// input: apps/web/app/(main)/learn/payment/confirm/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/learn/review/page.tsx d2f8887c2e8c2deb5d0ac1836fb53806ed463b072f8541ad77dba84dac15fce6
// input: apps/web/app/(main)/learn/topic/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/topic/page.tsx 0d05b3788905dd9c002bdc7ca7b73f4e82b1896d2e42d6e48c1a112cb20fb4b1
// input: apps/web/app/(main)/lecturers/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/lecturers/page.tsx e7e8513759d44d29268575a6779df422547ed19bcb65144ae752aeb7982ad939
// input: apps/web/app/(main)/legal/service-specific-terms/page.tsx 12e032225aa329936abea7f030ba3179cb46b1b3ee15c5167386e0af3c3f64ce
// input: apps/web/app/(main)/legal/supported-regions/page.tsx 87f20f60a7a5ba45a1598512f3f1b3704022f2f5a91c5a4c5ce0a0521bcf7351
// input: apps/web/app/(main)/legal/terms/page.tsx 6d65e9d26ec02489a1101836f82101778028173d87c5937fc431280c07aa2bb8
// input: apps/web/app/(main)/legal/usage-policy/page.tsx f77bd29a0903e201d29aed51f3cad181715e04efb9b2dd0755a89d22e3473a2f
// input: apps/web/app/(main)/letters/page.tsx ca4712562135892b1f6c90fe5e5c1214dd8ce0d7e52a109e2e03eb6731aef02a
// input: apps/web/app/(main)/live/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/live/[id]/play/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/live/host/page.tsx 6b0dbcdbe4abc967a0427877d7acd4f8bed1b51083b077a9da42b3d7f90de83f
// input: apps/web/app/(main)/live/page.tsx 83831774c9e61d39eea6316010e2cd1d5808899e75d1be1badf8470231d1c5ec
// input: apps/web/app/(main)/mcp-projects/page.tsx 8083d86a1ffdc43d0480d154482c92eeb73b0ea5ca834c4ff5d3811cc1194eca
// input: apps/web/app/(main)/mcp-store/page.tsx 3801930b21799b9b5fdfda53588178b765ed08d5dcf53aedd69fa6f0591fae38
// input: apps/web/app/(main)/media-tasks/page.tsx ee97ab0841dd035479b777fedbaf966385983fe9c7e0a43e573c2667da96ee74
// input: apps/web/app/(main)/member/addresses/page.tsx f10c2a6363f6fc9b26fe75653d4d80d2c4003b4ea45598c9338ef2090a7a51c0
// input: apps/web/app/(main)/member/benefits/page.tsx 15f816876e31e8e9116290eb606435148ff64d82860722c43833d90360fe3998
// input: apps/web/app/(main)/member/coupons/page.tsx e58e4ab06bef73ea626b8a1b2642eb2cd0a2c91467cbc56654d1d4e787f9a0d9
// input: apps/web/app/(main)/member/dashboard/page.tsx d97eeca4e89649b6954d541a5e4a08a118c9247e026b29710b359092d4648540
// input: apps/web/app/(main)/member/exam/record/page.tsx 41bf3d12181b68bdae38edf8482e484221a081b627cdaf326afdbed6e9e56451
// input: apps/web/app/(main)/member/exam/sign-up/page.tsx 4cdff7b653bb37eaa38be3890432c74f9ae9032308cbca286a6e150f0b3bb7af
// input: apps/web/app/(main)/member/favorites/page.tsx 49796b198271d143484f6f9336b096c73a0df5bd34ae7c65fc7b0a9593d8a68a
// input: apps/web/app/(main)/member/feedback/page.tsx 688a33da92c5e50c50feebe17548fb772feb1ece63a33797626da835b4d46d66
// input: apps/web/app/(main)/member/help/page.tsx 4d7e92ffbcb7a1287f5fae07472bfa99f47ccc5cefe2db26d1429b4efe27c71b
// input: apps/web/app/(main)/member/history/page.tsx 28d285c883742cde04607e559bbd25794a8b50ce057a9b1fd38528096ca26c7e
// input: apps/web/app/(main)/member/page.tsx 2ec34f6d459cd8edd9922fe77f8e3564dc33c57e44abc0508bdc5a724afa498e
// input: apps/web/app/(main)/member/settings/page.tsx 9497d500da0cc90268e06092b7d67217f7d2d354c7b4eac88d64628fb1d4c9c6
// input: apps/web/app/(main)/member/subscription/page.tsx f1f1dde50595a05e07bdcc381f2815bda18a7b9151a49d5f2e846d11e8d8d132
// input: apps/web/app/(main)/members/page.tsx e6fa392f515b83a650fbe182c74c74e44ad8c336b2f68be46ad228fede256a95
// input: apps/web/app/(main)/memory-manager/page.tsx 8c8fa07e132b7fb05a40af7daf8c155b79b1bef3d059670c9680b6221983005c
// input: apps/web/app/(main)/memory/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/memory/new/page.tsx 278d94e5690c7ed220974a534cda3c771a2520616cbff9900bfea04d2e0c46cd
// input: apps/web/app/(main)/memory/page.tsx c934ea2da03847debe96ac69c04f2a7ca0decceb74dcfad416210bd499a468f0
// input: apps/web/app/(main)/memory/scope/[scope]/page.tsx d3cf5def475b03c0fd96f57fa00a6557e248e9439786c0875dad1c82b69d41fa
// input: apps/web/app/(main)/messages/[type]/page.tsx 2fdfa2b9b1de35ab72faab4733c4743b37f0845e976b32661cfc06d5e85159db
// input: apps/web/app/(main)/messages/page.tsx 99330cdb8f783573854dc167c8b6e8f9c2b730cebc14844b3c49e988f9998f1b
// input: apps/web/app/(main)/mobile-dashboard/page.tsx f842ccb24512e07fcec014c94c08af18d0eeb34b699579956b0202688479c55d
// input: apps/web/app/(main)/models-pricing/page.tsx d52e3cbdfd30d7d66fcdd54ea0e4b6a277874fff8c29467374fe50011468b3ea
// input: apps/web/app/(main)/models/api-docs/page.tsx cfed26685edafd1888538fa9267f38674466bc809c7d2bb591821f5b694d207a
// input: apps/web/app/(main)/models/billing/page.tsx 5c2234ddb42790aa6d2da7272d45b23495be4c3d7047f3044c783646c8db05f2
// input: apps/web/app/(main)/models/channels/page.tsx 594ff458d743e9332b9b904df359a6edae2ca93c0b9b46f57432bc11d1e2272f
// input: apps/web/app/(main)/models/chats/page.tsx b4a216a92e8200bc36be31cde9f0f78e5771c94e00eca0fc0e9d2099c5ced5c6
// input: apps/web/app/(main)/models/contact/page.tsx 3f2dc0c6f30d8682ff60b3bb96a80de338f5e8b088addc00a69a5eca90e99709
// input: apps/web/app/(main)/models/eval/page.tsx 3a238390c78ad81bbb970d3a46f11889a482c5d812848bad04fc13f82eb8fa49
// input: apps/web/app/(main)/models/groups/page.tsx 35b16db05d8be703bfb569f6c9ca68521e25b42b1ec573375e9d4a50c979fbe8
// input: apps/web/app/(main)/models/keys/page.tsx abdeabe644a8fee560ebb32b2b460d9d1098d776b771fbb8dface58431113b83
// input: apps/web/app/(main)/models/logs/page.tsx 3f8cfef85e1d26c0a4acac4d0ebc4862226d63c2bb6eef198ff4da057186c8a2
// input: apps/web/app/(main)/models/openclaw/page.tsx 8519b668e74d4662c7f055f764f7fab3796cfc6890735190212523a088463bd4
// input: apps/web/app/(main)/models/overview/page.tsx 145d1683f4e28ab01a010003d268439ff890c87cca87475065905ae0f7038318
// input: apps/web/app/(main)/models/page.tsx 5a4e9722c8358f30a37324c373fadcdc5121019f3eca7f2aa587006928f3c1f6
// input: apps/web/app/(main)/models/prompts/page.tsx 5033dcd5c8ddb399ab06740d50bfc22df159098032d5575e4b67aa2e2dea4f42
// input: apps/web/app/(main)/models/redeem/page.tsx 2d991a00d624b20e55bd43beefe8f80d071a52e4152310798cff6a176814ddf8
// input: apps/web/app/(main)/models/referral/page.tsx bfb105254316726cdfeb86531a2975484b82440fefd4c08092db0caee9e3bc9c
// input: apps/web/app/(main)/models/skills/page.tsx a7f7a6c464d9ec83a8e3639876a9acc582a2f0516b0748418bfa0005b190ba80
// input: apps/web/app/(main)/models/trajectory/page.tsx 7f5e01fafe0696755dbc96420921ea9c124ed264a1a8101c74dcc3538133dd0f
// input: apps/web/app/(main)/models/usage/page.tsx 10d19ef4b09aac39707e02ff470706b1b2d715705731587b04d9c908d54e49fe
// input: apps/web/app/(main)/models/users/page.tsx ca7ee659af729e3ce6961968c5e690e8ed719b3720b6693c3c96a0f6adc5d2c0
// input: apps/web/app/(main)/n8n-agents/page.tsx e7b6fc2e90b2b4465e5ecbe2db5e39c7e21c9869c26e90b2927f4ac49981dc87
// input: apps/web/app/(main)/news/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/news/category/[id]/page.tsx 9a4a74a52e0389d02f9c16d560907b2ba26abd2591906028fe504fbad9b58ccd
// input: apps/web/app/(main)/news/page.tsx 9dbb7eeb354b0b2c4224fd9e59ed3348b7e6e6a231a39cb278400fdaea3f2720
// input: apps/web/app/(main)/newsletter/page.tsx cdba2b84b0d8d5fb0819ab75d90ff7f6483e66c9e333899f77dea5a129224d67
// input: apps/web/app/(main)/notifications/page.tsx 77ade7eeafb40726efccf7b62c646d5d4f0ef2f3ef490d9e30f679353cc4aef7
// input: apps/web/app/(main)/oauth/authorize/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/oauth/my-authorized/page.tsx 563b5f075a09f83ad707903e5fc3a3fb98718e60fafd09dc3b3e08396e8e75fd
// input: apps/web/app/(main)/oauth/platform/page.tsx 4c426bf57ca6953380cb6ebc9a5bdf835634ea219a479732b294558b83f28b93
// input: apps/web/app/(main)/onboarding/page.tsx 4523c003ae23d9121b6227477b4626796e582f0bae1a4b3e2bcbbc6e75b60703
// input: apps/web/app/(main)/openclaw/page.tsx ba00db69962ded395fe97eeeb001f0e988e9dceb733362c653015609be9a0174
// input: apps/web/app/(main)/orchestration/page.tsx 777363de7187498e2b9b40feb2bd0ef1f14d359ac2293f0ce99524c6f8744a55
// input: apps/web/app/(main)/orders/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/orders/page.tsx 54bbedc1c367c9bf40acc79cd1826eaa47e5f4806979f2e99c18f2f2aa6ddecd
// input: apps/web/app/(main)/patrol/page.tsx cf0b14c58c41cb0e1d54dfb9107949947925f2b96238f137ce903eb6e08967bf
// input: apps/web/app/(main)/payment/checkout/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/payment/page.tsx cf316e5cd5eec1ee7ff246aca75429fc3e94312477bdac3317b91023ec79e955
// input: apps/web/app/(main)/personas/page.tsx 2ce22e1b7e041e4fad7bf33dc60376ded62102bac7e6d60e177f1009e03d18df
// input: apps/web/app/(main)/plan/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/plan/new/page.tsx 49e9f0e4aacd07e78e363e25a47e70457e6a559c627d1679a133beb90efc797d
// input: apps/web/app/(main)/plan/page.tsx 9baf1856cd8e162b3827739acfb84ba498cafb5a0c989c989b5011b6921f489c
// input: apps/web/app/(main)/playground/page.tsx ca50dbffcbf32eea3ea7baa7feedcc165204149fd6af07dd99c397b7fa6d8d2a
// input: apps/web/app/(main)/plaza/new/page.tsx a2e5e81722d99ebc2549c39c8482e17bf31dbf527462ffcf21a37165b12fefa8
// input: apps/web/app/(main)/plaza/page.tsx 7646688c9b22bbc29283a41c136cd55162c7bc1c82e0809ac8bafe1a75451148
// input: apps/web/app/(main)/plugins/page.tsx 9e2e1a15447f8fe92deb63237d80ed2c26dd0fc93213babb8c3dba6c330635a6
// input: apps/web/app/(main)/points/mall/page.tsx 11af49079f9b958124cb19cad948cd29559f87df8ed978aa155c0850b11f9b4c
// input: apps/web/app/(main)/points/page.tsx 7e37b6d892d34a72e66f2f29027c2313cd2f8e05de9a482274f29d0fa2165a84
// input: apps/web/app/(main)/points/sign-in/page.tsx 22d5256e0ecca2a9ce5c697fe2f457fd5171fda85992daf3863aaacb39cbd358
// input: apps/web/app/(main)/points/tasks/page.tsx 6c297aa885fe7f0b63370437baaeb3fed2ba7170807a2d5b1928972176eb9674
// input: apps/web/app/(main)/pricing/page.tsx 0a1c3717f2391db2cc15487136f202ec89b2a8366aceed099f40d0567d45f3d1
// input: apps/web/app/(main)/products/page.tsx bca2f8e745373d271291e554192cd1728570e61ba957c65a3ea48893a687b6e3
// input: apps/web/app/(main)/publish/accounts/page.tsx ef2178811ff0c75c42ac0423d9e794d73f083da22dcfba47dce2d96108fd44c8
// input: apps/web/app/(main)/publish/analytics/page.tsx 74e2c53a96b3b3891a112ed6b0694c8d206cc97fa0538a3eee9a05133fb9bfc3
// input: apps/web/app/(main)/publish/calendar/page.tsx 615ebd1c2bc023b3877aee077fae2e9d59dc909fa8ec1db1b35896010955dcd3
// input: apps/web/app/(main)/publish/history/page.tsx 78407c49391aa37bb3292f8634ed1ac9e9bd5980b612a4325f5d73b6a361f908
// input: apps/web/app/(main)/publish/monitor/page.tsx def0e22a6d730c05c53907dd9330077b387c35570c419caa171ef2bab0532411
// input: apps/web/app/(main)/publish/new/page.tsx e9cb934344160a31d35b64cc33ddf4fb68f0c9e9cb8b8bebb97ffb1ec04a24d1
// input: apps/web/app/(main)/publish/page.tsx c8db96a527dec17f81d00d0195ba83a0170b7ef84bc975fb318ec5f98ff384cc
// input: apps/web/app/(main)/purchase/page.tsx 9b9037ab03cbfdad16c70fbc52f51f7030a69d6b495c8eeb7b35eb5fe0765d5d
// input: apps/web/app/(main)/qoder-reset/page.tsx 177423576d6ebe797c9b901735200c70fd2bd5a57be2c0dda725815a842d1ebf
// input: apps/web/app/(main)/ranking/page.tsx 910974576ec729b0a2ff5e3f79882953043c8799317f4c00fb6d114dbd9bb1f2
// input: apps/web/app/(main)/recruitment/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/recruitment/page.tsx e221f036ea47bb646261be8d99227d7da159cbeb8c6bfe639a3a656601fe73f1
// input: apps/web/app/(main)/refund/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/refund/page.tsx 467db64ed3d0c259c0d0fe321eae5a36a371ce16ade5f24ea3c3f5fc94bb6ccf
// input: apps/web/app/(main)/registry/page.tsx a2a43a2b8a36f88a5e0ed8f4a5efb033d08751a0e73d478e4323875430f676c6
// input: apps/web/app/(main)/repo-wiki/page.tsx cf39e76af2596e8852affaeba1ff37c84ad25c1b84f14866af93eebdd64080d2
// input: apps/web/app/(main)/resources/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/resources/affiliates/page.tsx 6ee0101f481fe2082729a14b5773d16413f70a44ea2d11bc3f784f6de5a728bd
// input: apps/web/app/(main)/resources/edit/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/resources/page.tsx 29daccd463213e9858baaa808e486c202d12a9c884180c79bc1b45a2bd960974
// input: apps/web/app/(main)/rules/page.tsx 2c1ae6cf79a0d6d4f65ca9fc2b0bca1427d51087e6ce1533eb27c6cccaf32fd0
// input: apps/web/app/(main)/schedule/page.tsx 0396f529fbb7cdf6f2ee870283985915f58cfc92863f590e34429f08e8e361b9
// input: apps/web/app/(main)/search/history/page.tsx e7c4153b2c51bac260d679b79af9e6bd9ee68f010300aad1319f41f5e59ba994
// input: apps/web/app/(main)/search/page.tsx 9a7d108bde44eb18b8fb896ce95e07c3b72268adfa49fe83f076006e98b99d01
// input: apps/web/app/(main)/security-audit/page.tsx 48979b6540bf3624ca401685285bf82ec731d0f2122f4ac51efadab301e2e0d3
// input: apps/web/app/(main)/self-healing/page.tsx 66465d0ae39440c08f74b4a1040d997817e30df65678839854d7b9e97aee5c39
// input: apps/web/app/(main)/self-media/automation/page.tsx 3cab723d7477358053823d6cf40d723cf9f769304d3042f4b32f436b3e2cc243
// input: apps/web/app/(main)/self-media/koubo/page.tsx f3bd1665bc05912ae48fa0282e02ff57d34b6c90fb1ed8b792da6b046c486dca
// input: apps/web/app/(main)/self-media/wechat/page.tsx debb0578c8144eaa8cac2da14ebf6554c17dff626b1ade430636be0420fc89bf
// input: apps/web/app/(main)/services/page.tsx b54ca5c46d6700ea0fd78c5cac5efde5d04098a2be51feba7d745667d6dc7c8b
// input: apps/web/app/(main)/settings/account-deletion/page.tsx 9f46afbc579ca6ee367d75fea3221210fe02c9cd31c16e17a60caadaa45f2ce3
// input: apps/web/app/(main)/settings/activity/page.tsx 6b59e1c536916923e3b55b530f4f077c076f17bb7bcd2bf032eb49a32548ebdf
// input: apps/web/app/(main)/settings/agent-security/page.tsx a96dbae33189a1d6dc18a7fca9efc5405e39ac98f35eea9a733d6def8360f6e7
// input: apps/web/app/(main)/settings/api-keys/page.tsx 492e6b64711c856e20ec91c9ef5a74e42869c0127612dfca7cccb3476727083c
// input: apps/web/app/(main)/settings/authorizations/page.tsx 9752d54f8254521641e8475df0e827074db5473d77c5dbcb01d973f309905337
// input: apps/web/app/(main)/settings/billing/page.tsx f60a63f9d10be1e503f75874dbfbbf08be167a6c290fef9d3e026ebf67fc03b6
// input: apps/web/app/(main)/settings/connected-accounts/page.tsx b0afd772ebcc305f5e8049fec1c59861291ef79bcf6d1d48b83572fc14338301
// input: apps/web/app/(main)/settings/dashboard/page.tsx 9a3600e685ffcacd84130982a4ea40a2264a79d3eebe77329b8ef918535d36ca
// input: apps/web/app/(main)/settings/data-export/page.tsx b32177bb13f74dddf9933414e60db1750214411ec71a8145d301748268b09533
// input: apps/web/app/(main)/settings/data-rights/page.tsx 7acc471e9537f8aa1117ff6557b2ad64dc8d47d2699c380f32b55925b13f32f2
// input: apps/web/app/(main)/settings/gateway/page.tsx 4eef35b03c2dbdef89ee8baff5d817d53877f8ba5b13218e177ea03a6fd1049e
// input: apps/web/app/(main)/settings/icp-record/page.tsx 352ac1a3a83d9f8a996264639c8d1280bf667bd95f10dde71faa7acd91bd4cd1
// input: apps/web/app/(main)/settings/import/page.tsx 39a116fe524a9be9f7c53e6ad11021adb9e25c12a9b69e34b16b0ff24400ce13
// input: apps/web/app/(main)/settings/llm/page.tsx 33971a847f01d8bdf10692af698fe91335feac6e9ed338a50d259cc3d29ace13
// input: apps/web/app/(main)/settings/login-security/page.tsx b98327a2e5a9456141e3c9b669c0f8f75fdbd979f83929dc3985d548a4d34c81
// input: apps/web/app/(main)/settings/model-record/page.tsx 14fbf795ca1be17902174485c347fbd5a968c8fef2c7e0a6f9f51f0f90cbabbc
// input: apps/web/app/(main)/settings/notifications/page.tsx a7c7464b1e862e407f8cb552a89cd53dbd2c72a04996eebcf1b5f16133faa34b
// input: apps/web/app/(main)/settings/page.tsx cd858cf8ddf233183ee7ac6eb877f7987436aed3099e0a34a92f6c0a7e867f27
// input: apps/web/app/(main)/settings/preferences/page.tsx f9eb6b9d1949730363d7a776c51a381d05cc9e8885373a83b385c7e65e90a3c8
// input: apps/web/app/(main)/settings/privacy/page.tsx a614b200fe03f35dcc8c06253cbeda6c43b59906165a508e7c5e2cc6c71956a9
// input: apps/web/app/(main)/settings/security-log/page.tsx 2c3f5301a179183f4123165a21408e14861cda827bdcfd87d08da8bd5636b813
// input: apps/web/app/(main)/settings/usage/page.tsx 29bd6ed91c842a66c46413bc249b6c53416c50b14bcaaa95981aaa9a7352fa5b
// input: apps/web/app/(main)/share/[code]/page.tsx 167c448e4b4a8fc29be5687451d9507f01ee71ce9633cc34fae01875dea45992
// input: apps/web/app/(main)/share/page.tsx d5df784435de4fdc6af70d10d3c1dedeaa4359289d56e9d4da7778f0acddb552
// input: apps/web/app/(main)/skills-market/[id]/page.tsx 22c9297245a249350e204aacc1e1e978198704afda124abd0e11d6e06c91f8f9
// input: apps/web/app/(main)/skills-market/page.tsx a766040ff3b687a5a3d7149bfcc1290d96559d2472a5240a23e5bd2b134ba600
// input: apps/web/app/(main)/skills/market/page.tsx 120945e3704181cc6d0b8762deed6c387755149316ddba093bea5fd804b035f1
// input: apps/web/app/(main)/skills/page.tsx 38765932b5d79e111a9d91fa22317363d4be64742dd17ae1e1d012e9cd098f40
// input: apps/web/app/(main)/spec/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/spec/generate/page.tsx a7119f967454163db01bc31ad90fd56e274c5e20a4d382b187e0c00d17e2babc
// input: apps/web/app/(main)/spec/page.tsx a282ebe99e6718ddb542b13bbf1d7cb6aed220f6aad9d47c962b9452cab9f951
// input: apps/web/app/(main)/spec/templates/page.tsx 09194658681769e573ae332a8d93d9c86c64c7cf2ca8bb6fe7c31eac16df990b
// input: apps/web/app/(main)/sponsor/page.tsx e1d0251b33321dc4220e68baad4ac5a70aff6eff218c8a4fa22c42412098556d
// input: apps/web/app/(main)/stock/page.tsx 0c953ff7deb722e5d472f222c587434b68c14b538dd4d08a311643ac15a5323a
// input: apps/web/app/(main)/student/certificates/page.tsx cda1d04f379af93eb06451be0e3c937169aa101237513a470e0c51107f5d83ab
// input: apps/web/app/(main)/student/my-articles/page.tsx 00abc702d82dcc5730f3d5f2746e0a31e49dac2f204bd732de533c7886060e97
// input: apps/web/app/(main)/student/my-asks/page.tsx cf617d3401c4b5d057275be5735d1a6c7ecf4adc13f06aadbbd8c18ef4abcdd9
// input: apps/web/app/(main)/student/my-circles/page.tsx 19f63ef4c7bd03abf107b14dff4c3cc98d63fcb2e953678b5262c187e0325bfd
// input: apps/web/app/(main)/student/my-comments/page.tsx f9c60dc847cbd818930f8202a521056b8efea47b256811d26f2b4b6cdb97623e
// input: apps/web/app/(main)/student/my-lessons/page.tsx 6c427a56e3db43220850f489f03752a00da74027e5659261acb384a5d65869a4
// input: apps/web/app/(main)/student/my-resources/page.tsx 511a59157c1e233e1a5bd91badfd92015c64bf9677ea90060792d4976c3943be
// input: apps/web/app/(main)/student/notes/page.tsx 3bd89e5faa15d6fb50f99c1e77c758063ebef0acecb52db4030e94686fe8f4db
// input: apps/web/app/(main)/student/offline-records/page.tsx 3d50b2184a5bd1b27a37e706d083e2f6dc5d107978e1185f77b9ec89bd020378
// input: apps/web/app/(main)/student/page.tsx d1823dbe0a1eb5848d935de094cdb3b52a9e33bd6723573316af8bbc30661fe6
// input: apps/web/app/(main)/student/papers/page.tsx b83298784a944858722bef0fce11569be1901f7841a479a71d9419afa3186736
// input: apps/web/app/(main)/student/wrong-book/page.tsx 5645ee45a9b359f6934ed7fc63c4fa02bdecaea9979ef69a3cc540d3973ee3b7
// input: apps/web/app/(main)/subagents/detail/page.tsx 67bd2d0c222fa08a830ac3af06e599b5b08194699537fa4d87e95935747bc111
// input: apps/web/app/(main)/subagents/dispatch/page.tsx a29e7298c9d24fb2905d5ed23ca5194608c9819c6e33f9dc6cc23b25f4dace90
// input: apps/web/app/(main)/subagents/page.tsx 4e5d3daf3d277074b556dca8abc742a9379e0aa92b81fbf1e2e23c83e3f3d4bf
// input: apps/web/app/(main)/subagents/topology/page.tsx d89c0f68d2b7aa2b1a65ebd35bd7f8efb45f1c3039111c454a9c660193e029a2
// input: apps/web/app/(main)/subscriptions/page.tsx f1f406e104c2a1e497473db3ece0884b7c902eb6bdca3a897d219449deacd7a8
// input: apps/web/app/(main)/support/page.tsx 5e1be0ee17e4f704eb9ff03c3f8d0a9009eea2ce1878d8f1d44597602f8a9034
// input: apps/web/app/(main)/tags/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/tags/page.tsx 925272d06ad0a116b82260d69804303ba992e77fc18b7ea601ebddd53694db20
// input: apps/web/app/(main)/task-receiver/page.tsx d2f7ec24e0bcc2e4290862e6e996b4e4ea9c9a632e5cc9839b542a31089f718f
// input: apps/web/app/(main)/team-knowledge/page.tsx a7a6b9df6152b4767f4c1e507ad92cf8ee65cf00f6e548af0f5e15c164294e84
// input: apps/web/app/(main)/team-memory/page.tsx fcadf4f92141b01541502fdbdab2ffb5c2eb8ae4b53111e557406b9b550d2a88
// input: apps/web/app/(main)/teams/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/teams/page.tsx 907d7790d60f6a54dd25474159a63a02487ba4971841a9e99dd5a9eed67cc2bd
// input: apps/web/app/(main)/token-value/page.tsx 51fd0c8ea8ef2c929923a2272bf4d273596b3b4d257d55e42ac3359cc23284a8
// input: apps/web/app/(main)/tools/page.tsx c1739c08fb0e3e1534c04aba8f212863544bdc6a40f26ef3d4ec87d8c19ace82
// input: apps/web/app/(main)/tools/pdf/convert/page.tsx 896416df7082843b3e8d235c7602e745403fbe2082b87a0641ab5c583f8e8ab6
// input: apps/web/app/(main)/tools/pdf/merge/page.tsx 85a41758770c58853fded816e0d9432756b5f7d96d6c06449320a5a10021efb5
// input: apps/web/app/(main)/tools/pdf/page.tsx 1fe320eea43449251a8dcf0843ae903e88abb59c427894c62f5cfb4be3b4f48e
// input: apps/web/app/(main)/tools/pdf/split/page.tsx c98aabd570ae469a454eddc9d091a47ee81442bf7213dd2cc334e80fe4c7e394
// input: apps/web/app/(main)/tools/pdf/watermark/page.tsx e1eedf45077e5a2d472c076d15ad74d98d952d64393d8f08a04720e3c8b1f332
// input: apps/web/app/(main)/tools/voice-stt/page.tsx 59098c66f3748987152b91af55f542cdb8e21275cd8baa96267b969bf55f4db2
// input: apps/web/app/(main)/topics/page.tsx 608c322da6a2740508f36823dc15e9e5e661671452060b657773fa8f363fcb9b
// input: apps/web/app/(main)/traders/page.tsx 62f27f8cfb0f5ef4a69b2cbb18b73908d516d13ccfab7856950459108d5d104a
// input: apps/web/app/(main)/use-cases/ai-design/page.tsx c2e06cd483c8337dcaaae76188e6ae0f1857ea6781b0c2284989d9eb1d77cf33
// input: apps/web/app/(main)/use-cases/ai-edu/page.tsx 8cfa2e186136bdcdc51262d76059802fde79bce1e0b36db588a60fd42092f228
// input: apps/web/app/(main)/use-cases/ai-marketing/page.tsx b3d1247b671d37c41c370ddff343440511188df6e3b9228b1d0673c4fb170132
// input: apps/web/app/(main)/use-cases/ai-research/page.tsx 14c33ebb79c47fd7bae34c428de7511f15dee537c266b114bfb94f627ac4afb9
// input: apps/web/app/(main)/use-cases/ai-translation/page.tsx be4e0ba5a7b6882856171b97ccd1cb3a4d36ccc4ece40f1794944bbac91e37c2
// input: apps/web/app/(main)/use-cases/code-assistant/page.tsx 807f10e2e032b92096db24674119d7f6b986515cb478e901eace5252b2cdb3d0
// input: apps/web/app/(main)/use-cases/content-generation/page.tsx 774300a10ff8e5fd66bea169a75b3cc1be0989fbd422e73776048f202e2b8bd6
// input: apps/web/app/(main)/use-cases/customer-support/page.tsx 0c5d38e03a57257117f9979ae2d68680bc68a843850ee17f3e472449e5a29f73
// input: apps/web/app/(main)/use-cases/data-analysis/page.tsx f8e0139933514263f58d0d4b99ebb896149321764f517e26865e6fc7273b838c
// input: apps/web/app/(main)/use-cases/hr-recruiting/page.tsx ee783812fe2e16c76978049f5be3c80964d24063cfb14f5b47983f0b4ad0a600
// input: apps/web/app/(main)/use-cases/it-ops/page.tsx c3ae9991f48b285f33dd4577b6487a3612762ebb6ac3efdbeda4ad7972f8123f
// input: apps/web/app/(main)/use-cases/knowledge-base/page.tsx cf548c1885b98fbf0d57fa5a6fa9b0044ef87f84b4c2de12c74c97e32e361542
// input: apps/web/app/(main)/use-cases/market-analysis/page.tsx a84fb167df23e220ee410311b1d167142015917cf688025a1e30eba984077d18
// input: apps/web/app/(main)/use-cases/page.tsx e2c2e3b5ec7aee9b375200b8460c2115b4e60b3be82988bad2ad86a0a08912e4
// input: apps/web/app/(main)/use-cases/product-analysis/page.tsx b5b48d01cb4a782ead3c346a1d985109be26ccec4f263f3a7901993f58eb9381
// input: apps/web/app/(main)/use-cases/sales/page.tsx bf613bd57299029fdb536f91845e50821ba61ab3542bd333bed07f690c8a0205
// input: apps/web/app/(main)/user/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/user/articles/page.tsx 0c51ab7e20a6f4b81f5e5519fe0803858bed0d614dc9991d728cb38a9656aec9
// input: apps/web/app/(main)/user/ask/page.tsx f91ebc063fb6491d910eb39631b4efeac8ec39c82d4c16616ed397d1e1a23b28
// input: apps/web/app/(main)/user/circle/page.tsx 5f4c0d16f5dc6f1d3cc69de1aa36d5dba9ba000c814055e844471745daa8d7a6
// input: apps/web/app/(main)/user/comment/page.tsx 99cd42b50282855a9d0f1a82a2f70bf474b38cc5255b65796f84ac4a1ee934d8
// input: apps/web/app/(main)/user/exam/page.tsx a36f2606aa087e24474657484f9f9fb59c2ee171af998f59e5c8932dc200f571
// input: apps/web/app/(main)/user/fans/page.tsx fd51d139ec86d041c3222575e083043cb9faba95c265858df01e5c15ea2ceb90
// input: apps/web/app/(main)/user/follow/page.tsx 954d014e609df02adcf661c97bbfc0e24cb7520739ce9b1a5451e2131d5e64b4
// input: apps/web/app/(main)/user/learn-record/page.tsx 7c793775b13567aa3209ea1d70187006b69cf9ed4fe6f4dd43b74d26542610ef
// input: apps/web/app/(main)/user/page.tsx 90e1734021e341936e8414bbeece0e57c26a418454139749805082f243b1370b
// input: apps/web/app/(main)/user/profile/page.tsx 9eba924bdd5e51a797db713415c65dd35850b578a23c81246802b80b0f568d53
// input: apps/web/app/(main)/user/qr-code/page.tsx b7bb7e796a49678d7f49f74dd6b64c5e60e60f39797f9e73000c9a57ace61a85
// input: apps/web/app/(main)/user/realname/page.tsx 30f617db3c36f26d721cc9f12579c98fa7545ebfdb0a34362edb0eaba3345fc9
// input: apps/web/app/(main)/user/resource/page.tsx 3660f506b161c34ef548b35a3871d5df2c20ce3e92f65ed9b47ecda0ed1c5d73
// input: apps/web/app/(main)/user/security/page.tsx df587a169917965295116049a4bad90cd275f8bfef72cb6bb1528fc0048c6676
// input: apps/web/app/(main)/user/sign-up/page.tsx bf305a07cd0ead9d9d4d0168301f0d355f2cf1bc28d37c2a70ca618209a5b77b
// input: apps/web/app/(main)/user/subscription/page.tsx 7e096c59a0ab4b28b21a1aa27a46a47fa8f83a86b0099bfc23af231926755888
// input: apps/web/app/(main)/vip/details/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/vip/page.tsx 0ee554722233990f22e3ea4c625d05ec5d3e56910de473daef18c5471a7a72b0
// input: apps/web/app/(main)/vip/trader/page.tsx 47a89d80d8d645d654422d054fa6f9a0bcaa1060181f87097cfd3b92ea70d79e
// input: apps/web/app/(main)/voices/page.tsx 6959f82657cf946bd8e290cf99084dd9f5200b6300a4cca14e79f149575805b8
// input: apps/web/app/(main)/wallet/page.tsx 06655dc39ab1d9af78f75a148b71f1965b0b33dd905fc9b66564b21e573f2e75
// input: apps/web/app/(main)/wallet/recharge/fail/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/wallet/recharge/page.tsx 27fa1d557fcdd7a0a79ca423deb8fbdacb4d0ed04c4b7137d48333210c03ba91
// input: apps/web/app/(main)/wallet/recharge/success/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/wallet/withdraw/page.tsx e780126637c867c48659734c1072a9f2b820484c58621f0983e986cb27bbf078
// input: apps/web/app/(main)/wallet/withdraw/records/page.tsx a53c7e726205b48c67090a8b80cba2a3606a0ee1866e111b2d1611436884bac4
// input: apps/web/app/(main)/web-tools/page.tsx bbf4e52b231bcad2ae0730b2f8127cd23a6bf09fdda4e49f8dbd1167acccc4fa
// input: apps/web/app/(main)/workbuddy-reset/page.tsx 87bfa8554c3f815d1094ae29887d7b1af53e6a0033b761f217fa45eac110ded7
// input: apps/web/app/(main)/workflows/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/workflows/instances/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/workflows/page.tsx 04023d6b22d63b60eceb775e64e213bddfab0a02b4ad697969fb33d9a199ddfe
// input: apps/web/app/(main)/workspace/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/workspace/page.tsx 77cedd27c5adce0bf3c237573f1c9d7644ec77242c88420e4f3e7229f756a27e
// input: apps/web/app/(main)/workspace/permissions/page.tsx ab730c7513ca7889dcba394a01282c148c370fca733ec43b099a0ece471dff24
// input: apps/web/app/(main)/zh-TW/use-cases/ai-design/page.tsx 968e3a59c964cbbe36456b1a0b785d248128d5b9e0a1f4f2339a9bcba43191bf
// input: apps/web/app/(main)/zh-TW/use-cases/ai-edu/page.tsx 186a51dcf9e97017ac78ee4ef025f3ed404146d2358be881a71553ea41083385
// input: apps/web/app/(main)/zh-TW/use-cases/ai-marketing/page.tsx 84f22e5df326fda0e10f00af56ba40e87f493ec071241c4468d918d517339ab4
// input: apps/web/app/(main)/zh-TW/use-cases/ai-research/page.tsx 2f0815dc8fe7797fecf317e3275152e964d74d3dab59c17ce9780134e67095af
// input: apps/web/app/(main)/zh-TW/use-cases/ai-translation/page.tsx aead2f28cc9f6b74152e8351aad8999356f4f0c4be570ef8edbdfbb4a58b3837
// input: apps/web/app/(marketing)/page.tsx 8004f807b187bbd827d227e7bc43dff4efd301968e177cfdf807c1d700681c97
// input: apps/web/app/en/agents/page.tsx dbc52d72f94e290fddd12f28008fcdd12c312ddd8a7d17c5f44cbdec145f1fb5
// input: apps/web/app/en/docs/page.tsx f305c726806d74a2f8ebf3dae006dba3d2aa2079034ce09b58ab5122d662d566
// input: apps/web/app/en/models/page.tsx 6550698798d45e17826689cf5b281bb35c63b361f28b243047bceec9789db7bf
// input: apps/web/app/en/page.tsx dfa012b6ce87288409a7329ae167defe0688ca723c55419510957d429223436c
// input: apps/web/app/en/pricing/page.tsx 35d8afbe6689e1260476df6c5a581d59a454065c382afed1977c81650324dee3
// input: apps/web/app/forbidden/page.tsx 7e66da391b84e4d0d9f04663f7080dd7ac926b44bd5823780a5e3bd88d9d990f
// input: apps/web/app/h5/share/[code]/page.tsx 167c448e4b4a8fc29be5687451d9507f01ee71ce9633cc34fae01875dea45992
// input: apps/web/app/login/page.tsx f2ee8254da02a265ebf622b16283fd9f31b604d5f19fa26620418a4a5bb5891e
// input: apps/web/app/sso/[provider]/page.tsx ef2d295a33af0b0ab8d9c98ae1543f68880e57949a4617b1de744e77858fdf93
// input: apps/web/app/sso/auth/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/sso/dingtalk/page.tsx fcf9e7746b7f89f487cf7918a46ee7e5b6790029aed1d16430c0366d371a5e2e
// input: apps/web/app/sso/login/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/sso/mobile-auth/page.tsx f6c51a1ea23764b025e27b0dcd5af679feb42a42404a08dd4b0c905e2b2dcfc0
// input: apps/web/app/sso/redirect/page.tsx bdf4f937090bbd2036ff68e338493a2c33db74535aea56f609dede6afd68cec5
// input: apps/web/app/sso/register/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/sso/wecom/page.tsx 6df145382f287882d4dfd57434356f055a22a13afc39f5a8efff3edf6f8460a2
// input: apps/web/app/status/page.tsx 73f528f7654b7eb8bf5d08493a07afa63ed1de621f5a792399270a41505bf2fd
// skipped: excludedTopSegments(sso|h5|api)=9 pages; duplicatePaths(保留先扫描到的)=0
// generatedAt: 2026-10-10T19:35:05.041Z
// IHUI-GEN-PIN-END

export const UI_ROUTES: { path: string; param: boolean; group: string }[] = [
  { path: '/', param: false, group: '' },
  { path: '/a2a', param: false, group: 'a2a' },
  { path: '/about', param: false, group: 'about' },
  { path: '/activities', param: false, group: 'activities' },
  { path: '/activities/:slug', param: true, group: 'activities' },
  { path: '/admin', param: false, group: 'admin' },
  { path: '/admin/about-us', param: false, group: 'admin' },
  { path: '/admin/advertise', param: false, group: 'admin' },
  { path: '/admin/agent-rule', param: false, group: 'admin' },
  { path: '/admin/agent-rules', param: false, group: 'admin' },
  { path: '/admin/agent-task', param: false, group: 'admin' },
  { path: '/admin/agents', param: false, group: 'admin' },
  { path: '/admin/agents/categories', param: false, group: 'admin' },
  { path: '/admin/agents/examine', param: false, group: 'admin' },
  { path: '/admin/agents/settlement', param: false, group: 'admin' },
  { path: '/admin/agreements', param: false, group: 'admin' },
  { path: '/admin/ai-cost', param: false, group: 'admin' },
  { path: '/admin/ai-feed', param: false, group: 'admin' },
  { path: '/admin/ai-gc', param: false, group: 'admin' },
  { path: '/admin/ai-metrics', param: false, group: 'admin' },
  { path: '/admin/ai-models', param: false, group: 'admin' },
  { path: '/admin/ai-pricing', param: false, group: 'admin' },
  { path: '/admin/ai-skills', param: false, group: 'admin' },
  { path: '/admin/ai-world/sites', param: false, group: 'admin' },
  { path: '/admin/announcements', param: false, group: 'admin' },
  { path: '/admin/api-debug', param: false, group: 'admin' },
  { path: '/admin/api-groups', param: false, group: 'admin' },
  { path: '/admin/api-logs', param: false, group: 'admin' },
  { path: '/admin/api-platform/apps', param: false, group: 'admin' },
  { path: '/admin/api-platform/billing', param: false, group: 'admin' },
  { path: '/admin/api-platform/packages', param: false, group: 'admin' },
  { path: '/admin/api-platform/usage', param: false, group: 'admin' },
  { path: '/admin/api-usage', param: false, group: 'admin' },
  { path: '/admin/articles', param: false, group: 'admin' },
  { path: '/admin/asks', param: false, group: 'admin' },
  { path: '/admin/auth-accounts', param: false, group: 'admin' },
  { path: '/admin/auth-dept', param: false, group: 'admin' },
  { path: '/admin/auth-find-info', param: false, group: 'admin' },
  { path: '/admin/auth-role', param: false, group: 'admin' },
  { path: '/admin/auth-user-vip', param: false, group: 'admin' },
  { path: '/admin/auth-veri-codes', param: false, group: 'admin' },
  { path: '/admin/backend-health', param: false, group: 'admin' },
  { path: '/admin/backup-jobs', param: false, group: 'admin' },
  { path: '/admin/behavior', param: false, group: 'admin' },
  { path: '/admin/behavior-analytics', param: false, group: 'admin' },
  { path: '/admin/bi-dashboard', param: false, group: 'admin' },
  { path: '/admin/carousel', param: false, group: 'admin' },
  { path: '/admin/certificate', param: false, group: 'admin' },
  { path: '/admin/certificate/templates', param: false, group: 'admin' },
  { path: '/admin/channel-quota', param: false, group: 'admin' },
  { path: '/admin/circles', param: false, group: 'admin' },
  { path: '/admin/circles/dynamics', param: false, group: 'admin' },
  { path: '/admin/clawdbot', param: false, group: 'admin' },
  { path: '/admin/clawdbot/analytics', param: false, group: 'admin' },
  { path: '/admin/clawdbot/bots', param: false, group: 'admin' },
  { path: '/admin/clawdbot/health', param: false, group: 'admin' },
  { path: '/admin/clawdbot/messages', param: false, group: 'admin' },
  { path: '/admin/clawdbot/permissions', param: false, group: 'admin' },
  { path: '/admin/clawdbot/sessions', param: false, group: 'admin' },
  { path: '/admin/clawdbot/tools', param: false, group: 'admin' },
  { path: '/admin/comment-logs', param: false, group: 'admin' },
  { path: '/admin/comments', param: false, group: 'admin' },
  { path: '/admin/configs', param: false, group: 'admin' },
  { path: '/admin/contact', param: false, group: 'admin' },
  { path: '/admin/crew', param: false, group: 'admin' },
  { path: '/admin/crew/:id', param: true, group: 'admin' },
  { path: '/admin/customer-service', param: false, group: 'admin' },
  { path: '/admin/dashboard-stat', param: false, group: 'admin' },
  { path: '/admin/database-optimization', param: false, group: 'admin' },
  { path: '/admin/demand-audit', param: false, group: 'admin' },
  { path: '/admin/demand-audit/:id', param: true, group: 'admin' },
  { path: '/admin/demand-square', param: false, group: 'admin' },
  { path: '/admin/demand-square/:id', param: true, group: 'admin' },
  { path: '/admin/deploy-diagnosis', param: false, group: 'admin' },
  { path: '/admin/developer', param: false, group: 'admin' },
  { path: '/admin/developer-link', param: false, group: 'admin' },
  { path: '/admin/dict', param: false, group: 'admin' },
  { path: '/admin/distribution', param: false, group: 'admin' },
  { path: '/admin/distribution/orders', param: false, group: 'admin' },
  { path: '/admin/distribution/rules', param: false, group: 'admin' },
  { path: '/admin/distribution/settlements', param: false, group: 'admin' },
  { path: '/admin/distribution/withdrawals', param: false, group: 'admin' },
  { path: '/admin/docs', param: false, group: 'admin' },
  { path: '/admin/downloads', param: false, group: 'admin' },
  { path: '/admin/edu', param: false, group: 'admin' },
  { path: '/admin/edu-settings', param: false, group: 'admin' },
  { path: '/admin/edu/answer', param: false, group: 'admin' },
  { path: '/admin/edu/answer/card', param: false, group: 'admin' },
  { path: '/admin/edu/answer/online', param: false, group: 'admin' },
  { path: '/admin/edu/answer/programming', param: false, group: 'admin' },
  { path: '/admin/edu/certificate', param: false, group: 'admin' },
  { path: '/admin/edu/certificate/issued', param: false, group: 'admin' },
  { path: '/admin/edu/certificate/templates', param: false, group: 'admin' },
  { path: '/admin/edu/class', param: false, group: 'admin' },
  { path: '/admin/edu/class/members', param: false, group: 'admin' },
  { path: '/admin/edu/class/schedule', param: false, group: 'admin' },
  { path: '/admin/edu/course', param: false, group: 'admin' },
  { path: '/admin/edu/course/audit', param: false, group: 'admin' },
  { path: '/admin/edu/course/categories', param: false, group: 'admin' },
  { path: '/admin/edu/course/chapters', param: false, group: 'admin' },
  { path: '/admin/edu/course/pay', param: false, group: 'admin' },
  { path: '/admin/edu/course/platform-log', param: false, group: 'admin' },
  { path: '/admin/edu/course/trash', param: false, group: 'admin' },
  { path: '/admin/edu/exam', param: false, group: 'admin' },
  { path: '/admin/edu/exam/arrangements', param: false, group: 'admin' },
  { path: '/admin/edu/exam/categories', param: false, group: 'admin' },
  { path: '/admin/edu/exam/grades', param: false, group: 'admin' },
  { path: '/admin/edu/exam/papers-manual', param: false, group: 'admin' },
  { path: '/admin/edu/exam/papers-random', param: false, group: 'admin' },
  { path: '/admin/edu/exam/papers-template', param: false, group: 'admin' },
  { path: '/admin/edu/exam/questions', param: false, group: 'admin' },
  { path: '/admin/edu/exam/questions/:type', param: true, group: 'admin' },
  { path: '/admin/edu/exam/ranking', param: false, group: 'admin' },
  { path: '/admin/edu/exam/records', param: false, group: 'admin' },
  { path: '/admin/edu/finance', param: false, group: 'admin' },
  { path: '/admin/edu/finance/invoices', param: false, group: 'admin' },
  { path: '/admin/edu/finance/statistics', param: false, group: 'admin' },
  { path: '/admin/edu/learn', param: false, group: 'admin' },
  { path: '/admin/edu/learn/community', param: false, group: 'admin' },
  { path: '/admin/edu/learn/homework', param: false, group: 'admin' },
  { path: '/admin/edu/learn/live', param: false, group: 'admin' },
  { path: '/admin/edu/learn/maps', param: false, group: 'admin' },
  { path: '/admin/edu/learn/materials', param: false, group: 'admin' },
  { path: '/admin/edu/learn/plan', param: false, group: 'admin' },
  { path: '/admin/edu/learn/progress', param: false, group: 'admin' },
  { path: '/admin/edu/learn/ranking', param: false, group: 'admin' },
  { path: '/admin/edu/learn/recorded', param: false, group: 'admin' },
  { path: '/admin/edu/learn/records', param: false, group: 'admin' },
  { path: '/admin/edu/learn/remind', param: false, group: 'admin' },
  { path: '/admin/edu/learn/signup-batch', param: false, group: 'admin' },
  { path: '/admin/edu/learn/signup-batchlesson', param: false, group: 'admin' },
  { path: '/admin/edu/learn/topics', param: false, group: 'admin' },
  { path: '/admin/edu/organization', param: false, group: 'admin' },
  { path: '/admin/edu/platform', param: false, group: 'admin' },
  { path: '/admin/edu/reports/companystudy', param: false, group: 'admin' },
  { path: '/admin/edu/reports/lessonstudy', param: false, group: 'admin' },
  { path: '/admin/edu/reports/memberstudy', param: false, group: 'admin' },
  { path: '/admin/edu/reports/signup', param: false, group: 'admin' },
  { path: '/admin/edu/student', param: false, group: 'admin' },
  { path: '/admin/edu/student/detail', param: false, group: 'admin' },
  { path: '/admin/edu/student/levels', param: false, group: 'admin' },
  { path: '/admin/edu/teacher', param: false, group: 'admin' },
  { path: '/admin/edu/teacher/detail', param: false, group: 'admin' },
  { path: '/admin/edu/teacher/review', param: false, group: 'admin' },
  { path: '/admin/edu/user-platform', param: false, group: 'admin' },
  { path: '/admin/edu/zhs-identity', param: false, group: 'admin' },
  { path: '/admin/error-dashboard', param: false, group: 'admin' },
  { path: '/admin/event-bus-monitor', param: false, group: 'admin' },
  { path: '/admin/events', param: false, group: 'admin' },
  { path: '/admin/exam', param: false, group: 'admin' },
  { path: '/admin/exam-marking', param: false, group: 'admin' },
  { path: '/admin/exam/categories', param: false, group: 'admin' },
  { path: '/admin/exam/questions', param: false, group: 'admin' },
  { path: '/admin/exam/records', param: false, group: 'admin' },
  { path: '/admin/exchange-rates', param: false, group: 'admin' },
  { path: '/admin/feedbacks', param: false, group: 'admin' },
  { path: '/admin/github-app', param: false, group: 'admin' },
  { path: '/admin/gray-release', param: false, group: 'admin' },
  { path: '/admin/help', param: false, group: 'admin' },
  { path: '/admin/home-schema', param: false, group: 'admin' },
  { path: '/admin/i18n-dashboard', param: false, group: 'admin' },
  { path: '/admin/i18n-dashboard/compare', param: false, group: 'admin' },
  { path: '/admin/i18n-dashboard/missing', param: false, group: 'admin' },
  { path: '/admin/identity-proportion', param: false, group: 'admin' },
  { path: '/admin/im-channels', param: false, group: 'admin' },
  { path: '/admin/integrations', param: false, group: 'admin' },
  { path: '/admin/invoices', param: false, group: 'admin' },
  { path: '/admin/invoices/applications', param: false, group: 'admin' },
  { path: '/admin/invoices/titles', param: false, group: 'admin' },
  { path: '/admin/knowledge-rag', param: false, group: 'admin' },
  { path: '/admin/learn', param: false, group: 'admin' },
  { path: '/admin/learn/categories', param: false, group: 'admin' },
  { path: '/admin/learn/chapters', param: false, group: 'admin' },
  { path: '/admin/learn/signups', param: false, group: 'admin' },
  { path: '/admin/learn/topic/category', param: false, group: 'admin' },
  { path: '/admin/live', param: false, group: 'admin' },
  { path: '/admin/live/categories', param: false, group: 'admin' },
  { path: '/admin/live/lecturers', param: false, group: 'admin' },
  { path: '/admin/login-logs', param: false, group: 'admin' },
  { path: '/admin/logs', param: false, group: 'admin' },
  { path: '/admin/lottery', param: false, group: 'admin' },
  { path: '/admin/member-groups', param: false, group: 'admin' },
  { path: '/admin/member/blacklist', param: false, group: 'admin' },
  { path: '/admin/member/companies', param: false, group: 'admin' },
  { path: '/admin/member/company-types', param: false, group: 'admin' },
  { path: '/admin/member/departments', param: false, group: 'admin' },
  { path: '/admin/member/logs', param: false, group: 'admin' },
  { path: '/admin/member/permissions', param: false, group: 'admin' },
  { path: '/admin/member/roles', param: false, group: 'admin' },
  { path: '/admin/member/unaudited', param: false, group: 'admin' },
  { path: '/admin/member/users', param: false, group: 'admin' },
  { path: '/admin/members', param: false, group: 'admin' },
  { path: '/admin/members/levels', param: false, group: 'admin' },
  { path: '/admin/menu', param: false, group: 'admin' },
  { path: '/admin/menu-permission', param: false, group: 'admin' },
  { path: '/admin/message-overview', param: false, group: 'admin' },
  { path: '/admin/message-templates', param: false, group: 'admin' },
  { path: '/admin/meta-learner', param: false, group: 'admin' },
  { path: '/admin/mobile-adapter', param: false, group: 'admin' },
  { path: '/admin/model-pricing', param: false, group: 'admin' },
  { path: '/admin/monitor/alerts', param: false, group: 'admin' },
  { path: '/admin/monitor/dashboard', param: false, group: 'admin' },
  { path: '/admin/monitor/funnel', param: false, group: 'admin' },
  { path: '/admin/monitoring-dashboard', param: false, group: 'admin' },
  { path: '/admin/news', param: false, group: 'admin' },
  { path: '/admin/news/categories', param: false, group: 'admin' },
  { path: '/admin/notification-channels', param: false, group: 'admin' },
  { path: '/admin/notification-dispatch', param: false, group: 'admin' },
  { path: '/admin/notification-logs', param: false, group: 'admin' },
  { path: '/admin/notification-preferences', param: false, group: 'admin' },
  { path: '/admin/oauth-apps', param: false, group: 'admin' },
  { path: '/admin/oauth-audit-dashboard', param: false, group: 'admin' },
  { path: '/admin/oauth/apps', param: false, group: 'admin' },
  { path: '/admin/oauth/audit', param: false, group: 'admin' },
  { path: '/admin/oauth/tokens', param: false, group: 'admin' },
  { path: '/admin/online-users', param: false, group: 'admin' },
  { path: '/admin/operlog', param: false, group: 'admin' },
  { path: '/admin/orders', param: false, group: 'admin' },
  { path: '/admin/oss', param: false, group: 'admin' },
  { path: '/admin/oss-config', param: false, group: 'admin' },
  { path: '/admin/oss/files', param: false, group: 'admin' },
  { path: '/admin/performance-dashboard', param: false, group: 'admin' },
  { path: '/admin/permissions', param: false, group: 'admin' },
  { path: '/admin/plugins-stats', param: false, group: 'admin' },
  { path: '/admin/point', param: false, group: 'admin' },
  { path: '/admin/point/records', param: false, group: 'admin' },
  { path: '/admin/point/rules', param: false, group: 'admin' },
  { path: '/admin/points-mall', param: false, group: 'admin' },
  { path: '/admin/post', param: false, group: 'admin' },
  { path: '/admin/private-letters', param: false, group: 'admin' },
  { path: '/admin/product-identity', param: false, group: 'admin' },
  { path: '/admin/projects', param: false, group: 'admin' },
  { path: '/admin/promotion-rule', param: false, group: 'admin' },
  { path: '/admin/providers-health', param: false, group: 'admin' },
  { path: '/admin/realname-audit', param: false, group: 'admin' },
  { path: '/admin/recommendation-config', param: false, group: 'admin' },
  { path: '/admin/redis-monitor', param: false, group: 'admin' },
  { path: '/admin/refund', param: false, group: 'admin' },
  { path: '/admin/refund/:id', param: true, group: 'admin' },
  { path: '/admin/relay', param: false, group: 'admin' },
  { path: '/admin/relay-param-ops', param: false, group: 'admin' },
  { path: '/admin/relay/alert-rules', param: false, group: 'admin' },
  { path: '/admin/relay/capacity', param: false, group: 'admin' },
  { path: '/admin/relay/channels', param: false, group: 'admin' },
  { path: '/admin/relay/data-management', param: false, group: 'admin' },
  { path: '/admin/relay/discovery', param: false, group: 'admin' },
  { path: '/admin/relay/enterprise', param: false, group: 'admin' },
  { path: '/admin/relay/error-rules', param: false, group: 'admin' },
  { path: '/admin/relay/insights', param: false, group: 'admin' },
  { path: '/admin/relay/key-pool', param: false, group: 'admin' },
  { path: '/admin/relay/key-scheduling', param: false, group: 'admin' },
  { path: '/admin/relay/logs', param: false, group: 'admin' },
  { path: '/admin/relay/models', param: false, group: 'admin' },
  { path: '/admin/relay/overview', param: false, group: 'admin' },
  { path: '/admin/relay/peak-pricing', param: false, group: 'admin' },
  { path: '/admin/relay/plugins', param: false, group: 'admin' },
  { path: '/admin/relay/prompt-audit', param: false, group: 'admin' },
  { path: '/admin/relay/user-attributes', param: false, group: 'admin' },
  { path: '/admin/resource-product', param: false, group: 'admin' },
  { path: '/admin/resource-tag', param: false, group: 'admin' },
  { path: '/admin/resources', param: false, group: 'admin' },
  { path: '/admin/resources/categories', param: false, group: 'admin' },
  { path: '/admin/resources/product-categories', param: false, group: 'admin' },
  { path: '/admin/resources/products', param: false, group: 'admin' },
  { path: '/admin/resources/tags', param: false, group: 'admin' },
  { path: '/admin/revenue-stat', param: false, group: 'admin' },
  { path: '/admin/roles', param: false, group: 'admin' },
  { path: '/admin/roles/auth-user', param: false, group: 'admin' },
  { path: '/admin/roles/select-user', param: false, group: 'admin' },
  { path: '/admin/saas', param: false, group: 'admin' },
  { path: '/admin/saas/:slug', param: true, group: 'admin' },
  { path: '/admin/saas/:slug/backups', param: true, group: 'admin' },
  { path: '/admin/saas/certificates', param: false, group: 'admin' },
  { path: '/admin/saas/metrics', param: false, group: 'admin' },
  { path: '/admin/schedule', param: false, group: 'admin' },
  { path: '/admin/schedule/logs', param: false, group: 'admin' },
  { path: '/admin/search-hot-words', param: false, group: 'admin' },
  { path: '/admin/security/anomalies', param: false, group: 'admin' },
  { path: '/admin/security/ip-reputation', param: false, group: 'admin' },
  { path: '/admin/security/threat-dashboard', param: false, group: 'admin' },
  { path: '/admin/sensitive-word', param: false, group: 'admin' },
  { path: '/admin/sensitive-words', param: false, group: 'admin' },
  { path: '/admin/shop/funds', param: false, group: 'admin' },
  { path: '/admin/shop/payments', param: false, group: 'admin' },
  { path: '/admin/shop/products', param: false, group: 'admin' },
  { path: '/admin/shop/withdrawals', param: false, group: 'admin' },
  { path: '/admin/signin-rule', param: false, group: 'admin' },
  { path: '/admin/skill-batch', param: false, group: 'admin' },
  { path: '/admin/skill-categories', param: false, group: 'admin' },
  { path: '/admin/skill-stats', param: false, group: 'admin' },
  { path: '/admin/skill-versions', param: false, group: 'admin' },
  { path: '/admin/skills', param: false, group: 'admin' },
  { path: '/admin/sms', param: false, group: 'admin' },
  { path: '/admin/sms-receive', param: false, group: 'admin' },
  { path: '/admin/statistics', param: false, group: 'admin' },
  { path: '/admin/system/login-logs', param: false, group: 'admin' },
  { path: '/admin/system/monitor', param: false, group: 'admin' },
  { path: '/admin/system/operation-logs', param: false, group: 'admin' },
  { path: '/admin/system/tasks', param: false, group: 'admin' },
  { path: '/admin/system/tasks/log', param: false, group: 'admin' },
  { path: '/admin/tags', param: false, group: 'admin' },
  { path: '/admin/task-developer', param: false, group: 'admin' },
  { path: '/admin/tax', param: false, group: 'admin' },
  { path: '/admin/theme', param: false, group: 'admin' },
  { path: '/admin/theme/assets', param: false, group: 'admin' },
  { path: '/admin/theme/colors', param: false, group: 'admin' },
  { path: '/admin/theme/create', param: false, group: 'admin' },
  { path: '/admin/theme/dark-mode', param: false, group: 'admin' },
  { path: '/admin/theme/edit/:id', param: true, group: 'admin' },
  { path: '/admin/theme/export', param: false, group: 'admin' },
  { path: '/admin/theme/fonts', param: false, group: 'admin' },
  { path: '/admin/theme/presets', param: false, group: 'admin' },
  { path: '/admin/ticket', param: false, group: 'admin' },
  { path: '/admin/ticket-reply', param: false, group: 'admin' },
  { path: '/admin/tool/gen', param: false, group: 'admin' },
  { path: '/admin/topup-config', param: false, group: 'admin' },
  { path: '/admin/unauthorized', param: false, group: 'admin' },
  { path: '/admin/user-agent-audio', param: false, group: 'admin' },
  { path: '/admin/user-agent-context', param: false, group: 'admin' },
  { path: '/admin/user-agent-image', param: false, group: 'admin' },
  { path: '/admin/user-center', param: false, group: 'admin' },
  { path: '/admin/user-margin', param: false, group: 'admin' },
  { path: '/admin/user-stat', param: false, group: 'admin' },
  { path: '/admin/users', param: false, group: 'admin' },
  { path: '/admin/variables', param: false, group: 'admin' },
  { path: '/admin/video-logs', param: false, group: 'admin' },
  { path: '/admin/visit-tracking', param: false, group: 'admin' },
  { path: '/admin/visit-trend', param: false, group: 'admin' },
  { path: '/admin/wallet', param: false, group: 'admin' },
  { path: '/admin/withdrawal', param: false, group: 'admin' },
  { path: '/admin/workflows', param: false, group: 'admin' },
  { path: '/admin/zhs-activity', param: false, group: 'admin' },
  { path: '/admin/zhs-agent', param: false, group: 'admin' },
  { path: '/admin/zhs-user', param: false, group: 'admin' },
  { path: '/agent-canvas', param: false, group: 'agent-canvas' },
  { path: '/agent-kanban', param: false, group: 'agent-kanban' },
  { path: '/agent-plan', param: false, group: 'agent-plan' },
  { path: '/agent-plan/progress', param: false, group: 'agent-plan' },
  { path: '/agent-runtime', param: false, group: 'agent-runtime' },
  { path: '/agent-step-recorder', param: false, group: 'agent-step-recorder' },
  { path: '/agent-teams', param: false, group: 'agent-teams' },
  { path: '/agent-timeline', param: false, group: 'agent-timeline' },
  { path: '/agent-workbench', param: false, group: 'agent-workbench' },
  { path: '/agents', param: false, group: 'agents' },
  { path: '/agents/:id', param: true, group: 'agents' },
  { path: '/agents/categories', param: false, group: 'agents' },
  { path: '/agents/categories/:id', param: true, group: 'agents' },
  { path: '/agents/create', param: false, group: 'agents' },
  { path: '/agents/edit/:id', param: true, group: 'agents' },
  { path: '/agents/featured', param: false, group: 'agents' },
  { path: '/agents/my', param: false, group: 'agents' },
  { path: '/agents/stats', param: false, group: 'agents' },
  { path: '/agreement', param: false, group: 'agreement' },
  { path: '/agreement/:type', param: true, group: 'agreement' },
  { path: '/ai-career', param: false, group: 'ai-career' },
  { path: '/ai-generation', param: false, group: 'ai-generation' },
  { path: '/ai-generation/video-tasks', param: false, group: 'ai-generation' },
  { path: '/ai-news', param: false, group: 'ai-news' },
  { path: '/ai-skills', param: false, group: 'ai-skills' },
  { path: '/ai-skills/:id', param: true, group: 'ai-skills' },
  { path: '/ai-world', param: false, group: 'ai-world' },
  { path: '/ai-world/:id', param: true, group: 'ai-world' },
  { path: '/ai-world/create', param: false, group: 'ai-world' },
  { path: '/ai-world/edit/:id', param: true, group: 'ai-world' },
  { path: '/ai-world/favorites', param: false, group: 'ai-world' },
  { path: '/ai-world/history', param: false, group: 'ai-world' },
  { path: '/ai-world/share/:id', param: true, group: 'ai-world' },
  { path: '/announcements', param: false, group: 'announcements' },
  { path: '/announcements/:id', param: true, group: 'announcements' },
  { path: '/api-test', param: false, group: 'api-test' },
  { path: '/app-permissions', param: false, group: 'app-permissions' },
  { path: '/apple/callback', param: false, group: 'apple' },
  { path: '/article', param: false, group: 'article' },
  { path: '/articles', param: false, group: 'articles' },
  { path: '/articles/:id', param: true, group: 'articles' },
  { path: '/articles/edit', param: false, group: 'articles' },
  { path: '/articles/hot', param: false, group: 'articles' },
  { path: '/ask', param: false, group: 'ask' },
  { path: '/asks', param: false, group: 'asks' },
  { path: '/asks/:id', param: true, group: 'asks' },
  { path: '/asks/edit', param: false, group: 'asks' },
  { path: '/asks/edit/:id', param: true, group: 'asks' },
  { path: '/automations', param: false, group: 'automations' },
  { path: '/available-channels', param: false, group: 'available-channels' },
  { path: '/bi-dashboard', param: false, group: 'bi-dashboard' },
  { path: '/blog', param: false, group: 'blog' },
  { path: '/blog/:slug', param: true, group: 'blog' },
  { path: '/business-card', param: false, group: 'business-card' },
  { path: '/business-card/edit', param: false, group: 'business-card' },
  { path: '/business-card/favorites', param: false, group: 'business-card' },
  { path: '/business-card/share/:id', param: true, group: 'business-card' },
  { path: '/business-license', param: false, group: 'business-license' },
  { path: '/callback', param: false, group: 'callback' },
  { path: '/capability-market', param: false, group: 'capability-market' },
  { path: '/carte', param: false, group: 'carte' },
  { path: '/certificate', param: false, group: 'certificate' },
  { path: '/certificate/:id', param: true, group: 'certificate' },
  { path: '/certificate/download', param: false, group: 'certificate' },
  { path: '/certificate/verify', param: false, group: 'certificate' },
  { path: '/channel-status', param: false, group: 'channel-status' },
  { path: '/chat', param: false, group: 'chat' },
  { path: '/chat/favorites', param: false, group: 'chat' },
  { path: '/chat/history', param: false, group: 'chat' },
  { path: '/chat/settings', param: false, group: 'chat' },
  { path: '/chat/share/:id', param: true, group: 'chat' },
  { path: '/chat/templates', param: false, group: 'chat' },
  { path: '/checkin', param: false, group: 'checkin' },
  { path: '/circles', param: false, group: 'circles' },
  { path: '/circles/:id', param: true, group: 'circles' },
  { path: '/circles/post', param: false, group: 'circles' },
  { path: '/cloud-agent', param: false, group: 'cloud-agent' },
  { path: '/cloud-run', param: false, group: 'cloud-run' },
  { path: '/comments', param: false, group: 'comments' },
  { path: '/commission/plan', param: false, group: 'commission' },
  { path: '/compare', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-autogen', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-bolt-new', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-claude-code', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-copilot-studio', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-coze', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-crewai', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-cursor', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-deepseek-platform', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-devin', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-dify', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-doubao', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-ernie', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-fastgpt', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-flowise', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-github-copilot', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-kimi-platform', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-langchain', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-llamaindex', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-lovable', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-make', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-manus', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-minimax', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-n8n', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-openai-agent', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-qwen-platform', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-relevance-ai', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-replit-agent', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-spark', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-stack-ai', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-typebot', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-v0-dev', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-voiceflow', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-windsurf', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-wordware', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-zapier-ai', param: false, group: 'compare' },
  { path: '/compare/ihui-vs-zhipu', param: false, group: 'compare' },
  { path: '/computer-use', param: false, group: 'computer-use' },
  { path: '/connectors', param: false, group: 'connectors' },
  { path: '/contact', param: false, group: 'contact' },
  { path: '/context', param: false, group: 'context' },
  { path: '/context-compaction', param: false, group: 'context-compaction' },
  { path: '/context/compression', param: false, group: 'context' },
  { path: '/context/mentions', param: false, group: 'context' },
  { path: '/context/visualization', param: false, group: 'context' },
  { path: '/cost-dashboard', param: false, group: 'cost-dashboard' },
  { path: '/dashboard', param: false, group: 'dashboard' },
  { path: '/deep-research', param: false, group: 'deep-research' },
  { path: '/design', param: false, group: 'design' },
  { path: '/design-system', param: false, group: 'design-system' },
  { path: '/developer', param: false, group: 'developer' },
  { path: '/developer/api-docs', param: false, group: 'developer' },
  { path: '/developer/billing', param: false, group: 'developer' },
  { path: '/developer/capabilities', param: false, group: 'developer' },
  { path: '/developer/conversations', param: false, group: 'developer' },
  { path: '/developer/enterprise', param: false, group: 'developer' },
  { path: '/developer/error-codes', param: false, group: 'developer' },
  { path: '/developer/ide', param: false, group: 'developer' },
  { path: '/developer/keys', param: false, group: 'developer' },
  { path: '/developer/limits', param: false, group: 'developer' },
  { path: '/developer/logs', param: false, group: 'developer' },
  { path: '/developer/notifications', param: false, group: 'developer' },
  { path: '/developer/pricing', param: false, group: 'developer' },
  { path: '/developer/relay', param: false, group: 'developer' },
  { path: '/developer/relay/benefits', param: false, group: 'developer' },
  { path: '/developer/relay/keys', param: false, group: 'developer' },
  { path: '/developer/relay/subscriptions', param: false, group: 'developer' },
  { path: '/developer/relay/usage', param: false, group: 'developer' },
  { path: '/developer/sandbox', param: false, group: 'developer' },
  { path: '/developer/settings', param: false, group: 'developer' },
  { path: '/developer/subscription', param: false, group: 'developer' },
  { path: '/developer/team', param: false, group: 'developer' },
  { path: '/developer/versions', param: false, group: 'developer' },
  { path: '/developer/webhooks', param: false, group: 'developer' },
  { path: '/developers', param: false, group: 'developers' },
  { path: '/distribution', param: false, group: 'distribution' },
  { path: '/distribution/commission', param: false, group: 'distribution' },
  { path: '/distribution/company', param: false, group: 'distribution' },
  { path: '/distribution/orders', param: false, group: 'distribution' },
  { path: '/distribution/referrer', param: false, group: 'distribution' },
  { path: '/distribution/team', param: false, group: 'distribution' },
  { path: '/distribution/team/:id', param: true, group: 'distribution' },
  { path: '/distribution/token', param: false, group: 'distribution' },
  { path: '/distribution/withdraw', param: false, group: 'distribution' },
  { path: '/distribution/withdraw/records', param: false, group: 'distribution' },
  { path: '/docs', param: false, group: 'docs' },
  { path: '/docs/agent', param: false, group: 'docs' },
  { path: '/docs/api', param: false, group: 'docs' },
  { path: '/docs/manual', param: false, group: 'docs' },
  { path: '/docs/manual/account', param: false, group: 'docs' },
  { path: '/docs/manual/agent', param: false, group: 'docs' },
  { path: '/docs/manual/ai-chat', param: false, group: 'docs' },
  { path: '/docs/manual/billing', param: false, group: 'docs' },
  { path: '/docs/manual/faq', param: false, group: 'docs' },
  { path: '/docs/manual/getting-started', param: false, group: 'docs' },
  { path: '/docs/manual/knowledge-base', param: false, group: 'docs' },
  { path: '/docs/mcp', param: false, group: 'docs' },
  { path: '/docs/models', param: false, group: 'docs' },
  { path: '/docs/quickstart', param: false, group: 'docs' },
  { path: '/docs/rag', param: false, group: 'docs' },
  { path: '/docs/self-host', param: false, group: 'docs' },
  { path: '/docs/team', param: false, group: 'docs' },
  { path: '/docs/workflow', param: false, group: 'docs' },
  { path: '/download', param: false, group: 'download' },
  { path: '/download/:platform', param: true, group: 'download' },
  { path: '/drama', param: false, group: 'drama' },
  { path: '/earnings', param: false, group: 'earnings' },
  { path: '/ecosystem', param: false, group: 'ecosystem' },
  { path: '/ecosystem/connectors/:key', param: true, group: 'ecosystem' },
  { path: '/ecosystem/expert-packs', param: false, group: 'ecosystem' },
  { path: '/ecosystem/expert-packs/:slug', param: true, group: 'ecosystem' },
  { path: '/edu', param: false, group: 'edu' },
  { path: '/edu-ai', param: false, group: 'edu-ai' },
  { path: '/edu-ai/aigc-tools', param: false, group: 'edu-ai' },
  { path: '/edu-ai/certification', param: false, group: 'edu-ai' },
  { path: '/edu-ai/courses', param: false, group: 'edu-ai' },
  { path: '/edu-ai/map', param: false, group: 'edu-ai' },
  { path: '/edu-ai/marking', param: false, group: 'edu-ai' },
  { path: '/edu-ai/outbound', param: false, group: 'edu-ai' },
  { path: '/edu-ai/policy', param: false, group: 'edu-ai' },
  { path: '/edu-ai/tbox', param: false, group: 'edu-ai' },
  { path: '/edu-ai/video-compose', param: false, group: 'edu-ai' },
  { path: '/edu-ai/voice', param: false, group: 'edu-ai' },
  { path: '/edu-points', param: false, group: 'edu-points' },
  { path: '/edu/certificates', param: false, group: 'edu' },
  { path: '/edu/certificates/:id', param: true, group: 'edu' },
  { path: '/edu/courses', param: false, group: 'edu' },
  { path: '/edu/courses/:id', param: true, group: 'edu' },
  { path: '/edu/courses/:id/learn', param: true, group: 'edu' },
  { path: '/edu/dashboard', param: false, group: 'edu' },
  { path: '/edu/edu-management/attendance', param: false, group: 'edu' },
  { path: '/edu/edu-management/enrollment', param: false, group: 'edu' },
  { path: '/edu/edu-management/finance', param: false, group: 'edu' },
  { path: '/edu/edu-management/grades', param: false, group: 'edu' },
  { path: '/edu/edu-management/grades/trend/:studentId', param: true, group: 'edu' },
  { path: '/edu/edu-management/homework', param: false, group: 'edu' },
  { path: '/edu/edu-management/meal', param: false, group: 'edu' },
  { path: '/edu/edu-management/procurement', param: false, group: 'edu' },
  { path: '/edu/edu-management/schedule', param: false, group: 'edu' },
  { path: '/edu/edu-management/scheduling', param: false, group: 'edu' },
  { path: '/edu/edu-management/study-plan', param: false, group: 'edu' },
  { path: '/edu/exam', param: false, group: 'edu' },
  { path: '/edu/exam/:id', param: true, group: 'edu' },
  { path: '/edu/exam/:id/result', param: true, group: 'edu' },
  { path: '/edu/notes', param: false, group: 'edu' },
  { path: '/edu/parent', param: false, group: 'edu' },
  { path: '/edu/parent/bind', param: false, group: 'edu' },
  { path: '/edu/parent/children/:childId/attendance', param: true, group: 'edu' },
  { path: '/edu/parent/children/:childId/courses', param: true, group: 'edu' },
  { path: '/edu/parent/children/:childId/grades', param: true, group: 'edu' },
  { path: '/edu/parent/children/:childId/meals', param: true, group: 'edu' },
  { path: '/edu/parent/children/:childId/study-plans', param: true, group: 'edu' },
  { path: '/edu/progress', param: false, group: 'edu' },
  { path: '/edu/qa', param: false, group: 'edu' },
  { path: '/edu/schedule', param: false, group: 'edu' },
  { path: '/edu/shop', param: false, group: 'edu' },
  { path: '/en', param: false, group: 'en' },
  { path: '/en/agents', param: false, group: 'en' },
  { path: '/en/docs', param: false, group: 'en' },
  { path: '/en/models', param: false, group: 'en' },
  { path: '/en/pricing', param: false, group: 'en' },
  { path: '/en/use-cases/ai-design', param: false, group: 'en' },
  { path: '/en/use-cases/ai-edu', param: false, group: 'en' },
  { path: '/en/use-cases/ai-marketing', param: false, group: 'en' },
  { path: '/en/use-cases/ai-research', param: false, group: 'en' },
  { path: '/en/use-cases/ai-translation', param: false, group: 'en' },
  { path: '/enterprise', param: false, group: 'enterprise' },
  { path: '/enterprise/inquiry', param: false, group: 'enterprise' },
  { path: '/exam', param: false, group: 'exam' },
  { path: '/exam/:id', param: true, group: 'exam' },
  { path: '/exam/:id/result', param: true, group: 'exam' },
  { path: '/exam/wrong-questions', param: false, group: 'exam' },
  { path: '/faq', param: false, group: 'faq' },
  { path: '/favorites', param: false, group: 'favorites' },
  { path: '/feature-center', param: false, group: 'feature-center' },
  { path: '/feature-center/agents', param: false, group: 'feature-center' },
  { path: '/feature-center/apis', param: false, group: 'feature-center' },
  { path: '/feature-center/documents', param: false, group: 'feature-center' },
  { path: '/feature-center/models', param: false, group: 'feature-center' },
  { path: '/feature-center/sdks', param: false, group: 'feature-center' },
  { path: '/feedback', param: false, group: 'feedback' },
  { path: '/feedback/:id', param: true, group: 'feedback' },
  { path: '/figma-import', param: false, group: 'figma-import' },
  { path: '/following', param: false, group: 'following' },
  { path: '/forbidden', param: false, group: 'forbidden' },
  { path: '/forgot-password', param: false, group: 'forgot-password' },
  { path: '/free-ai', param: false, group: 'free-ai' },
  { path: '/fund-data', param: false, group: 'fund-data' },
  { path: '/google/callback', param: false, group: 'google' },
  { path: '/groups', param: false, group: 'groups' },
  { path: '/help', param: false, group: 'help' },
  { path: '/help/:slug', param: true, group: 'help' },
  { path: '/home', param: false, group: 'home' },
  { path: '/hooks', param: false, group: 'hooks' },
  { path: '/image-gen', param: false, group: 'image-gen' },
  { path: '/image-gen/favorites', param: false, group: 'image-gen' },
  { path: '/image-gen/gallery', param: false, group: 'image-gen' },
  { path: '/image-gen/history', param: false, group: 'image-gen' },
  { path: '/image-gen/templates', param: false, group: 'image-gen' },
  { path: '/invitations', param: false, group: 'invitations' },
  { path: '/invoices', param: false, group: 'invoices' },
  { path: '/ja/use-cases/ai-design', param: false, group: 'ja' },
  { path: '/ja/use-cases/ai-edu', param: false, group: 'ja' },
  { path: '/ja/use-cases/ai-marketing', param: false, group: 'ja' },
  { path: '/ja/use-cases/ai-research', param: false, group: 'ja' },
  { path: '/ja/use-cases/ai-translation', param: false, group: 'ja' },
  { path: '/knowledge', param: false, group: 'knowledge' },
  { path: '/knowledge-base', param: false, group: 'knowledge-base' },
  { path: '/knowledge-base/:id', param: true, group: 'knowledge-base' },
  { path: '/knowledge-base/edit', param: false, group: 'knowledge-base' },
  { path: '/knowledge-base/edit/:id', param: true, group: 'knowledge-base' },
  { path: '/knowledge-base/search', param: false, group: 'knowledge-base' },
  { path: '/knowledge-cards', param: false, group: 'knowledge-cards' },
  { path: '/knowledge-graph', param: false, group: 'knowledge-graph' },
  { path: '/knowledge-planet', param: false, group: 'knowledge-planet' },
  { path: '/knowledge-rag', param: false, group: 'knowledge-rag' },
  { path: '/knowledge-rag/:id', param: true, group: 'knowledge-rag' },
  { path: '/knowledge-rag/:id/chunks', param: true, group: 'knowledge-rag' },
  { path: '/knowledge-rag/manage', param: false, group: 'knowledge-rag' },
  { path: '/ko/use-cases/ai-design', param: false, group: 'ko' },
  { path: '/ko/use-cases/ai-edu', param: false, group: 'ko' },
  { path: '/ko/use-cases/ai-marketing', param: false, group: 'ko' },
  { path: '/ko/use-cases/ai-research', param: false, group: 'ko' },
  { path: '/ko/use-cases/ai-translation', param: false, group: 'ko' },
  { path: '/learn', param: false, group: 'learn' },
  { path: '/learn/:id', param: true, group: 'learn' },
  { path: '/learn/:id/homework', param: true, group: 'learn' },
  { path: '/learn/:id/rate', param: true, group: 'learn' },
  { path: '/learn/buyconfirm', param: false, group: 'learn' },
  { path: '/learn/map', param: false, group: 'learn' },
  { path: '/learn/payment/confirm', param: false, group: 'learn' },
  { path: '/learn/review', param: false, group: 'learn' },
  { path: '/learn/topic', param: false, group: 'learn' },
  { path: '/learn/topic/:id', param: true, group: 'learn' },
  { path: '/lecturers', param: false, group: 'lecturers' },
  { path: '/lecturers/:id', param: true, group: 'lecturers' },
  { path: '/legal/service-specific-terms', param: false, group: 'legal' },
  { path: '/legal/supported-regions', param: false, group: 'legal' },
  { path: '/legal/terms', param: false, group: 'legal' },
  { path: '/legal/usage-policy', param: false, group: 'legal' },
  { path: '/letters', param: false, group: 'letters' },
  { path: '/live', param: false, group: 'live' },
  { path: '/live/:id', param: true, group: 'live' },
  { path: '/live/:id/play', param: true, group: 'live' },
  { path: '/live/host', param: false, group: 'live' },
  { path: '/login', param: false, group: 'login' },
  { path: '/mcp-projects', param: false, group: 'mcp-projects' },
  { path: '/mcp-store', param: false, group: 'mcp-store' },
  { path: '/media-tasks', param: false, group: 'media-tasks' },
  { path: '/member', param: false, group: 'member' },
  { path: '/member/addresses', param: false, group: 'member' },
  { path: '/member/benefits', param: false, group: 'member' },
  { path: '/member/coupons', param: false, group: 'member' },
  { path: '/member/dashboard', param: false, group: 'member' },
  { path: '/member/exam/record', param: false, group: 'member' },
  { path: '/member/exam/sign-up', param: false, group: 'member' },
  { path: '/member/favorites', param: false, group: 'member' },
  { path: '/member/feedback', param: false, group: 'member' },
  { path: '/member/help', param: false, group: 'member' },
  { path: '/member/history', param: false, group: 'member' },
  { path: '/member/settings', param: false, group: 'member' },
  { path: '/member/subscription', param: false, group: 'member' },
  { path: '/members', param: false, group: 'members' },
  { path: '/memory', param: false, group: 'memory' },
  { path: '/memory-manager', param: false, group: 'memory-manager' },
  { path: '/memory/:id', param: true, group: 'memory' },
  { path: '/memory/new', param: false, group: 'memory' },
  { path: '/memory/scope/:scope', param: true, group: 'memory' },
  { path: '/messages', param: false, group: 'messages' },
  { path: '/messages/:type', param: true, group: 'messages' },
  { path: '/mobile-dashboard', param: false, group: 'mobile-dashboard' },
  { path: '/models', param: false, group: 'models' },
  { path: '/models-pricing', param: false, group: 'models-pricing' },
  { path: '/models/api-docs', param: false, group: 'models' },
  { path: '/models/billing', param: false, group: 'models' },
  { path: '/models/channels', param: false, group: 'models' },
  { path: '/models/chats', param: false, group: 'models' },
  { path: '/models/contact', param: false, group: 'models' },
  { path: '/models/eval', param: false, group: 'models' },
  { path: '/models/groups', param: false, group: 'models' },
  { path: '/models/keys', param: false, group: 'models' },
  { path: '/models/logs', param: false, group: 'models' },
  { path: '/models/openclaw', param: false, group: 'models' },
  { path: '/models/overview', param: false, group: 'models' },
  { path: '/models/prompts', param: false, group: 'models' },
  { path: '/models/redeem', param: false, group: 'models' },
  { path: '/models/referral', param: false, group: 'models' },
  { path: '/models/skills', param: false, group: 'models' },
  { path: '/models/trajectory', param: false, group: 'models' },
  { path: '/models/usage', param: false, group: 'models' },
  { path: '/models/users', param: false, group: 'models' },
  { path: '/n8n-agents', param: false, group: 'n8n-agents' },
  { path: '/news', param: false, group: 'news' },
  { path: '/news/:id', param: true, group: 'news' },
  { path: '/news/category/:id', param: true, group: 'news' },
  { path: '/newsletter', param: false, group: 'newsletter' },
  { path: '/notifications', param: false, group: 'notifications' },
  { path: '/oauth/authorize', param: false, group: 'oauth' },
  { path: '/oauth/my-authorized', param: false, group: 'oauth' },
  { path: '/oauth/platform', param: false, group: 'oauth' },
  { path: '/onboarding', param: false, group: 'onboarding' },
  { path: '/openclaw', param: false, group: 'openclaw' },
  { path: '/orchestration', param: false, group: 'orchestration' },
  { path: '/orders', param: false, group: 'orders' },
  { path: '/orders/:id', param: true, group: 'orders' },
  { path: '/patrol', param: false, group: 'patrol' },
  { path: '/payment', param: false, group: 'payment' },
  { path: '/payment/checkout', param: false, group: 'payment' },
  { path: '/personas', param: false, group: 'personas' },
  { path: '/plan', param: false, group: 'plan' },
  { path: '/plan/:id', param: true, group: 'plan' },
  { path: '/plan/new', param: false, group: 'plan' },
  { path: '/playground', param: false, group: 'playground' },
  { path: '/plaza', param: false, group: 'plaza' },
  { path: '/plaza/new', param: false, group: 'plaza' },
  { path: '/plugins', param: false, group: 'plugins' },
  { path: '/points', param: false, group: 'points' },
  { path: '/points/mall', param: false, group: 'points' },
  { path: '/points/sign-in', param: false, group: 'points' },
  { path: '/points/tasks', param: false, group: 'points' },
  { path: '/pricing', param: false, group: 'pricing' },
  { path: '/products', param: false, group: 'products' },
  { path: '/publish', param: false, group: 'publish' },
  { path: '/publish/accounts', param: false, group: 'publish' },
  { path: '/publish/analytics', param: false, group: 'publish' },
  { path: '/publish/calendar', param: false, group: 'publish' },
  { path: '/publish/history', param: false, group: 'publish' },
  { path: '/publish/monitor', param: false, group: 'publish' },
  { path: '/publish/new', param: false, group: 'publish' },
  { path: '/purchase', param: false, group: 'purchase' },
  { path: '/qoder-reset', param: false, group: 'qoder-reset' },
  { path: '/ranking', param: false, group: 'ranking' },
  { path: '/recruitment', param: false, group: 'recruitment' },
  { path: '/recruitment/:id', param: true, group: 'recruitment' },
  { path: '/refund', param: false, group: 'refund' },
  { path: '/refund/:id', param: true, group: 'refund' },
  { path: '/registry', param: false, group: 'registry' },
  { path: '/repo-wiki', param: false, group: 'repo-wiki' },
  { path: '/resources', param: false, group: 'resources' },
  { path: '/resources/:id', param: true, group: 'resources' },
  { path: '/resources/affiliates', param: false, group: 'resources' },
  { path: '/resources/edit', param: false, group: 'resources' },
  { path: '/rules', param: false, group: 'rules' },
  { path: '/schedule', param: false, group: 'schedule' },
  { path: '/search', param: false, group: 'search' },
  { path: '/search/history', param: false, group: 'search' },
  { path: '/security-audit', param: false, group: 'security-audit' },
  { path: '/self-healing', param: false, group: 'self-healing' },
  { path: '/self-media/automation', param: false, group: 'self-media' },
  { path: '/self-media/koubo', param: false, group: 'self-media' },
  { path: '/self-media/wechat', param: false, group: 'self-media' },
  { path: '/services', param: false, group: 'services' },
  { path: '/settings', param: false, group: 'settings' },
  { path: '/settings/account-deletion', param: false, group: 'settings' },
  { path: '/settings/activity', param: false, group: 'settings' },
  { path: '/settings/agent-security', param: false, group: 'settings' },
  { path: '/settings/api-keys', param: false, group: 'settings' },
  { path: '/settings/authorizations', param: false, group: 'settings' },
  { path: '/settings/billing', param: false, group: 'settings' },
  { path: '/settings/connected-accounts', param: false, group: 'settings' },
  { path: '/settings/dashboard', param: false, group: 'settings' },
  { path: '/settings/data-export', param: false, group: 'settings' },
  { path: '/settings/data-rights', param: false, group: 'settings' },
  { path: '/settings/gateway', param: false, group: 'settings' },
  { path: '/settings/icp-record', param: false, group: 'settings' },
  { path: '/settings/import', param: false, group: 'settings' },
  { path: '/settings/llm', param: false, group: 'settings' },
  { path: '/settings/login-security', param: false, group: 'settings' },
  { path: '/settings/model-record', param: false, group: 'settings' },
  { path: '/settings/notifications', param: false, group: 'settings' },
  { path: '/settings/preferences', param: false, group: 'settings' },
  { path: '/settings/privacy', param: false, group: 'settings' },
  { path: '/settings/security-log', param: false, group: 'settings' },
  { path: '/settings/usage', param: false, group: 'settings' },
  { path: '/share', param: false, group: 'share' },
  { path: '/share/:code', param: true, group: 'share' },
  { path: '/skills', param: false, group: 'skills' },
  { path: '/skills-market', param: false, group: 'skills-market' },
  { path: '/skills-market/:id', param: true, group: 'skills-market' },
  { path: '/skills/market', param: false, group: 'skills' },
  { path: '/spec', param: false, group: 'spec' },
  { path: '/spec/:id', param: true, group: 'spec' },
  { path: '/spec/generate', param: false, group: 'spec' },
  { path: '/spec/templates', param: false, group: 'spec' },
  { path: '/sponsor', param: false, group: 'sponsor' },
  { path: '/status', param: false, group: 'status' },
  { path: '/stock', param: false, group: 'stock' },
  { path: '/student', param: false, group: 'student' },
  { path: '/student/certificates', param: false, group: 'student' },
  { path: '/student/my-articles', param: false, group: 'student' },
  { path: '/student/my-asks', param: false, group: 'student' },
  { path: '/student/my-circles', param: false, group: 'student' },
  { path: '/student/my-comments', param: false, group: 'student' },
  { path: '/student/my-lessons', param: false, group: 'student' },
  { path: '/student/my-resources', param: false, group: 'student' },
  { path: '/student/notes', param: false, group: 'student' },
  { path: '/student/offline-records', param: false, group: 'student' },
  { path: '/student/papers', param: false, group: 'student' },
  { path: '/student/wrong-book', param: false, group: 'student' },
  { path: '/subagents', param: false, group: 'subagents' },
  { path: '/subagents/detail', param: false, group: 'subagents' },
  { path: '/subagents/dispatch', param: false, group: 'subagents' },
  { path: '/subagents/topology', param: false, group: 'subagents' },
  { path: '/subscriptions', param: false, group: 'subscriptions' },
  { path: '/support', param: false, group: 'support' },
  { path: '/tags', param: false, group: 'tags' },
  { path: '/tags/:slug', param: true, group: 'tags' },
  { path: '/task-receiver', param: false, group: 'task-receiver' },
  { path: '/team-knowledge', param: false, group: 'team-knowledge' },
  { path: '/team-memory', param: false, group: 'team-memory' },
  { path: '/teams', param: false, group: 'teams' },
  { path: '/teams/:id', param: true, group: 'teams' },
  { path: '/token-value', param: false, group: 'token-value' },
  { path: '/tools', param: false, group: 'tools' },
  { path: '/tools/pdf', param: false, group: 'tools' },
  { path: '/tools/pdf/convert', param: false, group: 'tools' },
  { path: '/tools/pdf/merge', param: false, group: 'tools' },
  { path: '/tools/pdf/split', param: false, group: 'tools' },
  { path: '/tools/pdf/watermark', param: false, group: 'tools' },
  { path: '/tools/voice-stt', param: false, group: 'tools' },
  { path: '/topics', param: false, group: 'topics' },
  { path: '/traders', param: false, group: 'traders' },
  { path: '/use-cases', param: false, group: 'use-cases' },
  { path: '/use-cases/ai-design', param: false, group: 'use-cases' },
  { path: '/use-cases/ai-edu', param: false, group: 'use-cases' },
  { path: '/use-cases/ai-marketing', param: false, group: 'use-cases' },
  { path: '/use-cases/ai-research', param: false, group: 'use-cases' },
  { path: '/use-cases/ai-translation', param: false, group: 'use-cases' },
  { path: '/use-cases/code-assistant', param: false, group: 'use-cases' },
  { path: '/use-cases/content-generation', param: false, group: 'use-cases' },
  { path: '/use-cases/customer-support', param: false, group: 'use-cases' },
  { path: '/use-cases/data-analysis', param: false, group: 'use-cases' },
  { path: '/use-cases/hr-recruiting', param: false, group: 'use-cases' },
  { path: '/use-cases/it-ops', param: false, group: 'use-cases' },
  { path: '/use-cases/knowledge-base', param: false, group: 'use-cases' },
  { path: '/use-cases/market-analysis', param: false, group: 'use-cases' },
  { path: '/use-cases/product-analysis', param: false, group: 'use-cases' },
  { path: '/use-cases/sales', param: false, group: 'use-cases' },
  { path: '/user', param: false, group: 'user' },
  { path: '/user/:id', param: true, group: 'user' },
  { path: '/user/articles', param: false, group: 'user' },
  { path: '/user/ask', param: false, group: 'user' },
  { path: '/user/circle', param: false, group: 'user' },
  { path: '/user/comment', param: false, group: 'user' },
  { path: '/user/exam', param: false, group: 'user' },
  { path: '/user/fans', param: false, group: 'user' },
  { path: '/user/follow', param: false, group: 'user' },
  { path: '/user/learn-record', param: false, group: 'user' },
  { path: '/user/profile', param: false, group: 'user' },
  { path: '/user/qr-code', param: false, group: 'user' },
  { path: '/user/realname', param: false, group: 'user' },
  { path: '/user/resource', param: false, group: 'user' },
  { path: '/user/security', param: false, group: 'user' },
  { path: '/user/sign-up', param: false, group: 'user' },
  { path: '/user/subscription', param: false, group: 'user' },
  { path: '/vip', param: false, group: 'vip' },
  { path: '/vip/details', param: false, group: 'vip' },
  { path: '/vip/trader', param: false, group: 'vip' },
  { path: '/voices', param: false, group: 'voices' },
  { path: '/wallet', param: false, group: 'wallet' },
  { path: '/wallet/recharge', param: false, group: 'wallet' },
  { path: '/wallet/recharge/fail', param: false, group: 'wallet' },
  { path: '/wallet/recharge/success', param: false, group: 'wallet' },
  { path: '/wallet/withdraw', param: false, group: 'wallet' },
  { path: '/wallet/withdraw/records', param: false, group: 'wallet' },
  { path: '/web-tools', param: false, group: 'web-tools' },
  { path: '/workbuddy-reset', param: false, group: 'workbuddy-reset' },
  { path: '/workflows', param: false, group: 'workflows' },
  { path: '/workflows/:id', param: true, group: 'workflows' },
  { path: '/workflows/instances/:id', param: true, group: 'workflows' },
  { path: '/workspace', param: false, group: 'workspace' },
  { path: '/workspace/:id', param: true, group: 'workspace' },
  { path: '/workspace/permissions', param: false, group: 'workspace' },
  { path: '/zh-TW/use-cases/ai-design', param: false, group: 'zh-TW' },
  { path: '/zh-TW/use-cases/ai-edu', param: false, group: 'zh-TW' },
  { path: '/zh-TW/use-cases/ai-marketing', param: false, group: 'zh-TW' },
  { path: '/zh-TW/use-cases/ai-research', param: false, group: 'zh-TW' },
  { path: '/zh-TW/use-cases/ai-translation', param: false, group: 'zh-TW' },
]
