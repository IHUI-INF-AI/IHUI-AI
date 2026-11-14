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
// sourceCommit: fd3cad81c727c2637b6fc59cfaab539315d57afc
// inputsSha256: 8049566d6d5cd9fa990e37225ef4785bcd7146fc5e3f31c30f608ef88111b70f
// input: apps/web/app/(auth)/apple/callback/page.tsx f328ceb139ed3b61c0e79bc671e93885a6c1e1b6b7c356febbc97f3255da2075
// input: apps/web/app/(auth)/callback/page.tsx d17f249c8506951babf768ff47e0800dc7ed191a9c80ddb124142a8520bcd80e
// input: apps/web/app/(auth)/forgot-password/page.tsx ebf3e4b50c09d9871131b9fbdc5cddb79c0f9c73bc5775c5ce56dd08a0fa2443
// input: apps/web/app/(auth)/google/callback/page.tsx cde1e4556035c25e575647a27a27b2d58eef2f65726a875747af87d31f0a9cba
// input: apps/web/app/(main)/a2a/page.tsx eb8d56ea5abc0503bca356a62f3b8806b506fff8984b356096a9bdc683f9f73c
// input: apps/web/app/(main)/about/page.tsx e3d901fdc0b500c8971b22861417d3a4f271d3355d8f0d7db1411d80d6948c40
// input: apps/web/app/(main)/account-pool/page.tsx e433ef5618d3ac5d08e807c91f202a107ecd66dd6960cc0f5d21b28c990b2532
// input: apps/web/app/(main)/activities/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/activities/page.tsx 9e7a9cc7d0adf040df7fbc5e49c716de8eb3683f09da47929b8a75ee3b2f3b2b
// input: apps/web/app/(main)/admin/about-us/page.tsx e27cf1b28eb854fb50b56ced7a823440ffc4f8078085f38f7d04bd625b34baf0
// input: apps/web/app/(main)/admin/advertise/page.tsx daaa6ffe59856d1f880175a4f0bed169aa5fdc07ac2e3b3aeb1ffaffaf3c91b8
// input: apps/web/app/(main)/admin/agent-rule/page.tsx 89d93d95cfde3b3928d53b50d504b5bf5ce5d89a67412a8c9a8608f79f680883
// input: apps/web/app/(main)/admin/agent-rules/page.tsx 934e6af96b5130c9f89e32c191c25989ba7bf87ead913faaee21ca2e0e898a9e
// input: apps/web/app/(main)/admin/agent-task/page.tsx 70f2a736f9c9eb7d8a471aa64c1c3114c6e324ac43cb3dbf8199accdc84330e3
// input: apps/web/app/(main)/admin/agents/categories/page.tsx f3bf0ec20c3afbd0660d3adc12a0aa9df83b0a03d87fa7810ca9b0d7a3f16432
// input: apps/web/app/(main)/admin/agents/examine/page.tsx 1c397d104ed34b2a02d3e902d3d0d3b30b2119a7b2b663528039fff6faf34365
// input: apps/web/app/(main)/admin/agents/page.tsx d7845d2b0f1705becfabdccae777d2c36ef320849ac938377352fe436e434720
// input: apps/web/app/(main)/admin/agents/settlement/page.tsx cdf2ee17ae9b5560726edfe81e7198bf937c4826c5ce6ba808ae274fefc74b90
// input: apps/web/app/(main)/admin/agreements/page.tsx 3dd482894368242d346524e29b81fb7de90ae33ac2715e23c5a34a9a665cab18
// input: apps/web/app/(main)/admin/ai-cost/page.tsx ffee1e8a3fa8a2e29abd8eb3f3ad9806dfde0bbfef1a260f914545f64851be44
// input: apps/web/app/(main)/admin/ai-feed/page.tsx 673c7167e902d321a907a950b631b2a86730e07fbd1ad08a73b65601355bfe5d
// input: apps/web/app/(main)/admin/ai-gc/page.tsx 3b7f8ecbd8e10dd4991d13103feb67c03df6956a80c8a56e193cd427d975ec45
// input: apps/web/app/(main)/admin/ai-metrics/page.tsx 12d76a57252859b0c2f8006a6956ff51f0e908465a73a065c57d8a9b8a3221b4
// input: apps/web/app/(main)/admin/ai-models/page.tsx 243b5eac76ab87f85f402627f477a2edf328589706005e062069533ce672834f
// input: apps/web/app/(main)/admin/ai-pricing/page.tsx 51a71f5aa9b6ddb9b16c885d7a2b2121cb69fa320896bf0e6a459bf6921979fe
// input: apps/web/app/(main)/admin/ai-skills/page.tsx f7ecefd78d6ced58516553afe7995db1a76223756e45934c7162dae96ce8a79c
// input: apps/web/app/(main)/admin/ai-world/sites/page.tsx 28b5edf31304cfcf9cbc84fa5da29d297bb66a71911d493ef58bb1d206d99a69
// input: apps/web/app/(main)/admin/announcements/page.tsx 29100d1d2d2143b909c3f2aab861520ceda9565552681c0bd4bb23c61d774a3f
// input: apps/web/app/(main)/admin/api-debug/page.tsx b48ea3c8bec22610139f563144446daf5e71e5445b1ea1a75feb0be0839b2a23
// input: apps/web/app/(main)/admin/api-groups/page.tsx 6de0ccfec7c8c76393eb391a4b6a9d19a9cbc61ff0455bbca6a98bb6b3bff9da
// input: apps/web/app/(main)/admin/api-logs/page.tsx decc04ab96204b89f274e0a0d397ce58673754bbe73696f8a5e9191e5b91801c
// input: apps/web/app/(main)/admin/api-platform/apps/page.tsx 7b4be535b52d4622b1dbd84756abf3f955476725c5f80109b83ed699ec8cac51
// input: apps/web/app/(main)/admin/api-platform/billing/page.tsx 75fe5f321b32555052d1ee437f9890a93e6dae0696025d6cea41952a16521dc8
// input: apps/web/app/(main)/admin/api-platform/packages/page.tsx 6e4f92d131b3c046d1d95913afff4fb508a8b101deffda07386b62d0a373572c
// input: apps/web/app/(main)/admin/api-platform/usage/page.tsx ea643bdc07ea4aaeb011602d85530b1a164ff26e279ac8ab768623a836e67301
// input: apps/web/app/(main)/admin/api-usage/page.tsx 5d97112471a387b07e2d388114c2ee3ffd929f094a920457560ba27186563890
// input: apps/web/app/(main)/admin/articles/page.tsx 012497454a135572ac85f393f772386881ecfe2142cb5f4364fd774b8a2d7aa9
// input: apps/web/app/(main)/admin/asks/page.tsx 8bf9245a5894a8b78dccf69330ebebc563f1f263c5b85965830b35d28a767dc5
// input: apps/web/app/(main)/admin/auth-accounts/page.tsx 1390e1bd68d302c845fb2deeb2eeb771c3a17bcb5a418ea71bfc9b5cdaaf1dc8
// input: apps/web/app/(main)/admin/auth-dept/page.tsx 293ee24e5bc1fb0edfac588c343ea10907d66a36e9a39ff0d2d298fc843526e7
// input: apps/web/app/(main)/admin/auth-find-info/page.tsx 9df04b659ed76206fcdd9e9a9e1a772f3e822200486f5ffd540ecdbecda7cdb5
// input: apps/web/app/(main)/admin/auth-role/page.tsx 5d6ab226a7011d7b12707ce1c8abe498c0475ca90c305290b6b7606bc93e5da7
// input: apps/web/app/(main)/admin/auth-user-vip/page.tsx 895a9fa86f7c953636a8ec1e2f78fdfda0ed55869f9c3a0715e78e690242f5e6
// input: apps/web/app/(main)/admin/auth-veri-codes/page.tsx ec0534978c7f3c083d5056e96860335e1b38b3525501a2db817a481d7c333ba6
// input: apps/web/app/(main)/admin/backend-health/page.tsx 44ca43197ad3b84142f6f182cd2d4b83042635c859797b9288f0bfd2b8f4d1b9
// input: apps/web/app/(main)/admin/backup-jobs/page.tsx a0fd9673df968a8e75e50a0e413fb65f500df876185de6f3fe4801f0a1fd8859
// input: apps/web/app/(main)/admin/behavior-analytics/page.tsx 86fb4834f81aa0e302d31eca6e90a1bdb2ef083556f98eb077fe4cf7794677db
// input: apps/web/app/(main)/admin/behavior/page.tsx 5cded6bcab023d2fba293961ed506391d2680a10bc74f33bac3c1c3d356f7aa0
// input: apps/web/app/(main)/admin/bi-dashboard/page.tsx 811c5b1e4eff9cc3dfdd0666cebb1ba5cd777cfdb2d5cf2553b2051858981452
// input: apps/web/app/(main)/admin/carousel/page.tsx 7b3d51d086b08fb259a04acdceae403c77db169ff7fb907fd8ec30f7f0634704
// input: apps/web/app/(main)/admin/certificate/page.tsx 6dc14c334c1d6591cc7efb3f210ad7585d7c096640fec841c5e8cde5d7b3fa48
// input: apps/web/app/(main)/admin/certificate/templates/page.tsx 6e8f16f9deea1dce5b93278edfc2a0dd49aae97c5cf31c65d10ec35928e82b32
// input: apps/web/app/(main)/admin/channel-quota/page.tsx 7c81ec839aa0765c979646ca90da6bd22c60e001840f38d75844e5227035b29c
// input: apps/web/app/(main)/admin/circles/dynamics/page.tsx 513fdf2f30ab985db0e9e6ff94315d6723b85aa412e1a7c62dcd0cae1c0e75d0
// input: apps/web/app/(main)/admin/circles/page.tsx cdfae1aeaf57fc0b5a9bde4fd3676042e26927bf4041e1cfb36155a0e0842b7a
// input: apps/web/app/(main)/admin/clawdbot/analytics/page.tsx 1f2c07852d29d509485e66ce2d9cac9143ead9b51e86abaa1de0a957ea7bff63
// input: apps/web/app/(main)/admin/clawdbot/bots/page.tsx 441bef7812f1f0a6db676cb9bb04976bc46846480cd38f068796ac4946d4fee7
// input: apps/web/app/(main)/admin/clawdbot/health/page.tsx c176888c819af8199eede1f05cd7190213c7239a9ffe08a6cf93495784cbf2e2
// input: apps/web/app/(main)/admin/clawdbot/messages/page.tsx fd4ef9b6d11a6c63ca8804c904b1555a3dc2236f60a7ad635e881d43d1cf2341
// input: apps/web/app/(main)/admin/clawdbot/page.tsx cc4622e6ab4f3ba468cb97a8d85651d93d94121aa7634da270a7215cf8c650a8
// input: apps/web/app/(main)/admin/clawdbot/permissions/page.tsx 513ad8bee8bc65599374cb5b0dc49a9c81382168c13441872a291f21d9f79a23
// input: apps/web/app/(main)/admin/clawdbot/sessions/page.tsx 83ec05fde4338ded67e4fe94779b79a37b1bbdf2c65ba1d3c60679ef8a8d42a4
// input: apps/web/app/(main)/admin/clawdbot/tools/page.tsx 34e50f5a6f2c14af0882209f536a6971b8a384f1cec11b0432d6f0ce756afd82
// input: apps/web/app/(main)/admin/comment-logs/page.tsx f82734a3215cbf4e1a057d2c24a693c967983c5bcd26ac92b97f86892e97ffb7
// input: apps/web/app/(main)/admin/comments/page.tsx 8c660ae2c74907c4900d7621d0a86775b07e7142a31038bd6c851812dab51169
// input: apps/web/app/(main)/admin/configs/page.tsx 47bba4e32a7c2051822a621aeff5c6cf9730826a22506d9ec20fe813a457e8c4
// input: apps/web/app/(main)/admin/contact/page.tsx 1cf98700a31e7e71f32d3e3b9f12f7806e73d4b5994ee7b362f838487eee26f9
// input: apps/web/app/(main)/admin/crew/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/crew/page.tsx f7ee4d5eda7b23f950cc77b1e93ff94e65635edc053dd7e3b8769ffa971c1da4
// input: apps/web/app/(main)/admin/customer-service/page.tsx a5c078a7ab2261559472791fee03df57a43000dcff2f88613d998778243de859
// input: apps/web/app/(main)/admin/dashboard-stat/page.tsx 96b3ea00a4fa7edc9d2ee54ebe6fe7bed37bd911aa8caadb2d6fcfb22ff22597
// input: apps/web/app/(main)/admin/database-optimization/page.tsx 5e6d8d57fdb839e582b226890879ecf5deee2628cdf97879f8097dd17e34a9bb
// input: apps/web/app/(main)/admin/demand-audit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/demand-audit/page.tsx ff0de8d0f04a73f1da487821b71e4641f85c10f22b355f20d12e225f11f84ee2
// input: apps/web/app/(main)/admin/demand-square/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/demand-square/page.tsx dc2395a6312da1c53e83ef158544874edbc4bd9f194606adfeb6bc22cf00fd1e
// input: apps/web/app/(main)/admin/deploy-diagnosis/page.tsx d7b69baf41a9d99bb64a5706f3d56fde2f8b75a0d3b095b30430b348d0839e04
// input: apps/web/app/(main)/admin/developer-link/page.tsx ad0b61780b1303b1d6db49996320c82743cc7427370fbf83cf5c7829a84b2d8d
// input: apps/web/app/(main)/admin/developer/page.tsx 37aa8f34206e355f4a47c6f8637f46257a877543ac6abf1a148b4d90644c5a13
// input: apps/web/app/(main)/admin/dict/page.tsx a4fcd323d605075d508c22fa692863a145457498d0c864d4e362050659b48dbd
// input: apps/web/app/(main)/admin/distribution/orders/page.tsx 464102b752e5b90d3e1f35dc22b00369f589c4de0f91c30994839f5a157f377e
// input: apps/web/app/(main)/admin/distribution/page.tsx 9376bd5cb5202eba75c2bfd2ce417633ae56092c08d615ed02bc6883c39b4c72
// input: apps/web/app/(main)/admin/distribution/rules/page.tsx 258b5a29b6cce959437dffdb9b903ce3faa196957d60d58c76b7e068541b0b38
// input: apps/web/app/(main)/admin/distribution/settlements/page.tsx 6fccb89b65823881762bbfff043412c5c11494a99acef7e4d9b1aa917cbc7716
// input: apps/web/app/(main)/admin/distribution/withdrawals/page.tsx 5f605f4913fed987d22bbf15c97a25cae83e8b7b770ab9145af23387a02c8d6b
// input: apps/web/app/(main)/admin/docs/page.tsx 54e1189b6bbe867648a742c349bcf8e36cf3ecf9185cde295bdfa786e798f6d1
// input: apps/web/app/(main)/admin/downloads/page.tsx b3500def9f12886e95a4940512c131801e862ad736eb0651c8f95ea30e5a601b
// input: apps/web/app/(main)/admin/edu-settings/page.tsx 3573ecbbd89811672ef00d3ddf784c9a991eed44113764ef1a77e42ec54fdcb7
// input: apps/web/app/(main)/admin/edu/answer/card/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/edu/answer/online/page.tsx eae7bad04213f8a05ab9fb24ac2f7641e0b91df7bf2c829256ebfec875cceeca
// input: apps/web/app/(main)/admin/edu/answer/page.tsx 6c81013b5d68c42d4325bb962aa4b8658d4c2927621f80fd1cd0bad151534037
// input: apps/web/app/(main)/admin/edu/answer/programming/page.tsx 00ac116a6e5f2ea35065480480bc9f7c96500847d4f05ff81906415ad053c979
// input: apps/web/app/(main)/admin/edu/certificate/issued/page.tsx 5a4fdf46e3d24b2d0239da5d1611ca3f2acdbb939245c17d9e32777fcfbeeabd
// input: apps/web/app/(main)/admin/edu/certificate/page.tsx 32baeaa4a0af50ac777bd6490d1c2735da89b237807616cde1e46912f4187525
// input: apps/web/app/(main)/admin/edu/certificate/templates/page.tsx 442caf2e1a81587e6ed3988d2fc95b6c095b9c335cdcfcd003fe55d857b3e73e
// input: apps/web/app/(main)/admin/edu/class/members/page.tsx 3cd706f879aaac2e65876560d638a2bb8082b56eb831c52e0706dcbaf4acace8
// input: apps/web/app/(main)/admin/edu/class/page.tsx 86c64a9b0d2a96b117a4cfcd2c6c1789d1da14cddbad55de3b743e4bc59d3754
// input: apps/web/app/(main)/admin/edu/class/schedule/page.tsx 14b11e8eed1aa8bc99c8c90c75a2973cdd3c0fe2845c2b96a9d966fbd1eccd5f
// input: apps/web/app/(main)/admin/edu/course/audit/page.tsx 64e6eb3851d4c0b1a0444747cde124967226e6bbd5f042277dc9fed5645a83ac
// input: apps/web/app/(main)/admin/edu/course/categories/page.tsx 83860287ce1b56a618176f812e0b47af249b55d90021444db5dbb26e21df7091
// input: apps/web/app/(main)/admin/edu/course/chapters/page.tsx a22bfac21970125d6749666990786da3d3d8767ef5d2fd3a23883905df32acd6
// input: apps/web/app/(main)/admin/edu/course/page.tsx 7a593e0e95daea2e626ad5d4e6bc2eca6bb67412216773d9d99ba6cafa04f5d4
// input: apps/web/app/(main)/admin/edu/course/pay/page.tsx 77c46a1b181f2600acb4753bd48e33b45c2d2ed665d501ca939b709a846d0436
// input: apps/web/app/(main)/admin/edu/course/platform-log/page.tsx 2118c2b253760ae7e767819c10b2264972431afe5ef8d2f4c0eff415399747b5
// input: apps/web/app/(main)/admin/edu/course/trash/page.tsx 5407f3510686779dff104b1bde9428bb43c30cdc4755f7b5006cd56b2b0e5cf0
// input: apps/web/app/(main)/admin/edu/exam/arrangements/page.tsx 7d68d48b5abd69d9dc97e56cd1c79fa8aae1ed2f0830908872ce73ba580c6357
// input: apps/web/app/(main)/admin/edu/exam/categories/page.tsx a6fef0aabf25aa5ef89bfd88ec71b9ff606b473db015d271bc96d0764e565d66
// input: apps/web/app/(main)/admin/edu/exam/grades/page.tsx 945e049d6fd4c34b32adc9d4c85473de63ba8063a44daaa154d59f38825cc1fa
// input: apps/web/app/(main)/admin/edu/exam/page.tsx d6b2eb5d8e1fb37cc48e2afde300204e21fa7a40ee8a38c506d4275c58cfd156
// input: apps/web/app/(main)/admin/edu/exam/papers-manual/page.tsx 5d14812ce2b3e0be64d7153901a892febe4c519254eb9c143585671995eb40fb
// input: apps/web/app/(main)/admin/edu/exam/papers-random/page.tsx adf20e60384071aec4819e40c682d8647c06c19fc016874acf41131ce711924d
// input: apps/web/app/(main)/admin/edu/exam/papers-template/page.tsx a6e1dfaa8a0539c6db20b3f130ade846245b9d9d18afdf31c8396f4164ed2b42
// input: apps/web/app/(main)/admin/edu/exam/questions/[type]/page.tsx 85511830b4645b36d7610541fb8a42196d64ecee166ccccadea4af53402b668c
// input: apps/web/app/(main)/admin/edu/exam/questions/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/edu/exam/ranking/page.tsx 7e84df14b397bf80d0401102bf172767f12d9ef4972f44728f0922a34d78893f
// input: apps/web/app/(main)/admin/edu/exam/records/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/edu/finance/invoices/page.tsx d61163111d5135de89f065b19c0e07eee9665cfc09b7f83955d980d5c2302191
// input: apps/web/app/(main)/admin/edu/finance/page.tsx 890ca6db601e5012b2a82eebf0c4c2d64fbd54be29f415c4f719b92168131325
// input: apps/web/app/(main)/admin/edu/finance/statistics/page.tsx 313c8bea46fe5a5c1d5afd8a0b5eeba0aa41c3ab7786ad5ae4059fdc5fa9da8a
// input: apps/web/app/(main)/admin/edu/learn/community/page.tsx 71b103c12eb9d4930277ec1e7948f34d983157ccb96630afa1f85e3f44c03b07
// input: apps/web/app/(main)/admin/edu/learn/homework/page.tsx 05ead5e35de8ea261268c335e157c85fb9906014ff0d557f4e3fc2af27cbe124
// input: apps/web/app/(main)/admin/edu/learn/live/page.tsx fa769e5ef54e76cb00c8a3e7f4bdfa1155c2810c46a82a78260a5c9fc92c0d0e
// input: apps/web/app/(main)/admin/edu/learn/maps/page.tsx e06417d597e8366578058dced464c5ae0df8703ef553290d3bc6684f76f973a6
// input: apps/web/app/(main)/admin/edu/learn/materials/page.tsx 0059381cb9b99fc2b8509a22199e358c946dd7ab5e21c82ad20a54193049833d
// input: apps/web/app/(main)/admin/edu/learn/page.tsx cd08dfb297068f82a0c993d019beebca09e6ffa9521c37579ef03d86d77aad89
// input: apps/web/app/(main)/admin/edu/learn/plan/page.tsx 0a59b6116d7eef899d1e42c23528154e6a66ef97472520a52ae51017f586a09b
// input: apps/web/app/(main)/admin/edu/learn/progress/page.tsx 88ba73be285462bea44015b1ca377196171a5a713732bb1d9726b2a902d0b05b
// input: apps/web/app/(main)/admin/edu/learn/ranking/page.tsx 9dd367d006bf98cd72f4bcb63e12e9ae7fb1643ff2dccbe1e3ee974a3d2e1436
// input: apps/web/app/(main)/admin/edu/learn/recorded/page.tsx df2bbac1c02f836026f9f1b1b03b80c5ce63a331a343519e26de554cd97f4001
// input: apps/web/app/(main)/admin/edu/learn/records/page.tsx 97281793d06a4b212b56a582408ab4250835a997ec2864e143d37dbb524396ce
// input: apps/web/app/(main)/admin/edu/learn/remind/page.tsx 10b63a0f01c81bd64f9893e435dc46f48d3a462d62066bfe2ddd40d63f487586
// input: apps/web/app/(main)/admin/edu/learn/signup-batch/page.tsx cb7a500a2359e540143e0483d5e0ff7b8185200a2428670f8e140c9fa6ef70fb
// input: apps/web/app/(main)/admin/edu/learn/signup-batchlesson/page.tsx 62903262494234da8a0a3897fb803acb213dbe4d91b135cfba288ed9641126b1
// input: apps/web/app/(main)/admin/edu/learn/topics/page.tsx 7ced3f757bce7faa25ff4eac76a97c40157c29a642e15d76b4299d6e7a757f38
// input: apps/web/app/(main)/admin/edu/organization/page.tsx 1d67e6a214c9de610c50f7ace9c8e745a15024a9164d7237f3ffa22b42a97f41
// input: apps/web/app/(main)/admin/edu/page.tsx f6bf2a819715a4272601665a5001b62c5e447185452d64d5ce846a73d1a3fe3a
// input: apps/web/app/(main)/admin/edu/platform/page.tsx 6adebb103e5a03f76bc46190bde0f62455fb947f0cf6394f8fdb30510b5c40ad
// input: apps/web/app/(main)/admin/edu/reports/companystudy/page.tsx 0c0b37ba3d940ba1d62292dd8745478a69f53ff27922ab5bbaa536f79b6fbf6f
// input: apps/web/app/(main)/admin/edu/reports/lessonstudy/page.tsx 4136b03dd649c08caffe3934abe272e934ed497069b600ad2f79ee60b4f2a2a1
// input: apps/web/app/(main)/admin/edu/reports/memberstudy/page.tsx c6bfca2b8b4a63f2bda026d0320d0112adaede1df8c2d7926d6d04b0d445d427
// input: apps/web/app/(main)/admin/edu/reports/signup/page.tsx d2db23f76963cf7f61edb957bb91ba8714eaab2d36e9784100c0f26dc707f1a6
// input: apps/web/app/(main)/admin/edu/student/detail/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/edu/student/levels/page.tsx a8f777c412404caee6e8f1aa6228ecf576664e2436628a54842a36a79eb6c2ab
// input: apps/web/app/(main)/admin/edu/student/page.tsx 750e15e1f0c479922544f90706a2da4eba0e4be9261d597c5753afebb3a5513e
// input: apps/web/app/(main)/admin/edu/teacher/detail/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/edu/teacher/page.tsx fbbffd1967e6c7212736983e58d8bdb31b6d745fd968e44ccd47586a0373a348
// input: apps/web/app/(main)/admin/edu/teacher/review/page.tsx 66625c389ee0daca329f1206526b0d1011dabe8ae59c9b086a9be31b66e58d2e
// input: apps/web/app/(main)/admin/edu/user-platform/page.tsx 351580a7610a0a680ca958253b75eb7bd7f527e1276b51699e980e289d73d7bc
// input: apps/web/app/(main)/admin/edu/zhs-identity/page.tsx 877ee224ba21183604f420dde13aa4a2cc7ad6fbce799f310c2d7bd819a42fe7
// input: apps/web/app/(main)/admin/error-dashboard/page.tsx 7e44e602c05535c10c4275c9848dfde96159a2d7bc624af121d11598fe2addeb
// input: apps/web/app/(main)/admin/event-bus-monitor/page.tsx 9aedc75dbb23ca74ee2f46fde4f586569d0c80ec4c80c34c9030425a0cf18c61
// input: apps/web/app/(main)/admin/events/page.tsx cad549f85e30758f75e4bc357c0a5eaf2728a63f25d763786f2dd993bc062271
// input: apps/web/app/(main)/admin/exam-marking/page.tsx ea66cf3545c823bbf0ca43fef0bfd761bceeed56c8b455c7da6fbe5eefd92268
// input: apps/web/app/(main)/admin/exam/categories/page.tsx 163ac24e26aa4dcefd23ba2fc6d7ede84c2e149524faf2e92a1e1cdcfdf3b36f
// input: apps/web/app/(main)/admin/exam/page.tsx c17fbde2106303907f3139a30fff39641a9ded4071e956b6cebeadbbdd16a104
// input: apps/web/app/(main)/admin/exam/questions/page.tsx 66edcb2907e55a9a47d1d60a878233400949c085414f803b81c61bf99098e66b
// input: apps/web/app/(main)/admin/exam/records/page.tsx 66edcb2907e55a9a47d1d60a878233400949c085414f803b81c61bf99098e66b
// input: apps/web/app/(main)/admin/exchange-rates/page.tsx 339b2cec9cbd529976487ed01b76538f4db15e030a87d0d0c22e46e76021b852
// input: apps/web/app/(main)/admin/feedbacks/page.tsx 0b8f7f587d4aa6002725aacf6ef4e4daf723e5925ff9238a9d09c85822b7d98d
// input: apps/web/app/(main)/admin/finance-ai/page.tsx c5c2c5c284dae0f225d99a1ec1d40151b6ed230c815f88b441183c3c4acf90c9
// input: apps/web/app/(main)/admin/github-app/page.tsx d39fce19cc0f920f2ff0b342e5bd5427c08849e625d83164d02f6f17424c83d9
// input: apps/web/app/(main)/admin/gray-release/page.tsx db293ce9fcecb15175a15323feb4a367f58486b3d697ed532b075c01b756966e
// input: apps/web/app/(main)/admin/help/page.tsx eff70194426b19eee76958dfac04d6a1444f2220736d73164af54a4bd1f20eec
// input: apps/web/app/(main)/admin/home-schema/page.tsx dc4ce8e0553789f28c2f88cccff8671c82af3c526e7b095b5186f140257af627
// input: apps/web/app/(main)/admin/hr-attendance/page.tsx 2a4afd28e4aa74b4e86ab4af9a135bfaf4ced204f6ca116534e5cc07c3c1f8ea
// input: apps/web/app/(main)/admin/i18n-dashboard/compare/page.tsx 3b751a9676ee81147b354d3d0eb5c07d531ce198ddf2b07102631a19e7d838e0
// input: apps/web/app/(main)/admin/i18n-dashboard/missing/page.tsx 0ca10935aab8fee788bd1ee4d7eba0a6b17b6e4ed0b9420fc5b828775f2beb7d
// input: apps/web/app/(main)/admin/i18n-dashboard/page.tsx e3b10d41c8ad7cc21f4b6c86e7604e24d82e04126c1ac0a6b63e795955ce9f6a
// input: apps/web/app/(main)/admin/identity-proportion/page.tsx d5618787bbdae9fb9230be54c7bbd0303bd94d84325590935f49fc0652fbb49c
// input: apps/web/app/(main)/admin/im-channels/page.tsx 186fbc488dcad0bab1a1ad4b7c7ea52355a0dc43c16e5089c65ac6058a17f467
// input: apps/web/app/(main)/admin/integrations/page.tsx 1310972c2dfc51b7706ac6006cc2dc11c59c525a63a7664effeb891664f0ce48
// input: apps/web/app/(main)/admin/invoices/applications/page.tsx edc643210dcb8a680a04be5b5e91cfb567da5012f4416e2dd0a6e33b867744c4
// input: apps/web/app/(main)/admin/invoices/page.tsx 0b77dc0f15772eb9186a77c48b99567863f4901d837af148dfdfff57364cafca
// input: apps/web/app/(main)/admin/invoices/titles/page.tsx 58c80c5b2cca259c61f4f4841032cc5b517ebb5493af8de4d765909ea9469896
// input: apps/web/app/(main)/admin/knowledge-rag/page.tsx a0cefef2ceb68c6503165db8e49a8683bee19cb9d879fea73406752dc6936708
// input: apps/web/app/(main)/admin/learn/categories/page.tsx 131da78d70e6365036373cdb35cd70925d74d95c9650a367163cad532739b823
// input: apps/web/app/(main)/admin/learn/chapters/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/learn/page.tsx 701818f754e8ca93bcbe9f58052a2f7b047e00430e624188494015b56e262c31
// input: apps/web/app/(main)/admin/learn/signups/page.tsx 5e8510538b2493f62d51080663ca347628b215a371d7c164c134577f64c04d79
// input: apps/web/app/(main)/admin/learn/topic/category/page.tsx cdc35476d173215a4032f31103257ca46aeb50a6ecf2271417a91f0430805353
// input: apps/web/app/(main)/admin/live/categories/page.tsx 0b8e7d7f97b7c44e845098ff1eb5cf0df70f881a5c69f5bdcbce8fe1776d48aa
// input: apps/web/app/(main)/admin/live/lecturers/page.tsx 52582426e6450b588846a15cc9e1f486e8f1a8a680297078644b060d13a2716e
// input: apps/web/app/(main)/admin/live/page.tsx 0f05ccc2d0608f19b0c773ae5ea1628d1337dfad3cb2b6183300e30bf38e5e88
// input: apps/web/app/(main)/admin/login-logs/page.tsx 83cd501f61baf887a8efb60b51daa8ed8a516cf742357681c28973c9df4d4434
// input: apps/web/app/(main)/admin/logs/page.tsx 91963f1c1101c1449b240649335456ae9ec0131854b61b1648c5213c280bc814
// input: apps/web/app/(main)/admin/lottery/page.tsx ea4bf9a7a38b0402c8a0c94053e390e68d6468aeec3ba58f0440f8574ee20701
// input: apps/web/app/(main)/admin/member-groups/page.tsx b89f72449e6563d8091b83bdbd7b273b2fb63b61f1c9b7989f391ab74289a539
// input: apps/web/app/(main)/admin/member/blacklist/page.tsx f0beeff032ff49acdd39ea3bcc799d07c9ab341af4639bc91ef8a17844a995e6
// input: apps/web/app/(main)/admin/member/companies/page.tsx 0c4072466560064ecef9916f83810a100a7de847a77befc930c6b53df3a758ee
// input: apps/web/app/(main)/admin/member/company-types/page.tsx 07f41d327abd4138e666e9d0bf4ec182078b1d033638104310252480b019fc09
// input: apps/web/app/(main)/admin/member/departments/page.tsx c77684646042daf5efdd6e88c7b98f160e0df4389f570005bde53d0f482da251
// input: apps/web/app/(main)/admin/member/logs/page.tsx 128de647def37d82eaf805b4a17ae11de5ce49234ea92fbc7c942aacda86eba7
// input: apps/web/app/(main)/admin/member/permissions/page.tsx aafb3ebb96e19382fdba348c70291157ae32079c1adc9da9d1f6b2d0dee04585
// input: apps/web/app/(main)/admin/member/roles/page.tsx 4a78fcbea79cd4cb6096fa27f2c8a11a131a7da4680e627e113bfede93f38361
// input: apps/web/app/(main)/admin/member/unaudited/page.tsx e94abba25ed869f46407d8e1aafd43b5218b8fa9eb8efbb6e3031dbd9c420a0e
// input: apps/web/app/(main)/admin/member/users/page.tsx 7410fda556c24fa2942b19c3f0d48827fa30e7b6738f036082fff0c813fce004
// input: apps/web/app/(main)/admin/members/levels/page.tsx 66e6f1fa5d739a8c7f3adde008ae03c4a0606fc05fc07d731744b25f51289a24
// input: apps/web/app/(main)/admin/members/page.tsx 80986d6e620d35f50db46fa04c658d5641c3538776554a368013a5d285ee1fe9
// input: apps/web/app/(main)/admin/menu-permission/page.tsx e051ca92a71e75c2d4d24960f649dc93dfbfa43825464d975234823ded0fe356
// input: apps/web/app/(main)/admin/menu/page.tsx 0ab9b5569858abaebab5cb8880a93a3cc88e0eaca5ef20e83cb503cae55eb3f6
// input: apps/web/app/(main)/admin/message-overview/page.tsx a1983602b36ce71df37ba779b30499ae1d154b268c4522aa57d7a4cc79aac3a4
// input: apps/web/app/(main)/admin/message-templates/page.tsx 8a0241e77c4e3573bf3754aa2c58da75171020a8c03731d04a9c053092e13197
// input: apps/web/app/(main)/admin/meta-learner/page.tsx ff7ff74899336954cd5b84ee731010768a8fd6220da172e9170e36445643ce54
// input: apps/web/app/(main)/admin/mobile-adapter/page.tsx 33323aa7d1d7284725b2c3b1a983c89082928f0ba705c976755e54752fe7e4eb
// input: apps/web/app/(main)/admin/model-pricing-console/page.tsx af1d5cb57f40138e5e7f06bde1d4e28ea3d9537e4ba2915f2b755eed7da5ce1a
// input: apps/web/app/(main)/admin/model-pricing/page.tsx b242133c521cea203bc00caf564b3203d82f72bbd5439f513b52663cba0843e2
// input: apps/web/app/(main)/admin/monitor/alerts/page.tsx d37aedd862057efd75cd446558a24ed6f31028bb187a5b00112e0823669f0e82
// input: apps/web/app/(main)/admin/monitor/dashboard/page.tsx 4d40e008b73375e79d42e76f737affeb62ab0c255d0e1ddfa61b6f60948c180e
// input: apps/web/app/(main)/admin/monitor/funnel/page.tsx fccf80df86515aea32233a101e3fe1cf6b4f62cd28240b5d941b86843da09cd1
// input: apps/web/app/(main)/admin/monitor/panels/page.tsx 49b030075d3ae91fce46597dc578856497c725ea60a383226e94ed84763eb555
// input: apps/web/app/(main)/admin/monitor/wallboard/page.tsx 76e91e1802de4bd677f3bf972142e1d74a64f135c9382cf8dc193cdf6ef9a442
// input: apps/web/app/(main)/admin/monitoring-dashboard/page.tsx dc2f568f889f4664f578ca8a2a3e39afad0876cd8547b56b0faa8e47e4c45e8e
// input: apps/web/app/(main)/admin/news/categories/page.tsx e9ec5a4b82ac0e9685832b64e0448d6be2477434bef8e28bfaba089f298b9065
// input: apps/web/app/(main)/admin/news/page.tsx 7cbbd8612b8916946d46d8caf7ae44a30d18774ff763aab88a9b6c1655c0b064
// input: apps/web/app/(main)/admin/notification-channels/page.tsx 6c80cf633e6f1ff1834d83e7917df11ef9d2d6861a59863da07b724795793f7e
// input: apps/web/app/(main)/admin/notification-dispatch/page.tsx bfbfc2c33201bcf2de1f44207883148a13c8e239cb7ac60cbe4714227b4e0c80
// input: apps/web/app/(main)/admin/notification-logs/page.tsx 51bb2a40603c7bff983e1617869e460111a6e8ac8147f7ac1f1e577d1ef3b08e
// input: apps/web/app/(main)/admin/notification-preferences/page.tsx b1dda24332b4e81f6066db7c2697de81fc248558090ad755ba0dd0729f41fabf
// input: apps/web/app/(main)/admin/oauth-apps/page.tsx 972060269ac7af5912a465022ae3446de8525d1878bfbb9d58c3ad9d48fb7361
// input: apps/web/app/(main)/admin/oauth-audit-dashboard/page.tsx 086112fc36066c06369f3291e947ea9ad956d325ac15701e5012e523005418a2
// input: apps/web/app/(main)/admin/oauth/apps/page.tsx e6a751d5ef33e54ddd98c045eb5ce2888340e03e9d1024a31cb2f18a506ef53b
// input: apps/web/app/(main)/admin/oauth/audit/page.tsx f85a86dc99af618a8eb6529dcb9bb0827a9f0f5e7f192eaa75f7f7cfdca8932c
// input: apps/web/app/(main)/admin/oauth/tokens/page.tsx c7ae41d46cf41fe9cb6e90172600e05f897b59b44169acf528abea4734c1e9b0
// input: apps/web/app/(main)/admin/online-users/page.tsx af17521f298a1adeee812e2e74b16fd7dfd0f9f4bdb220a39fb57958b2c24b66
// input: apps/web/app/(main)/admin/operlog/page.tsx e1e1a0837b9581914aeeae63da4c8af3b2714a7f2359d1633f022e73ebb867a8
// input: apps/web/app/(main)/admin/orders/page.tsx a5b1cf5ba1057d0fe0103fde847180c094d11ce0cc2e3b0e87ba25f6527f2981
// input: apps/web/app/(main)/admin/org-governance/page.tsx a157a2e2a2af5f32ab1575e027bb0e4363267353b8371a1825cd62ad878ae128
// input: apps/web/app/(main)/admin/oss-config/page.tsx 7f698575232bf13a3dc015033643925f8daec0c24be224438a4967351120d50e
// input: apps/web/app/(main)/admin/oss/files/page.tsx 3a11e031a5a54a86ecedc9befb227a9725e7ae86459eae32f686756e1a3db26d
// input: apps/web/app/(main)/admin/oss/page.tsx a4099f971b9efa8efaa2c82c23e715d7200839cd1ab4ac59335a3e09d1841011
// input: apps/web/app/(main)/admin/page.tsx d06b47b76f357b7793b46765028c047c0f7fed0e46761299c05066f2c97c00ac
// input: apps/web/app/(main)/admin/performance-dashboard/page.tsx 412cbfb8bd47094b37c33f7d4a8fd3423e423439ed9e0dea677d27836612439f
// input: apps/web/app/(main)/admin/permissions/page.tsx c9a5638cb1002713a446d5884c551c0cba798e0921aa10e1595663280eff4a16
// input: apps/web/app/(main)/admin/plugins-stats/page.tsx b36efe37baccad651720aa053866f52e85871208162242987d026a50a48fd505
// input: apps/web/app/(main)/admin/point/page.tsx 01bd9f793dc54a1ca0c073590b90fb70b302e8394bb86237c4fd3e22163607bf
// input: apps/web/app/(main)/admin/point/records/page.tsx af715c42f0e16c416ccaa9f9d8650119ad65613f03f87ce3763193ba7f096fb1
// input: apps/web/app/(main)/admin/point/rules/page.tsx 0fbf71bcfb4efa4200531b0651506cfe03d47d4d074e881395e088d4bd00ff1a
// input: apps/web/app/(main)/admin/points-mall/page.tsx c92bb1baef1e87d181488ad8e6175168b0b5a7fb5ef4ba74975aaf22fa9f9f69
// input: apps/web/app/(main)/admin/post/page.tsx da9d6d18937a12f3e72010e86b24b4e1051e86fd9fc3b61f0065c410e379ca15
// input: apps/web/app/(main)/admin/private-letters/page.tsx 40230c3302184bce5fad9e44951ebde043e956bf607944a541caff3746607fea
// input: apps/web/app/(main)/admin/product-identity/page.tsx f4c777dc4694d94bd9f66ffa98364faa599981af365888cc5951dc7d64d5b33b
// input: apps/web/app/(main)/admin/projects/page.tsx fc1cea7c35070ad15d0a2eb7cf894abff8f078b570be2eadfa174c3130bde6cf
// input: apps/web/app/(main)/admin/promotion-rule/page.tsx 2d53c6f363605858955e60447aae86603aa60b8481ce16522f0ba3f82c7f3bd1
// input: apps/web/app/(main)/admin/providers-health/page.tsx 0bc0bcc458ae8a94712c785c1b7eb1ff816405f6b6a4395c7f3adae9bef12dbf
// input: apps/web/app/(main)/admin/realname-audit/page.tsx f99ba27274775129e5dda8c0cc1c60774c41dd3e716f27b712d393785c5347d2
// input: apps/web/app/(main)/admin/recommendation-config/page.tsx 9d95671d972c3398c61f84c41e74a32ddcba7d5e26071a752488f8b485479534
// input: apps/web/app/(main)/admin/redis-monitor/page.tsx 5efb026586ae3e445ad5faaefff8e8f22475f9bc7273a3473222aaf31de99a1c
// input: apps/web/app/(main)/admin/refund/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/refund/page.tsx 5354bd330a9d2e4aed74b987fda52a4c42800739871fe8ac74bddcda4ba8507a
// input: apps/web/app/(main)/admin/relay-param-ops/page.tsx ea5d50a5f17c33b3767f77ad81a297178083aa363120b8b8800bbbb24eab0947
// input: apps/web/app/(main)/admin/relay/account-pool/page.tsx c7c44ecd069479dcc95cf16f053173afcf9dd61d718b6468641b59472d5883e4
// input: apps/web/app/(main)/admin/relay/account-proxy/page.tsx cd0c7da1c4722c9d74fb83d32e42c71a1ca99230dda8d7c427d3038203451d0e
// input: apps/web/app/(main)/admin/relay/alert-rules/page.tsx fedc05b330b5a0f92bb81fccd737c8532e80cd23c9cb7ef72eee20a8e3312040
// input: apps/web/app/(main)/admin/relay/capacity/page.tsx 48763f3c6314af0bdc7e7c0343790a7f303ae7454f64ccc9708c17fba4de2e14
// input: apps/web/app/(main)/admin/relay/channels/page.tsx 20fb63eded036a46db22717fd0eeaa79b0f904a16af53a968cbecf8fa914cc6f
// input: apps/web/app/(main)/admin/relay/data-management/page.tsx cdf06bd253df536c0898d124f5a145e46795dc3c9c5a70eebddb7477c46e8614
// input: apps/web/app/(main)/admin/relay/discovery/page.tsx e8286f13a2694f82c06d4630d83dfbd983bebef101b3cfb83978af84e46532b3
// input: apps/web/app/(main)/admin/relay/enterprise/page.tsx 735e27f81b2bc80056bf8eca0fc5c33a9f98ac76f85d840a6a3cab02665eb09d
// input: apps/web/app/(main)/admin/relay/error-rules/page.tsx 567257efce45d8cfb6ecb6c6971bb1e9b43f97bf313254cdbab33ebf1f951342
// input: apps/web/app/(main)/admin/relay/insights/page.tsx 1ff97d29ac4d9803fe4bbee0d3ae29e573c6b1f712c2d2d77caf06cb36484eca
// input: apps/web/app/(main)/admin/relay/key-pool/page.tsx 2f2a4ca7e7812e49acc5134cf420b33f0b72631c177bedd9d38f4685ff6994d1
// input: apps/web/app/(main)/admin/relay/key-scheduling/page.tsx 1a798fa9d6202053e12804847f3d14bba52dba0254019bc12718dcf350801860
// input: apps/web/app/(main)/admin/relay/logs/page.tsx 81a1fbc003ba70e3704052d37c9909688abb47db02ad4c9020e397843844884d
// input: apps/web/app/(main)/admin/relay/models/page.tsx 87d561169d6c5dce9eaa95223a76f47a414a903e2ffa0bec672d2a6f688a28da
// input: apps/web/app/(main)/admin/relay/overview/page.tsx aea390e78cd7e3312788d2d16a1646f1119b8d2ae6aa346d49816afd9d79a3ed
// input: apps/web/app/(main)/admin/relay/page.tsx 4c51a4cd30860c5df88f3d4a7d0a24446b370a2975e3bdf3cadd856fcd21ac5d
// input: apps/web/app/(main)/admin/relay/peak-pricing/page.tsx 05543b07fabe2f32623047ee973776c0a177b185a5fdec5f85f9a67f0bc8d4e6
// input: apps/web/app/(main)/admin/relay/plugins/page.tsx 41f0bae5fb21b02005408598cc21d4e2d7f5cb87e9c55b51000dff61a60116ae
// input: apps/web/app/(main)/admin/relay/prompt-audit/page.tsx 92898675f8bbe9bb37a344c9a34a5c94ff24042fffdc23b4ac21aad044d8e048
// input: apps/web/app/(main)/admin/relay/tasks/page.tsx e04fa2a1fbc8292c5f3b81675faefd80037a07900f0efbaa1700f151ef4df4bb
// input: apps/web/app/(main)/admin/relay/user-attributes/page.tsx e3c4ec97bdbbefcae8f386da86dabc3a3388b0a1941ec7f921ed325d8219cb89
// input: apps/web/app/(main)/admin/resource-product/page.tsx 40a7cc8b3cb3ca949f3e1e676a1a307c51200f1108fb2a20d6899e53d11a0044
// input: apps/web/app/(main)/admin/resource-tag/page.tsx 5f0f362b7891b71692d5e71864ed3565cf5885929d146da2e90e476ac6017e2c
// input: apps/web/app/(main)/admin/resources/categories/page.tsx 6df298a7d1066c67d0be068771bef41bf1931e5e04c27b9c1d0a73cc59ba2d51
// input: apps/web/app/(main)/admin/resources/page.tsx f1d46bdddc26809d6797dffca358d80569022b4f3345da92af74ae7eb68ef016
// input: apps/web/app/(main)/admin/resources/product-categories/page.tsx fa5bc3ff841bbf197d0da1cbf4176e8dfc0ab9040a803e84659cf360a69ad75a
// input: apps/web/app/(main)/admin/resources/products/page.tsx 9a6091167d445833b90a0e274e151482f37c231919646c4cbe5b9ca5732df8c9
// input: apps/web/app/(main)/admin/resources/tags/page.tsx d7edacd1fc4c0a2bd2f960c08912b2a4f8b36bf363096d044a50e61736503014
// input: apps/web/app/(main)/admin/revenue-stat/page.tsx 48392ae897ddb60019755a33def691ef7cd345112391e7d5f66c09574e016b84
// input: apps/web/app/(main)/admin/roles/auth-user/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/roles/page.tsx 1a8f31aeed9dc6c739be3f5e3f115efa4507002646fac94da1c6f57ff2fb68b7
// input: apps/web/app/(main)/admin/roles/select-user/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/saas/[slug]/backups/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/admin/saas/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/admin/saas/certificates/page.tsx e8d7c068763732bf836539c1b12d19bad7614fb241f29c9e668801a9c4d32244
// input: apps/web/app/(main)/admin/saas/metrics/page.tsx 8e18d069d4c21b611125b865578a90e1887899b931372d6053838765a408aee2
// input: apps/web/app/(main)/admin/saas/page.tsx 72676eb5a6930681b3cb46e4826610f8bdeab0bdaebdbe6c3ea9a34369bd32d8
// input: apps/web/app/(main)/admin/schedule/logs/page.tsx 881a8dbc7e743242c793cf5716c8e2bc928c353b80bd69b3b0bfef46d18e29bd
// input: apps/web/app/(main)/admin/schedule/page.tsx 685fa8999cb48e57a5b91b177b336227241e44b62d2366e309b6f63a096fa7d9
// input: apps/web/app/(main)/admin/search-hot-words/page.tsx 3f997d5c094ed27fe1b4808ef10569eab4614cd8ac23e6f89b79b5bcd3583bc8
// input: apps/web/app/(main)/admin/security/anomalies/page.tsx 913873a0017170acf81b75366e6617cb4ee74ae4029b281bd1a7cd59bfb860e7
// input: apps/web/app/(main)/admin/security/ip-reputation/page.tsx 54cc085bf5f6aa2278058e7bfca3ca60f7543cda537d9eb628b7f85a53443d61
// input: apps/web/app/(main)/admin/security/threat-dashboard/page.tsx de510b4fff4a2621ac9ee53aafd66dd7d74f6d1d807e4aba43714b59230820e5
// input: apps/web/app/(main)/admin/sensitive-word/page.tsx 224651bae88c2d92042cbaf2c09f0a7428e796072b2f60f875fa709445705237
// input: apps/web/app/(main)/admin/sensitive-words/page.tsx 0f13f58853a12388cd1966603eacbfa101c9a490df1a358f5549d77dfceab811
// input: apps/web/app/(main)/admin/shop/funds/page.tsx 16e6066e61c9fb6482fb853ef75ce8d26a9c4b23bb37c571df834fc634c26372
// input: apps/web/app/(main)/admin/shop/payments/page.tsx 53ab512d32a762bcfe92309922032cba50e3a0d77f83b04bd92342878317a25a
// input: apps/web/app/(main)/admin/shop/products/page.tsx ca7e2f546db8956243f57296378d8b6c7cb466266e6f076fad0066088ae54e97
// input: apps/web/app/(main)/admin/shop/withdrawals/page.tsx 5755dbf04c8a287832bb52cfecaabd574338b409593972137f89e212a31a6a7c
// input: apps/web/app/(main)/admin/signin-rule/page.tsx fcd2218c408001fc4717f50deab4313a8e4915ae1a8036d804d7da3f4b9c8925
// input: apps/web/app/(main)/admin/skill-batch/page.tsx 2f75906c0ec8e004fd1d1ef0f1d7fc13318e80e0605365f3a9e8f7e8d494b95d
// input: apps/web/app/(main)/admin/skill-categories/page.tsx 1d38feda1ed53edd28b29deed17baf994378c9a987228805b6bce86175336c98
// input: apps/web/app/(main)/admin/skill-stats/page.tsx 991e25cff285e901c0c8bbabb82af26832e6570b578daf67686f407f320d8c51
// input: apps/web/app/(main)/admin/skill-versions/page.tsx 2f508287b80cc679d5b7287b5f734724f51c677398981bd2efc36486f6738ace
// input: apps/web/app/(main)/admin/skills/page.tsx ec133e44c28944baa809162c2c651d88b608a99ea26ae0c2e43e64775b718323
// input: apps/web/app/(main)/admin/sms-receive/page.tsx d922befc460f7b165c8488a8bd34a5138c5919ec150cccfa57cc70a2ff098ab6
// input: apps/web/app/(main)/admin/sms/operations/page.tsx b8f3a6d37aca3a061361b806eaf5f80b7e29dff3157d283663f726a79356ca8a
// input: apps/web/app/(main)/admin/sms/page.tsx 6df4260e6e5e9dc4b44ba8b4c4cd6e656a4491e6a7dade583ad26c9b480d48bc
// input: apps/web/app/(main)/admin/statistics/page.tsx 4dce3da16b8dfe4fa96cf2086195ac30eb1588c04e30a2ecf44d9224336182e5
// input: apps/web/app/(main)/admin/system/login-logs/page.tsx a142c03cc5f3ab5389ca9e4a1515d54a464c128a162bfc6987111b1db74edfc8
// input: apps/web/app/(main)/admin/system/monitor/page.tsx 2349e2ee1fa68c68be01d8dc2fb369460f959d700010601e9f5afa8059235319
// input: apps/web/app/(main)/admin/system/operation-logs/page.tsx 8614dc2156cb0b693095d4b48e17cdd4338d59ca37e86838833e8038d39e403b
// input: apps/web/app/(main)/admin/system/tasks/log/page.tsx e4dfae3c6eb435edd7e2a9ef64947eb21ee82e2e86d26ad1b09465a99171b589
// input: apps/web/app/(main)/admin/system/tasks/page.tsx 4b195fb8537d77b2c8653a35f427694b51f09228002b47a7eb2b68a69ebdd3d3
// input: apps/web/app/(main)/admin/tags/page.tsx cca2875bd369eb5f5c3d9cce2e0f89316b41f729d01a8d95523cd45595fb8f8e
// input: apps/web/app/(main)/admin/task-developer/page.tsx d890d4bfb5704817780570d85412b078e52869d7ab96aba74546732d494b83d6
// input: apps/web/app/(main)/admin/tax/page.tsx e5f0e7e63d9f1e160387bc0c44a6f1321dc168097dddedb4df3550b00255d4e2
// input: apps/web/app/(main)/admin/theme/assets/page.tsx e65542e3673b33458531b834305aaad6e6d76fe1cb5bd90988bd0f3d325c8e76
// input: apps/web/app/(main)/admin/theme/colors/page.tsx d8b3b261416a124e372199583ddcfe64eea275012784757122390a0d32df3bb8
// input: apps/web/app/(main)/admin/theme/create/page.tsx 8b1a59d6e8cc1d4e3050b16d03d905438e6bdb4c74644e3ff335778437ef5396
// input: apps/web/app/(main)/admin/theme/dark-mode/page.tsx 374a4ffbf9e470bd9c5170d5eddcedded77d8d8dc1508f793a719d7058da8d27
// input: apps/web/app/(main)/admin/theme/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/theme/export/page.tsx f92d27408132e97560c9ea523ab026c086fd647f745dbcf56d5d3edf663cecdd
// input: apps/web/app/(main)/admin/theme/fonts/page.tsx f215dd4764bd73bef0eae0d7aa2ac46c4d50f8c2b63968f6d6dee239961f7287
// input: apps/web/app/(main)/admin/theme/page.tsx 89d6216803c5c3f37d16422eb09607bd34b6d9ebd6cbfb7d4a6743099eb587a1
// input: apps/web/app/(main)/admin/theme/presets/page.tsx 0e2637f0e5c5736025a1c59cbda2d7ab1a846b690f4e04d4ba121d37c839a9e9
// input: apps/web/app/(main)/admin/ticket-reply/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/ticket/page.tsx 7783ae2fb5b46c3dcca150e25ce855cbf74cc61fb0fe14bea7110b830d9e2946
// input: apps/web/app/(main)/admin/tool/gen/page.tsx f044f1898331b4624aa8560d336dad7c4eed776a0a90dcac9afaa4331380742e
// input: apps/web/app/(main)/admin/topup-config/page.tsx 445aed5d03cae0a0be29f9f91648b39b878fef91bcb03675f65361250a4445da
// input: apps/web/app/(main)/admin/unauthorized/page.tsx ba29a05da12263fe194cc5b6f04ea69e0db53cb40fa473965aa0adb96c9ebc09
// input: apps/web/app/(main)/admin/user-agent-audio/page.tsx 8773c1afcc4d132e13a5c0a7a8d9dc66d23a2ee0273bd2456d72af31f019de35
// input: apps/web/app/(main)/admin/user-agent-context/page.tsx 51b5299d16a051b904d4c02e7d40a55c3492cfe9657cb67436e6a5780248470a
// input: apps/web/app/(main)/admin/user-agent-image/page.tsx 6b4b1c70bfe6cb1b7973f330487f7fa6568b125d41ad42d0c0bb25b49b239eda
// input: apps/web/app/(main)/admin/user-center/page.tsx 5e5c7dbbbefdc5ef78c8fba8b32bad91e18a5ff27b92878a1974882546674611
// input: apps/web/app/(main)/admin/user-margin/page.tsx 8e3ff15587b69d2ae0ff6da7c87786ec26aed878d50fbd7f2af6467390af0e9a
// input: apps/web/app/(main)/admin/user-stat/page.tsx 118c2fb873342ba161e06763e86a505a923f14cf413e96bc6798e9588cdcd39d
// input: apps/web/app/(main)/admin/users/page.tsx 487b5c4f398febdc7a4ab0a5fbd4be8cafea1c8051f7cd44e79e1e111035ffd5
// input: apps/web/app/(main)/admin/variables/page.tsx f6d725f8df9e1b97ce6d63ee0a24866becf375123ff6d567177bcb931aa84b73
// input: apps/web/app/(main)/admin/video-logs/page.tsx 3e3bed309da78091dd6c471f7fed1eb28f8af6ea2dc3d5273fc625d1dc6ec465
// input: apps/web/app/(main)/admin/visit-tracking/page.tsx 9902908b6f65641538401c8e235c1e1db70415942229c4ad52e2a23e8f2a9739
// input: apps/web/app/(main)/admin/visit-trend/page.tsx b0ac45d98d22bb8d18b7b36ac875d1ecd31ccd1e6378c7ab542b14b956193a9f
// input: apps/web/app/(main)/admin/wallet/page.tsx deaef6ae0728c51f4f40ed331a2c425bde1ea2bd7c7874b49955d8d7646f896a
// input: apps/web/app/(main)/admin/withdrawal/page.tsx d60f6e5a195a88e88e9d95d3d619693c607ccfa6c37ef5983cfd0d7cb2808ba0
// input: apps/web/app/(main)/admin/workflows/page.tsx f7e58a661e0e06ea63556f51e08ec30133be0f31f194f3b1e8e08331990b7e7d
// input: apps/web/app/(main)/admin/zhs-activity/page.tsx 9b6ecdef68ed3fa071c6b7e2f4d049d11bc31dd4976637fe68cbcea74d6721ae
// input: apps/web/app/(main)/admin/zhs-agent/page.tsx e91c1c3e20cc0b6073d3a33ee789ee297ba7548094b8f74cf07b4e086b447d77
// input: apps/web/app/(main)/admin/zhs-user/page.tsx aa46e86bf903890a2686538c5a0b7ad1b5cdc722bf25c9c4eeb6123fca644223
// input: apps/web/app/(main)/agent-canvas/page.tsx 1b33f7ec304881b404c28d68d8c69b41e41d60d3866828ff2c9c2fbe7decb232
// input: apps/web/app/(main)/agent-kanban/page.tsx 407708aa64c2e3312a29b075597f5186a32517d3c250659b2a5c20e08839af12
// input: apps/web/app/(main)/agent-plan/page.tsx b9bfb43736fa7955ec0aef8ff68c5bf1122fd3eedbe520f3e5adac1361974473
// input: apps/web/app/(main)/agent-plan/progress/page.tsx 8914c3e917a820e8aee3dd6bf372d512f5f806ef3b6c4644355910f4e6276491
// input: apps/web/app/(main)/agent-runtime/page.tsx e3c11f471373c4122a254ec7f7b598b79d45d501ee522cb2955814e0ed8a2708
// input: apps/web/app/(main)/agent-step-recorder/page.tsx ff01566dcda29de3562268ed5e65311efe6ece343119e3eaa63900bb1b03adb1
// input: apps/web/app/(main)/agent-teams/page.tsx 5d1ee067d4bf99fe3dc9271977cf285ec655e4b152a85d108e6efcc35898c9a9
// input: apps/web/app/(main)/agent-timeline/page.tsx c176b9da05b78d179a83e405b4af3db95258d7623cebed517070149cf20bfdbe
// input: apps/web/app/(main)/agent-workbench/page.tsx a1c506b4cb8e11fe2eb57454e17dcbfe2a6ba624b3fc1a6057c7be57865d7c26
// input: apps/web/app/(main)/agents/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/agents/categories/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/agents/categories/page.tsx 6288b83b1015470d8bdfd2e00a1bd938e10a1f2688a7306bf8f9ee4c87020567
// input: apps/web/app/(main)/agents/create/page.tsx 3eaa7a71ba1f4bb7b38f28bc0489112ac17c46d08a9e13fc30e10f65adc8f7f2
// input: apps/web/app/(main)/agents/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/agents/featured/page.tsx 576de371f97a9654ae5eff7c332bf0eee66a0bf32e3cba5671878b8b2098d4d4
// input: apps/web/app/(main)/agents/my/page.tsx 3a6c714020776f9786b088ee0aed04d77c67f6a17d02d785bf5d379b8115e6c6
// input: apps/web/app/(main)/agents/page.tsx 71db76f2fd7ae1d5c358cf3173ed1e935bc114b29e500a3212422f7c7290e9bb
// input: apps/web/app/(main)/agents/stats/page.tsx 2be7e0863b31dbe5a1d15c9186f8fdb3c0ed6e08545e6967eaa9b8bdc35ca40b
// input: apps/web/app/(main)/agreement/[type]/page.tsx 2fdfa2b9b1de35ab72faab4733c4743b37f0845e976b32661cfc06d5e85159db
// input: apps/web/app/(main)/agreement/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/ai-career/page.tsx 8101c415cdae8b0f949f1b40b4cc816b1ccf93735f95a697cc944e84565b797f
// input: apps/web/app/(main)/ai-generation/page.tsx a910eeb39c53b9c6c3280ba8cda7662d1d9814e8b7541e57754142faa28a2dbd
// input: apps/web/app/(main)/ai-generation/video-tasks/page.tsx d7e7e599be959478c5cd397e5c0f67aeb2498848a4ab5bd59c8a23a747f6a9b4
// input: apps/web/app/(main)/ai-news/page.tsx feacb40238e2a77a8d63a99a4bd54d81f894b405bb538eb7bbcc9a86f661d818
// input: apps/web/app/(main)/ai-skills/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/ai-skills/page.tsx 84e608aed20bceae83d3bd6e3a54da8967657bff065bf6a4091fe87692ec8e7b
// input: apps/web/app/(main)/ai-world/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/ai-world/create/page.tsx bbe97e12ee943eebbf002ec555aaf10f43b5fd28db58500cfad8d0ca8b5beb8b
// input: apps/web/app/(main)/ai-world/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/ai-world/favorites/page.tsx b8d0d540321896c6423fba14265eb00649500aa0b583e0cf3558198398e1ff49
// input: apps/web/app/(main)/ai-world/history/page.tsx 865e2baad1fc1cc7e333c2b131d8862494b7e199b33e318fcb1a42bdba14725a
// input: apps/web/app/(main)/ai-world/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/ai-world/share/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/announcements/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/announcements/page.tsx db78fc0e76f00465fa9d4cdf1a084ce9e88341a7c9c646793babdddc59363eb2
// input: apps/web/app/(main)/api-test/page.tsx 81438a313501fff53cba265a0a4da2dc50bbc6f2acd6885dbd72afd94b1484b3
// input: apps/web/app/(main)/app-permissions/page.tsx 2c545a93b76c0a231440ba9d43ac6df057141d2d5a65d84d24fda2960df77915
// input: apps/web/app/(main)/article/page.tsx 3be8cc21f72dd604fb3eb6600b920077394f24997281f4444f6ea429ac8dd74d
// input: apps/web/app/(main)/articles/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/articles/edit/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/articles/hot/page.tsx dab15cf8d1cf265ab1ebd82dabaf4ea6378c51f7a92af2e61f8d0fe7914395d1
// input: apps/web/app/(main)/articles/page.tsx 52d3c0a836d8d55f4d8b477063d55401313cb0179528af9e69ec973da97b3d4b
// input: apps/web/app/(main)/artifacts/page.tsx 893da27d71ad48fa5989c9221647abf04d605ab3584b1c20c15fbbe7c49b1ccc
// input: apps/web/app/(main)/ask/page.tsx 78a7b752303eaca2fbdc8d28229eb7f3def29c9cf10b8c15119d06d5d05301d2
// input: apps/web/app/(main)/asks/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/asks/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/asks/edit/page.tsx bce551f4905115a2657746b7280e0993a183d6eaffe18c89b06136bbf1bf465a
// input: apps/web/app/(main)/asks/page.tsx 1c9d4df95e8354dcdf2f044b7affadeb88f2e50f921659683becb115f155cee1
// input: apps/web/app/(main)/automations/page.tsx 579d2e1d0248c88a39c7c170a5e7738828a4a0abd7882a524405801f27f65f46
// input: apps/web/app/(main)/available-channels/page.tsx d0f2f3006c18ddbf8bf97b97786b224e4c3135e7f33d9642a33df88d92c92eae
// input: apps/web/app/(main)/bi-dashboard/page.tsx ba36d5d9f9d0a5c5080b17ba059882f3b3e5126da3c665022606c331e00efde1
// input: apps/web/app/(main)/blog/[slug]/page.tsx 2127ba4162152ebbfc23beaf52095ccd2edcbce7abc7266d37d754cc776a6f26
// input: apps/web/app/(main)/blog/page.tsx 89162952efaea84000ffbe77be0f6ff2140cd49348bb7835255ced8e14c1d499
// input: apps/web/app/(main)/business-card/edit/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/business-card/favorites/page.tsx dceeb316273cb22c5a857ca9311f966e3064a7c59eaf020f01f6628c45d43b6e
// input: apps/web/app/(main)/business-card/page.tsx 23585eb1b4d5cbbba8c47755befac95d9213adea94b4c4c856eb6410ea4261e0
// input: apps/web/app/(main)/business-card/share/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/business-license/page.tsx beae9a12be3ab85651d49897d061f069ce0a8c5aeeef943febb5c289fda5f603
// input: apps/web/app/(main)/capability-market/page.tsx 9e89193db363da5deaf464c9761bc0492a1b267424452762a75f8d6ec65df25a
// input: apps/web/app/(main)/carte/page.tsx 7294e8e110049417bfe632aa4614b0739dec5679a0a12213771e238015175d0e
// input: apps/web/app/(main)/certificate/[id]/page.tsx 5dcc5b5105320a0545f6b5cee21fa59b7e585f99d35b43760a431322aff0dae0
// input: apps/web/app/(main)/certificate/download/page.tsx 497a03adc5598e544b636d0b65b1fec223aa8bbd981d6627d72ec1fc0d8e3f17
// input: apps/web/app/(main)/certificate/page.tsx 3e6b9961ae96c8315007d9aa35fe4dc023e4c8461ae154d3b864e09a57643c00
// input: apps/web/app/(main)/certificate/verify/page.tsx 3a76a90b9ea291c222719062f2de98362560918faa89652307bdfd6c153a67be
// input: apps/web/app/(main)/channel-status/page.tsx cd96a600eeba925827c9f73793fb4458e3585216ee01365efaf23e47378b5319
// input: apps/web/app/(main)/chat/favorites/page.tsx 0abc78ad901d884d13db4677ae68f0fc9a378daf45aaeba24e076eded10084e7
// input: apps/web/app/(main)/chat/history/page.tsx 526d0a7a3635b5e46e80b9593d6f92580906d64177a987a7bf77f65081d6cfe0
// input: apps/web/app/(main)/chat/page.tsx 1ab20ab06a1d9d14453d3834e942258d7a1d14ec8a09c3563bf645b25d379d62
// input: apps/web/app/(main)/chat/settings/page.tsx 621313dbf30f4255de9b4c44a2e1f7a04ea987ab9bc2f982513307dc035dcb0c
// input: apps/web/app/(main)/chat/share/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/chat/templates/page.tsx b22721ff90f032f5d67a6220eba3b04cb89bbc298c5085b4ab3315043d2b40b9
// input: apps/web/app/(main)/chat/workbench/page.tsx 806a03649e52ae6b4b4d8487136387510df62de97b00fb6501add78d189d4c7f
// input: apps/web/app/(main)/checkin/page.tsx 60f1076bb5958ca637e10a8fe2763ecf6e353e0ead7e346222360442c152b4f5
// input: apps/web/app/(main)/circles/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/circles/page.tsx 5dc5b147cc4e060a352c51f9480deb7b0063dfeae971c07933cd0a4fbbfd9cdd
// input: apps/web/app/(main)/circles/post/page.tsx 0edf499258e2bd30be4d431381a8e8853196ccb9aea3b69fc14d5c41b20d7680
// input: apps/web/app/(main)/cloud-agent/page.tsx d0fdf66eab368c19e4158b4427237157f60017c0e067d49447ddda6b398b49ae
// input: apps/web/app/(main)/cloud-run/page.tsx 33ecf8d6d2bf8844eb45d5d7257fd2b6bbdc0c891acc33382a8bbf94ffbaa13c
// input: apps/web/app/(main)/comments/page.tsx 5ce339f4885a779bbf4dc12138881c8316bb1ee14c14aa256278ec2a29d7e806
// input: apps/web/app/(main)/commission/plan/page.tsx 864ee4da4e8ade35e8787c611562bc8b5fcd7af78fbbf07ba08c8add3c0a3a3c
// input: apps/web/app/(main)/compare/ihui-vs-autogen/page.tsx 1b2edb69907af975a7e3f37843479cacc491e213963282b042c99db31dbb9d54
// input: apps/web/app/(main)/compare/ihui-vs-bolt-new/page.tsx 7ec4ce0eb20069a5b7a70a348de01c6708038dde69a7df366bc1e0bc4616d832
// input: apps/web/app/(main)/compare/ihui-vs-claude-code/page.tsx a7909fab2b1dc57d5435572e9188a430f04d39ef59fe5ae747671e4c32e272b2
// input: apps/web/app/(main)/compare/ihui-vs-copilot-studio/page.tsx 5fd4882dbc5e2f254a446a1cf22610a0cdc0ff2cead0738953358e0146f81611
// input: apps/web/app/(main)/compare/ihui-vs-coze/page.tsx 059bb5caac77b0026571db967db04da0e5a9ff64c8c8c4d9d38406c9e9346671
// input: apps/web/app/(main)/compare/ihui-vs-crewai/page.tsx 50ac297771ea5af124fdbe821bf1ab3b280799183a07d47932095f32676604c1
// input: apps/web/app/(main)/compare/ihui-vs-cursor/page.tsx 0dd380a3f83578717ca935c7d67deb916317c73c1664c3d22c294f450c3e3c98
// input: apps/web/app/(main)/compare/ihui-vs-deepseek-platform/page.tsx bc9bda6d650703e95036920f32536c1089bac761d387113cc6b8895a384c6171
// input: apps/web/app/(main)/compare/ihui-vs-devin/page.tsx 2524d22673950f4349ff02be76e0292479374a59f048463ccea5695fb1fcf2c9
// input: apps/web/app/(main)/compare/ihui-vs-dify/page.tsx f05f2c52791ef246f1ba0d305f92d28a551a53f0a311a17a44081890ebb1c7d0
// input: apps/web/app/(main)/compare/ihui-vs-doubao/page.tsx 54b08e17c30bfea783492a8428f3f1f47e4f08b1246902b7988d40f3b7a12ec1
// input: apps/web/app/(main)/compare/ihui-vs-ernie/page.tsx 5c8060b5311ac82827d49c9b12327af52f156060abf8357bc574dd9ccb19c32e
// input: apps/web/app/(main)/compare/ihui-vs-fastgpt/page.tsx a636caa0d3249aa59ef9d77d77b7bf4c21ee8c4c2109b81d2bd350ae698c1e2f
// input: apps/web/app/(main)/compare/ihui-vs-flowise/page.tsx dabc84e9223cbd90c85cf2fed24dcf8aa4f08d36b981b010d8047070015c06bc
// input: apps/web/app/(main)/compare/ihui-vs-github-copilot/page.tsx e90ac4ab5a2cfbc44b8dabc88363d995f01086338c4f0f8b793c93774e6d6ee2
// input: apps/web/app/(main)/compare/ihui-vs-kimi-platform/page.tsx 31974894919e06981dc418edb6a5a111f5fac7a45eb2f73ac9e42f65fda52a0b
// input: apps/web/app/(main)/compare/ihui-vs-langchain/page.tsx 63a725a01fd7b9cd47782b55b412cc458df5bf5f505d31eea319090b01a5f10f
// input: apps/web/app/(main)/compare/ihui-vs-llamaindex/page.tsx cc7865ef7a3bd9f9f0665c4ba9ae4f02df9af31097d17f299315a8b162a2f119
// input: apps/web/app/(main)/compare/ihui-vs-lovable/page.tsx 84ffa044a957dbdfb019bdb9032977e6ed6e850f36ff049bfd338f1e405360f9
// input: apps/web/app/(main)/compare/ihui-vs-make/page.tsx fe6a8ba410b0f92c88335fa3209f6e2b0ac8b0a4ef83780bbec88a688e8faff1
// input: apps/web/app/(main)/compare/ihui-vs-manus/page.tsx 369623d62a8b7bbcb46dafc18e9a4270e830e38c3fcaa515ae684b9808dcf97d
// input: apps/web/app/(main)/compare/ihui-vs-minimax/page.tsx 421a8f25a0c324189d7f4afe8c4cb603565a97d3688659f0d22e5081b7024494
// input: apps/web/app/(main)/compare/ihui-vs-n8n/page.tsx a96414dc1569e87e234e6473f1d60649bd003e3f2bdaf46b2bba68ef8a58c078
// input: apps/web/app/(main)/compare/ihui-vs-openai-agent/page.tsx 42b403345b9206a4e0c632106e81e055f3796db4762c40231fd83c16974ea309
// input: apps/web/app/(main)/compare/ihui-vs-qwen-platform/page.tsx c4937c89a1726b6dcbd89b61c5a58395fdbf897b45104490a20e671604e5ec74
// input: apps/web/app/(main)/compare/ihui-vs-relevance-ai/page.tsx 8f27ee7f185bd2df58e78e705602724dcded86f5ed17008560b22744b9a034e8
// input: apps/web/app/(main)/compare/ihui-vs-replit-agent/page.tsx fd1b1034ab87bb9ad0b5a42c4b28ed6ab2e0e0d99244e973a1fc5705a153a365
// input: apps/web/app/(main)/compare/ihui-vs-spark/page.tsx 03f898375f3abdda9b944d46de33bcb198d6d0215549be8bee3783f65c1d65e5
// input: apps/web/app/(main)/compare/ihui-vs-stack-ai/page.tsx 311c32af2814aadf1ba6e7318f15fc329c9ea4ea1b11bab21659cce5bd09fcde
// input: apps/web/app/(main)/compare/ihui-vs-typebot/page.tsx 4b2f9bbf58c654a92b68424828d833f0bb2326e4855d4dc9520b731684084d41
// input: apps/web/app/(main)/compare/ihui-vs-v0-dev/page.tsx 8c8472b249ac0eb97a55c88c34b1375daf914212593d28736a778c9ca05fc7da
// input: apps/web/app/(main)/compare/ihui-vs-voiceflow/page.tsx fd0de9df7e2707bd9863bdc1933dd2ed628b90b2107f4b8f5cf26fe32f7f79ee
// input: apps/web/app/(main)/compare/ihui-vs-windsurf/page.tsx 426004cceefe8bc6326c109df263d170f3df6e5b781bbbc255049fad12930bd4
// input: apps/web/app/(main)/compare/ihui-vs-wordware/page.tsx 1931ff1806325b0348e8081c38699af3cf01387eef5f27477415471aec5f3917
// input: apps/web/app/(main)/compare/ihui-vs-zapier-ai/page.tsx 5df49b65a49efe26b0a866ebdde4984b08ec71a9301dca265f430f4ec74b1b84
// input: apps/web/app/(main)/compare/ihui-vs-zhipu/page.tsx 8bf7b9ce5f238e1df965389a431f2b88e8fa521bdedd3da536508e3b2a48b46a
// input: apps/web/app/(main)/compare/page.tsx b1faaa8d1abe0eccbbfb254e24c33bc2826709b09a5288ca8d518265208e4c2f
// input: apps/web/app/(main)/computer-use/page.tsx 87f662079ecb9e24fc2b264186ee65a40dda0684eb11d38ea36cc83e6449d4d9
// input: apps/web/app/(main)/connectors/page.tsx efe0c3dfc82f0add7377bd131e6fd6497ec9868e79b7366b241042d79c9994f0
// input: apps/web/app/(main)/contact/page.tsx 99ae6fcc686c03bf2f61f0881ab55f44899283f31748428db259257423238f6f
// input: apps/web/app/(main)/context-compaction/page.tsx 71c0c574c0b38d2b9e98b5b8d810636a2d9cdf90858ca2b281bd043cb6360c71
// input: apps/web/app/(main)/context/compression/page.tsx ee8741912a7056b6de719c34f572c76e78c0b2a5efe03926b22d6173d316d679
// input: apps/web/app/(main)/context/mentions/page.tsx 0b12293321bcee4648ee88287486494310e987ed38ff4910e7e5c8ebde9789c5
// input: apps/web/app/(main)/context/page.tsx 0473c645dc5669d1641c158d84383c59212737edff01b991f2462694df5a130b
// input: apps/web/app/(main)/context/visualization/page.tsx 069dc37026d81cac803529fd36e3a6a3d91c4f62a553ec10de74c44b14098009
// input: apps/web/app/(main)/cost-dashboard/page.tsx b1eefba458c3badc887f02ed355fcbe69a2f26a48bc29c2224fa038a45419be0
// input: apps/web/app/(main)/dashboard/page.tsx df5ebfd3e2514353c8ace16bd25faa37c07ad31a4916c7d684a120cec8d18b82
// input: apps/web/app/(main)/deep-research/page.tsx 30fe04e13ba048ac7f2d73fd55fa46ed34152838b2760728fc0186ec3206f850
// input: apps/web/app/(main)/design-system/page.tsx e2a38caae54802fe2145bc39ce0878275686ad755931024b87ba6f4dee417e97
// input: apps/web/app/(main)/design/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/developer/api-docs/page.tsx a702693f712da9d4835e464ad643fe078661eb0cb321ac09ac16ecef0ecc7794
// input: apps/web/app/(main)/developer/billing/page.tsx b3943ceab9774b33d0f3d7491fd8ba781dad9a3ff81d8f4f19c4d74b04752d20
// input: apps/web/app/(main)/developer/capabilities/page.tsx 408bb101025192ac59d591272fed30fefe5ae11f401e1abf500ae39deb432039
// input: apps/web/app/(main)/developer/conversations/page.tsx c22875dc6fdc9b983de77fef4a09aa8235117fcced574b60ec53e105ab4e041f
// input: apps/web/app/(main)/developer/enterprise/page.tsx 072b3a042370caf0d528eddd1e9030fb99f2fe9592177b0bb182bb79ebfcd4e9
// input: apps/web/app/(main)/developer/error-codes/page.tsx d9e553018d8c80277a9c78081d06fb82cb55f94dc86200919e5789bbf26131e8
// input: apps/web/app/(main)/developer/ide/page.tsx d736ab882ef1c6c4080135b303532359e67866559107a5de66d31746b001bf41
// input: apps/web/app/(main)/developer/keys/page.tsx 8bf0974f97e53ca84fc5573315e81d69eb29e34fa3d929409fd1c68f77a3b0c4
// input: apps/web/app/(main)/developer/limits/page.tsx db498c82601204b72eb36d0c87b6597ce4e88c1d15905e0d35d00c12834ed2f3
// input: apps/web/app/(main)/developer/logs/page.tsx e988d0975687f57fb93cca53a1d3f92f36eb3ad83e030affd9d4aff036294415
// input: apps/web/app/(main)/developer/notifications/page.tsx de633ba91488329bc30f94e91ebc91b181bedb0ddb930eeeece9dac1956397a0
// input: apps/web/app/(main)/developer/page.tsx 058d223c910b0e6b113e86d58a7c5892f8110e31508fd90f988248c6ed9f80a6
// input: apps/web/app/(main)/developer/pricing/page.tsx 98ff5a53b9448a91c64ec733e291aea8f124e35458fba949d11d8ac943aa1b42
// input: apps/web/app/(main)/developer/relay/benefits/page.tsx bb891682ce223ec7e2e961b9935a9e47acaf06129fc2afc8af98329553f0fe4d
// input: apps/web/app/(main)/developer/relay/keys/page.tsx b1d8b1aad64cb0d0ce0ac761f464f3dc47d8e3c4039837f027a639bbaa8299d2
// input: apps/web/app/(main)/developer/relay/page.tsx 3b4d05ac57bef88d5c7a30305c526365065d1b55479e02ef6a9574ec82d5d290
// input: apps/web/app/(main)/developer/relay/subscriptions/page.tsx 8a01eb896b18b7aea2cf3c7f299bb6921f6943d82082ca1aedeeb2c7031e0cb9
// input: apps/web/app/(main)/developer/relay/usage/page.tsx a3feba28b60c1e5f80ea4b6e58d752bb74a47eb06046967e10caee50d38b00dd
// input: apps/web/app/(main)/developer/sandbox/page.tsx b50a6d8a5e44dffba2311dc7c7b9b19e53b0a6d2aa9a790e2de80390fa1318b9
// input: apps/web/app/(main)/developer/settings/page.tsx 5cb31c2571125a45aa797b8e97c13c8ec07e8f473011e546ac6aecc4c5a2373e
// input: apps/web/app/(main)/developer/subscription/page.tsx f6b2a40a260be58a59311e664e78a7d27c286cd7d2586b8a6f244832ec2082d3
// input: apps/web/app/(main)/developer/team/page.tsx 790a852322429559d0f2ffcb61057f2241f96c8953c49f09308d87c6acc6117f
// input: apps/web/app/(main)/developer/versions/page.tsx 1eb8eb34bf9d490d701e5852a1edb9f86d590d8fa17bc02aa4ba3184bc35821a
// input: apps/web/app/(main)/developer/webhooks/page.tsx 634c8fbf6268a766e2b6054da2e589993ddd7df2f6c65b623db3da16a3a8e898
// input: apps/web/app/(main)/developers/page.tsx e4a6a847e564c28bb1671478df1925f636facf1e3373d3f391d398746b165fba
// input: apps/web/app/(main)/distribution/commission/page.tsx 9e02840a674cff362534c834a753ce4210dd0153128b60d3caec80840a646d91
// input: apps/web/app/(main)/distribution/company/page.tsx a645543f4109a4982a51b275816566b96a4c5af90c7fdffcb42447c3ecd246be
// input: apps/web/app/(main)/distribution/orders/page.tsx 1c94fa3f3d8c697d407dbb96eea381f04ec5830d726408f0a29463408d4291c4
// input: apps/web/app/(main)/distribution/page.tsx d209aa5216a207734e5025053be9265d9b1bcda5095f3eca4c7186467ceb46ec
// input: apps/web/app/(main)/distribution/referrer/page.tsx fc0e3c7e5c635ede6aad04cd11731949f84e1e617e0da8b5c8efe6badc19b181
// input: apps/web/app/(main)/distribution/team/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/distribution/team/page.tsx 16d51c419fdd51efb57037c2a22f22488e508c272a590633483a4ed8009143a8
// input: apps/web/app/(main)/distribution/token/page.tsx 9a0763e8fe1123cb2f6ccfd91600222ffb33234514c1bd90cd10ce8aa1d76517
// input: apps/web/app/(main)/distribution/withdraw/page.tsx 7f9111c7dd56e3e536f08da514f6303ce8ba8569b89376a288347aa4881fbec9
// input: apps/web/app/(main)/distribution/withdraw/records/page.tsx 3266de32a62f6afbe02f1a952d63f3aee665756995beca9d484ed21d0d6732ec
// input: apps/web/app/(main)/docs/[slug]/page.tsx d9e39fe33ef0fb967b1a6d248330be44f86ef1f4383ea8eeff3e6596d4f58284
// input: apps/web/app/(main)/docs/agent/page.tsx 40d70e1b1f22ec3217d84d50887f78a94573b93905d3ce86091ddd5c00893f72
// input: apps/web/app/(main)/docs/api/page.tsx adc5b024114dd704183926fe9e3ef8edfe22cdd192d0320961fcc6d55234524b
// input: apps/web/app/(main)/docs/manual/account/page.tsx 601075e1080655e6c6cce2ee0f736cd2f4dbde103c0407af2430f3e61067d79d
// input: apps/web/app/(main)/docs/manual/agent/page.tsx 065ae4e47c10d3c43227c0f4efdb60766f63d95763cdca2a2086dda4eadb3f59
// input: apps/web/app/(main)/docs/manual/ai-chat/page.tsx a993bc96c59b0016943267cc4891430958ab5b5cef5d08cb00acac9d98b34fae
// input: apps/web/app/(main)/docs/manual/billing/page.tsx 79c0ab656a06a1085e7d31a72068d0e9932ef1eb855b0af6c039ccf1fb408b46
// input: apps/web/app/(main)/docs/manual/faq/page.tsx 684833c7776282cd6f06820461446eaa207b23a3f8135233b6c5b58db5732298
// input: apps/web/app/(main)/docs/manual/getting-started/page.tsx 1a4c594b20e197e099e7f99c052d3a443167db898dbab3fe98b345d41225aa8e
// input: apps/web/app/(main)/docs/manual/knowledge-base/page.tsx 5f3d597068003d736d7d9803cc7abd32beec2d82dffc605d259b8afded764e80
// input: apps/web/app/(main)/docs/manual/page.tsx ec601c0ce71c36bdfba1aaf94b28eeefd7d5246d65b7c84d1a3f9d4e3790a1b1
// input: apps/web/app/(main)/docs/mcp/page.tsx a85949c7b39026febfde12cdabf13b5a87b94e4b5fde4d585082926ca7185471
// input: apps/web/app/(main)/docs/models/page.tsx e032137fd1c343a8217bb546276d57a6191b81662762bd12793b23df83c9df31
// input: apps/web/app/(main)/docs/page.tsx 8184b7020ea92ddc3a675a5277d44133d0d13df86096fab17d59c83bda0f8c94
// input: apps/web/app/(main)/docs/quickstart/page.tsx a4a3cea188a612908d56e2650fa0ad4f61028fc3446f2b2803f2e0105ff4c1a5
// input: apps/web/app/(main)/docs/rag/page.tsx 1ddbe125d9d1a7ea600d54f584f6c4b8542842921c94a9153d73ea409bc71687
// input: apps/web/app/(main)/docs/self-host/page.tsx f91d2e1fd1c734a6f8a78c9d4aefd0abac115283428734335a2ca0fcfa86ee7b
// input: apps/web/app/(main)/docs/team/page.tsx 944b44312e50f73d0b8a67c86fc6eaca2ee644b33f314881039f430c715e066e
// input: apps/web/app/(main)/docs/workflow/page.tsx 48b09b53769a0cdbffcb11f48ac55f0ed24e59a71ffdf34d2d3808d382b56f4d
// input: apps/web/app/(main)/domains/ai/page.tsx 1a06ad7c1c2aa734cc2adf9cbe2196dcf8e52e766328ce76b55c53892e4c2cd8
// input: apps/web/app/(main)/domains/content/page.tsx 5f2aadcd2744e25d3e55f3329446167280360de8d78bf2a8d48c36f2bb426e7c
// input: apps/web/app/(main)/domains/edu/page.tsx 610d37bec54c738e573d24150b1a36c173a9344cb559da2ed18aeb7386026fd2
// input: apps/web/app/(main)/domains/personal/page.tsx 329a5d2bbc5fa9b6ec73b84cb77f6c673bf0e5273e92264fbb2c8c4a1a0988fb
// input: apps/web/app/(main)/domains/trade/page.tsx 81b8bcc37d1565a1ffdbbb0abbcf9f8eb077f08bdc9b8d8b789fb789c2368949
// input: apps/web/app/(main)/download/[platform]/page.tsx d3bbb195572d6316c2547bd8fda8e9107c05cc60a2a2925e9b02002c7c29ee85
// input: apps/web/app/(main)/download/page.tsx 59bc8557ed62a53fa3608ec75132263f58a438dd8c09e066e49f8a07bb726c04
// input: apps/web/app/(main)/drama/page.tsx 07acbee306d9355b545bd1f2fecc374e5a7a28cd327db6f151f550a800942ab8
// input: apps/web/app/(main)/earnings/page.tsx afc5f32edc78ecaad674bc498944baa5c7b3961b51d5da9f2d4edf6e504ab948
// input: apps/web/app/(main)/ecosystem/connectors/[key]/page.tsx 8393c69c5ff681ca5d2aa9dd26f6c2474d62f0e1af2f9eba3c138003af32eb69
// input: apps/web/app/(main)/ecosystem/expert-packs/[slug]/page.tsx 098fab45a09bd2cf6ceecccf47cef0ed94dff9daa2efc87dc98ee3ec6ba51d7d
// input: apps/web/app/(main)/ecosystem/expert-packs/page.tsx b3874012bca5399c92bc75fb664ca004babb2448ab83f7853548e1aede67dec7
// input: apps/web/app/(main)/ecosystem/page.tsx f0dbfb332b9a6d22dde55a80d763e3aacf88436996ad4b44a76eadab0e95ea88
// input: apps/web/app/(main)/edu-ai/aigc-tools/page.tsx 5bd64c26440bea49c7ec6763b0510dce8c3349f1e4350ab90498f6d372d4df20
// input: apps/web/app/(main)/edu-ai/certification/page.tsx 05c64f653e624c37112ec3ec1f7b73ab0ddd2cb0e125c8a2746156df73f732fe
// input: apps/web/app/(main)/edu-ai/courses/page.tsx 5323b0577a44a2b53c62766902dcfec40cc33873248a22d1cb24ce733499606b
// input: apps/web/app/(main)/edu-ai/map/page.tsx c230bcac5d5a31d6f2bcea1214f8356f2f2e63ec5be1fa5ec76607e9f25b4093
// input: apps/web/app/(main)/edu-ai/marking/page.tsx 0979cdb9789a5e51167448b230c657d59ee3fb87efb22fa48d8377f8b16f3e16
// input: apps/web/app/(main)/edu-ai/outbound/page.tsx 0eae1d317ca018c08fd83bcac53e8da69b9d365c1e29466d8a38c4ea6997776c
// input: apps/web/app/(main)/edu-ai/page.tsx b9b0cda9b604916f23f82f1b13c0f5e8d93ba97624e5b111f7b0cf524aa47a2f
// input: apps/web/app/(main)/edu-ai/policy/page.tsx 48f87cbe0c067dc139c3814764ec804dd1bbfe494bcb915e89025ee43223557c
// input: apps/web/app/(main)/edu-ai/tbox/page.tsx 8d39a2ab460c8f918cf500220ae49a47f0ba3bed3bc928a6a60df9a79612a35e
// input: apps/web/app/(main)/edu-ai/video-compose/page.tsx ac98188e904e8850a147be7a9bd72513bba3eb427cd362cfda6ffdd09b35f41b
// input: apps/web/app/(main)/edu-ai/voice/page.tsx c8f83428e33c1c5655788aec0483c2adaf98b34969c2b1c322b1e9575ba19852
// input: apps/web/app/(main)/edu-points/page.tsx 587e91f93ced2010ba9ad5d0c7ba58a8a565d966542c7d51aa0c9403ca37dc1e
// input: apps/web/app/(main)/edu/attendance/page.tsx 641d6e7944597cf19f12e1971656f477fff45be919c42edc21cc48ad553f9d6e
// input: apps/web/app/(main)/edu/certificates/[id]/page.tsx 30c76c078af2e8d4b7be7c0b2bc032d8e6bef02caa9c6852d6bdd187dc173fcb
// input: apps/web/app/(main)/edu/certificates/page.tsx 53dae18588908c650922f113a1159344e3129b6d9993ef248c469d95a52c950a
// input: apps/web/app/(main)/edu/courses/[id]/learn/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/edu/courses/[id]/page.tsx 3e8b1025fc51b722335ad922830d0eb9363a75759bf9b11aafbf7cb5db4704be
// input: apps/web/app/(main)/edu/courses/page.tsx 85a8f858c53077a481e8a11de4c70ed968b6e717af84f4558d122cd2bb86ec9c
// input: apps/web/app/(main)/edu/dashboard/page.tsx dc7cb93954ea4892831344aedb2108142f541b3daf710e9ae099e31e27b1b475
// input: apps/web/app/(main)/edu/edu-management/attendance/page.tsx ee249673237ea43b362e64ac999eea54c1e170455eb5433939a3fc06835a38ad
// input: apps/web/app/(main)/edu/edu-management/enrollment/page.tsx 6101506bb7649fea1a634f0199e7aa8734bb4ed6090f5172a96345eb89bb0654
// input: apps/web/app/(main)/edu/edu-management/finance/page.tsx edb66b9e18d8629d4c1636b5fd0fd5e6ab1e13ed353bff6bc7fb000efc1253e2
// input: apps/web/app/(main)/edu/edu-management/grades/page.tsx 995cbff800387b67319592f4b6ef107859ff49a08f1e944bf8092c45c8d557c7
// input: apps/web/app/(main)/edu/edu-management/grades/trend/[studentId]/page.tsx bc6a04718ae14638d59ed11026b720cb0706d9b6b1009a08362b9486c21ff94a
// input: apps/web/app/(main)/edu/edu-management/homework/page.tsx 8a544efa39c6f7c569f8ebba0a92c54a670ad7c29bb295ef6c88698a9a29dfba
// input: apps/web/app/(main)/edu/edu-management/meal/page.tsx 6c2f89e138bad15ab8f37f0cb40ca83530ca76eca8a9d1169f71b6e9f0be0f78
// input: apps/web/app/(main)/edu/edu-management/procurement/page.tsx 93e78655145d19ae56ffe794b347d9ce2413648df6b573ca8fd0d431f5fba32d
// input: apps/web/app/(main)/edu/edu-management/schedule/page.tsx 19bf2ac58846b288d2e3d95bbaf80485e4b155df149a1890ea91be1f480574c4
// input: apps/web/app/(main)/edu/edu-management/scheduling/page.tsx 5ee1d0f6e76fb0e6bd806814d02a02d914c30a18f754e2def172d3c39a856864
// input: apps/web/app/(main)/edu/edu-management/study-plan/page.tsx a694a3bcf917afe21dab9bf015fcc45374464695a31d9812080d144a00503899
// input: apps/web/app/(main)/edu/exam/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/edu/exam/[id]/result/page.tsx fd23d193dee43ff51841125e799a6c64265e22b0499200947c6404d12b2e2954
// input: apps/web/app/(main)/edu/exam/page.tsx 3ff633a99bc64eeb5013570b024c2fb55b7252c64209ff8959e23d67ef2180da
// input: apps/web/app/(main)/edu/notes/page.tsx bf1bc737bc956c52dabb000dba96c98c891ab777ac8c27551c7eb74b62816373
// input: apps/web/app/(main)/edu/page.tsx 5676e95679d2502f6cd77fd60b3b482af8b4cd19de696436b62fb18f3c71c222
// input: apps/web/app/(main)/edu/parent/bind/page.tsx 31bf3f8727cda42d8135ce41041390f13b208450420ed1f55fca1d78cf776ed2
// input: apps/web/app/(main)/edu/parent/children/[childId]/attendance/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/courses/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/grades/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/meals/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/study-plans/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/page.tsx 3cfbfe58ae02678dd1a984208d953ad1b1e594a5a0ca0f15c4ea4671f9ca1bac
// input: apps/web/app/(main)/edu/progress/page.tsx 0841f7a55d2525edc145012e449f8116b8dba58079f9187c6056d62449071c61
// input: apps/web/app/(main)/edu/qa/page.tsx ed2dea9e118f1506550c53fec0b2d3cd2ba259320a00cfc5b0ff9b68bc6c6d30
// input: apps/web/app/(main)/edu/schedule/page.tsx e9e437e30879b9b76ba946e4cfe775e69b8219794f022b5561b84e372b0aa1f6
// input: apps/web/app/(main)/edu/shop/page.tsx 1ddf710d7e838de64a12a61909cb6db037ede39730ea8a3fa8a722cd9d2664b1
// input: apps/web/app/(main)/en/use-cases/ai-design/page.tsx 3685cd5ee4107c7fc390e56515523f122d6152af55d8c76f779abc94acff7bcd
// input: apps/web/app/(main)/en/use-cases/ai-edu/page.tsx 4bcc6d2d8138b068772ed23429a0d3870f2279cf81eb9c67cda64d2c341f852e
// input: apps/web/app/(main)/en/use-cases/ai-marketing/page.tsx e7cfc84efab7332128eceeceac231154e53133480580f6c24e043661d498dc4c
// input: apps/web/app/(main)/en/use-cases/ai-research/page.tsx 4c753044eff87f4494cd1b7efb561596dfe73b037493aa49fc9a2503bd51ec22
// input: apps/web/app/(main)/en/use-cases/ai-translation/page.tsx e3a586ab2675a4f8bad6be338735b8aa5a1e3a5544135b71511c1fadfae950bd
// input: apps/web/app/(main)/enterprise/inquiry/page.tsx aa20b6854cdfc1f1f0f2614c4b5e3e21eaba22a79345ba034c58b3f110901353
// input: apps/web/app/(main)/enterprise/page.tsx e92a22969539402162bd1794714526c8d2c5e84cad577a2d26bc1ab7a35a86f9
// input: apps/web/app/(main)/exam/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/exam/[id]/result/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/exam/page.tsx 60f763631fdec77bcb37f1384e284258119dce575f3d2e14f355cf741da85506
// input: apps/web/app/(main)/exam/wrong-questions/page.tsx 42a5c316b63cb0442fca2c1c9a08c8b3a7d6ded25407f86df966e28332ed7e63
// input: apps/web/app/(main)/faq/page.tsx 6a227706665fa51d378a76039e37dca190b0a144c25a47cd8ab28acebeeaf71e
// input: apps/web/app/(main)/favorites/page.tsx 29ac96a073c65d8932e70d24dff3f56bbdd73a0d8734e725ca6687bfefe1debf
// input: apps/web/app/(main)/feature-center/agents/page.tsx 433444fa348c25f0add761c5282ceeadff0539f4898be9efeef7816d8d60caca
// input: apps/web/app/(main)/feature-center/apis/page.tsx 23b20f154ed76a89bb411eb47ed297fc5b6dde0ab1e284b7dd57e251b82defa6
// input: apps/web/app/(main)/feature-center/documents/page.tsx 1946ee485aafb9680f353f91f6671ec28b5afc94dcfb0d56cc2b264879c025d2
// input: apps/web/app/(main)/feature-center/models/page.tsx c3a31d9294c7b032abdf2bbd36d2edbab15eb06d8acf8dbad883c317119837c6
// input: apps/web/app/(main)/feature-center/page.tsx 824e9140d9b9a05c71bef2c4834d7171e8658b434a258475a5db70adf5065e97
// input: apps/web/app/(main)/feature-center/sdks/page.tsx 293c189449b762b76579e96699f8c3df9e8a9fce5373d764bead611b407fd38a
// input: apps/web/app/(main)/feedback/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/feedback/page.tsx d2eeddddd157b4c4276d39bc7ac83d2fdf89778ae29c38093b62065cce64d40e
// input: apps/web/app/(main)/figma-import/page.tsx d646438f571ef064cfc9308916bb18de94e24fb41b522d1048c7494d97994d5b
// input: apps/web/app/(main)/following/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/free-ai/page.tsx 14251afe2b1cbca09b1bd672b0d3d4283992db241dbd30d8075e0418c6bc0edd
// input: apps/web/app/(main)/fund-data/page.tsx 0df023488c947c49f8bbd0b540c959848e397aef1e50a41ddad1585d9f8548b1
// input: apps/web/app/(main)/groups/page.tsx f4ff97c2afc04098f9abade4781d565f39b500f76e3442f2f78624a6e62830d6
// input: apps/web/app/(main)/help/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/help/page.tsx e7a95a36781696a1426c4e26d2e3676b4a60910adc345742d7eac8a91d21b735
// input: apps/web/app/(main)/home/page.tsx c363a3b298783696813c1ff6c01ea43d10ac6a57a18ffeb7a2aabf1356e1c93a
// input: apps/web/app/(main)/hooks/page.tsx c7aed66054b4f50815c7b49434e711bb1b5049c02878b5f1521d6499f663936e
// input: apps/web/app/(main)/image-gen/favorites/page.tsx 5cdc64e17969f50a89d42e1d7763821495d6e7fa14e850d6f07471ea531184ad
// input: apps/web/app/(main)/image-gen/gallery/page.tsx 8ff24c38e1380167be980f28ba55573d4454874ecd03e5042036d68148b9b1e7
// input: apps/web/app/(main)/image-gen/history/page.tsx e15ad1851aad0ab2a2ca45ee43e590aa00a60e546c3ef2b09d2efbdbb885870a
// input: apps/web/app/(main)/image-gen/page.tsx 61d06b7ad83dad533e88f14a6e04aed7c5508ec0da20ff448e95f7b779fbd10f
// input: apps/web/app/(main)/image-gen/templates/page.tsx 1259791d8648029ef3194f1ec87c688e1dcfedb581d6b4eac164b51e03265896
// input: apps/web/app/(main)/invitations/page.tsx e37d0a9d9191042a16ce4f03abe48077cc04a4cb96e6543554d347cd44d5c3d8
// input: apps/web/app/(main)/invoices/page.tsx 308d4d880f67fd68329aacc33fdfad1a34d6c37fc67b75b69dd9669ccf1a54be
// input: apps/web/app/(main)/ja/use-cases/ai-design/page.tsx 80ab364b5cfe0b63de19e7e16fcfe1e2f03d5d8b53d399c96ff3a764cbd813ad
// input: apps/web/app/(main)/ja/use-cases/ai-edu/page.tsx 934f35b98459ba44c5b3315984d82f4dd305407cf6aea3fd7fbc59cba88dd5eb
// input: apps/web/app/(main)/ja/use-cases/ai-marketing/page.tsx 10984450cc017a807186b96d642dca0abc0bbb4e566e9bd2930354f23c443d87
// input: apps/web/app/(main)/ja/use-cases/ai-research/page.tsx 5feebfc0e9df50f9009e412d4caa79d5656ec4d10620c1ace195a6829e70850d
// input: apps/web/app/(main)/ja/use-cases/ai-translation/page.tsx 06e45850acdada592d477c399007215514d12e185add8f8ac450afdbc2505600
// input: apps/web/app/(main)/knowledge-base/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-base/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-base/edit/page.tsx 06bf7c2e75a9364766505300c734a149a0ea22dc250abc6527071ff9998b2ce7
// input: apps/web/app/(main)/knowledge-base/page.tsx f6806ee60537bd39671f905b3171c899e396efbfda870dad928109339179efb1
// input: apps/web/app/(main)/knowledge-base/search/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/knowledge-cards/page.tsx d5f739f5cc337ce681004d22caeee0b57871330d913c10bf2bbe9171205dc551
// input: apps/web/app/(main)/knowledge-graph/page.tsx d938eee1c132f920cbb7d0d47f16e6fd449bd0ccac8bbcbfcacc8f24e71942ed
// input: apps/web/app/(main)/knowledge-planet/page.tsx 0f26c7caf2affee4a234ead90db5ccdf9e63f6dcdd6331ff3269ae14ce0d24a3
// input: apps/web/app/(main)/knowledge-rag/[id]/chunks/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-rag/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-rag/manage/page.tsx aa5c03febf0f76cd89e2303ff84945faedf64ee3f9a1a80245b70df4f9107e47
// input: apps/web/app/(main)/knowledge-rag/page.tsx 6dfc4d7cc321632603972c3204042ba467caa290660e748886d9ef5166c8843c
// input: apps/web/app/(main)/knowledge/page.tsx 1b1e1fe9b4402ce3395311a64894caf0d84a1d0272c6d979c1dbe2a139dc05c5
// input: apps/web/app/(main)/ko/use-cases/ai-design/page.tsx 96cf11b4ea63e82ec3bea92c6043375926efda32b2af83847aef7a1c7bf87bc1
// input: apps/web/app/(main)/ko/use-cases/ai-edu/page.tsx 8b0b85a683902dfbdbdc6ce3fd792eb1006e7d5cf785fcd004b69b2bdd70c04a
// input: apps/web/app/(main)/ko/use-cases/ai-marketing/page.tsx 422b7e7f80a8264960ea2f081592cf97100354591dd6ced989450fda5b33727e
// input: apps/web/app/(main)/ko/use-cases/ai-research/page.tsx 49f706db1741f27405fa68cc34b8c09113b9f952aa80754a8a2f065a0c632464
// input: apps/web/app/(main)/ko/use-cases/ai-translation/page.tsx 972bdd65c13245698921691bc7139cea0f5b10e66860648a272c3576c4a83233
// input: apps/web/app/(main)/learn/[id]/homework/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/[id]/rate/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/buyconfirm/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/learn/map/page.tsx 872e5e5414775527ff60bebf4c869e156bb72b345f93805a8400f8c67a0692b9
// input: apps/web/app/(main)/learn/page.tsx fc9fab38a6c51b65566960e7e4e491b0a4cf97ce8a3407db7916ff10c5f94d27
// input: apps/web/app/(main)/learn/payment/confirm/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/learn/review/page.tsx 4672e0db0a483e5a2a7bbb4c2f6dacfb41bafc8d64428b37fae53c4f5ee60fc2
// input: apps/web/app/(main)/learn/topic/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/topic/page.tsx 2ee3d15641751351130dd090a7d289b220989eb5ff902ffdce2d8505606b8f11
// input: apps/web/app/(main)/lecturers/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/lecturers/page.tsx 556e2cb3c25c2c4a47ff43cd6b0c0e0f069b5f6458f3664fb7ebb708674738da
// input: apps/web/app/(main)/legal/service-specific-terms/page.tsx e8302bb6ad605c6f03d4cf974438e8d2b76a3f9f9f906ea76eae80d1647bd3c2
// input: apps/web/app/(main)/legal/supported-regions/page.tsx b41a39b4d7c831340b1db82b138e5f3d22c2112e9930a0802e02fb74e3a7dfe9
// input: apps/web/app/(main)/legal/terms/page.tsx 2b0d58df9fee1daef1f8420cd93933e938a156376cde7cd81b6ae79b0fdf56af
// input: apps/web/app/(main)/legal/usage-policy/page.tsx aadc5fcb9674399d1774a4f943de346b068c26a151243fc5eeb88a72baca4b85
// input: apps/web/app/(main)/letters/page.tsx e36021e7ee1add67ac7925b7abee87233f2d41c21ce5a24d99c24d642f7ead4a
// input: apps/web/app/(main)/live/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/live/[id]/play/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/live/host/page.tsx 7c8870b75aac09c7f9f3682fe4fcca02004fcf47e3c118aff6f62e5b42c3546c
// input: apps/web/app/(main)/live/page.tsx b8329086aac80eaba16ad6805e9b72fa4ec2e69d30d95768729a3dd419d7cb21
// input: apps/web/app/(main)/mcp-projects/page.tsx 8083d86a1ffdc43d0480d154482c92eeb73b0ea5ca834c4ff5d3811cc1194eca
// input: apps/web/app/(main)/mcp-store/page.tsx 3801930b21799b9b5fdfda53588178b765ed08d5dcf53aedd69fa6f0591fae38
// input: apps/web/app/(main)/media-tasks/page.tsx 0d25f6dd87d853c2ec502afbad5261286ff52f60b04c7e7a187c79a2adf7c8a1
// input: apps/web/app/(main)/member/addresses/page.tsx fff04497d9f3358dcc81b555f8f25ead6e69a1c48f9516e96de8cbe447f91ad5
// input: apps/web/app/(main)/member/benefits/page.tsx 87b8b25432a2bc87fce3819f47105c8f1bee8571d23a3481178991d7cdc3fdeb
// input: apps/web/app/(main)/member/coupons/page.tsx 0528e360ef84328bc5fd9b5e2add274c97b888ce610f664074bba905051dfbe7
// input: apps/web/app/(main)/member/dashboard/page.tsx 90b75c8114b0b10fbcd7ca79dab933ce34fc9314b05349ea88248b5c5ded5cb6
// input: apps/web/app/(main)/member/exam/record/page.tsx a901960abc562b4fc0de2724b04f553b29105200c2ddae6d8d244a51f6b1296c
// input: apps/web/app/(main)/member/exam/sign-up/page.tsx ef36e6f0c3ad9864387aa359af530c94c0ca8490d11a7ccb87b29d0544b6d012
// input: apps/web/app/(main)/member/favorites/page.tsx 23db6513f69ab6fa23b2376ae7e02f2577fb10591cef8dd5fdaea1d60d33bacf
// input: apps/web/app/(main)/member/feedback/page.tsx f77656c39dbbfc315b4ba375d16598171dcf57735d934e980c1a05140f23e7b9
// input: apps/web/app/(main)/member/help/page.tsx 5695295c5bbcd2d393fede66954935abbd7179fc5fb8626d65dbcdafd92a0d36
// input: apps/web/app/(main)/member/history/page.tsx f69b270d1b122ef8aeb602086790efa2dda4b7653a771624afe6fec1cc1e2d95
// input: apps/web/app/(main)/member/page.tsx 2ec34f6d459cd8edd9922fe77f8e3564dc33c57e44abc0508bdc5a724afa498e
// input: apps/web/app/(main)/member/settings/page.tsx ee560e6d306ff80dae87fe465c5d4cb48f4c0d4ee8f8b0c7384f2580e7aab82b
// input: apps/web/app/(main)/member/subscription/page.tsx 6a57aaeb7f187ef9447bad5bfdde4407978352fefb75ca63ed20c4e492ba1acd
// input: apps/web/app/(main)/members/page.tsx cf8b5291eb01c73def32e6cff0eea7a9e8579bc4582d1f04c671aab8f7db5329
// input: apps/web/app/(main)/memory-manager/page.tsx 88fa9f6b40890eb84d6743cb7a4a7a1bc40dda1eb45921c566f576ffcf1ac1ea
// input: apps/web/app/(main)/memory/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/memory/new/page.tsx 890f7e4951858962b7dc5a216d0f20d83a2ba1e887db6b4fd460675a40b02c77
// input: apps/web/app/(main)/memory/page.tsx 99cde2e52b71c5bc02a85f3823f995680d4ffd74683596cb893d128167507dc3
// input: apps/web/app/(main)/memory/scope/[scope]/page.tsx d3cf5def475b03c0fd96f57fa00a6557e248e9439786c0875dad1c82b69d41fa
// input: apps/web/app/(main)/messages/[type]/page.tsx 2fdfa2b9b1de35ab72faab4733c4743b37f0845e976b32661cfc06d5e85159db
// input: apps/web/app/(main)/messages/page.tsx 99330cdb8f783573854dc167c8b6e8f9c2b730cebc14844b3c49e988f9998f1b
// input: apps/web/app/(main)/mobile-dashboard/page.tsx f842ccb24512e07fcec014c94c08af18d0eeb34b699579956b0202688479c55d
// input: apps/web/app/(main)/models-pricing/page.tsx d52e3cbdfd30d7d66fcdd54ea0e4b6a277874fff8c29467374fe50011468b3ea
// input: apps/web/app/(main)/models/api-docs/page.tsx a5cc8405dba768a5d5c4727296e6422a1b2b0f335ea3241ebf97af3089d00717
// input: apps/web/app/(main)/models/billing/page.tsx 2bea495b2f1566d5886acc3e92a6718cf380499c21432ef15f673c1de51d353e
// input: apps/web/app/(main)/models/channels/page.tsx 594ff458d743e9332b9b904df359a6edae2ca93c0b9b46f57432bc11d1e2272f
// input: apps/web/app/(main)/models/chats/page.tsx 79197a92b7eaf0e6204a4bdd6f8c9f8fb9d8e203d7eba85993f20eb1c4cb62cc
// input: apps/web/app/(main)/models/contact/page.tsx 269bc7f44ce9cca0035176dbf626be368d0e0dfd087154f6b5e20bc8327f0e23
// input: apps/web/app/(main)/models/eval/page.tsx 36162509a885e45b6053c752e6b8813020a4e04e6e81cae5a519d6312c36be3a
// input: apps/web/app/(main)/models/groups/page.tsx c8d0241b0cc4da20fef8ef24e167804bb3579145d0bcf0ed33d978d5c3fdfbe3
// input: apps/web/app/(main)/models/keys/page.tsx 3c3a0325df8ecc12cd9dfeafdbe1114e2699cabcb46fbee613b41128eea3dc0a
// input: apps/web/app/(main)/models/logs/page.tsx 25c20545805972a81246d5cfd70749749115715055e5c05082589383c9447fd4
// input: apps/web/app/(main)/models/openclaw/page.tsx 4f94e0876d499d18a401b04cec554b3b5f80a593e6641e3f689a1d5e0b4a54b5
// input: apps/web/app/(main)/models/overview/page.tsx efc6eb799926e8dae7c5aefa8ed795ae32647377390992db2e36b099bf4b1fd7
// input: apps/web/app/(main)/models/page.tsx 5a4e9722c8358f30a37324c373fadcdc5121019f3eca7f2aa587006928f3c1f6
// input: apps/web/app/(main)/models/prompts/page.tsx 209af233182675b818deaf97eff6188a94d25b944ccd5a22893b31d2c852e83b
// input: apps/web/app/(main)/models/redeem/page.tsx 935d36a577b8e77cdb56de39c06c0fe24df2286f4329b5cb36bf8e180a289e5c
// input: apps/web/app/(main)/models/referral/page.tsx 3593c495ce0cc35e1c05b335fc8c3f03a088f28785c07ea69b0bcc844d5f1555
// input: apps/web/app/(main)/models/skills/page.tsx 842201f8eb699683b246873a47c025b9b2b4727e2068e6287dd1ecddc8fd382f
// input: apps/web/app/(main)/models/trajectory/page.tsx bae73d36caa41f8bb21dff1c70074a3a0d744d8f678a7216c66c9c78897e9947
// input: apps/web/app/(main)/models/usage/page.tsx e894d2ce8ae9842170a706c4cdf33c1356eba051b7224ccf6a4d04d418ac1a48
// input: apps/web/app/(main)/models/users/page.tsx 9733819e068405c6144e7229860fe0f8fc960f1bcaa485d3197fb7f43fd34883
// input: apps/web/app/(main)/n8n-agents/page.tsx 7b97c1af57e81a44a56ecb211d8f8871dee02fa83c562954887193edbccdd4c0
// input: apps/web/app/(main)/news/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/news/category/[id]/page.tsx 9a4a74a52e0389d02f9c16d560907b2ba26abd2591906028fe504fbad9b58ccd
// input: apps/web/app/(main)/news/page.tsx 9dbb7eeb354b0b2c4224fd9e59ed3348b7e6e6a231a39cb278400fdaea3f2720
// input: apps/web/app/(main)/newsletter/page.tsx cdba2b84b0d8d5fb0819ab75d90ff7f6483e66c9e333899f77dea5a129224d67
// input: apps/web/app/(main)/notifications/page.tsx 4cd6752709fe215c91fcaadbd59e01ace8ca5c2f344b2826d06cc279d6b22b0f
// input: apps/web/app/(main)/oauth/authorize/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/oauth/my-authorized/page.tsx f9ec88268fd2134e6c734fd9879925ae365b8246748ca94fe479f46fb40ab3ea
// input: apps/web/app/(main)/oauth/platform/page.tsx e8812b2822d04fea364c25606957ad3a3c825bef58ada49b1158de0fe972e4a3
// input: apps/web/app/(main)/onboarding/page.tsx 2e680b428ae2ae653201f80b54bbfcc7ad35e04149a208abb6121bbbf9296672
// input: apps/web/app/(main)/openclaw/page.tsx 4df4f6051c83d525f8cb30b782dbf2044cc6bf6d17c67c072f23c429fe58e95d
// input: apps/web/app/(main)/orchestration/page.tsx a937023e7ddbdd63981e89f170d8eb9570b21854e29e87d8364ad510abe0496d
// input: apps/web/app/(main)/orders/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/orders/page.tsx 336ae13262a543b07d49598302ab108af259c2056a3d187189c27caee12017c3
// input: apps/web/app/(main)/patrol/page.tsx 95542c81b471db04973923a76f0875e4c5663276ced098d5c2f2a24dd7c9b9df
// input: apps/web/app/(main)/payment/checkout/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/payment/page.tsx 22bd090b88cb4427bfdeaa66dac9f40534032ee946b562ad326ae78a54b653a1
// input: apps/web/app/(main)/personas/page.tsx da7b8bbc49fcbceeaec3e1f9fcd32c499285e60f0aeab0fce55be653159a505e
// input: apps/web/app/(main)/plan/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/plan/new/page.tsx 7617ebc7420477c8b8354f1c55aab2cfa2231d74bf65a1994864ab9aebfb767f
// input: apps/web/app/(main)/plan/page.tsx f60a010081a16951d137c7c170525d73e169669450a54327df437ccf3f6bd304
// input: apps/web/app/(main)/play-beta/page.tsx 782878ccc647def051105b9ac08b7fc6a2c19607d43115ab7b792c0df2c9fddf
// input: apps/web/app/(main)/playground/page.tsx 59ec3e50955b72879bffbebb89b5d64a8ba56c4758cd4647d1d285ab27617666
// input: apps/web/app/(main)/plaza/new/page.tsx a2e5e81722d99ebc2549c39c8482e17bf31dbf527462ffcf21a37165b12fefa8
// input: apps/web/app/(main)/plaza/page.tsx 7646688c9b22bbc29283a41c136cd55162c7bc1c82e0809ac8bafe1a75451148
// input: apps/web/app/(main)/plugins/page.tsx 62429d7f3d6cae03f756884e44ba5ddc2bdfffcd67f719e742f916f3100807b8
// input: apps/web/app/(main)/points/mall/page.tsx ba42bf5c2f314f12cfc9868d63b1c4ade48a568af5f71161057135ad6c7706ad
// input: apps/web/app/(main)/points/page.tsx 22afe064b54ac8b9af8d5397c1dd502210b1c36423e8dcf118dd1b56b9e25ff7
// input: apps/web/app/(main)/points/sign-in/page.tsx 03e28ad52e905196c8fcb4957c4b9160fbe53f0c36dc945a3bdc52178624a226
// input: apps/web/app/(main)/points/tasks/page.tsx ee0c20de33c0f9125c2eacdf6564003c6206390449d0956c126146c4be1d6b9c
// input: apps/web/app/(main)/pricing/page.tsx 0a1c3717f2391db2cc15487136f202ec89b2a8366aceed099f40d0567d45f3d1
// input: apps/web/app/(main)/products/page.tsx bca2f8e745373d271291e554192cd1728570e61ba957c65a3ea48893a687b6e3
// input: apps/web/app/(main)/publish/accounts/page.tsx 7f06d2c37abd11b36cf3ff8d9865e3e1d2bd0444ebb5c9092a5b84af1adbbada
// input: apps/web/app/(main)/publish/analytics/page.tsx 561cc06088d1f81c760eb294e75d8f9d88a2547bd431851e0a4dd39181ef2edc
// input: apps/web/app/(main)/publish/calendar/page.tsx e86fd335003a1bffaa93f9b7e34d12cb0ef659229e67ce5d696759802e10ed48
// input: apps/web/app/(main)/publish/history/page.tsx 19ee8cd23bcadae0d9d3809f3a897e3dfa3eb316e208e22ed299a8ee21ac16ed
// input: apps/web/app/(main)/publish/monitor/page.tsx bf4090a97df62951c60dd6b88b46c1c69be782c7bd7e0df42edc5a2ea467ffa1
// input: apps/web/app/(main)/publish/new/page.tsx 5e34dec8b524d849f16ad1e177cdc266151bdddb37e71c0037293b7d86051358
// input: apps/web/app/(main)/publish/page.tsx c8db96a527dec17f81d00d0195ba83a0170b7ef84bc975fb318ec5f98ff384cc
// input: apps/web/app/(main)/purchase/page.tsx 9b9037ab03cbfdad16c70fbc52f51f7030a69d6b495c8eeb7b35eb5fe0765d5d
// input: apps/web/app/(main)/qoder-reset/page.tsx 3f4e1c7eb00b9a32e076093b16e98af1be635a3be36da6ebda0ff604b3f96991
// input: apps/web/app/(main)/ranking/page.tsx 910974576ec729b0a2ff5e3f79882953043c8799317f4c00fb6d114dbd9bb1f2
// input: apps/web/app/(main)/recruitment/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/recruitment/page.tsx 75acf79ac520f50099145a275a27b080c47e436adf41ffde857ff8b5486fd66b
// input: apps/web/app/(main)/refund/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/refund/page.tsx 15d77dc25c30d09cc358bc70c25b92de2f90ba676c8b08923addd1fb4ed32845
// input: apps/web/app/(main)/registry/page.tsx 9070bf050930487fe3560a0eacbf726d64f58d06cf04de57e9473aed2057d023
// input: apps/web/app/(main)/repo-wiki/page.tsx 2c48dded5d888c618a37a998c93a237cde39615d1a6475dd4e85c454d42d8a40
// input: apps/web/app/(main)/resources/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/resources/affiliates/page.tsx 6ee0101f481fe2082729a14b5773d16413f70a44ea2d11bc3f784f6de5a728bd
// input: apps/web/app/(main)/resources/edit/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/resources/page.tsx 180a9783d2de0c06f9296604ed8fbbf796d3ee9565407107e59d558c469223e6
// input: apps/web/app/(main)/rules/page.tsx fded796d761de0925cc5ca6bc9fd7bf01bd616c0e497cd528e1aa5a532b69e68
// input: apps/web/app/(main)/sag2/page.tsx c0cbceb953439ebe9b84888ff9db1c62ee21c407daadc4e72bc57511ec47eff8
// input: apps/web/app/(main)/schedule/page.tsx e21bf50c94b7d96e2acf1ee6d479043c02d2e5f0bb49d3f7c4d72d6272b318e9
// input: apps/web/app/(main)/search/history/page.tsx 1b1b3dbaf7c50e8b141f3cfef02d6e7af399cd94219c7bc6181ac6f06e649713
// input: apps/web/app/(main)/search/page.tsx 9e7de3a1fc1f2c59c7b05b9081944bd9a9a77554dfa96971cff5d08fe67a5ebe
// input: apps/web/app/(main)/security-audit/page.tsx acf263013c8b2af76a0c4530999e29f1794c02e4a8613d0b35bf5a5bc7d06ef0
// input: apps/web/app/(main)/self-healing/page.tsx c04ec29796018c246ab0256185f5395bc653c17645ebae90292145e8b11772b8
// input: apps/web/app/(main)/self-media/automation/page.tsx d9a8599cd4e16eae479470b0cb6254c2c5c9c889dcda280647262a9b1be7ba8a
// input: apps/web/app/(main)/self-media/koubo/page.tsx ef36a73376d8ad4784db041acb58033fa4d2bb5712a679f8e41f25f5314176ff
// input: apps/web/app/(main)/self-media/wechat/page.tsx 26013635b79d6a515a8ebef8c5f396c3653440933a0007de863207fa62f4dfd3
// input: apps/web/app/(main)/services/page.tsx b54ca5c46d6700ea0fd78c5cac5efde5d04098a2be51feba7d745667d6dc7c8b
// input: apps/web/app/(main)/settings/account-deletion/page.tsx 0e4d50919617a426b6b6c5030a75c41e8edd1735c5dc2a9966a4e3809a52bce3
// input: apps/web/app/(main)/settings/activity/page.tsx e01b30e9f2d8be4089a668bc58f192390b9d9b1d8f145f7f48fe0f8904c32859
// input: apps/web/app/(main)/settings/agent-security/page.tsx 737c23b973f0c007887ff18ca25c53f7a7a99d5793249a221056e9e20cb055c3
// input: apps/web/app/(main)/settings/api-keys/page.tsx 64eb416eb0f634d712d8ae232d5b8c03fb584b07493ec184f93ed7efc412ebe4
// input: apps/web/app/(main)/settings/authorizations/page.tsx 3b8b97c5b3b06caead0ba87313e9b1518a8edf3520967741e45d30edd34dea09
// input: apps/web/app/(main)/settings/billing/page.tsx 59dd63ab12f4afd588c08fae35006bacc20cb0d65b495146006ec02ba1ccbcdb
// input: apps/web/app/(main)/settings/connected-accounts/page.tsx 9b44514461d055e191dbf96253267b25ccb27cacf5bcfeebeee73b3dc7d86f1b
// input: apps/web/app/(main)/settings/dashboard/page.tsx be0a8fd47191f47f85f5beb176646fe61384e7bb349fcb59295551371bc256a3
// input: apps/web/app/(main)/settings/data-export/page.tsx 930b14217176863aabe1fa837ed9399a0aed079a6d9149b486bd7411972a5b31
// input: apps/web/app/(main)/settings/data-rights/page.tsx e1b6ec030b9edd876a79120768ff7bf72780f33217261d624fe1136a39586af3
// input: apps/web/app/(main)/settings/devices/page.tsx 64151a76c1fe271f15986544dfd58fbd16dc11bb08a283d3c6e6b626320eb142
// input: apps/web/app/(main)/settings/gateway/page.tsx 4eef35b03c2dbdef89ee8baff5d817d53877f8ba5b13218e177ea03a6fd1049e
// input: apps/web/app/(main)/settings/icp-record/page.tsx 6524629dc5a9d07d534922c7c447a7ad8e5f18f3fcb2540fe5a81bc69c287d4e
// input: apps/web/app/(main)/settings/import/page.tsx 336e2fb0d88d41c8e7da3dfa5b4827f58e655c9db9b06337ddec6677a16ad800
// input: apps/web/app/(main)/settings/llm/page.tsx 33971a847f01d8bdf10692af698fe91335feac6e9ed338a50d259cc3d29ace13
// input: apps/web/app/(main)/settings/login-security/page.tsx 41e5976d01b3698a8cd1c9cc0eb42166a4a7df4a320e9f1a2c8097f5b57b80ce
// input: apps/web/app/(main)/settings/model-record/page.tsx 61e8dab86044ed61293eef313452347a997f01e03fe21b8096362f3e26b5f968
// input: apps/web/app/(main)/settings/notifications/page.tsx 6826a6d875187dffee897338224cc5c6b5d3169fad791d886c33a00cfd223c3a
// input: apps/web/app/(main)/settings/page.tsx cd858cf8ddf233183ee7ac6eb877f7987436aed3099e0a34a92f6c0a7e867f27
// input: apps/web/app/(main)/settings/preferences/page.tsx 74445a50663525ba349504048b13b969f9d9229f85d58d7836f466f324f5e612
// input: apps/web/app/(main)/settings/privacy/page.tsx b33ffed42f185de95451eea3c278001eeff720cfe99143f2d2a42345649699d6
// input: apps/web/app/(main)/settings/security-log/page.tsx 46a448161593748b49328a8d778c8dc035384da1f4692ee69fb1099b239388c3
// input: apps/web/app/(main)/settings/usage/page.tsx 07ef54b204561a9c6cda33f325410b673cbf1e4e860c54f13da41b576eaf52d5
// input: apps/web/app/(main)/share/[code]/page.tsx 167c448e4b4a8fc29be5687451d9507f01ee71ce9633cc34fae01875dea45992
// input: apps/web/app/(main)/share/page.tsx d5df784435de4fdc6af70d10d3c1dedeaa4359289d56e9d4da7778f0acddb552
// input: apps/web/app/(main)/skills-market/[id]/page.tsx 22c9297245a249350e204aacc1e1e978198704afda124abd0e11d6e06c91f8f9
// input: apps/web/app/(main)/skills-market/page.tsx a766040ff3b687a5a3d7149bfcc1290d96559d2472a5240a23e5bd2b134ba600
// input: apps/web/app/(main)/skills/market/page.tsx 20f79d5ed8d385531f569bcf8183cb22c8015c80cbcef2038511ead3c9809563
// input: apps/web/app/(main)/skills/page.tsx 38765932b5d79e111a9d91fa22317363d4be64742dd17ae1e1d012e9cd098f40
// input: apps/web/app/(main)/spec/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/spec/generate/page.tsx 5c6c4d5b27e1d1c7c6306457fbaf6650a9df873c14c1be71bf5481d9d61b6c20
// input: apps/web/app/(main)/spec/page.tsx 228ebb57dfbc55df3cf4da82d7007b1d10fae2adeaeac7e0fd3a0753164b52a2
// input: apps/web/app/(main)/spec/templates/page.tsx 523741f9b7659d5b19d0011d6a146ac13e771bce41082a2b194564e4279827f9
// input: apps/web/app/(main)/sponsor/page.tsx e1d0251b33321dc4220e68baad4ac5a70aff6eff218c8a4fa22c42412098556d
// input: apps/web/app/(main)/stock/page.tsx f0950e8e828f21d490c5b04d55eed34573a85dab481101d102e9361565e448eb
// input: apps/web/app/(main)/student/certificates/page.tsx 3d70199b693738782f22df922eee7ac6ba53ea2e473438910ceebe4a129e8b86
// input: apps/web/app/(main)/student/my-articles/page.tsx 6ec2e8a3e5daccfdb6cb25d0390547cad4ca20e0d280f95fb2e7b230c89efe44
// input: apps/web/app/(main)/student/my-asks/page.tsx 823183bc84cf73b335857d61a12069f7ac2c420d46e7a40d5074a43f7ea75072
// input: apps/web/app/(main)/student/my-circles/page.tsx 8c44806b91c76963cb498c89289a2d76949151b5543c87fbd815e61b08e13e7a
// input: apps/web/app/(main)/student/my-comments/page.tsx 4d28a2f4db5da02b18b330ac5a211e0aa38c8248df63edbcd2cb300766e47334
// input: apps/web/app/(main)/student/my-lessons/page.tsx f30d187064a0bd45bf2645e5bdf9bdceaeed7c9ddb6e045a53cb3d0842d99941
// input: apps/web/app/(main)/student/my-resources/page.tsx 3fa00c4a2f443038f9950fb14b0063fae597b78242198dbb921898b837b8e5fe
// input: apps/web/app/(main)/student/notes/page.tsx 8eb7e4ca8dc6baf0d083778d10f4a3f74628a35b2eef22600e3f1f9edcfed1b6
// input: apps/web/app/(main)/student/offline-records/page.tsx cfe32632645752cf1cbc88b62b15fc0034510629a6837430527d56f819ef15a5
// input: apps/web/app/(main)/student/page.tsx 4cf84e0db605112662020d524721a5cc405700c56df08b533e010ae55731d48e
// input: apps/web/app/(main)/student/papers/page.tsx 4a91c82b358b71e9b038c0a09801dcdf28c76f222bdddc0095135d53d6836cc7
// input: apps/web/app/(main)/student/wrong-book/page.tsx c5a1123efe128ebb33a2ef1ed614a2b6e833fc07b7bb0e529340cbd23024c4cf
// input: apps/web/app/(main)/subagents/detail/page.tsx 984254f7629aa023a7c03c41296bd1170dd8a986e7d14635b8beb70d4b844a35
// input: apps/web/app/(main)/subagents/dispatch/page.tsx 5aef88d1913fbe3697c2eaae09179e3c501db547c94cacd79860e9785baf2a78
// input: apps/web/app/(main)/subagents/page.tsx bea0a2df4d15de0b3e4d7c7538a583b6acf0584d2929d1605d54bef49cf7a13c
// input: apps/web/app/(main)/subagents/topology/page.tsx 609fb6028d39528b8eff849ffe08e8c0cd2fe894edbb85080498cb2b431574f3
// input: apps/web/app/(main)/subscriptions/page.tsx dc05733634bb01d6a39816ab5ffd88c131320903996a41fe736340223932188c
// input: apps/web/app/(main)/super-agent/page.tsx ece518f09d5f9c86ba4764fc7dbb8ad1296f2475f81723ad9a8699d6b558f982
// input: apps/web/app/(main)/support/page.tsx 3edc8e19b95bf837e28b1264c2a2985902faa99f2aa1f445d7f169666361cd45
// input: apps/web/app/(main)/tags/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/tags/page.tsx 1d150f9dca48e30f4fb4a0a73090b701c6f6567697451b57ae9c0ff65b2e226b
// input: apps/web/app/(main)/task-receiver/page.tsx d2f7ec24e0bcc2e4290862e6e996b4e4ea9c9a632e5cc9839b542a31089f718f
// input: apps/web/app/(main)/team-knowledge/page.tsx 4581aae6247be33b43dee2fc38973b5cb48b8178449d823489899cb8a35dc6ba
// input: apps/web/app/(main)/team-memory/page.tsx 33c57ed6bbb6b6f06d62a004d54bd3424bfd6ef420ed4055cce0754c2afc92f6
// input: apps/web/app/(main)/teams/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/teams/page.tsx 15a211fa077a2b74d38c722e6d602a7f106bd5a676f17318a94d465e5fdd342c
// input: apps/web/app/(main)/token-value/page.tsx 50c469d06c6f561f443ad83cbb202f098e8d0d4a8ad3f461af301844d48711b5
// input: apps/web/app/(main)/tools/page.tsx 83f30751678c16fb04ac442e71ab62be786c2c57b28fe7aa1963443c3f67b899
// input: apps/web/app/(main)/tools/pdf/convert/page.tsx 896416df7082843b3e8d235c7602e745403fbe2082b87a0641ab5c583f8e8ab6
// input: apps/web/app/(main)/tools/pdf/merge/page.tsx 1fb0b872dd16cc0cdc633c1f050b67bfd5845c7b9feedc7c1093f32558806fd5
// input: apps/web/app/(main)/tools/pdf/page.tsx 36e50d34da9a2980448613df5590114728082fcc7134ae52c90405acd04b12a5
// input: apps/web/app/(main)/tools/pdf/split/page.tsx c6b30c7d43d022dc6b771f7b8f773a0f662df6e2a97ed9737b14dac8fc4e9415
// input: apps/web/app/(main)/tools/pdf/watermark/page.tsx 09d3e26e2f3bc92db4c004de18b54bbf203f128581c1ceca53ec1a0364a457e0
// input: apps/web/app/(main)/tools/voice-stt/page.tsx 2f409a7dfac325f0e78fbe792bd0c049b4275a8d30863507601acd49ced3f6ce
// input: apps/web/app/(main)/topics/page.tsx 2eaaae49934b1d9d72ee2406da6801b685e98d1a444e24c95be04cd748724bf3
// input: apps/web/app/(main)/traders/page.tsx fef81adcf78f60692301ad05757cd43b33de19ad991cb4597894458464122b02
// input: apps/web/app/(main)/use-cases/ai-design/page.tsx 85a79751a6799a6f78d74320d8831c63223042d3a2ae24a02f72045250337841
// input: apps/web/app/(main)/use-cases/ai-edu/page.tsx 6e41c9c1f6d53a929d4d4f96b4785dc8a6735a851f722b26b7302dd5410e2b4e
// input: apps/web/app/(main)/use-cases/ai-marketing/page.tsx 55f6b0fe21da8f014fd07d342730f18915fcb66e3242301f13224702248cc19f
// input: apps/web/app/(main)/use-cases/ai-research/page.tsx 0e0805e0402844f90a60994788310d21fb6a88980cff14adeb5ad54b342afdf9
// input: apps/web/app/(main)/use-cases/ai-translation/page.tsx aeca5fcdd5771657ea4c0c91e926d9382c87e9c3dc82949fde9a2bd74f45d9c7
// input: apps/web/app/(main)/use-cases/code-assistant/page.tsx 218068c6fcb84aefaa1b74d7cbe595aebe823c478476c61a02cef7996c6646ff
// input: apps/web/app/(main)/use-cases/content-generation/page.tsx 6cbc7ec9be77fbb4c3c2bda3e8816947da4838770e68d62b448099214e0ca51f
// input: apps/web/app/(main)/use-cases/customer-support/page.tsx 7f2da7242c72f11346a2e224deeb2066db253dde8becf70ccc821728f0a09e07
// input: apps/web/app/(main)/use-cases/data-analysis/page.tsx 393e404357ed755d95fec5babc9e27b1e497d95db6b877968709e91c4edf8659
// input: apps/web/app/(main)/use-cases/hr-recruiting/page.tsx a5d8a418ecbbff9d139dbe0f662dd6909fc9262abb1bfcd5443cc46ef86acd37
// input: apps/web/app/(main)/use-cases/it-ops/page.tsx acd2ba3cbaf40c0a4a009c619d5175f166bbb8cf62d591c3c13b052c5b967c5b
// input: apps/web/app/(main)/use-cases/knowledge-base/page.tsx 7a9d2455c6beb6d10b4cfb21288b1cedc77558ea43a12837c100010aeaf94095
// input: apps/web/app/(main)/use-cases/market-analysis/page.tsx f2c415f90bb052392cbcbdf71977537423236cc37078750a5b5bde8cb5afd1e6
// input: apps/web/app/(main)/use-cases/page.tsx 62c810dfbfc5f8e95fa0ac61579de476cc9a2e607f2013268758e33cee49dde6
// input: apps/web/app/(main)/use-cases/product-analysis/page.tsx d7ce78cfdffba4eaf8733e3ebc80359e9638a1227c777f5b33bfca7ce49d8acb
// input: apps/web/app/(main)/use-cases/sales/page.tsx de077c1b4f10f904795ae493abae30f45984a186019a99dc56a9bd06408f0c48
// input: apps/web/app/(main)/user/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/user/articles/page.tsx f6bea800eecedcc9369ec6b3453ed7c1c9f634f8d7585985ed5391765df43aa7
// input: apps/web/app/(main)/user/ask/page.tsx 5a7f9748bde8bd23fda3ac2ce2f145235ce1b9542fc7aacdd006807eb723fd3b
// input: apps/web/app/(main)/user/circle/page.tsx f9ebcd82814b24a71736749010c039a10d65cc81521b7d583563ce57908ed222
// input: apps/web/app/(main)/user/comment/page.tsx 176b270b1dc675f8f597ba6accdfc1b5b0eaecbf50fd525104553250112725a5
// input: apps/web/app/(main)/user/exam/page.tsx efc1e5a843ebfd58aba675ffb5dfa41fb6613b70c52e5aee1c182366f469a6fa
// input: apps/web/app/(main)/user/fans/page.tsx 3bec412b75f14223ce9061108267d661c65eb81c647432246fe0e4d479b19b54
// input: apps/web/app/(main)/user/follow/page.tsx fabcd1c058dc78ca15c493270ddef7933731e3719416175fc1383888ba4a2f2b
// input: apps/web/app/(main)/user/learn-record/page.tsx 416f84a485441dcaf0b3d8008a95f4032cc03238c183301a3dbbb32b5ec2eec6
// input: apps/web/app/(main)/user/page.tsx 90e1734021e341936e8414bbeece0e57c26a418454139749805082f243b1370b
// input: apps/web/app/(main)/user/profile/page.tsx 50d9f39353538bd85d6ae4893d3a4d2b40933df8d92df7e52f95da8a9801b8b7
// input: apps/web/app/(main)/user/qr-code/page.tsx 0449910812e78aad9b6555f8ff2a8adccde7788535406624ca0b1b5d752dfdb6
// input: apps/web/app/(main)/user/realname/page.tsx eb8f7740121d35d50f610da70f2626b9f91385ec95ce4210addb1692dcb7adfe
// input: apps/web/app/(main)/user/resource/page.tsx 8035b963b0f9257e50661e9cc94737bc71e32f16b16e650bd544f74986092e07
// input: apps/web/app/(main)/user/security/page.tsx 76a8952e14f28ab771f7b33e246ec9aa95d3c4fb1ad69b64f1de044652494616
// input: apps/web/app/(main)/user/sign-up/page.tsx e0566d9d6f2166b98a99e831c8864ff1d81a15f710e63db92742aa1b32602396
// input: apps/web/app/(main)/user/subscription/page.tsx 0a278195eb3beb4265d3fb29dd495f85cd7da1526ee4027996a797d9006e8513
// input: apps/web/app/(main)/vip/details/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/vip/page.tsx 0352e946a383b61f3496e88645401448f75e4ac145d75f0228518183ef132b48
// input: apps/web/app/(main)/vip/trader/page.tsx 0673efe46df37b9553d2b72d2cd9aa1c95886bb0c43ed7e68dea6822428d7f3e
// input: apps/web/app/(main)/voices/page.tsx c68d2a84a3398bad4944fdef278c577f9f209c0b0511806544c49ba78f095124
// input: apps/web/app/(main)/wallet/page.tsx e178360fa4559223156dc36ea3098f205dc56c99b9e3bd40c926121b531be0f8
// input: apps/web/app/(main)/wallet/recharge/fail/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/wallet/recharge/page.tsx d8a6e5398125764a49e9f74049dd0405b5dd21735854e51628c8300254942d1c
// input: apps/web/app/(main)/wallet/recharge/success/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/wallet/withdraw/page.tsx f97032228a916964c08ed98f8373203c4bb433a05b13598d1ca539db92dc10ba
// input: apps/web/app/(main)/wallet/withdraw/records/page.tsx 9477479de2bfbda133d82ce9ddf934aa364432cc7e37e2504236b1a6934a2a4e
// input: apps/web/app/(main)/web-tools/page.tsx 00a7975c51aa5cf85bc1a937e993e763c3e18935d551639bb42f049d84bce87b
// input: apps/web/app/(main)/workbuddy-reset/page.tsx e8f6797d00dab9b1c71316e7fdc7d1ab2ea7681389e824bdf61f59a7582aff37
// input: apps/web/app/(main)/workflows/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/workflows/instances/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/workflows/page.tsx 04023d6b22d63b60eceb775e64e213bddfab0a02b4ad697969fb33d9a199ddfe
// input: apps/web/app/(main)/workspace/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/workspace/page.tsx 7d5a9329af0ad9d628f71949ba26c67650d8740b9ef7b688926f4ce9ba536d50
// input: apps/web/app/(main)/workspace/permissions/page.tsx 38886a323039fdee621a08d3965eaae3710bffb83ae28538fdb303e0d980cad1
// input: apps/web/app/(main)/zh-TW/use-cases/ai-design/page.tsx 35fec407c5e43398b902bd54336cd2606bc15c4425901af87e97066c624fca67
// input: apps/web/app/(main)/zh-TW/use-cases/ai-edu/page.tsx 294b66aa5726095e0388eb69c2ca2828851ceccdf987f15071626f311da28c90
// input: apps/web/app/(main)/zh-TW/use-cases/ai-marketing/page.tsx db56f48237297b2f6c8a5ee101b3c6a9cf2bb49633678f9a407673ee2cb885ea
// input: apps/web/app/(main)/zh-TW/use-cases/ai-research/page.tsx ec189b42ce6084ca641f0438a72e8259499d44898d9a4534371d3a6aac1a26a6
// input: apps/web/app/(main)/zh-TW/use-cases/ai-translation/page.tsx 527c2d4aa11c0f9caa98c4ed8b3b6db3ed5312b421cf49e83fb204e9a341c646
// input: apps/web/app/(marketing)/page.tsx 8004f807b187bbd827d227e7bc43dff4efd301968e177cfdf807c1d700681c97
// input: apps/web/app/(pilot)/shared-pilot/page.tsx 98a7584005179c9990b06f8d1c2bae8d734423b4c4ecc7a24a4f435a22a88cb4
// input: apps/web/app/e2e-harness/markdown-stream/page.tsx da979112451fb93b65b21a631fb27e6c3fcfeb2d8f9a89f7f69d12a52cd98f13
// input: apps/web/app/en/agents/page.tsx 10b327a0a31a1070ebd2fa5262363dc7788bd1ecfa139540eac3a370d131d68f
// input: apps/web/app/en/docs/page.tsx 29cce924cad158fdb8d729bc12c5499660cdee254159efe39e506153951e0e0d
// input: apps/web/app/en/models/page.tsx c803fb9bee56402a15715981b93bbfd515dd1c0095f5143bc6dd1a9557624002
// input: apps/web/app/en/page.tsx f5237c873f9b67f76cc698e8d884d2f8ea827d712e05efd7412fa45ab78df4f4
// input: apps/web/app/en/pricing/page.tsx 605746de919c6b6c481875364a93cc5e699c56981537a0aeea9d276ecf5af6e0
// input: apps/web/app/forbidden/page.tsx 7e66da391b84e4d0d9f04663f7080dd7ac926b44bd5823780a5e3bd88d9d990f
// input: apps/web/app/h5/share/[code]/page.tsx 167c448e4b4a8fc29be5687451d9507f01ee71ce9633cc34fae01875dea45992
// input: apps/web/app/login/page.tsx f2ee8254da02a265ebf622b16283fd9f31b604d5f19fa26620418a4a5bb5891e
// input: apps/web/app/sso/[provider]/page.tsx fd34930f90d675b52341e38b24b81dd11ee6927b07fba100795a7406f63b748a
// input: apps/web/app/sso/auth/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/sso/dingtalk/page.tsx 64f99922068bb205c61f970f25e60d57130099226a50b9e87cdda19264463459
// input: apps/web/app/sso/login/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/sso/mobile-auth/page.tsx f6c51a1ea23764b025e27b0dcd5af679feb42a42404a08dd4b0c905e2b2dcfc0
// input: apps/web/app/sso/redirect/page.tsx bdf4f937090bbd2036ff68e338493a2c33db74535aea56f609dede6afd68cec5
// input: apps/web/app/sso/register/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/sso/wecom/page.tsx 35efcf616fc264c76204fb3d155f464682cd239b37965652b930391e0e7144b6
// input: apps/web/app/status/page.tsx d28928c9d285ce3bbf41205bea01abc4d8eadce1762f269615846130b228510e
// skipped: excludedTopSegments(sso|h5|api)=9 pages; duplicatePaths(保留先扫描到的)=0
// generatedAt: 2026-11-13T16:35:28.991Z
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
  { path: '/admin/finance-ai', param: false, group: 'admin' },
  { path: '/admin/github-app', param: false, group: 'admin' },
  { path: '/admin/gray-release', param: false, group: 'admin' },
  { path: '/admin/help', param: false, group: 'admin' },
  { path: '/admin/home-schema', param: false, group: 'admin' },
  { path: '/admin/hr-attendance', param: false, group: 'admin' },
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
  { path: '/admin/model-pricing-console', param: false, group: 'admin' },
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
  { path: '/admin/org-governance', param: false, group: 'admin' },
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
  { path: '/admin/relay/account-proxy', param: false, group: 'admin' },
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
  { path: '/admin/relay/tasks', param: false, group: 'admin' },
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
  { path: '/admin/sms/operations', param: false, group: 'admin' },
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
  { path: '/artifacts', param: false, group: 'artifacts' },
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
  { path: '/chat/workbench', param: false, group: 'chat' },
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
  { path: '/docs/:slug', param: true, group: 'docs' },
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
  { path: '/e2e-harness/markdown-stream', param: false, group: 'e2e-harness' },
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
  { path: '/edu/attendance', param: false, group: 'edu' },
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
  { path: '/sag2', param: false, group: 'sag2' },
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
  { path: '/settings/devices', param: false, group: 'settings' },
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
  { path: '/shared-pilot', param: false, group: 'shared-pilot' },
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
  { path: '/super-agent', param: false, group: 'super-agent' },
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
