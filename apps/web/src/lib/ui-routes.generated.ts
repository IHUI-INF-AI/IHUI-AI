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
// sourceCommit: 9d73034ba87371706d1a4edf94f63032a1e46e5a
// inputsSha256: 46f419d56ab406dd3b1b263d336d765ee50c841ea70e018acc6e5c14641aa111
// input: apps/web/app/(auth)/apple/callback/page.tsx f328ceb139ed3b61c0e79bc671e93885a6c1e1b6b7c356febbc97f3255da2075
// input: apps/web/app/(auth)/callback/page.tsx 3d3cf195c8dcb8ec142e08a1d50b9016687a48c3503839f0db0dff7f9bbce67e
// input: apps/web/app/(auth)/forgot-password/page.tsx ebf3e4b50c09d9871131b9fbdc5cddb79c0f9c73bc5775c5ce56dd08a0fa2443
// input: apps/web/app/(auth)/google/callback/page.tsx cde1e4556035c25e575647a27a27b2d58eef2f65726a875747af87d31f0a9cba
// input: apps/web/app/(main)/a2a/page.tsx f4e49ffe7a1795abdf5306d3e7963abd6c4e48512611591d477d6363373db7d5
// input: apps/web/app/(main)/about/page.tsx 5afd0dd2943e9a1e6b3fa72f8209d79c8c58ba3625c13ba86808b4acfe3806b1
// input: apps/web/app/(main)/account-pool/page.tsx e6dae24a92485718792070e2f34eecf65fd71a26576b097621197b40fb632c77
// input: apps/web/app/(main)/activities/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/activities/page.tsx 47c04d04d667f2b1fae1b158949ee7c96b70cafffdadb3df8e09c616bddb5244
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
// input: apps/web/app/(main)/admin/ai-cost/page.tsx a116f85da14476756eb33be4fd16ace735ccf94e6a7377c08c07311fe9f06847
// input: apps/web/app/(main)/admin/ai-feed/page.tsx 0254d6d439e3d75bdee0dee31bde8ffe09b465b507ae6ee6c93a73e9fce2ba67
// input: apps/web/app/(main)/admin/ai-gc/page.tsx 0a421c2f7a2e2417334b66c29ac9882e109685d7f370be6ef676206299ae02ee
// input: apps/web/app/(main)/admin/ai-metrics/page.tsx 4b242efbe2d2fd309c43a2b5b00e4f2ae0ef97451dfc9ec8fa20825df0415526
// input: apps/web/app/(main)/admin/ai-models/page.tsx d040f6a5dbc4d6e109d1a85a81bf0f752ebb754daf7ee52712c1f50f5e6420a5
// input: apps/web/app/(main)/admin/ai-pricing/page.tsx 449d45ad21248ec02daba32e79d0659e19c067fdcb713de2ec33726e3ec7033f
// input: apps/web/app/(main)/admin/ai-skills/page.tsx f7ecefd78d6ced58516553afe7995db1a76223756e45934c7162dae96ce8a79c
// input: apps/web/app/(main)/admin/ai-world/sites/page.tsx 0af77c3deb73c30393cc4bb0a14d5547957661354d58a9d67a7ba9e884619487
// input: apps/web/app/(main)/admin/announcements/page.tsx 2a781c5700689d4069fc87a44a8f1193291570e25eff25ca202d5e64b7363570
// input: apps/web/app/(main)/admin/api-debug/page.tsx 9da5141c93e6e3634a2bb78fbbcda82b020a3ad5a2b4e0f6c3fd2c114c8c891a
// input: apps/web/app/(main)/admin/api-groups/page.tsx 206b23e4863e80811d6d2e4cc16cc1396eb8ae978b9f918e7b59abb180fcb805
// input: apps/web/app/(main)/admin/api-logs/page.tsx b85cd4a21156bfe629a7f1af409d6e7dfc38df8db2d7537b474e9b87c7bce600
// input: apps/web/app/(main)/admin/api-platform/apps/page.tsx 7b4be535b52d4622b1dbd84756abf3f955476725c5f80109b83ed699ec8cac51
// input: apps/web/app/(main)/admin/api-platform/billing/page.tsx 9ee9f9295b8ee01db611dc59051d8baa3f080a1da7f33dc2ef753d365302364f
// input: apps/web/app/(main)/admin/api-platform/packages/page.tsx 0cd150beecd1a23470b13d848ae6488694ac2202443bb18d8c914980f6b55b31
// input: apps/web/app/(main)/admin/api-platform/usage/page.tsx 48b8a72b9694145b37cb31b2a745cafdca2bb0adb94e837e12fad3eebf6ae611
// input: apps/web/app/(main)/admin/api-usage/page.tsx 864ca374469977ba615742be0a8a40527e709fcc66b9b24e7d273b0941ad7d8c
// input: apps/web/app/(main)/admin/articles/page.tsx 0058e2ad7e710739999c0f3bb4155158e482748393c7a6345cfa94b25386d5b9
// input: apps/web/app/(main)/admin/asks/page.tsx e7a3b003ae9e5e11bcdd654505beca0a03a6adb8ecac10b96808abcb49b20f9d
// input: apps/web/app/(main)/admin/auth-accounts/page.tsx cafad6ffb70767d4f03609cbb5d99ae768bd9de00373c99bd560aec9edf08ffa
// input: apps/web/app/(main)/admin/auth-dept/page.tsx 981e8b048a357fe59614c0c41ab6d99f42360bee83bc51f48d9ee5bf0830b054
// input: apps/web/app/(main)/admin/auth-find-info/page.tsx ecd3281706699a25ba944ad1cfe6d835c217785f9ba3a7df2e59fa3c8347ec21
// input: apps/web/app/(main)/admin/auth-role/page.tsx 58689c07de3002493780dad858c6a43d40fb01ef378cc21ea6d209373ea8adfd
// input: apps/web/app/(main)/admin/auth-user-vip/page.tsx 61e0c63b06bd9f31c8a4d5fc8aca72bcb55c4adb788136a4cf0017bdf44cfa90
// input: apps/web/app/(main)/admin/auth-veri-codes/page.tsx 00d4aef40013866a9dae40c418d5627fb41c527b01932005b2250e4695e470be
// input: apps/web/app/(main)/admin/backend-health/page.tsx f74047ee78e89c7fb20a916b6740401ce41b0c2e167152525575cc5da8348353
// input: apps/web/app/(main)/admin/backup-jobs/page.tsx a6c7a42167a74fe375bc7a8f73a81e3794ce6d1805c652f9b960ed35e3aa702f
// input: apps/web/app/(main)/admin/behavior-analytics/page.tsx abc8f9d72ff5f0d0aea4469e796fcc40fdf429848d0e85f592d6fa09e6477a41
// input: apps/web/app/(main)/admin/behavior/page.tsx d815d477b56149aa609b6de1e9ea72060075cb8f9e065d90b76a56ddd1e1170a
// input: apps/web/app/(main)/admin/bi-dashboard/page.tsx 99a02b2aeb2881a78a7ca7046843d74835432954e5731c632b83485019f2f3a1
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
// input: apps/web/app/(main)/admin/comment-logs/page.tsx eea003ae66b24adaaf56525cedace0af243dd38d78c794ffa2464972b5490b21
// input: apps/web/app/(main)/admin/comments/page.tsx 01b8c96a9e409307adb9ceeb151b4695b9d4f311fa830682416154d3678eb324
// input: apps/web/app/(main)/admin/configs/page.tsx f21c84244179c08e4e203577a37d78ef5c948904f522c177751edeede9a57708
// input: apps/web/app/(main)/admin/contact/page.tsx 1f3841404940e4a75a7b8df1a0063b5495d820aab5c40eff2ec7d90f94f91672
// input: apps/web/app/(main)/admin/crew/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/crew/page.tsx 3f3587a0a1c42b80c0ffc1750f031e5c3d56c26154417fc7199a6df2deea6cbf
// input: apps/web/app/(main)/admin/customer-service/page.tsx d50eed19e25470df94d2d05f9cdf7af72d283727195869a780b9303837e1ef50
// input: apps/web/app/(main)/admin/dashboard-stat/page.tsx e495a89e81b35450afd3886b31e9adfe4e1797ddd876a94158e4457121b69964
// input: apps/web/app/(main)/admin/database-optimization/page.tsx 6c94de84a4c6082f7a8ffa617dc0cbb955c1df6ff84a247696fb937546dd4326
// input: apps/web/app/(main)/admin/demand-audit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/demand-audit/page.tsx cc1ef70b768f504580c2df48fe807776dfe9322519a9a542becaadb54e214d7e
// input: apps/web/app/(main)/admin/demand-square/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/demand-square/page.tsx 62d74908f20891c7b5c247157206cd245cdfde3322b5f184b1f7ca396d396aa9
// input: apps/web/app/(main)/admin/deploy-diagnosis/page.tsx 5837afdd8e5504c93692fc578a8436d61ec0ec4919fc246bee5a035704a83b58
// input: apps/web/app/(main)/admin/developer-link/page.tsx 20b3d248e36ba33a4effe0ee1508cdf24f396acc55457edcf39d38e4277c6dc5
// input: apps/web/app/(main)/admin/developer/page.tsx e0e71857844a37eace323f1616763b5ca607dc77a1e1e16ce5cbb5c738898920
// input: apps/web/app/(main)/admin/dict/page.tsx 7e2cde3eee7d029913d35a04f905e76762f724cba566e4a451639f0ef0fd6545
// input: apps/web/app/(main)/admin/distribution/orders/page.tsx 33245dd731e85cb177b98ccc489079a4a7a496b6350cbcf861ec44514f2ebabf
// input: apps/web/app/(main)/admin/distribution/page.tsx 4f3ff5013a91b0326f6b4b2fef88622338a3fa381af33d055b5aa08920ca1c6c
// input: apps/web/app/(main)/admin/distribution/rules/page.tsx 0b78a7c8b8bd4c805f9411f8766958ad1ebda5134ddb3bcbc96b2fe4b41dca7a
// input: apps/web/app/(main)/admin/distribution/settlements/page.tsx 8d2311835610f16ec7ca730c8c65e7db0277a0c4c0f3cb3db310d23b586eb696
// input: apps/web/app/(main)/admin/distribution/withdrawals/page.tsx c3d5f2600e7189421b75c37c9e989be51142b6eb374fe32e53494142562a07ef
// input: apps/web/app/(main)/admin/docs/page.tsx b586d735dd7dcb438d6d516ad7dd73da5bb011b7816633903c7fcc65fc867d0a
// input: apps/web/app/(main)/admin/downloads/page.tsx 8819060090a817f13cc5f5a7dccc075694b0901af5f868996a1d0b7f943b0a05
// input: apps/web/app/(main)/admin/edu-settings/page.tsx 97cfdd6dd3a4b505b020d2c9cf8bf34f0c54df1ef4562afe39e6cbead346a183
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
// input: apps/web/app/(main)/admin/edu/finance/page.tsx eba4282dfce50b99afc3002ecc1393cbd0bdfbb7713134325fb2102c2c95c18b
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
// input: apps/web/app/(main)/admin/edu/learn/signup-batch/page.tsx e222b15339f3058b1fb3214b4b40104285501c1fde623b649a1c6ef63a45882e
// input: apps/web/app/(main)/admin/edu/learn/signup-batchlesson/page.tsx df88b035b43ccf4fe4986366949d533b9a509dd5d4f9911126c68af7a8db3a8e
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
// input: apps/web/app/(main)/admin/events/page.tsx af61b0b78b4e0be3844042aa0bd9fef79c358c858a270698a57e915472d57843
// input: apps/web/app/(main)/admin/exam-marking/page.tsx 1fdb5a1e78ccfce4a969495e5c401ccd94c6c59f66fd7a3a4c1b4ab5be118e92
// input: apps/web/app/(main)/admin/exam/categories/page.tsx 163ac24e26aa4dcefd23ba2fc6d7ede84c2e149524faf2e92a1e1cdcfdf3b36f
// input: apps/web/app/(main)/admin/exam/page.tsx c17fbde2106303907f3139a30fff39641a9ded4071e956b6cebeadbbdd16a104
// input: apps/web/app/(main)/admin/exam/questions/page.tsx 66edcb2907e55a9a47d1d60a878233400949c085414f803b81c61bf99098e66b
// input: apps/web/app/(main)/admin/exam/records/page.tsx 66edcb2907e55a9a47d1d60a878233400949c085414f803b81c61bf99098e66b
// input: apps/web/app/(main)/admin/exchange-rates/page.tsx 9cb5e61ffe2aeb3ab04b0d1f8030ecc967c29d811f87e655dbafde5b6deccf2c
// input: apps/web/app/(main)/admin/feedbacks/page.tsx 56da79722f9d609c8af1449c341238e5d79575cfbb64725e6acc1d28c1b916f1
// input: apps/web/app/(main)/admin/github-app/page.tsx 8f5826403a19c4debfc22e1d553b8e5ee6b8162fdb4bba851b184a2c848e4bd1
// input: apps/web/app/(main)/admin/gray-release/page.tsx 6958b20cf23e6f4ac370c8b15f50dc81e91e23d401d0be533ff70018b25a2684
// input: apps/web/app/(main)/admin/help/page.tsx eff70194426b19eee76958dfac04d6a1444f2220736d73164af54a4bd1f20eec
// input: apps/web/app/(main)/admin/home-schema/page.tsx 7437d156bebfc8651b725988cccf4fd69e1ad683f99335a7d359f3f26bc629bd
// input: apps/web/app/(main)/admin/i18n-dashboard/compare/page.tsx 1bdf0d4e0d2bfc4969d91b8ecad6e2109ceb4dc3b1b9d77e1e9c4b92fb6d40ca
// input: apps/web/app/(main)/admin/i18n-dashboard/missing/page.tsx ab0fee35316e5cd371bb9ea7331ab85b22d67abab39edf7574b06257252a4423
// input: apps/web/app/(main)/admin/i18n-dashboard/page.tsx 5d246684ed3c4bc549f8e1cf181a5f3ae8c83e35e0075381f6b7c71ef67d6344
// input: apps/web/app/(main)/admin/identity-proportion/page.tsx 068b77325a5cbead9ef3e29f414e15fee26bd0ca780f8739a0a1a430c4d2eda5
// input: apps/web/app/(main)/admin/im-channels/page.tsx 186fbc488dcad0bab1a1ad4b7c7ea52355a0dc43c16e5089c65ac6058a17f467
// input: apps/web/app/(main)/admin/integrations/page.tsx 1310972c2dfc51b7706ac6006cc2dc11c59c525a63a7664effeb891664f0ce48
// input: apps/web/app/(main)/admin/invoices/applications/page.tsx 409d3ce4869decba3de302531625b841b52e2e24d6004c98241cad2a8928b311
// input: apps/web/app/(main)/admin/invoices/page.tsx 0b77dc0f15772eb9186a77c48b99567863f4901d837af148dfdfff57364cafca
// input: apps/web/app/(main)/admin/invoices/titles/page.tsx 063ea99bdd2372e45bc096b7baf60c977d4ab868c129a7c509029a42a5c3c04d
// input: apps/web/app/(main)/admin/knowledge-rag/page.tsx 081c558408c336acd0aab97be10fc7244db0603c9d1c3a50d6e1201b5134d9d0
// input: apps/web/app/(main)/admin/learn/categories/page.tsx ee11b7e3e23068a368f6ef5568737b2840723570f68922d2ef656b544d610495
// input: apps/web/app/(main)/admin/learn/chapters/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/learn/page.tsx 701818f754e8ca93bcbe9f58052a2f7b047e00430e624188494015b56e262c31
// input: apps/web/app/(main)/admin/learn/signups/page.tsx fbf6b75fb274e92250d8eae7583fcaadc116dc9ae289e852f60cf9f573068b3b
// input: apps/web/app/(main)/admin/learn/topic/category/page.tsx 44b94a347a1973f38504248e811c400258ee4c7043b2784d38c26e81a2714c05
// input: apps/web/app/(main)/admin/live/categories/page.tsx 5cfabc41ca2033c4530d20f54044ff3c820c2004d6739e7c56a79df349ed0393
// input: apps/web/app/(main)/admin/live/lecturers/page.tsx 24f6748e1290ea996a7b8087623905e61b3dc9fcc702b9cccbf7a0c61116c2eb
// input: apps/web/app/(main)/admin/live/page.tsx 85961c5c9591c9a1f2bd2833b9981e7a12bbc0a5fbfd589f11ad715a8ec7a3da
// input: apps/web/app/(main)/admin/login-logs/page.tsx 83cd501f61baf887a8efb60b51daa8ed8a516cf742357681c28973c9df4d4434
// input: apps/web/app/(main)/admin/logs/page.tsx ab9f6206958ecae13068871646005b8d1033b382903fcecb188c953fe2c8d52d
// input: apps/web/app/(main)/admin/lottery/page.tsx 2d56ce694eb51b2969608bf5f64d362ca979165764ff492b789129e76e0858b9
// input: apps/web/app/(main)/admin/member-groups/page.tsx 4b3ce36558c0c07df7e4c01eafa34a52219ebb77020e33dfbcdc521d1c7b9ac1
// input: apps/web/app/(main)/admin/member/blacklist/page.tsx 20c1d0465de358ebb2143f7df3ad358c6b63cee87f9eb25eb512e9498c7c1d8f
// input: apps/web/app/(main)/admin/member/companies/page.tsx 89e1ffb7dade68c261806c5b3c67192d7e76f141f9078a907a5e1461c67625b5
// input: apps/web/app/(main)/admin/member/company-types/page.tsx 31cabdfd12fd5c586fd57713019987e1d56344e8f4c90f7ec2b891401710206d
// input: apps/web/app/(main)/admin/member/departments/page.tsx eae9b056ad3b176b361823f8371f18b44e20a05c81a22739b9c2fa0813a0f344
// input: apps/web/app/(main)/admin/member/logs/page.tsx c6e57b4c24f08f041febee82f1483212fd48781d7905cc60deea93fd11b49841
// input: apps/web/app/(main)/admin/member/permissions/page.tsx 5c0ebf1489c877380e349365dc83f7c6253358dcdd9fcbaf0e2c39dc7188e3be
// input: apps/web/app/(main)/admin/member/roles/page.tsx 0994054f2ac86376504334d58293eb32255a4f193b12b12acd280febc1bf5572
// input: apps/web/app/(main)/admin/member/unaudited/page.tsx e2c1de981dd9f33419bcdcda818b36ed01e25c776754b9ab8c6efc8b6266d4de
// input: apps/web/app/(main)/admin/member/users/page.tsx f0ebee09c80f3ef371182f1c739bba20b1eda1b544cb815f1fc5aaf30a10f522
// input: apps/web/app/(main)/admin/members/levels/page.tsx e506dc5d008fc9aecfe59386f37c7cf2ef450989973b6f4da0f3a073dfa76362
// input: apps/web/app/(main)/admin/members/page.tsx 46269e89f869bf480359dd43520e3043a0168bc37aa0866322a15dd9b4e718d7
// input: apps/web/app/(main)/admin/menu-permission/page.tsx 3ba55691bca785ff724a51ed76066e48347249700560d949fd55a82256c04e0b
// input: apps/web/app/(main)/admin/menu/page.tsx 1c80bef4cf838bf2a7e8d9e8ddd4fa7d4821f6959fb89af2acfd6674821b8b69
// input: apps/web/app/(main)/admin/message-overview/page.tsx 37a8533bf4d12ef87ca5014bad64afbeab0626bf7820bf744bf9beb5e032856e
// input: apps/web/app/(main)/admin/message-templates/page.tsx a96dd0b049a43b162e0675ae722689e54b78bc60d06c8d629ec7120edbc40c5d
// input: apps/web/app/(main)/admin/meta-learner/page.tsx e851fae92c397fa177c751ab222381c5802052ffcffef465dd78813b16f4efcd
// input: apps/web/app/(main)/admin/mobile-adapter/page.tsx 1ecdd2eb82de1867e2f77049b9969ca4cc39df480c824aed0d42cec90bac7c43
// input: apps/web/app/(main)/admin/model-pricing/page.tsx 25cc30cf26d4ccd3e344103e38948eb2f741a4c0f587bbd4f7a6bf09305e6863
// input: apps/web/app/(main)/admin/monitor/alerts/page.tsx 01dc62eac2dedfc48de756e56f869baaeb1f964f620f4dd886a1af353aba742f
// input: apps/web/app/(main)/admin/monitor/dashboard/page.tsx a3ff7e8790dbbad4bb5c6bd83bac609526193c0973f2a02f9bce51a0f40c3480
// input: apps/web/app/(main)/admin/monitor/funnel/page.tsx 1adc5fd6bc5a2b70809fe4879a6f07fae5e46546d49cb12ff3138419d2715b78
// input: apps/web/app/(main)/admin/monitor/panels/page.tsx 78dee2b618a5367727dba150e37770fee93facbeae4a9ed05a387f87f0a57c01
// input: apps/web/app/(main)/admin/monitor/wallboard/page.tsx 81794482f527d0bcb2b884178f998a4e925ec24383540dbc4e7908372c390b90
// input: apps/web/app/(main)/admin/monitoring-dashboard/page.tsx 91ac016c4e35ef2fece61b47e45fb15a5da23f37210a465f36c5e48c316ce852
// input: apps/web/app/(main)/admin/news/categories/page.tsx df7652a304de4fe78c8db64324358b0ae2d622a8f119708be839ab8df9c17e5d
// input: apps/web/app/(main)/admin/news/page.tsx 7d0127c4117f7c5168bc51fc4164aa98f9a249f01e700fbe4c7670f9bc5b9854
// input: apps/web/app/(main)/admin/notification-channels/page.tsx e98b9b4db7e6f4e718961c4654956d600c2ae7fdf77e56e35ef445d8a2865090
// input: apps/web/app/(main)/admin/notification-dispatch/page.tsx a15048121de8a402fda493a17744a2aacdf7540c9029835bbd9eb2d14fe516fc
// input: apps/web/app/(main)/admin/notification-logs/page.tsx 216a694ba83071e5cbc0af9c5d32c184e1e25e0c20d7ffd086cddc16eab03b33
// input: apps/web/app/(main)/admin/notification-preferences/page.tsx bc80f1b9242b89749b74e31520c868d26b7750c3926a0794f37dbdfd5a192201
// input: apps/web/app/(main)/admin/oauth-apps/page.tsx 972060269ac7af5912a465022ae3446de8525d1878bfbb9d58c3ad9d48fb7361
// input: apps/web/app/(main)/admin/oauth-audit-dashboard/page.tsx 73c35b66c244a0ebca03e9d8f7ef6faf682356f9a3d6ea3bcc0b561b736ecbed
// input: apps/web/app/(main)/admin/oauth/apps/page.tsx fc521ff8e7f3bc5ac6de89463059719d462c5967f8239ca69c8f0f087d037693
// input: apps/web/app/(main)/admin/oauth/audit/page.tsx 53c6ed33d28e9abc6b1d81c8bb39e2d5d27dd673c2bccad0cae7ea4e346c3eeb
// input: apps/web/app/(main)/admin/oauth/tokens/page.tsx 061737bae7f6cebdb5f37b9366cd93acc355afbabd5d31f012da6b16a6012798
// input: apps/web/app/(main)/admin/online-users/page.tsx 8aa7823b2df39d02588350f5e5bf3f673cad255ec5de5ff50397e99d5d47173a
// input: apps/web/app/(main)/admin/operlog/page.tsx e1e1a0837b9581914aeeae63da4c8af3b2714a7f2359d1633f022e73ebb867a8
// input: apps/web/app/(main)/admin/orders/page.tsx 2a3ebca2eaf05134f4236f64f8478071bdd7e7df008e9a5f121aefdd8669649a
// input: apps/web/app/(main)/admin/oss-config/page.tsx 625b3c1ee16962c3a347a1c865523c8367b86f1108bea0d1df0b7721d4596dac
// input: apps/web/app/(main)/admin/oss/files/page.tsx 968510b8b64d910f842848d295b387b63b422184f6710a2121dfa869d912be33
// input: apps/web/app/(main)/admin/oss/page.tsx a4099f971b9efa8efaa2c82c23e715d7200839cd1ab4ac59335a3e09d1841011
// input: apps/web/app/(main)/admin/page.tsx 2253e63232dbadf74677193db857d458e5916dbfce160c8a08e79ccef2a98d93
// input: apps/web/app/(main)/admin/performance-dashboard/page.tsx 4cf7d2391e8b585f604adc1208d449566ba02236f9407808d14e6a340d2b138a
// input: apps/web/app/(main)/admin/permissions/page.tsx c9a5638cb1002713a446d5884c551c0cba798e0921aa10e1595663280eff4a16
// input: apps/web/app/(main)/admin/plugins-stats/page.tsx 8b07070cd42eab7a77f9fa39cbdfa5689ce4bfa1e0072b39af65939cb5dd407c
// input: apps/web/app/(main)/admin/point/page.tsx bd0239205c46e441b978d37d32aba94700c235e2ef1c8974452004c858270ee8
// input: apps/web/app/(main)/admin/point/records/page.tsx 9a60e4455fc29c4e7c883dca423fa0e0be8766d900a4a0cc61168152a098eec5
// input: apps/web/app/(main)/admin/point/rules/page.tsx dc9ae764dd1b5514749940dea04876838c91df9b8d11937f877cfea9959b24fc
// input: apps/web/app/(main)/admin/points-mall/page.tsx c5ac749fadeabdb3ed3ab194c14b40e4fa96711179ff6943e0f4ddc5147fa52a
// input: apps/web/app/(main)/admin/post/page.tsx 03b4367e69222a8e1376d974e43b467018289f1cd41ff78abedf5527709cc1fd
// input: apps/web/app/(main)/admin/private-letters/page.tsx da4ef4aab25e459bae8f872145665e5c1716384e4d469f4f8be02e24fae56ec4
// input: apps/web/app/(main)/admin/product-identity/page.tsx 90e707dbac00d23c589463cf5eed4497d5f2c4f6122960c3f0e49f9d1a3ad29c
// input: apps/web/app/(main)/admin/projects/page.tsx 8961d34b8a9224a4279e5205a33caba32f144b2fcb029397a883632ef6e3e0c8
// input: apps/web/app/(main)/admin/promotion-rule/page.tsx c893d26c3b06db6ec265d3e314bd7273e95150c9f3372ce341c1c99641c7abe6
// input: apps/web/app/(main)/admin/providers-health/page.tsx 90b85b077649fd374f15e048a2800491ead74f99a856da639cb172cbd01f75d5
// input: apps/web/app/(main)/admin/realname-audit/page.tsx aa463ae68890cf65570d0f145ed94deea44d99f857c973d867275bf79bb92e5b
// input: apps/web/app/(main)/admin/recommendation-config/page.tsx bff5b3265cacd6c2c5b3144707cc35ebe80fa7adf64c3bffa9365c064277a5ab
// input: apps/web/app/(main)/admin/redis-monitor/page.tsx 58042aac5969aa0a373dce251befe7c249e373c927d9c293b270cbbc5a157c04
// input: apps/web/app/(main)/admin/refund/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/refund/page.tsx a88b2ceb20ccce16959ac58c55ba249296ed681c5481ad03e4f1e463ecdc3d50
// input: apps/web/app/(main)/admin/relay-param-ops/page.tsx eec9fe4164facc66cce530f01bd6abfa49b667b64a28a6788ecd15662323bd82
// input: apps/web/app/(main)/admin/relay/account-pool/page.tsx 8af1eb2f17ca0ec1e73102748014de60393802c67c53bbe89116a2f9341ae2e7
// input: apps/web/app/(main)/admin/relay/alert-rules/page.tsx fabfbb96d5db4e2eb4f8c630890e0511ad467e1c5572f02ba08dc150f7bd3785
// input: apps/web/app/(main)/admin/relay/capacity/page.tsx e764a1fd7100863cdad16da8a5011b5951ca304f6eb4fb5735296e70e1263060
// input: apps/web/app/(main)/admin/relay/channels/page.tsx ee2621001ff5858411a40cc5c8d71dc36aece49b8278adb7947d53e8d860ca3e
// input: apps/web/app/(main)/admin/relay/data-management/page.tsx 9eba9267ef4d4f8053e57254e7f1f0490e885c4366edb45cba9e996ff91ebf46
// input: apps/web/app/(main)/admin/relay/discovery/page.tsx d3aa41665db9583e8b3227d4800cbbbe48b93f90865bafa0abd5b42d49de4b2c
// input: apps/web/app/(main)/admin/relay/enterprise/page.tsx 6dfea213b1b3335e471dbc9bfe48b3540e0ae19b30f8c96bdafb527d6cc6f491
// input: apps/web/app/(main)/admin/relay/error-rules/page.tsx 43d14860fa5c1ed8bf049ccc1e226021f9084955efe0abe40ebd114a0cc68f5c
// input: apps/web/app/(main)/admin/relay/insights/page.tsx 61ddece98567eb326813abbad1dbcaaba89c1674bfa99dcd036d82ca62563dfd
// input: apps/web/app/(main)/admin/relay/key-pool/page.tsx b0d543dfc47afecbf83d782b7762464efc8eb4fccbede0dcaccf0f2c5ba943c1
// input: apps/web/app/(main)/admin/relay/key-scheduling/page.tsx 3de0eca139a494b5fd106d8a83b4707f35cfd2503d97359371cc000c65b6ba29
// input: apps/web/app/(main)/admin/relay/logs/page.tsx 61d35eeeab2acb7e0b0c689c03d8415054fe0674e9124f5f7041d839b075a192
// input: apps/web/app/(main)/admin/relay/models/page.tsx 04c26b367bd57c0c036a4ad3d0f118276bbd6cb116af2a60f887b0b44a5aeeef
// input: apps/web/app/(main)/admin/relay/overview/page.tsx 453f04dadeb0c49386215d6be5fba3144f8567c0269f5bce10876ca1311899e7
// input: apps/web/app/(main)/admin/relay/page.tsx 16a6441584e28e0c12e371ef572fc091d21e5585dabcd4ef760d00d78a37e8c0
// input: apps/web/app/(main)/admin/relay/peak-pricing/page.tsx 1bf9ff2a6fa41c8f2172ede3a6e889d2d5c36073e289a4ab94e0c5cb716b8f13
// input: apps/web/app/(main)/admin/relay/plugins/page.tsx f2c489e7a2fce2f01b53cc7a2273014b1efcd4f14f16b0e68303b6b43381632d
// input: apps/web/app/(main)/admin/relay/prompt-audit/page.tsx 0af7f0dec90485cd9814af6abd713afbca8320d24b5f3a046b86f941588063c8
// input: apps/web/app/(main)/admin/relay/user-attributes/page.tsx 43d93470aee50ec7618ccfd39a5b76436f8a017b70b9069f015659273e464f7a
// input: apps/web/app/(main)/admin/resource-product/page.tsx 3e3f0fe50d3afc39991e7ca530634c996ca8496f42f7bca8b2608491b0027051
// input: apps/web/app/(main)/admin/resource-tag/page.tsx 8713454be6610b3a9775d40217b653c2ee840d518a7251a0780065b258ef2b45
// input: apps/web/app/(main)/admin/resources/categories/page.tsx dd8fb351a828f46f7f7415480cb9232a041adeb2d23eff954da93ed7f89ec258
// input: apps/web/app/(main)/admin/resources/page.tsx 813c0b98122e8316c8174bd03b0ad9f33196ea75a9aab99bd2480a18e865437f
// input: apps/web/app/(main)/admin/resources/product-categories/page.tsx bbfd19465cad1e507ef6fc882ec98bfc10d7c0c2c1d6c075ff54d4e79f334f63
// input: apps/web/app/(main)/admin/resources/products/page.tsx d0d3dd605b34a2d6ce324a3266d1390b1edc91cee089d1a09279986180f90825
// input: apps/web/app/(main)/admin/resources/tags/page.tsx 47c649f27618a8e111d75c9b4841ed30d244434df55739a57d08a1bcc99acb84
// input: apps/web/app/(main)/admin/revenue-stat/page.tsx 035db306fef7f84c9f849884b4d0d71086d70443744c23e7df45e258ba4ba01f
// input: apps/web/app/(main)/admin/roles/auth-user/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/roles/page.tsx 1a8f31aeed9dc6c739be3f5e3f115efa4507002646fac94da1c6f57ff2fb68b7
// input: apps/web/app/(main)/admin/roles/select-user/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/saas/[slug]/backups/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/admin/saas/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/admin/saas/certificates/page.tsx 36022730143ead334e3e296f99b46a76cd758afd5a2f9ea87751584f30b3f99a
// input: apps/web/app/(main)/admin/saas/metrics/page.tsx 5309ad7e8481b33d427c9c224720daad7a0bfe07b0bed911d7a6934aaaff1515
// input: apps/web/app/(main)/admin/saas/page.tsx e51dd6f9afd8e675015eba0e36bc822b38cf2564ce75181a310a33fff3e7e857
// input: apps/web/app/(main)/admin/schedule/logs/page.tsx ceff5f7dd2aa30be28fcc557d1ac6fb382a2b8bdf6e0eb724c7aa0b02b24bb4d
// input: apps/web/app/(main)/admin/schedule/page.tsx 9fbdee31515beabccf943a5f5ad2a87520050b92deff8910a463231a6b5ccb15
// input: apps/web/app/(main)/admin/search-hot-words/page.tsx 3bfe5e29c8392d308c6b63748b2adaa22f80d66d1cc78e9378e0ee43d9113cd4
// input: apps/web/app/(main)/admin/security/anomalies/page.tsx e7cacdbf7d26c307406f571f8b980f802e6b801bc85aa686a2633458b3034cae
// input: apps/web/app/(main)/admin/security/ip-reputation/page.tsx 26e71d56af43399ef833a80851c42e777a687d0b41edcb058380e79a0045fcf6
// input: apps/web/app/(main)/admin/security/threat-dashboard/page.tsx ed3e87b83c899e32364c9e40af08222ebc96d898c27ed81628d926c0cbfa8e4f
// input: apps/web/app/(main)/admin/sensitive-word/page.tsx 0d15dcaffc998f506a0cefac114247e070ea7ba3af4b5df71925b0e7b2b5f33b
// input: apps/web/app/(main)/admin/sensitive-words/page.tsx 0070ce5a0dd4d5537dd27d1b3c1e1feae68d38a87ad3a116f7b1aa4d43d29ec9
// input: apps/web/app/(main)/admin/shop/funds/page.tsx 16e6066e61c9fb6482fb853ef75ce8d26a9c4b23bb37c571df834fc634c26372
// input: apps/web/app/(main)/admin/shop/payments/page.tsx 8dce190dcb8edf26c5c19ed9b21233c6604cd054bccd94d8cb9db79033eebf22
// input: apps/web/app/(main)/admin/shop/products/page.tsx 2c4fbbe523c3b390e6b707c841e0f3c89e6b0515446c8aee292f408bd61e755e
// input: apps/web/app/(main)/admin/shop/withdrawals/page.tsx 68d35c3456954e82efbd20a8d603f4d8eb5bac3a087c82e6b969ca9bae03c4cb
// input: apps/web/app/(main)/admin/signin-rule/page.tsx e5031203d54a27bca7833422ea4cb7ab201a71326d06f0a5eedf1a082c50bb29
// input: apps/web/app/(main)/admin/skill-batch/page.tsx 2f75906c0ec8e004fd1d1ef0f1d7fc13318e80e0605365f3a9e8f7e8d494b95d
// input: apps/web/app/(main)/admin/skill-categories/page.tsx 33419ea0a873857fbb7067fed6d37b009d53ffe523135287b90f366147b21f6e
// input: apps/web/app/(main)/admin/skill-stats/page.tsx 991e25cff285e901c0c8bbabb82af26832e6570b578daf67686f407f320d8c51
// input: apps/web/app/(main)/admin/skill-versions/page.tsx c493386851d7f28c74a1fd134874040d25215fa6937f8f2b86d4c7ec7297b538
// input: apps/web/app/(main)/admin/skills/page.tsx 430306a7968473f7ec0b93764700de97b39ae472d93971813ed2b8d880f3f8e2
// input: apps/web/app/(main)/admin/sms-receive/page.tsx e0cd3fae2a950040d6dc0ce1ed3384f0a38b8917ae68dd48d6091628cc063aec
// input: apps/web/app/(main)/admin/sms/page.tsx ff30a4a5b8afec377a29408fa94a0762359ce539e85f4fe004e2202fbcd60e29
// input: apps/web/app/(main)/admin/statistics/page.tsx 898fca9b97d952ff402eee5071f4c0b343e5689de461991ca0c51b2ab2a48c76
// input: apps/web/app/(main)/admin/system/login-logs/page.tsx 8232466920411a110c810e97acfdd0ac75d618ce782f690ded404032bc698964
// input: apps/web/app/(main)/admin/system/monitor/page.tsx 283edad5aa7cc4ca99fbf7953406c8368d89f63a159b1dc39443bf97474a8105
// input: apps/web/app/(main)/admin/system/operation-logs/page.tsx b06566d9668dbc64a0efd5fd5d60c9a80cd5a04dcfb57e5717293f8e217e2d25
// input: apps/web/app/(main)/admin/system/tasks/log/page.tsx fbfa0937c856ae6e8123740406dd4b5286da64cf92e9ac69c5652d0b562f044e
// input: apps/web/app/(main)/admin/system/tasks/page.tsx 1f2c410a8a4287a0c11d91d5b2dc44aa6734e94a9a5a7e32c0f2c069f8695899
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
// input: apps/web/app/(main)/admin/user-agent-context/page.tsx cc8dc3f0129074d67aa390e1720bf124e43850a7013571340e4510826f7ccd90
// input: apps/web/app/(main)/admin/user-agent-image/page.tsx c27b92a56d718b6736aded255947277e1756758e65b2a7a05719f0683a3e878e
// input: apps/web/app/(main)/admin/user-center/page.tsx 0b501a4c395d4abb2cccc4437944e5b323dcc4f5333421c84f1c637376d4bea9
// input: apps/web/app/(main)/admin/user-margin/page.tsx b03ce43390424496b763eb69a821b0afcd3be7a0d606cda2a5aa2586a483ac80
// input: apps/web/app/(main)/admin/user-stat/page.tsx e03b94cc20ba7b5fa7a02e90665d490959df397b75bd6436aa24731797b0ce65
// input: apps/web/app/(main)/admin/users/page.tsx b56741efbad48ac8b0ab17b50fca5084190d82cf4c908a4002b862f538323be3
// input: apps/web/app/(main)/admin/variables/page.tsx 5b7984cdbb2b5cf26a38909f39ee4b5ad6bfadcf355a2d3c60a92b7781173dbb
// input: apps/web/app/(main)/admin/video-logs/page.tsx 5152ffc1d6a8d6fc1b144fa5ef7b3d5474e4011793c2db7a327518ab8291d748
// input: apps/web/app/(main)/admin/visit-tracking/page.tsx 7b5eca7f564d6752b34fb78ab0699070677d74a1426289461f4d2ae9cbaadc1c
// input: apps/web/app/(main)/admin/visit-trend/page.tsx 489241d5c372cfff542ea832afaa36b95fd998fecc9163c2bb1e2f030fa0c01d
// input: apps/web/app/(main)/admin/wallet/page.tsx 78ad624d2200933c17d122539c25ab9f5d2d666d9e6f77bfdb33ad0bb40d5d9d
// input: apps/web/app/(main)/admin/withdrawal/page.tsx 7d83a7267c486252693e5f7d9f33ee628d5548703e553cb220faa72c33ef582b
// input: apps/web/app/(main)/admin/workflows/page.tsx c6bf295bb43d4076341a37b109bdd1c63e1c40eeffe0118d791d4a7c1c4bd8f5
// input: apps/web/app/(main)/admin/zhs-activity/page.tsx 5be84abca8364aec50d3907ec4104181559beb5fb644fcb3df458af8932c5461
// input: apps/web/app/(main)/admin/zhs-agent/page.tsx 3be8bf47ad25765d52ab5f9ca9c3001d81d6f947db8fe3c45ba2a47cc35c4fd0
// input: apps/web/app/(main)/admin/zhs-user/page.tsx 43c119f499014e3fd7cbdb1ebeb3c330a74203e5533a3e9bceba09e5d5734765
// input: apps/web/app/(main)/agent-canvas/page.tsx 1b33f7ec304881b404c28d68d8c69b41e41d60d3866828ff2c9c2fbe7decb232
// input: apps/web/app/(main)/agent-kanban/page.tsx 407708aa64c2e3312a29b075597f5186a32517d3c250659b2a5c20e08839af12
// input: apps/web/app/(main)/agent-plan/page.tsx b9bfb43736fa7955ec0aef8ff68c5bf1122fd3eedbe520f3e5adac1361974473
// input: apps/web/app/(main)/agent-plan/progress/page.tsx d46b6d6d6c7263934c99a36b077f4044d6e7ff849675d726fec05acee4050bb6
// input: apps/web/app/(main)/agent-runtime/page.tsx 42166308a2a4d1989ea8eebc20d99238385ef4d9bdcd2c88610ddd8dda3acac2
// input: apps/web/app/(main)/agent-step-recorder/page.tsx 45ebd017cbf5d281ec5dd63034dc7b83ce852539533e48c74f04489390664e4b
// input: apps/web/app/(main)/agent-teams/page.tsx 31187390c8a6379974a3261bbc8be4562afae6ddfa44b3c5e4204d1cdf15bf9d
// input: apps/web/app/(main)/agent-timeline/page.tsx 6c7eb1a23483b1505faf2ad002f2631ab28e129494e5b3b63f83b5704d8bf75d
// input: apps/web/app/(main)/agent-workbench/page.tsx 1ff81c8bf8483e9ba640934aafced9f4169da527e6779a8eaedaf9d9804f86d0
// input: apps/web/app/(main)/agents/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/agents/categories/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/agents/categories/page.tsx bebe1863d32c5aa4ad7d53c4c169dc31310e4b9de2d55634224b2899045e6745
// input: apps/web/app/(main)/agents/create/page.tsx 68119a8ed6864dfe3b64a9e7d695de41227790286895d244bd10da5f24aac1ef
// input: apps/web/app/(main)/agents/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/agents/featured/page.tsx 7fa0c24ff6ba609bb0c6b3922ad7b0a35833cdfe669f203ecb04847f86af5b15
// input: apps/web/app/(main)/agents/my/page.tsx ef99eb8f7e9952730194e9e3d3df5be73014d4dff711e119b1d2c6345cf8b7a3
// input: apps/web/app/(main)/agents/page.tsx 71db76f2fd7ae1d5c358cf3173ed1e935bc114b29e500a3212422f7c7290e9bb
// input: apps/web/app/(main)/agents/stats/page.tsx aa04cd345f2baa25e3d3bd9bcd59b03cb24f4a7e0cd6dcdef8a24f1af00f16f3
// input: apps/web/app/(main)/agreement/[type]/page.tsx 2fdfa2b9b1de35ab72faab4733c4743b37f0845e976b32661cfc06d5e85159db
// input: apps/web/app/(main)/agreement/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/ai-career/page.tsx 1c89910a8b3dc9b409ebd96886e752eae4c31da606a7642cb1da69577766efca
// input: apps/web/app/(main)/ai-generation/page.tsx a910eeb39c53b9c6c3280ba8cda7662d1d9814e8b7541e57754142faa28a2dbd
// input: apps/web/app/(main)/ai-generation/video-tasks/page.tsx 57e4ac3c62b236d3e491947d673d17f939509388ab095c5c76007b1c3ee47b28
// input: apps/web/app/(main)/ai-news/page.tsx c9d13918b45feff87376005332735215d78d980e7a9da40d1690efcfbffe9ec7
// input: apps/web/app/(main)/ai-skills/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/ai-skills/page.tsx 84e608aed20bceae83d3bd6e3a54da8967657bff065bf6a4091fe87692ec8e7b
// input: apps/web/app/(main)/ai-world/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/ai-world/create/page.tsx a9314649ed2e5008f04429883a059d7eead8568dcf13f09dc673bf1460137a74
// input: apps/web/app/(main)/ai-world/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/ai-world/favorites/page.tsx 7ebd0ccc25f33439ede5b8730182dfee7271b68d746b333df9dfd053270d4cc3
// input: apps/web/app/(main)/ai-world/history/page.tsx c4bf896f31916bda4ae15bb61ad856cd8a213d6e2b134945ea2e1cfa4237abd6
// input: apps/web/app/(main)/ai-world/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/ai-world/share/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/announcements/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/announcements/page.tsx afe66ea6e9bbbb598cbde675dd679390bfb67582ee34755f7d44bba9a724b069
// input: apps/web/app/(main)/api-test/page.tsx 8a511e7fcaa1610b369b4032a7bb22e9b45b62c33bca45689eae2243f98189ba
// input: apps/web/app/(main)/app-permissions/page.tsx 5016d3200c07b40d6fe01ac3808d8e0592491e5f5da38d913d658a114a99a573
// input: apps/web/app/(main)/article/page.tsx 3be8cc21f72dd604fb3eb6600b920077394f24997281f4444f6ea429ac8dd74d
// input: apps/web/app/(main)/articles/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/articles/edit/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/articles/hot/page.tsx c1a29f146eebf20715e720d0e5bde9c8db468f796f5b36c8a5c0ed3d80ae136c
// input: apps/web/app/(main)/articles/page.tsx 52d3c0a836d8d55f4d8b477063d55401313cb0179528af9e69ec973da97b3d4b
// input: apps/web/app/(main)/ask/page.tsx 78a7b752303eaca2fbdc8d28229eb7f3def29c9cf10b8c15119d06d5d05301d2
// input: apps/web/app/(main)/asks/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/asks/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/asks/edit/page.tsx 1bfcf3cdca785cba1065fc4422223172d274b0784c260844a007956cdf40e13d
// input: apps/web/app/(main)/asks/page.tsx 1c9d4df95e8354dcdf2f044b7affadeb88f2e50f921659683becb115f155cee1
// input: apps/web/app/(main)/automations/page.tsx a05df43cd7bb048bdee10e5a74556bc561ef737c314039f7977d9db3411054e8
// input: apps/web/app/(main)/available-channels/page.tsx d0f2f3006c18ddbf8bf97b97786b224e4c3135e7f33d9642a33df88d92c92eae
// input: apps/web/app/(main)/bi-dashboard/page.tsx b41abfcaf529a78a016a261447cac60eb3e5b38fa4d5f1f4c41826b395c2a7f6
// input: apps/web/app/(main)/blog/[slug]/page.tsx b698057b460a3f264054824e2a58c523caf7ba840073351296b66bbbf0bee21a
// input: apps/web/app/(main)/blog/page.tsx 6d321f3ecc8b875053b770e47294d00d96ae27f077fc9e70af3fab765ef0324d
// input: apps/web/app/(main)/business-card/edit/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/business-card/favorites/page.tsx 9703d6e903fcf6ec6883eca607e865393cf40c4fdf2d69e401b74d68d5f0cfbd
// input: apps/web/app/(main)/business-card/page.tsx 298b751f19aefa82622445c47666284356b94df45940c74961a2a8e25f3b2575
// input: apps/web/app/(main)/business-card/share/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/business-license/page.tsx 44349580b71ee4ca4050496bdbf07ce1ffe51bdfd984ea57c829c423f0507c05
// input: apps/web/app/(main)/capability-market/page.tsx 9e89193db363da5deaf464c9761bc0492a1b267424452762a75f8d6ec65df25a
// input: apps/web/app/(main)/carte/page.tsx 5718f2c73c6abd28989cfc70e0a44cb190726861a62355f89bd6423bc8601236
// input: apps/web/app/(main)/certificate/[id]/page.tsx 5dcc5b5105320a0545f6b5cee21fa59b7e585f99d35b43760a431322aff0dae0
// input: apps/web/app/(main)/certificate/download/page.tsx e8c75c87f8f8957b179d9900c328824b094870c1ef02e32316d8390912bc44b1
// input: apps/web/app/(main)/certificate/page.tsx 3e6b9961ae96c8315007d9aa35fe4dc023e4c8461ae154d3b864e09a57643c00
// input: apps/web/app/(main)/certificate/verify/page.tsx 7ec8807178bba48c908101ce1b9156c0a07a4ebb9e52cc480890fb6af0c926c9
// input: apps/web/app/(main)/channel-status/page.tsx cd96a600eeba925827c9f73793fb4458e3585216ee01365efaf23e47378b5319
// input: apps/web/app/(main)/chat/favorites/page.tsx be5908fe3362784f9875de188bb7dc18c62af8990117eca418a1e5ba6ad69933
// input: apps/web/app/(main)/chat/history/page.tsx 25ed71aa398e4b8551d47edf661e353cd24e464bf8258bf4aabf16c06ed2d15a
// input: apps/web/app/(main)/chat/page.tsx cdd7abdac1010445b1b56a45313441eed2130c6af2a061ff43c6e12f850096f7
// input: apps/web/app/(main)/chat/settings/page.tsx 67d6c95fb2ac59cb7d2b01988a06c726698c226eef592a5fd189be4addd48b18
// input: apps/web/app/(main)/chat/share/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/chat/templates/page.tsx 39e208297dfffae123ddc54deaeb8bce5429862cf0d9b15ffb21ef8b2bd7e246
// input: apps/web/app/(main)/checkin/page.tsx fba931325b2179fabd10c97a5f9f9663aa3b48c87e5f878a3b55c65f5cd7e975
// input: apps/web/app/(main)/circles/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/circles/page.tsx 5dc5b147cc4e060a352c51f9480deb7b0063dfeae971c07933cd0a4fbbfd9cdd
// input: apps/web/app/(main)/circles/post/page.tsx b82f38759624befa67e2fd86cdef60b6f4d1130702bf5cc94d1bd40a179dad36
// input: apps/web/app/(main)/cloud-agent/page.tsx d0fdf66eab368c19e4158b4427237157f60017c0e067d49447ddda6b398b49ae
// input: apps/web/app/(main)/cloud-run/page.tsx 33ecf8d6d2bf8844eb45d5d7257fd2b6bbdc0c891acc33382a8bbf94ffbaa13c
// input: apps/web/app/(main)/comments/page.tsx a1d70741fc1b8d1ec7dc78ea50aa12fcc3585ed4625dfd99d79e434f337afc46
// input: apps/web/app/(main)/commission/plan/page.tsx 1742bf2916b8b8ba1c0e3820241b6bd9cd6c8136dd3a765f7ba7cb67e25f3ff0
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
// input: apps/web/app/(main)/context/compression/page.tsx 709061e71dbc8b88127db7b86d62b0ddc892a47fbeb69fb443d4e9b423230aa1
// input: apps/web/app/(main)/context/mentions/page.tsx 64382d53fd6eca7eb0a97deb80fb4a6c9950831ec9bebb67fba2b152c66d325e
// input: apps/web/app/(main)/context/page.tsx 03a75e516336b5a161503dff2a9ebd485f0da0ea12555c277e9a10fc263016bd
// input: apps/web/app/(main)/context/visualization/page.tsx 126c49a7647363e0b61d9110396b734344bbb417418ba145a397b7f160b00f96
// input: apps/web/app/(main)/cost-dashboard/page.tsx 1da98ca423dc3f9f5a4ece20154b2a04923e871a0c5185e18c766e844786701c
// input: apps/web/app/(main)/dashboard/page.tsx 811f42bce3ee198be01608c2232625759b6f1e8cb4f858cc2bd8de5c2dda9022
// input: apps/web/app/(main)/deep-research/page.tsx eeab8462c437cc6e3e0013c0955f23928e058201313d424ce21dd4bd125df752
// input: apps/web/app/(main)/design-system/page.tsx e2a38caae54802fe2145bc39ce0878275686ad755931024b87ba6f4dee417e97
// input: apps/web/app/(main)/design/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/developer/api-docs/page.tsx a80cc741331b26ad878d705b8aff832cefda7f720a79126f220947d7532ff113
// input: apps/web/app/(main)/developer/billing/page.tsx 7abbb1e16ee7e10f570a77122955adef7fff2b31f5393440b9175c33b3e60f3d
// input: apps/web/app/(main)/developer/capabilities/page.tsx 408bb101025192ac59d591272fed30fefe5ae11f401e1abf500ae39deb432039
// input: apps/web/app/(main)/developer/conversations/page.tsx 505da5ee03be37c234b76b28560f71854efdbb6ede418933342e32e5ba92a953
// input: apps/web/app/(main)/developer/enterprise/page.tsx 50e862dd7765dc64dabb5134e30cbebee71d5fe58eeac5fe73aaf701edbcd522
// input: apps/web/app/(main)/developer/error-codes/page.tsx d9e553018d8c80277a9c78081d06fb82cb55f94dc86200919e5789bbf26131e8
// input: apps/web/app/(main)/developer/ide/page.tsx d736ab882ef1c6c4080135b303532359e67866559107a5de66d31746b001bf41
// input: apps/web/app/(main)/developer/keys/page.tsx 8bf0974f97e53ca84fc5573315e81d69eb29e34fa3d929409fd1c68f77a3b0c4
// input: apps/web/app/(main)/developer/limits/page.tsx ef3196d617ee0dd3d83128cde4fecf1fe72029d6bbd5a804b29aa47aff8fa5be
// input: apps/web/app/(main)/developer/logs/page.tsx fe689ed68ce7f5bf7405f6c699111ceed54bbaf21390f770cd901780571634ed
// input: apps/web/app/(main)/developer/notifications/page.tsx 6b512e71d6e3ca1665f6ee50729495502e4add26eb85d7c352049ec7fe73f246
// input: apps/web/app/(main)/developer/page.tsx 058d223c910b0e6b113e86d58a7c5892f8110e31508fd90f988248c6ed9f80a6
// input: apps/web/app/(main)/developer/pricing/page.tsx 98ff5a53b9448a91c64ec733e291aea8f124e35458fba949d11d8ac943aa1b42
// input: apps/web/app/(main)/developer/relay/benefits/page.tsx f813cbff15df911f4c0a3f64a719e522d8a6d2300db2f5c167de4df8d41b8be8
// input: apps/web/app/(main)/developer/relay/keys/page.tsx ec6afb7f6b21994496b613ad495c3c340d6f79a88fc278fb1a29e62de3648cb2
// input: apps/web/app/(main)/developer/relay/page.tsx 88bb84a230cd74d14cb1f5f8b9f4b29b2b5c08670401dd051918b51e201a8981
// input: apps/web/app/(main)/developer/relay/subscriptions/page.tsx e604f24708ede8fba0fb5d4f0781586ba3454688a4e6d25e289c6c26aade04cc
// input: apps/web/app/(main)/developer/relay/usage/page.tsx a3feba28b60c1e5f80ea4b6e58d752bb74a47eb06046967e10caee50d38b00dd
// input: apps/web/app/(main)/developer/sandbox/page.tsx ac05dd3cb0bbfd072c4d88deadb45bfb4eb6f1f5c30497bfa6a7c8caf23ea833
// input: apps/web/app/(main)/developer/settings/page.tsx f762b8a4d9e7faebbd5a33101d946b1c01e0db468176c5d6a6e978e9577e7967
// input: apps/web/app/(main)/developer/subscription/page.tsx a307e299422e32fcb40af2e97035ed137eed1e4ec626ef5788249726434377fc
// input: apps/web/app/(main)/developer/team/page.tsx 790a852322429559d0f2ffcb61057f2241f96c8953c49f09308d87c6acc6117f
// input: apps/web/app/(main)/developer/versions/page.tsx b0e7126d654ddfe5dede6344a4e47dece4cccfe3b97eb5a663039f51c947d500
// input: apps/web/app/(main)/developer/webhooks/page.tsx 0f46dbb3470ee7b8b382f8e32f34fc26fad7c88c3d7fe9d76cd76faa30cb70c3
// input: apps/web/app/(main)/developers/page.tsx e4a6a847e564c28bb1671478df1925f636facf1e3373d3f391d398746b165fba
// input: apps/web/app/(main)/distribution/commission/page.tsx 004d9566e8830b4fec39ac8507603d874e88d90fb40ef0a51b6e3959092d2ed7
// input: apps/web/app/(main)/distribution/company/page.tsx ba7469f8e8fecd8455647698187595cf84d276bca96f06d33d71f96a4fb96e51
// input: apps/web/app/(main)/distribution/orders/page.tsx 7a567b4916c0eaf6ba34d71c935113c1601b8977c1cd49ce98c7e89aaf37b13f
// input: apps/web/app/(main)/distribution/page.tsx 59a98904decf57068e4afbae6652b80377d9857e329ebcf3bd678f4677656213
// input: apps/web/app/(main)/distribution/referrer/page.tsx 3b49ca96276ff5feb35519505258b35db0b6a05364abedc36de703dbeee54544
// input: apps/web/app/(main)/distribution/team/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/distribution/team/page.tsx 0b4f2911578cf07395d662f95a08f2c04692cd5a3e4f2d1a6d7710ec210323d8
// input: apps/web/app/(main)/distribution/token/page.tsx a0f780e135b0e0de28f081499b9375fea67ef1858e6c1ce560b193697dae472b
// input: apps/web/app/(main)/distribution/withdraw/page.tsx 29a6afe7fe16bc040cd3c01a455146efe6bdfc4846ff238be739662b790763c1
// input: apps/web/app/(main)/distribution/withdraw/records/page.tsx bfe609b0e665e5e103d42b907646dabbb5961e5e430872fa8bb200e038525276
// input: apps/web/app/(main)/docs/agent/page.tsx 8ae3fba6db8c22ddc1b8164ab7b4317e2768883b463e2fc034d67229ce5cee75
// input: apps/web/app/(main)/docs/api/page.tsx 51d81f4b479b1b750ca8415fa0576ce65d166506135c7f724f785efce98ec697
// input: apps/web/app/(main)/docs/manual/account/page.tsx 5003d9c412d19bf27e2333101a77d15c0f745aa796b870e3ad2c3d08557d660d
// input: apps/web/app/(main)/docs/manual/agent/page.tsx 65162ecc8b65b2215f067f1b698744fa96579a7cbf67f21ff601bff6b9084249
// input: apps/web/app/(main)/docs/manual/ai-chat/page.tsx 5182465e1f0219c14f313c1d3d71458e5f2cbe22436ad5aca97e89a9422505b0
// input: apps/web/app/(main)/docs/manual/billing/page.tsx 06f2fd6a6b5f7e519d07409b777e04a2583c526e5eff4f39ddd808172bce396f
// input: apps/web/app/(main)/docs/manual/faq/page.tsx 2a856c7c8fb9340052dcfb399c651618721b667df6068fad079045c3f9837c7f
// input: apps/web/app/(main)/docs/manual/getting-started/page.tsx 421cd3a58a286a9b3b666aed592e3ec9a10aeba5c76292e2df9519ea32bc0567
// input: apps/web/app/(main)/docs/manual/knowledge-base/page.tsx 1bc4bacdd41f661c1f0eb1f0b5d34cf0ec97284fe0d17b5d2dce6b7babd3ac4c
// input: apps/web/app/(main)/docs/manual/page.tsx 75637cde670f4a05baf9f0916168a4ad34b452cbc87526c04e9f48417637aabd
// input: apps/web/app/(main)/docs/mcp/page.tsx d7be429bf12a0fa91e46a798b1950e0d99910de35a16ef93e8655adb97e9cee0
// input: apps/web/app/(main)/docs/models/page.tsx 281458fd77c47d636b36f5ef9a039c034d883712a3f06874b20e39348a353728
// input: apps/web/app/(main)/docs/page.tsx 5a49df7de4a4cd193add961ea430b1735d8bd363ae333f3fbd08fa92de01ffe8
// input: apps/web/app/(main)/docs/quickstart/page.tsx f02ef05de37a67ad3eb4159bfc81e590ed9fa270c22880f36b08790c5487ca28
// input: apps/web/app/(main)/docs/rag/page.tsx d4eb5a8b0ee240425f90bccd2d869df96226d181616deb8049bcbb09f0af88cf
// input: apps/web/app/(main)/docs/self-host/page.tsx 740465af62b84414b1d5f6e239a16f839fbd76e25d18c843f6ab6eb0c4e972d1
// input: apps/web/app/(main)/docs/team/page.tsx 85e362da8004d35459cbeb7c0932a75fe273b2a0cd74c40d1a5f6e4978cf9048
// input: apps/web/app/(main)/docs/workflow/page.tsx 04b92e812fa0aed54e79bfc989191311e2c4bce2ed75f776b2d9cde22cf3f65d
// input: apps/web/app/(main)/domains/ai/page.tsx 1a06ad7c1c2aa734cc2adf9cbe2196dcf8e52e766328ce76b55c53892e4c2cd8
// input: apps/web/app/(main)/domains/content/page.tsx 5f2aadcd2744e25d3e55f3329446167280360de8d78bf2a8d48c36f2bb426e7c
// input: apps/web/app/(main)/domains/edu/page.tsx 610d37bec54c738e573d24150b1a36c173a9344cb559da2ed18aeb7386026fd2
// input: apps/web/app/(main)/domains/personal/page.tsx 329a5d2bbc5fa9b6ec73b84cb77f6c673bf0e5273e92264fbb2c8c4a1a0988fb
// input: apps/web/app/(main)/domains/trade/page.tsx 81b8bcc37d1565a1ffdbbb0abbcf9f8eb077f08bdc9b8d8b789fb789c2368949
// input: apps/web/app/(main)/download/[platform]/page.tsx 04bf22574b04954a7418bae2c41138e61083f06317686216af880c1b1529c314
// input: apps/web/app/(main)/download/page.tsx 59bc8557ed62a53fa3608ec75132263f58a438dd8c09e066e49f8a07bb726c04
// input: apps/web/app/(main)/drama/page.tsx 38e76b18be7c5ae74eb48bc258c8634d65ca08f6ebb2173241e3ad2aad5cd37c
// input: apps/web/app/(main)/earnings/page.tsx bcd684632476e990828d2b178b70194619c1616b469454bee87151b2d9ff36ba
// input: apps/web/app/(main)/ecosystem/connectors/[key]/page.tsx 8393c69c5ff681ca5d2aa9dd26f6c2474d62f0e1af2f9eba3c138003af32eb69
// input: apps/web/app/(main)/ecosystem/expert-packs/[slug]/page.tsx 098fab45a09bd2cf6ceecccf47cef0ed94dff9daa2efc87dc98ee3ec6ba51d7d
// input: apps/web/app/(main)/ecosystem/expert-packs/page.tsx b3874012bca5399c92bc75fb664ca004babb2448ab83f7853548e1aede67dec7
// input: apps/web/app/(main)/ecosystem/page.tsx f0dbfb332b9a6d22dde55a80d763e3aacf88436996ad4b44a76eadab0e95ea88
// input: apps/web/app/(main)/edu-ai/aigc-tools/page.tsx 57016c32116fcedc94d7c56382cacbac84c783a96455469f2e727fafa262ee53
// input: apps/web/app/(main)/edu-ai/certification/page.tsx c088654d74e5acdbcb9e05a2bc44f697dda39c89868f135c72e85b9ca5f60fe1
// input: apps/web/app/(main)/edu-ai/courses/page.tsx cb064665b50a56af43d0182f687348e33d90036c0af8f8199acffa1437eefd28
// input: apps/web/app/(main)/edu-ai/map/page.tsx 344837b943f5ae7b4dcaca05f4038aeeed4ff9a217469aced646690fa289fbbb
// input: apps/web/app/(main)/edu-ai/marking/page.tsx fb67bd7f20ab8219cb2875f856b511b83bd1b9a0cec5cdb08fed01be1ba08a65
// input: apps/web/app/(main)/edu-ai/outbound/page.tsx faee7843dad3d0b153a3ee832da1b105287a2eae8ceb4ab9b3a49352c12b02b6
// input: apps/web/app/(main)/edu-ai/page.tsx b9b0cda9b604916f23f82f1b13c0f5e8d93ba97624e5b111f7b0cf524aa47a2f
// input: apps/web/app/(main)/edu-ai/policy/page.tsx 589e6578c9454d8cfc39dc37d61ccdf3a3195c0cff0e910b2398974ad80ed356
// input: apps/web/app/(main)/edu-ai/tbox/page.tsx 86dd350056aaefeac7c91539f07ba6a6b3f38452bab3eb0616be876aaa1a3610
// input: apps/web/app/(main)/edu-ai/video-compose/page.tsx 65f513ab3387c2ace72a2b5ba3d35d78a31070592e8ac20069b1230358aaf3dd
// input: apps/web/app/(main)/edu-ai/voice/page.tsx e629dc8ff9e40dc78e5ccc3388306becfb83cb4581a567dee3115fc9bb16f40d
// input: apps/web/app/(main)/edu-points/page.tsx dd44c8af509a6758aa95dcdb940d09ed0a0ad77c1c280c33a647cf991cd54e45
// input: apps/web/app/(main)/edu/certificates/[id]/page.tsx 30c76c078af2e8d4b7be7c0b2bc032d8e6bef02caa9c6852d6bdd187dc173fcb
// input: apps/web/app/(main)/edu/certificates/page.tsx 53dae18588908c650922f113a1159344e3129b6d9993ef248c469d95a52c950a
// input: apps/web/app/(main)/edu/courses/[id]/learn/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/edu/courses/[id]/page.tsx 3e8b1025fc51b722335ad922830d0eb9363a75759bf9b11aafbf7cb5db4704be
// input: apps/web/app/(main)/edu/courses/page.tsx 85a8f858c53077a481e8a11de4c70ed968b6e717af84f4558d122cd2bb86ec9c
// input: apps/web/app/(main)/edu/dashboard/page.tsx 1bd10ce8c35206710df1be69a339538e9b9818cc6e556ed25582e667e8cf191f
// input: apps/web/app/(main)/edu/edu-management/attendance/page.tsx ee249673237ea43b362e64ac999eea54c1e170455eb5433939a3fc06835a38ad
// input: apps/web/app/(main)/edu/edu-management/enrollment/page.tsx 78cf64a1fdc6d747c1f561a105d5d91a44e5aefaa894ca360fa52477ab0f44dc
// input: apps/web/app/(main)/edu/edu-management/finance/page.tsx fc9b736d5c994dfa2bdeeaf4328b2280a22365c4d9d4b9ae94df3f8820896da2
// input: apps/web/app/(main)/edu/edu-management/grades/page.tsx 995cbff800387b67319592f4b6ef107859ff49a08f1e944bf8092c45c8d557c7
// input: apps/web/app/(main)/edu/edu-management/grades/trend/[studentId]/page.tsx bc6a04718ae14638d59ed11026b720cb0706d9b6b1009a08362b9486c21ff94a
// input: apps/web/app/(main)/edu/edu-management/homework/page.tsx 8a544efa39c6f7c569f8ebba0a92c54a670ad7c29bb295ef6c88698a9a29dfba
// input: apps/web/app/(main)/edu/edu-management/meal/page.tsx f80edc5914c91dd88a1ef30272aae875316e8f7890045055c59f10875838fe83
// input: apps/web/app/(main)/edu/edu-management/procurement/page.tsx 898e8298e303076a3c6f5ebcf49879a76385a374661c29969d144cc6e54bb3ab
// input: apps/web/app/(main)/edu/edu-management/schedule/page.tsx a6f0939133b35b2b17ca0204bed329360fdb74fb5c113dd9581747f4238184ca
// input: apps/web/app/(main)/edu/edu-management/scheduling/page.tsx 5ee1d0f6e76fb0e6bd806814d02a02d914c30a18f754e2def172d3c39a856864
// input: apps/web/app/(main)/edu/edu-management/study-plan/page.tsx a694a3bcf917afe21dab9bf015fcc45374464695a31d9812080d144a00503899
// input: apps/web/app/(main)/edu/exam/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/edu/exam/[id]/result/page.tsx fd23d193dee43ff51841125e799a6c64265e22b0499200947c6404d12b2e2954
// input: apps/web/app/(main)/edu/exam/page.tsx 1b73f31d6fa18e748eb1d1fffd85e3dc6212bcbc8c77c74f351e7f90d23faeb0
// input: apps/web/app/(main)/edu/notes/page.tsx 3f7f82327b4567ca9ee7fc7064d038ab1226b9888e9cb5968c00a616ababbba9
// input: apps/web/app/(main)/edu/page.tsx 5676e95679d2502f6cd77fd60b3b482af8b4cd19de696436b62fb18f3c71c222
// input: apps/web/app/(main)/edu/parent/bind/page.tsx 60d77b032cfc4dd9f2a44f257f91ea0c44214e00d85bcf51c4427ae83933555f
// input: apps/web/app/(main)/edu/parent/children/[childId]/attendance/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/courses/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/grades/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/meals/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/study-plans/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/page.tsx 30f55c840242cb8b4cca31e504cc681b3a54a175c26b505dbf38835d0a32c385
// input: apps/web/app/(main)/edu/progress/page.tsx a08cfdb943a9d2daf3e371aafdf61d85c4056cd8ef5d1908216dc05737608b56
// input: apps/web/app/(main)/edu/qa/page.tsx 8ce6381db40c0024877c8519629ffda24c462de5813838eb7bba90843c3bfcd7
// input: apps/web/app/(main)/edu/schedule/page.tsx 0f49bae31c6b880aecd3e11a2702fa0ff73f02822a91bda4b110957b6f21325d
// input: apps/web/app/(main)/edu/shop/page.tsx a3495c325315e34c3266e303fad361762511146477c375ef272b03c7b24ca279
// input: apps/web/app/(main)/en/use-cases/ai-design/page.tsx 263f5d399f0d9d9dbce8c184ebef0de76fbb039af1cab41b56ea6f2f98ac991a
// input: apps/web/app/(main)/en/use-cases/ai-edu/page.tsx 05470bce15e79c0e0c4e2f4742d9372bbeb075c99786e82ea9c53cfc164d370c
// input: apps/web/app/(main)/en/use-cases/ai-marketing/page.tsx 6644fe26f92c8902918b244553fd6bd1f5b9cf13cf89b1e65eb15b9afccf33a9
// input: apps/web/app/(main)/en/use-cases/ai-research/page.tsx 6d1e45c057143d3798db1ee88b25be83b5bba42b9f5dd5b4c12ed9cc654ae50b
// input: apps/web/app/(main)/en/use-cases/ai-translation/page.tsx 319ef03753663e6fd4f55f5e87a9449a7c5d51ed88d53803fbb7a8fcbc6a761f
// input: apps/web/app/(main)/enterprise/inquiry/page.tsx aa20b6854cdfc1f1f0f2614c4b5e3e21eaba22a79345ba034c58b3f110901353
// input: apps/web/app/(main)/enterprise/page.tsx e92a22969539402162bd1794714526c8d2c5e84cad577a2d26bc1ab7a35a86f9
// input: apps/web/app/(main)/exam/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/exam/[id]/result/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/exam/page.tsx bb41d351275bea89d84211cd885b404be631adcc8ff7b256e101150260d5afe0
// input: apps/web/app/(main)/exam/wrong-questions/page.tsx 44b6873f936b560607c26868feef9b57f1f429a694cf1be71f6605cffd0c1636
// input: apps/web/app/(main)/faq/page.tsx 340204418a12d33f01f6b30c7e8f7eb3ee65729d4a4484c5dc083a92a8e7e29d
// input: apps/web/app/(main)/favorites/page.tsx df2725493c67a9201775da91384ac1d6907d2548ce2d68923cbacd13537f1d0e
// input: apps/web/app/(main)/feature-center/agents/page.tsx fcf5e297611b6b02765b613931396c9b9665cb1028b13dcc5094cafffe38f7c2
// input: apps/web/app/(main)/feature-center/apis/page.tsx ad0b4eb11e49bc4fc494ec3840904d80b2bac3d3bec78cd6ba0eef9c786ad8a6
// input: apps/web/app/(main)/feature-center/documents/page.tsx 2ce7e67ef26bea8de23d91e16ce1a2cdc5102ae31a299a70947980857d530336
// input: apps/web/app/(main)/feature-center/models/page.tsx c7dea6c91b30310fd646b881e7ffec4ce0af71f4e8fb725e83eee8dadb32d5ee
// input: apps/web/app/(main)/feature-center/page.tsx 68f2a2f0142c71dd38e34ecc42eea2dec54a4d74b1ece10f30e21da65f333783
// input: apps/web/app/(main)/feature-center/sdks/page.tsx fdd8f6d0b5fe6c3c837d55b355d9fa344dc6344c648c2f042ece9fef5038a233
// input: apps/web/app/(main)/feedback/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/feedback/page.tsx e15690927679e5461828bda020a9ee3cf115a6523c1b7f642222a1838e7d94f8
// input: apps/web/app/(main)/figma-import/page.tsx fabceefd816dd87fb693857f3381cd43b9398517c3938d27833de3f6fb0f4ff9
// input: apps/web/app/(main)/following/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/free-ai/page.tsx 14251afe2b1cbca09b1bd672b0d3d4283992db241dbd30d8075e0418c6bc0edd
// input: apps/web/app/(main)/fund-data/page.tsx ccda93d7de9a024870a7650178be05f431df2a7a3d9ddb0bb91220ace26afcb9
// input: apps/web/app/(main)/groups/page.tsx 18164079287813b6fca51a4990021edb289e7dcd9e00595650b78866752b31d1
// input: apps/web/app/(main)/help/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/help/page.tsx 8d18c7e744dfd0440889c2a34c15f7b13da6823c1bdfeafedc275aeb91116eae
// input: apps/web/app/(main)/home/page.tsx c363a3b298783696813c1ff6c01ea43d10ac6a57a18ffeb7a2aabf1356e1c93a
// input: apps/web/app/(main)/hooks/page.tsx c7aed66054b4f50815c7b49434e711bb1b5049c02878b5f1521d6499f663936e
// input: apps/web/app/(main)/image-gen/favorites/page.tsx ef8faf082ad761d34a49fefdc73a6f31850f8323d99f398864c29c819ce9093d
// input: apps/web/app/(main)/image-gen/gallery/page.tsx 4f93698881bfd04d034eb6811fddded1405e2879932773b55b98b826a91de781
// input: apps/web/app/(main)/image-gen/history/page.tsx 4f53cef6c4fc726820ef0ada78f6c3b93c6920d04f519c98a0cfb2aa14fe99bf
// input: apps/web/app/(main)/image-gen/page.tsx 444447997ea5308fd24ba5d11b76d759181672dc600b1030ffaf07574916a2aa
// input: apps/web/app/(main)/image-gen/templates/page.tsx 94d4f30cd42b41ac0f2f7aaf06e107563bf78efc5c361200c944f59e8150a3ad
// input: apps/web/app/(main)/invitations/page.tsx b129561c878fee48ffcf1a6e67da7fa673f2c4c30f37906cf431a337e579af42
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
// input: apps/web/app/(main)/knowledge-graph/page.tsx 8ea5d4b774235176b5b6fc18833629c457d7e7ca3a252e5a2c8e9e40845f2774
// input: apps/web/app/(main)/knowledge-planet/page.tsx 95ed45d2892df6ad3d40a76573602a8394bda0d3196795c11d56c7b431d67115
// input: apps/web/app/(main)/knowledge-rag/[id]/chunks/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-rag/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-rag/manage/page.tsx f8ee3a99aad464308260f7eb654b1350b6ba0798357566446007c09683b5d268
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
// input: apps/web/app/(main)/learn/map/page.tsx ffa37baae3bc0e3316c3f36c3881152c10fc61d582f7dee5992a864e96555bf1
// input: apps/web/app/(main)/learn/page.tsx 1d58c5a638ff4a3b63f85964ddc2c69d02177f7ea4562a26c462b6b756430b0d
// input: apps/web/app/(main)/learn/payment/confirm/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/learn/review/page.tsx d2f8887c2e8c2deb5d0ac1836fb53806ed463b072f8541ad77dba84dac15fce6
// input: apps/web/app/(main)/learn/topic/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/topic/page.tsx a94be95fa6232275e19d27d16f63ee4c608e0a94f2bc03e77831556d4fb1afb6
// input: apps/web/app/(main)/lecturers/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/lecturers/page.tsx bad32e9620e5c89fe1bf8b5c3da86033eaf8e7872b20862d4cf1aa8e3699d1a8
// input: apps/web/app/(main)/legal/service-specific-terms/page.tsx 12e032225aa329936abea7f030ba3179cb46b1b3ee15c5167386e0af3c3f64ce
// input: apps/web/app/(main)/legal/supported-regions/page.tsx 87f20f60a7a5ba45a1598512f3f1b3704022f2f5a91c5a4c5ce0a0521bcf7351
// input: apps/web/app/(main)/legal/terms/page.tsx 6d65e9d26ec02489a1101836f82101778028173d87c5937fc431280c07aa2bb8
// input: apps/web/app/(main)/legal/usage-policy/page.tsx f77bd29a0903e201d29aed51f3cad181715e04efb9b2dd0755a89d22e3473a2f
// input: apps/web/app/(main)/letters/page.tsx 7e1c065bbe51b7dc7a3949573c3a6b47f42d4b41f42ea02f51984ef775e71bb5
// input: apps/web/app/(main)/live/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/live/[id]/play/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/live/host/page.tsx c9542f13f92441cf03f8d6a90f903a1ffcf0b51fa12b280614ba3c74487fe476
// input: apps/web/app/(main)/live/page.tsx d1618c415ffabf9ce987acd79bc5ab356f7db81aabaf941a40ac4258889b3c59
// input: apps/web/app/(main)/mcp-projects/page.tsx 8083d86a1ffdc43d0480d154482c92eeb73b0ea5ca834c4ff5d3811cc1194eca
// input: apps/web/app/(main)/mcp-store/page.tsx 3801930b21799b9b5fdfda53588178b765ed08d5dcf53aedd69fa6f0591fae38
// input: apps/web/app/(main)/media-tasks/page.tsx 92d6cd9ddc0e7e1f4b5cf1d5374d040d445b404930daccba6ce3b86a795ba3f6
// input: apps/web/app/(main)/member/addresses/page.tsx 799f89bfa50f0469a63e0d1113a2d743f1bb8002b9c1114c7cbf3715c1cdb366
// input: apps/web/app/(main)/member/benefits/page.tsx 5d34f24134ad8a89d3022266021936c3df22e8bb6627c4a1adc1fc123d7eb7aa
// input: apps/web/app/(main)/member/coupons/page.tsx ea4b4071d8fefd439d7d3e141f19b481b48ab8a7b25e27ce37b76c8aa005bb4b
// input: apps/web/app/(main)/member/dashboard/page.tsx a885f69b5b78eb3846a4f974d037cf74641f2dd845a2259c5981cfde97831486
// input: apps/web/app/(main)/member/exam/record/page.tsx a00f3c99f4ac5e4670b1c0ee632aed1d24e65a729ef98cf94f775155b2462643
// input: apps/web/app/(main)/member/exam/sign-up/page.tsx 4cdff7b653bb37eaa38be3890432c74f9ae9032308cbca286a6e150f0b3bb7af
// input: apps/web/app/(main)/member/favorites/page.tsx 046f2a0f3a07bd8a1d5df801023ca06d06ebb5571dc31c57e292bcd2caeb011e
// input: apps/web/app/(main)/member/feedback/page.tsx a0385097b0c89db7da33c677163adfa3706f47cf299ee2e6f6f8fc540ff86630
// input: apps/web/app/(main)/member/help/page.tsx 1b3a861d02c0fb8d363f25b23c4cf20cf5dcc2af21a5614ded84b621cee05931
// input: apps/web/app/(main)/member/history/page.tsx bc043c918e964709e5d23abee9a68f93f404573bc2f40957e752069d7c156579
// input: apps/web/app/(main)/member/page.tsx 2ec34f6d459cd8edd9922fe77f8e3564dc33c57e44abc0508bdc5a724afa498e
// input: apps/web/app/(main)/member/settings/page.tsx 064a3ea9ea7881e0705db2524963aaef5873e8af6dfe5e779d59f3a819822755
// input: apps/web/app/(main)/member/subscription/page.tsx 169706f6591934ef42a4eae14867451d1718e51f26b5ad46d1a38208d2d3e8a6
// input: apps/web/app/(main)/members/page.tsx cf8b5291eb01c73def32e6cff0eea7a9e8579bc4582d1f04c671aab8f7db5329
// input: apps/web/app/(main)/memory-manager/page.tsx 8c8fa07e132b7fb05a40af7daf8c155b79b1bef3d059670c9680b6221983005c
// input: apps/web/app/(main)/memory/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/memory/new/page.tsx 278d94e5690c7ed220974a534cda3c771a2520616cbff9900bfea04d2e0c46cd
// input: apps/web/app/(main)/memory/page.tsx ee1ae96a6e61c20dc4bafa196cfa316faa60fe1ce0d641c578c1785d12c227bb
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
// input: apps/web/app/(main)/models/eval/page.tsx 687d24f307aad2a6720137111a6fded32af51fb65e56b7072f331f73679f0826
// input: apps/web/app/(main)/models/groups/page.tsx 35b16db05d8be703bfb569f6c9ca68521e25b42b1ec573375e9d4a50c979fbe8
// input: apps/web/app/(main)/models/keys/page.tsx abdeabe644a8fee560ebb32b2b460d9d1098d776b771fbb8dface58431113b83
// input: apps/web/app/(main)/models/logs/page.tsx 3f8cfef85e1d26c0a4acac4d0ebc4862226d63c2bb6eef198ff4da057186c8a2
// input: apps/web/app/(main)/models/openclaw/page.tsx 8519b668e74d4662c7f055f764f7fab3796cfc6890735190212523a088463bd4
// input: apps/web/app/(main)/models/overview/page.tsx 145d1683f4e28ab01a010003d268439ff890c87cca87475065905ae0f7038318
// input: apps/web/app/(main)/models/page.tsx 5a4e9722c8358f30a37324c373fadcdc5121019f3eca7f2aa587006928f3c1f6
// input: apps/web/app/(main)/models/prompts/page.tsx 4dd34cf0b8cf07bca94b1ffe0ba90b67701daa61f0ef4bad39f3b6edd4befc6a
// input: apps/web/app/(main)/models/redeem/page.tsx 2d991a00d624b20e55bd43beefe8f80d071a52e4152310798cff6a176814ddf8
// input: apps/web/app/(main)/models/referral/page.tsx bfb105254316726cdfeb86531a2975484b82440fefd4c08092db0caee9e3bc9c
// input: apps/web/app/(main)/models/skills/page.tsx a7f7a6c464d9ec83a8e3639876a9acc582a2f0516b0748418bfa0005b190ba80
// input: apps/web/app/(main)/models/trajectory/page.tsx ec20f980c79e7057b838c806b0e52a6638b3ca08bc626bff0f23597367314829
// input: apps/web/app/(main)/models/usage/page.tsx 143ee61757e03218be4d7dc67ab60641dbe7fb804772e9c1fbd973c382f55402
// input: apps/web/app/(main)/models/users/page.tsx ca7ee659af729e3ce6961968c5e690e8ed719b3720b6693c3c96a0f6adc5d2c0
// input: apps/web/app/(main)/n8n-agents/page.tsx e7b6fc2e90b2b4465e5ecbe2db5e39c7e21c9869c26e90b2927f4ac49981dc87
// input: apps/web/app/(main)/news/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/news/category/[id]/page.tsx 9a4a74a52e0389d02f9c16d560907b2ba26abd2591906028fe504fbad9b58ccd
// input: apps/web/app/(main)/news/page.tsx 9dbb7eeb354b0b2c4224fd9e59ed3348b7e6e6a231a39cb278400fdaea3f2720
// input: apps/web/app/(main)/newsletter/page.tsx cdba2b84b0d8d5fb0819ab75d90ff7f6483e66c9e333899f77dea5a129224d67
// input: apps/web/app/(main)/notifications/page.tsx 68f24d1acabf45eda119ca3ae22cd1c41d1e505a6c1ef68f475975dee7657a64
// input: apps/web/app/(main)/oauth/authorize/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/oauth/my-authorized/page.tsx e9b4ec35412109b793e935e977a843a8b9923848b6dc1c41a15ec6953eeacd56
// input: apps/web/app/(main)/oauth/platform/page.tsx 4c426bf57ca6953380cb6ebc9a5bdf835634ea219a479732b294558b83f28b93
// input: apps/web/app/(main)/onboarding/page.tsx 4523c003ae23d9121b6227477b4626796e582f0bae1a4b3e2bcbbc6e75b60703
// input: apps/web/app/(main)/openclaw/page.tsx ba00db69962ded395fe97eeeb001f0e988e9dceb733362c653015609be9a0174
// input: apps/web/app/(main)/orchestration/page.tsx 777363de7187498e2b9b40feb2bd0ef1f14d359ac2293f0ce99524c6f8744a55
// input: apps/web/app/(main)/orders/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/orders/page.tsx 2640b6d2422088953736c0932f8dd0a0eb56e2ad3c3b5150a691e639b52d7dd0
// input: apps/web/app/(main)/patrol/page.tsx cf0b14c58c41cb0e1d54dfb9107949947925f2b96238f137ce903eb6e08967bf
// input: apps/web/app/(main)/payment/checkout/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/payment/page.tsx cf316e5cd5eec1ee7ff246aca75429fc3e94312477bdac3317b91023ec79e955
// input: apps/web/app/(main)/personas/page.tsx 2ce22e1b7e041e4fad7bf33dc60376ded62102bac7e6d60e177f1009e03d18df
// input: apps/web/app/(main)/plan/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/plan/new/page.tsx 49e9f0e4aacd07e78e363e25a47e70457e6a559c627d1679a133beb90efc797d
// input: apps/web/app/(main)/plan/page.tsx 9baf1856cd8e162b3827739acfb84ba498cafb5a0c989c989b5011b6921f489c
// input: apps/web/app/(main)/play-beta/page.tsx 782878ccc647def051105b9ac08b7fc6a2c19607d43115ab7b792c0df2c9fddf
// input: apps/web/app/(main)/playground/page.tsx ca50dbffcbf32eea3ea7baa7feedcc165204149fd6af07dd99c397b7fa6d8d2a
// input: apps/web/app/(main)/plaza/new/page.tsx a2e5e81722d99ebc2549c39c8482e17bf31dbf527462ffcf21a37165b12fefa8
// input: apps/web/app/(main)/plaza/page.tsx 7646688c9b22bbc29283a41c136cd55162c7bc1c82e0809ac8bafe1a75451148
// input: apps/web/app/(main)/plugins/page.tsx 9e2e1a15447f8fe92deb63237d80ed2c26dd0fc93213babb8c3dba6c330635a6
// input: apps/web/app/(main)/points/mall/page.tsx 48deac2b7f66674084bb3b226d8da505737c40c68a8595a2988d921938813b37
// input: apps/web/app/(main)/points/page.tsx 1ca18d9461b0f70f2364e636ab2901a74d2b2c59e3e6e6466ad79f3b07a7082e
// input: apps/web/app/(main)/points/sign-in/page.tsx faa0795d06aae817b0de4ab8c078a0da44c2671f0aea9bbfc186cce9c6a420f1
// input: apps/web/app/(main)/points/tasks/page.tsx 9c2d17081cc279a0864f3aac1014d74a2b43319569969bc9f7b7591e3a1d984b
// input: apps/web/app/(main)/pricing/page.tsx 0a1c3717f2391db2cc15487136f202ec89b2a8366aceed099f40d0567d45f3d1
// input: apps/web/app/(main)/products/page.tsx bca2f8e745373d271291e554192cd1728570e61ba957c65a3ea48893a687b6e3
// input: apps/web/app/(main)/publish/accounts/page.tsx 5323e03a54baa1029e8b5c01d685d35d99cc8da2d1ce85ca3aeba43358bbcb4c
// input: apps/web/app/(main)/publish/analytics/page.tsx a70391b061c820faab68ce4fcaba8f6bef980edc83c45351c8669efa223e59a2
// input: apps/web/app/(main)/publish/calendar/page.tsx 5ac9cd0aa833dfc8f7c957368a8f1ce19ebf9f17d5bdae8a3331fa3cb5ea309d
// input: apps/web/app/(main)/publish/history/page.tsx e7afca22d441d4ee6d133326e84f4c9cedc7810f794fe5744566b4ba3a02a1fc
// input: apps/web/app/(main)/publish/monitor/page.tsx ef982d5b7fd0f8d4be9abc738dfd6211d5f7abe7810d57b766e48c15d6e53304
// input: apps/web/app/(main)/publish/new/page.tsx 5865f7c704da5c4be7a71bd2d7f421b91109529b129f2c179667b8375f73f48a
// input: apps/web/app/(main)/publish/page.tsx c8db96a527dec17f81d00d0195ba83a0170b7ef84bc975fb318ec5f98ff384cc
// input: apps/web/app/(main)/purchase/page.tsx 9b9037ab03cbfdad16c70fbc52f51f7030a69d6b495c8eeb7b35eb5fe0765d5d
// input: apps/web/app/(main)/qoder-reset/page.tsx 177423576d6ebe797c9b901735200c70fd2bd5a57be2c0dda725815a842d1ebf
// input: apps/web/app/(main)/ranking/page.tsx 910974576ec729b0a2ff5e3f79882953043c8799317f4c00fb6d114dbd9bb1f2
// input: apps/web/app/(main)/recruitment/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/recruitment/page.tsx 0af592560a44133ff460630681949e7281f23b6203d8cbacc5fa2be5551e4037
// input: apps/web/app/(main)/refund/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/refund/page.tsx 467db64ed3d0c259c0d0fe321eae5a36a371ce16ade5f24ea3c3f5fc94bb6ccf
// input: apps/web/app/(main)/registry/page.tsx a2a43a2b8a36f88a5e0ed8f4a5efb033d08751a0e73d478e4323875430f676c6
// input: apps/web/app/(main)/repo-wiki/page.tsx cf39e76af2596e8852affaeba1ff37c84ad25c1b84f14866af93eebdd64080d2
// input: apps/web/app/(main)/resources/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/resources/affiliates/page.tsx 6ee0101f481fe2082729a14b5773d16413f70a44ea2d11bc3f784f6de5a728bd
// input: apps/web/app/(main)/resources/edit/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/resources/page.tsx 8bf406f0c8ea6cd10ab9fa046478c4dc0a89f64ae158077859051e62074a0054
// input: apps/web/app/(main)/rules/page.tsx 2c1ae6cf79a0d6d4f65ca9fc2b0bca1427d51087e6ce1533eb27c6cccaf32fd0
// input: apps/web/app/(main)/schedule/page.tsx 447fa76a12606e6e2f10518c08fdcf37aa7097d1e985b7605dba630ddde18b0c
// input: apps/web/app/(main)/search/history/page.tsx e7c4153b2c51bac260d679b79af9e6bd9ee68f010300aad1319f41f5e59ba994
// input: apps/web/app/(main)/search/page.tsx 9a7d108bde44eb18b8fb896ce95e07c3b72268adfa49fe83f076006e98b99d01
// input: apps/web/app/(main)/security-audit/page.tsx 48979b6540bf3624ca401685285bf82ec731d0f2122f4ac51efadab301e2e0d3
// input: apps/web/app/(main)/self-healing/page.tsx 66465d0ae39440c08f74b4a1040d997817e30df65678839854d7b9e97aee5c39
// input: apps/web/app/(main)/self-media/automation/page.tsx 817e2b62443bbcefde9c27f8ffee4f16dffdc0217210bdf99209751817a09744
// input: apps/web/app/(main)/self-media/koubo/page.tsx 1c562f92a1d0caceed55946eb85dede399330de57404f30506d37eee47c8a072
// input: apps/web/app/(main)/self-media/wechat/page.tsx debb0578c8144eaa8cac2da14ebf6554c17dff626b1ade430636be0420fc89bf
// input: apps/web/app/(main)/services/page.tsx b54ca5c46d6700ea0fd78c5cac5efde5d04098a2be51feba7d745667d6dc7c8b
// input: apps/web/app/(main)/settings/account-deletion/page.tsx c1d87c92d028c1d1760daddf43cd335d437049b5c6f3ece184388dcf314015dc
// input: apps/web/app/(main)/settings/activity/page.tsx bd2d5934dc5d697f77d05b6240a9fdbeee9d448e2b0d3e4e27bc733c89cfc57b
// input: apps/web/app/(main)/settings/agent-security/page.tsx 3e1a91132e20fc7bd3ae6b99774cdf8d93d7c26937edaceb5dc5407a4386aa45
// input: apps/web/app/(main)/settings/api-keys/page.tsx 492e6b64711c856e20ec91c9ef5a74e42869c0127612dfca7cccb3476727083c
// input: apps/web/app/(main)/settings/authorizations/page.tsx acc98c629b5c5069f804e1bbeae18fa87c48c84784f10fe3d5e04af92524e8d7
// input: apps/web/app/(main)/settings/billing/page.tsx ef30cd0cb4bbec7fc77ca05bf75a16f0f198e3cf9e982644ab7f143b383a826e
// input: apps/web/app/(main)/settings/connected-accounts/page.tsx b0afd772ebcc305f5e8049fec1c59861291ef79bcf6d1d48b83572fc14338301
// input: apps/web/app/(main)/settings/dashboard/page.tsx 9a3600e685ffcacd84130982a4ea40a2264a79d3eebe77329b8ef918535d36ca
// input: apps/web/app/(main)/settings/data-export/page.tsx c2ca8e792b53309e3a65bc957de4222c6f9efbad420a800d141fed3605af66ce
// input: apps/web/app/(main)/settings/data-rights/page.tsx 226c5f9c8db68d641455d439092dc3e090ad9c399938f404f9deda442023ecd7
// input: apps/web/app/(main)/settings/gateway/page.tsx 4eef35b03c2dbdef89ee8baff5d817d53877f8ba5b13218e177ea03a6fd1049e
// input: apps/web/app/(main)/settings/icp-record/page.tsx 352ac1a3a83d9f8a996264639c8d1280bf667bd95f10dde71faa7acd91bd4cd1
// input: apps/web/app/(main)/settings/import/page.tsx 1d4a7124cf1157a41650d821e146d3e0510765f9a8a121659cbd018ba84ac2c1
// input: apps/web/app/(main)/settings/llm/page.tsx 33971a847f01d8bdf10692af698fe91335feac6e9ed338a50d259cc3d29ace13
// input: apps/web/app/(main)/settings/login-security/page.tsx 10d923762ae80c83ad25b1471e24c833c8afe3145c2a352515dd2a0f88dc0b9f
// input: apps/web/app/(main)/settings/model-record/page.tsx 14fbf795ca1be17902174485c347fbd5a968c8fef2c7e0a6f9f51f0f90cbabbc
// input: apps/web/app/(main)/settings/notifications/page.tsx 0d55007275996e6dc6ae202244b7692f6ced73e2354eeabc864a0852606d4a29
// input: apps/web/app/(main)/settings/page.tsx cd858cf8ddf233183ee7ac6eb877f7987436aed3099e0a34a92f6c0a7e867f27
// input: apps/web/app/(main)/settings/preferences/page.tsx cd29e7d109a5406cb5db7fec4c05e74478b5d7a7a9d4a33a22b4f2c340d2f0a6
// input: apps/web/app/(main)/settings/privacy/page.tsx 49d1461e35d3cfe2d70a4a2757713f1fc3e0a1ac84e8c31e55703a93a4fda401
// input: apps/web/app/(main)/settings/security-log/page.tsx 3bc34ec087b95c50f9d8eb89aa18ab9ae1ae973fa92023f9c63361cd6423e507
// input: apps/web/app/(main)/settings/usage/page.tsx 5e7da09d44d1df492f41dc82b8aa04525dc3ba5982030172e8496abff8b557bc
// input: apps/web/app/(main)/share/[code]/page.tsx 167c448e4b4a8fc29be5687451d9507f01ee71ce9633cc34fae01875dea45992
// input: apps/web/app/(main)/share/page.tsx d5df784435de4fdc6af70d10d3c1dedeaa4359289d56e9d4da7778f0acddb552
// input: apps/web/app/(main)/skills-market/[id]/page.tsx 22c9297245a249350e204aacc1e1e978198704afda124abd0e11d6e06c91f8f9
// input: apps/web/app/(main)/skills-market/page.tsx a766040ff3b687a5a3d7149bfcc1290d96559d2472a5240a23e5bd2b134ba600
// input: apps/web/app/(main)/skills/market/page.tsx 227224af7ae4c6e5734642c4557bdf269f5a7f33fa333c402a8d210decfdf310
// input: apps/web/app/(main)/skills/page.tsx 38765932b5d79e111a9d91fa22317363d4be64742dd17ae1e1d012e9cd098f40
// input: apps/web/app/(main)/spec/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/spec/generate/page.tsx a7119f967454163db01bc31ad90fd56e274c5e20a4d382b187e0c00d17e2babc
// input: apps/web/app/(main)/spec/page.tsx 6e073eae2f146260862cedbd9127032e3598b2b16b4cfb70de04a2b273de6880
// input: apps/web/app/(main)/spec/templates/page.tsx 09194658681769e573ae332a8d93d9c86c64c7cf2ca8bb6fe7c31eac16df990b
// input: apps/web/app/(main)/sponsor/page.tsx e1d0251b33321dc4220e68baad4ac5a70aff6eff218c8a4fa22c42412098556d
// input: apps/web/app/(main)/stock/page.tsx 0c953ff7deb722e5d472f222c587434b68c14b538dd4d08a311643ac15a5323a
// input: apps/web/app/(main)/student/certificates/page.tsx 0dad9b93d8cd38f4d1615d1ec69516a406ea34537bf19b296be3ab0b4875bb64
// input: apps/web/app/(main)/student/my-articles/page.tsx 52fca96f51d2c14f7659c258f723ed6e148f26a71248c392117c2cde332388e9
// input: apps/web/app/(main)/student/my-asks/page.tsx 15011a60e598b4bc7c0d284558dadf73c214fb6d4f2331ed85d5f1b1e2f56645
// input: apps/web/app/(main)/student/my-circles/page.tsx 1f38086b168d2145e632562250bf7d2fd5a63982f8432b8c691ffabf5c5da3a9
// input: apps/web/app/(main)/student/my-comments/page.tsx 3560689c8415d54efc9979800b2b4f17f96e3b61661369cc355125e6e0705ed8
// input: apps/web/app/(main)/student/my-lessons/page.tsx 88c927eba0df02e779cd3ea095791d8a9d2b3585c688dc02baea4911be4fce54
// input: apps/web/app/(main)/student/my-resources/page.tsx 8c86463cd39a82d80b2fe77d0c3b7a8af2c8e1ad0cb3478bd3a5bd8f3b5d3489
// input: apps/web/app/(main)/student/notes/page.tsx 8399b9d1c53194c5a6630ee8c76969e42b77ce1e3b5fa190bcf01f3b66608e63
// input: apps/web/app/(main)/student/offline-records/page.tsx 91825e6a918fb7ca123b82ea18013ebe7a7c8b527840b4ea416e04efcb1be1b2
// input: apps/web/app/(main)/student/page.tsx 24e11b8d7dedf83f77d20ff1e4336d2f2b1fd26d1188977f49e8e8ddece69705
// input: apps/web/app/(main)/student/papers/page.tsx 97837a29efe0fd249f91e8b27409db7c127df365365008b5ed987b564c970e4a
// input: apps/web/app/(main)/student/wrong-book/page.tsx 38d595783c7e41c3c62d24d3196aa844dfac307254a44fd128c3c9ba10c335ae
// input: apps/web/app/(main)/subagents/detail/page.tsx 67bd2d0c222fa08a830ac3af06e599b5b08194699537fa4d87e95935747bc111
// input: apps/web/app/(main)/subagents/dispatch/page.tsx a29e7298c9d24fb2905d5ed23ca5194608c9819c6e33f9dc6cc23b25f4dace90
// input: apps/web/app/(main)/subagents/page.tsx 45fea481e8f1593b7db5dcfa179bb2f56bb982bd73ab5c65aa43155322ce3306
// input: apps/web/app/(main)/subagents/topology/page.tsx 2ed28c8422d413caaf4181e7ce1a7162d7430ceb42a1d3e4a1d16143b3097cc1
// input: apps/web/app/(main)/subscriptions/page.tsx 217f42b4c9a3925e7969ef12c36ee08739f56b181d36bef6ddea492ed27f65ae
// input: apps/web/app/(main)/support/page.tsx 5e1be0ee17e4f704eb9ff03c3f8d0a9009eea2ce1878d8f1d44597602f8a9034
// input: apps/web/app/(main)/tags/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/tags/page.tsx c1a7c83835a0c9bbca62b5f33f4def381ec6553e13efa89169e4cfc738b70cb4
// input: apps/web/app/(main)/task-receiver/page.tsx d2f7ec24e0bcc2e4290862e6e996b4e4ea9c9a632e5cc9839b542a31089f718f
// input: apps/web/app/(main)/team-knowledge/page.tsx a7a6b9df6152b4767f4c1e507ad92cf8ee65cf00f6e548af0f5e15c164294e84
// input: apps/web/app/(main)/team-memory/page.tsx fcadf4f92141b01541502fdbdab2ffb5c2eb8ae4b53111e557406b9b550d2a88
// input: apps/web/app/(main)/teams/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/teams/page.tsx fd79075e9d6b0c8cfccec4bbbe823158d78eb696df61216524e8937b8b9de935
// input: apps/web/app/(main)/token-value/page.tsx 51fd0c8ea8ef2c929923a2272bf4d273596b3b4d257d55e42ac3359cc23284a8
// input: apps/web/app/(main)/tools/page.tsx c1739c08fb0e3e1534c04aba8f212863544bdc6a40f26ef3d4ec87d8c19ace82
// input: apps/web/app/(main)/tools/pdf/convert/page.tsx 896416df7082843b3e8d235c7602e745403fbe2082b87a0641ab5c583f8e8ab6
// input: apps/web/app/(main)/tools/pdf/merge/page.tsx 85a41758770c58853fded816e0d9432756b5f7d96d6c06449320a5a10021efb5
// input: apps/web/app/(main)/tools/pdf/page.tsx 1fe320eea43449251a8dcf0843ae903e88abb59c427894c62f5cfb4be3b4f48e
// input: apps/web/app/(main)/tools/pdf/split/page.tsx c98aabd570ae469a454eddc9d091a47ee81442bf7213dd2cc334e80fe4c7e394
// input: apps/web/app/(main)/tools/pdf/watermark/page.tsx e1eedf45077e5a2d472c076d15ad74d98d952d64393d8f08a04720e3c8b1f332
// input: apps/web/app/(main)/tools/voice-stt/page.tsx 59098c66f3748987152b91af55f542cdb8e21275cd8baa96267b969bf55f4db2
// input: apps/web/app/(main)/topics/page.tsx c4d65e3e0f27680dd958404f0b195bfa658a9045edb1b183b9bbfe8d56995e19
// input: apps/web/app/(main)/traders/page.tsx 525d13d7ed170ad3b8b7fbe538396f977c141274d6b77b39f1b198fba80158ef
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
// input: apps/web/app/(main)/user/articles/page.tsx 2be46cc4dfdc50f4792a8ca582b20e2e577c960d0839b3c052d6ab78a84a46ed
// input: apps/web/app/(main)/user/ask/page.tsx bbb3c8f056d013de4d1b3f6837ef9b092afededed1ac77859457a264f358a080
// input: apps/web/app/(main)/user/circle/page.tsx 7358ec4b119c4ed8294bfb54eb8ec4633e367a3b0987427d5f530ab6fb822c4a
// input: apps/web/app/(main)/user/comment/page.tsx 08a40756abac2c8e6863991164fe6a3d63b49e2d43ddc91df597dd586f2c8adf
// input: apps/web/app/(main)/user/exam/page.tsx eca652e994dcf97e5f644317192ea1e65e3eec0ac09885a060410b4708b19714
// input: apps/web/app/(main)/user/fans/page.tsx 42626ee58b7fab02d0de8432c675307f8e4589ed314fc705597514010e90d41b
// input: apps/web/app/(main)/user/follow/page.tsx 8a98b39860066159c4ea24201f0521a6d63b2857af26dae450781016f83fd238
// input: apps/web/app/(main)/user/learn-record/page.tsx f6807cbb93501da358e712df4fdfd5572d51c208b51266ab38567eee93a2b4c1
// input: apps/web/app/(main)/user/page.tsx 90e1734021e341936e8414bbeece0e57c26a418454139749805082f243b1370b
// input: apps/web/app/(main)/user/profile/page.tsx f7e59544030ef92221dd9ffa1817aa61a09bed605cc2747193b603f22bfb8324
// input: apps/web/app/(main)/user/qr-code/page.tsx 597695eab437aa44aac5b06ee694b859d14f58a4ba6ff2eda52b76a040fd1f22
// input: apps/web/app/(main)/user/realname/page.tsx ff242b262e357b7dfc46452f037e7b693638564709de386797c3b3fb41c6bfec
// input: apps/web/app/(main)/user/resource/page.tsx 998bb9a3aede02f1c9c86737a1b55b91cea4bf6f92bdceeb14417bb0e5d9e5e8
// input: apps/web/app/(main)/user/security/page.tsx d50691f523947446c88f1b54d13c376d114564873f45a49b754dc5bf716b6a0a
// input: apps/web/app/(main)/user/sign-up/page.tsx 7b40010fca72ddc7d1bbd8ee753eb8aa586be052107994df60fd19f483396756
// input: apps/web/app/(main)/user/subscription/page.tsx adcdd9d4078ac7f4470b86e25a9513967d24a5cd6f052b502e9fe5b82d9c7707
// input: apps/web/app/(main)/vip/details/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/vip/page.tsx 580a7a463564b86a7720ba20e89a7716b7f74c43609013b6bb6a25408f61e71d
// input: apps/web/app/(main)/vip/trader/page.tsx 7beea9a0dac78ab999e606a2ef42b9a7f09db1d6cf6efb1442e99ffab842fb0a
// input: apps/web/app/(main)/voices/page.tsx 0f3b48f67c1b50a4d822b423d2d1823b74ed14b2e7021e20c0a0f44d9e0f2554
// input: apps/web/app/(main)/wallet/page.tsx 4e847a6671bdfb00232a6f58a919cc15f99ac7fedb8e08be4f8973872f123a87
// input: apps/web/app/(main)/wallet/recharge/fail/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/wallet/recharge/page.tsx 27fa1d557fcdd7a0a79ca423deb8fbdacb4d0ed04c4b7137d48333210c03ba91
// input: apps/web/app/(main)/wallet/recharge/success/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/wallet/withdraw/page.tsx 79d84910f64e5f0f951cfe0c61978ac6e113f5c529eff29f4937e28df7c47e95
// input: apps/web/app/(main)/wallet/withdraw/records/page.tsx 6e7779d04d5a17d8c8c901f024a6577f52586438259ca9f62d0dcc67b0b4af75
// input: apps/web/app/(main)/web-tools/page.tsx 989fecd8617dd1e1cd29dffe42488823b7154a773231fa2d51286be28e0f4f03
// input: apps/web/app/(main)/workbuddy-reset/page.tsx 87bfa8554c3f815d1094ae29887d7b1af53e6a0033b761f217fa45eac110ded7
// input: apps/web/app/(main)/workflows/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/workflows/instances/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/workflows/page.tsx 04023d6b22d63b60eceb775e64e213bddfab0a02b4ad697969fb33d9a199ddfe
// input: apps/web/app/(main)/workspace/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/workspace/page.tsx 3b716362dac4912f7c2de603f9423b0e61f1cc9243d136b626ab16a2368fda30
// input: apps/web/app/(main)/workspace/permissions/page.tsx 7a2f58b691152a91e7e99fe4801d385a08951241bffe3dd3e845367f29350628
// input: apps/web/app/(main)/zh-TW/use-cases/ai-design/page.tsx 968e3a59c964cbbe36456b1a0b785d248128d5b9e0a1f4f2339a9bcba43191bf
// input: apps/web/app/(main)/zh-TW/use-cases/ai-edu/page.tsx 186a51dcf9e97017ac78ee4ef025f3ed404146d2358be881a71553ea41083385
// input: apps/web/app/(main)/zh-TW/use-cases/ai-marketing/page.tsx 84f22e5df326fda0e10f00af56ba40e87f493ec071241c4468d918d517339ab4
// input: apps/web/app/(main)/zh-TW/use-cases/ai-research/page.tsx 2f0815dc8fe7797fecf317e3275152e964d74d3dab59c17ce9780134e67095af
// input: apps/web/app/(main)/zh-TW/use-cases/ai-translation/page.tsx aead2f28cc9f6b74152e8351aad8999356f4f0c4be570ef8edbdfbb4a58b3837
// input: apps/web/app/(marketing)/page.tsx 8004f807b187bbd827d227e7bc43dff4efd301968e177cfdf807c1d700681c97
// input: apps/web/app/en/agents/page.tsx dbc52d72f94e290fddd12f28008fcdd12c312ddd8a7d17c5f44cbdec145f1fb5
// input: apps/web/app/en/docs/page.tsx 439673e6796a965c8a7ed66fe54739c13d61f0a8d118b6590759ab1830297555
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
// input: apps/web/app/status/page.tsx 8509c1bc6272c3e141461ae79a70c998d3f8298592eaf936a64bb9be2402b464
// skipped: excludedTopSegments(sso|h5|api)=9 pages; duplicatePaths(保留先扫描到的)=0
// generatedAt: 2026-10-27T00:16:43.264Z
// IHUI-GEN-PIN-END

export const UI_ROUTES: { path: string; param: boolean; group: string }[] = [
  { path: '/', param: false, group: '' },
  { path: '/a2a', param: false, group: 'a2a' },
  { path: '/about', param: false, group: 'about' },
  { path: '/account-pool', param: false, group: 'account-pool' },
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
  { path: '/admin/monitor/panels', param: false, group: 'admin' },
  { path: '/admin/monitor/wallboard', param: false, group: 'admin' },
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
  { path: '/admin/relay/account-pool', param: false, group: 'admin' },
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
  { path: '/domains/ai', param: false, group: 'domains' },
  { path: '/domains/content', param: false, group: 'domains' },
  { path: '/domains/edu', param: false, group: 'domains' },
  { path: '/domains/personal', param: false, group: 'domains' },
  { path: '/domains/trade', param: false, group: 'domains' },
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
  { path: '/play-beta', param: false, group: 'play-beta' },
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
