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
// sourceCommit: 1f4dfcbdfb85b1e1f1e09bee55d2089779aae3d4
// inputsSha256: 8a4e9e246a29591475abb44a2d751faf968d2d9e043b5c7668280d467a068e8b
// input: apps/web/app/(auth)/apple/callback/page.tsx f328ceb139ed3b61c0e79bc671e93885a6c1e1b6b7c356febbc97f3255da2075
// input: apps/web/app/(auth)/callback/page.tsx d17f249c8506951babf768ff47e0800dc7ed191a9c80ddb124142a8520bcd80e
// input: apps/web/app/(auth)/forgot-password/page.tsx ebf3e4b50c09d9871131b9fbdc5cddb79c0f9c73bc5775c5ce56dd08a0fa2443
// input: apps/web/app/(auth)/google/callback/page.tsx cde1e4556035c25e575647a27a27b2d58eef2f65726a875747af87d31f0a9cba
// input: apps/web/app/(main)/a2a/page.tsx 1b8e33cbf89c49b66405886b6403d8a7f782f61b7a3a8536964cdc286a4e6e6d
// input: apps/web/app/(main)/about/page.tsx 5afd0dd2943e9a1e6b3fa72f8209d79c8c58ba3625c13ba86808b4acfe3806b1
// input: apps/web/app/(main)/account-pool/page.tsx da6169cc2fb7ddef0b2d8eb5fb969939f4b70ff95178c0c8259b2d8ffcb7ab6a
// input: apps/web/app/(main)/activities/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/activities/page.tsx 9e7a9cc7d0adf040df7fbc5e49c716de8eb3683f09da47929b8a75ee3b2f3b2b
// input: apps/web/app/(main)/admin/about-us/page.tsx 9a4a30fd3f2e6ee7e5f8f37674126dc7f9c089ead31d037e6fff73ccd7087420
// input: apps/web/app/(main)/admin/advertise/page.tsx daaa6ffe59856d1f880175a4f0bed169aa5fdc07ac2e3b3aeb1ffaffaf3c91b8
// input: apps/web/app/(main)/admin/agent-rule/page.tsx 89d93d95cfde3b3928d53b50d504b5bf5ce5d89a67412a8c9a8608f79f680883
// input: apps/web/app/(main)/admin/agent-rules/page.tsx 934e6af96b5130c9f89e32c191c25989ba7bf87ead913faaee21ca2e0e898a9e
// input: apps/web/app/(main)/admin/agent-task/page.tsx 70f2a736f9c9eb7d8a471aa64c1c3114c6e324ac43cb3dbf8199accdc84330e3
// input: apps/web/app/(main)/admin/agents/categories/page.tsx f3bf0ec20c3afbd0660d3adc12a0aa9df83b0a03d87fa7810ca9b0d7a3f16432
// input: apps/web/app/(main)/admin/agents/examine/page.tsx 1c397d104ed34b2a02d3e902d3d0d3b30b2119a7b2b663528039fff6faf34365
// input: apps/web/app/(main)/admin/agents/page.tsx d7845d2b0f1705becfabdccae777d2c36ef320849ac938377352fe436e434720
// input: apps/web/app/(main)/admin/agents/settlement/page.tsx cdf2ee17ae9b5560726edfe81e7198bf937c4826c5ce6ba808ae274fefc74b90
// input: apps/web/app/(main)/admin/agreements/page.tsx 3dd482894368242d346524e29b81fb7de90ae33ac2715e23c5a34a9a665cab18
// input: apps/web/app/(main)/admin/ai-cost/page.tsx 2a583464046a069f51dad772aba0494b7d991e77c67d337309d0396d0227d506
// input: apps/web/app/(main)/admin/ai-feed/page.tsx 673c7167e902d321a907a950b631b2a86730e07fbd1ad08a73b65601355bfe5d
// input: apps/web/app/(main)/admin/ai-gc/page.tsx 23744325a0b91fd4b96c00cd5e83fda0c240c9fb1cd26916ce0b67dccb5e1f04
// input: apps/web/app/(main)/admin/ai-metrics/page.tsx ec9b5ff88426e877986447e5f5bc39b0f5a112e26bdd9c5703e46987c3e1ac46
// input: apps/web/app/(main)/admin/ai-models/page.tsx 243b5eac76ab87f85f402627f477a2edf328589706005e062069533ce672834f
// input: apps/web/app/(main)/admin/ai-pricing/page.tsx 245361d5712ace75c12b0005314b2c3899713baaf519a0f132645a6e5a0c449b
// input: apps/web/app/(main)/admin/ai-skills/page.tsx f7ecefd78d6ced58516553afe7995db1a76223756e45934c7162dae96ce8a79c
// input: apps/web/app/(main)/admin/ai-world/sites/page.tsx 28b5edf31304cfcf9cbc84fa5da29d297bb66a71911d493ef58bb1d206d99a69
// input: apps/web/app/(main)/admin/announcements/page.tsx 29100d1d2d2143b909c3f2aab861520ceda9565552681c0bd4bb23c61d774a3f
// input: apps/web/app/(main)/admin/api-debug/page.tsx b48ea3c8bec22610139f563144446daf5e71e5445b1ea1a75feb0be0839b2a23
// input: apps/web/app/(main)/admin/api-groups/page.tsx 6de0ccfec7c8c76393eb391a4b6a9d19a9cbc61ff0455bbca6a98bb6b3bff9da
// input: apps/web/app/(main)/admin/api-logs/page.tsx decc04ab96204b89f274e0a0d397ce58673754bbe73696f8a5e9191e5b91801c
// input: apps/web/app/(main)/admin/api-platform/apps/page.tsx 7b4be535b52d4622b1dbd84756abf3f955476725c5f80109b83ed699ec8cac51
// input: apps/web/app/(main)/admin/api-platform/billing/page.tsx 75fe5f321b32555052d1ee437f9890a93e6dae0696025d6cea41952a16521dc8
// input: apps/web/app/(main)/admin/api-platform/packages/page.tsx 41caaa8fee448e85b45b8392e4bbdadfc464c44458acc32874c5bc4916af06f0
// input: apps/web/app/(main)/admin/api-platform/usage/page.tsx 000d086d4c038fefaaa24ce782e9bd35015bdbc88656238108d044b43f11daf6
// input: apps/web/app/(main)/admin/api-usage/page.tsx 5d97112471a387b07e2d388114c2ee3ffd929f094a920457560ba27186563890
// input: apps/web/app/(main)/admin/articles/page.tsx 012497454a135572ac85f393f772386881ecfe2142cb5f4364fd774b8a2d7aa9
// input: apps/web/app/(main)/admin/asks/page.tsx 8bf9245a5894a8b78dccf69330ebebc563f1f263c5b85965830b35d28a767dc5
// input: apps/web/app/(main)/admin/auth-accounts/page.tsx 1390e1bd68d302c845fb2deeb2eeb771c3a17bcb5a418ea71bfc9b5cdaaf1dc8
// input: apps/web/app/(main)/admin/auth-dept/page.tsx 293ee24e5bc1fb0edfac588c343ea10907d66a36e9a39ff0d2d298fc843526e7
// input: apps/web/app/(main)/admin/auth-find-info/page.tsx 9df04b659ed76206fcdd9e9a9e1a772f3e822200486f5ffd540ecdbecda7cdb5
// input: apps/web/app/(main)/admin/auth-role/page.tsx 5d6ab226a7011d7b12707ce1c8abe498c0475ca90c305290b6b7606bc93e5da7
// input: apps/web/app/(main)/admin/auth-user-vip/page.tsx 895a9fa86f7c953636a8ec1e2f78fdfda0ed55869f9c3a0715e78e690242f5e6
// input: apps/web/app/(main)/admin/auth-veri-codes/page.tsx ec0534978c7f3c083d5056e96860335e1b38b3525501a2db817a481d7c333ba6
// input: apps/web/app/(main)/admin/backend-health/page.tsx 7c711c3e37a4825c352462d292923deb5edfac84ec69a5b237de3aec46c9bf02
// input: apps/web/app/(main)/admin/backup-jobs/page.tsx a0fd9673df968a8e75e50a0e413fb65f500df876185de6f3fe4801f0a1fd8859
// input: apps/web/app/(main)/admin/behavior-analytics/page.tsx a31cd86b610f88a7ec07a1894d740385e95ddfd4df1c814c9f59e72c8bcf7c5e
// input: apps/web/app/(main)/admin/behavior/page.tsx 0a314eb0e83da4dc3b323d80fe17c6b52b421499d7d04686cfb44ef4b339a19d
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
// input: apps/web/app/(main)/admin/contact/page.tsx 56e68f8b840f8e05d770edd8d6fde2154396b97faf3c50b671ee9b74b24851e0
// input: apps/web/app/(main)/admin/crew/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/crew/page.tsx 70096db7ece2d8d8960986da60979f07f6ad9e498412ac49c305c1a0780adba4
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
// input: apps/web/app/(main)/admin/docs/page.tsx 039a1260cb644364582719e86895b3424f05db0397ad6e572b2c03f57fec36e0
// input: apps/web/app/(main)/admin/downloads/page.tsx b3500def9f12886e95a4940512c131801e862ad736eb0651c8f95ea30e5a601b
// input: apps/web/app/(main)/admin/edu-settings/page.tsx 3573ecbbd89811672ef00d3ddf784c9a991eed44113764ef1a77e42ec54fdcb7
// input: apps/web/app/(main)/admin/edu/answer/card/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/edu/answer/online/page.tsx cbc06fb628e5efdadc64ab66216bce2eac823c264a350cf9f2c1a021e65e02a8
// input: apps/web/app/(main)/admin/edu/answer/page.tsx 6c81013b5d68c42d4325bb962aa4b8658d4c2927621f80fd1cd0bad151534037
// input: apps/web/app/(main)/admin/edu/answer/programming/page.tsx 59e5fe2c95fce86fc41809ec1cb4a470a8960dd1b3255b11e77bd70818bbe4e1
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
// input: apps/web/app/(main)/admin/edu/exam/grades/page.tsx 11ec5e08ed206df618424fbc7ea177b14792d3e54d8711a17ffdd410600c7e5e
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
// input: apps/web/app/(main)/admin/edu/learn/live/page.tsx 7a05e96d4d0c67a96764ac8f459af671935f99ff31bb8bfea86090ec9afce2e8
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
// input: apps/web/app/(main)/admin/edu/learn/signup-batchlesson/page.tsx 4495fb93321d12517d5631eefe102a4489dc74a503b09cba6e7159be73f1a823
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
// input: apps/web/app/(main)/admin/error-dashboard/page.tsx d7a3350787fc0924527ca31daa3035b6d23d21a0332c4989aba14878e67aeb89
// input: apps/web/app/(main)/admin/event-bus-monitor/page.tsx 9aedc75dbb23ca74ee2f46fde4f586569d0c80ec4c80c34c9030425a0cf18c61
// input: apps/web/app/(main)/admin/events/page.tsx cad549f85e30758f75e4bc357c0a5eaf2728a63f25d763786f2dd993bc062271
// input: apps/web/app/(main)/admin/exam-marking/page.tsx a73b044234cf9bfceaf2d123a841b1bec0bb604d4c0300e2f81879f78ebe9490
// input: apps/web/app/(main)/admin/exam/categories/page.tsx 163ac24e26aa4dcefd23ba2fc6d7ede84c2e149524faf2e92a1e1cdcfdf3b36f
// input: apps/web/app/(main)/admin/exam/page.tsx c17fbde2106303907f3139a30fff39641a9ded4071e956b6cebeadbbdd16a104
// input: apps/web/app/(main)/admin/exam/questions/page.tsx 66edcb2907e55a9a47d1d60a878233400949c085414f803b81c61bf99098e66b
// input: apps/web/app/(main)/admin/exam/records/page.tsx 66edcb2907e55a9a47d1d60a878233400949c085414f803b81c61bf99098e66b
// input: apps/web/app/(main)/admin/exchange-rates/page.tsx 339b2cec9cbd529976487ed01b76538f4db15e030a87d0d0c22e46e76021b852
// input: apps/web/app/(main)/admin/feedbacks/page.tsx 0b8f7f587d4aa6002725aacf6ef4e4daf723e5925ff9238a9d09c85822b7d98d
// input: apps/web/app/(main)/admin/github-app/page.tsx d39fce19cc0f920f2ff0b342e5bd5427c08849e625d83164d02f6f17424c83d9
// input: apps/web/app/(main)/admin/gray-release/page.tsx 2ded41ac6e29893dcc280e05e0f035e1e970f264b30e45a53e3f399678426c78
// input: apps/web/app/(main)/admin/help/page.tsx eff70194426b19eee76958dfac04d6a1444f2220736d73164af54a4bd1f20eec
// input: apps/web/app/(main)/admin/home-schema/page.tsx dc4ce8e0553789f28c2f88cccff8671c82af3c526e7b095b5186f140257af627
// input: apps/web/app/(main)/admin/i18n-dashboard/compare/page.tsx cd1148a50dba0988f67b748f1239a0aac69d100fe02e0f9b0797c549d0f58a01
// input: apps/web/app/(main)/admin/i18n-dashboard/missing/page.tsx 3cad88d28fd230c860e2196cceb064a81e3ae92c6bfc6265d7a6316d000c4157
// input: apps/web/app/(main)/admin/i18n-dashboard/page.tsx e3b10d41c8ad7cc21f4b6c86e7604e24d82e04126c1ac0a6b63e795955ce9f6a
// input: apps/web/app/(main)/admin/identity-proportion/page.tsx d5618787bbdae9fb9230be54c7bbd0303bd94d84325590935f49fc0652fbb49c
// input: apps/web/app/(main)/admin/im-channels/page.tsx 186fbc488dcad0bab1a1ad4b7c7ea52355a0dc43c16e5089c65ac6058a17f467
// input: apps/web/app/(main)/admin/integrations/page.tsx 1310972c2dfc51b7706ac6006cc2dc11c59c525a63a7664effeb891664f0ce48
// input: apps/web/app/(main)/admin/invoices/applications/page.tsx 1809d283b7d0a55984955b73284930ef7510aca09bb9c900cd54904ea2f83027
// input: apps/web/app/(main)/admin/invoices/page.tsx 0b77dc0f15772eb9186a77c48b99567863f4901d837af148dfdfff57364cafca
// input: apps/web/app/(main)/admin/invoices/titles/page.tsx 58c80c5b2cca259c61f4f4841032cc5b517ebb5493af8de4d765909ea9469896
// input: apps/web/app/(main)/admin/knowledge-rag/page.tsx 4a60fe60b897555a0db14495e97defd1e8da427f1e6a1b6011697531a8b0ad5a
// input: apps/web/app/(main)/admin/learn/categories/page.tsx 131da78d70e6365036373cdb35cd70925d74d95c9650a367163cad532739b823
// input: apps/web/app/(main)/admin/learn/chapters/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/admin/learn/page.tsx 701818f754e8ca93bcbe9f58052a2f7b047e00430e624188494015b56e262c31
// input: apps/web/app/(main)/admin/learn/signups/page.tsx 5e8510538b2493f62d51080663ca347628b215a371d7c164c134577f64c04d79
// input: apps/web/app/(main)/admin/learn/topic/category/page.tsx cdc35476d173215a4032f31103257ca46aeb50a6ecf2271417a91f0430805353
// input: apps/web/app/(main)/admin/live/categories/page.tsx 0b8e7d7f97b7c44e845098ff1eb5cf0df70f881a5c69f5bdcbce8fe1776d48aa
// input: apps/web/app/(main)/admin/live/lecturers/page.tsx 52582426e6450b588846a15cc9e1f486e8f1a8a680297078644b060d13a2716e
// input: apps/web/app/(main)/admin/live/page.tsx 0f05ccc2d0608f19b0c773ae5ea1628d1337dfad3cb2b6183300e30bf38e5e88
// input: apps/web/app/(main)/admin/login-logs/page.tsx 83cd501f61baf887a8efb60b51daa8ed8a516cf742357681c28973c9df4d4434
// input: apps/web/app/(main)/admin/logs/page.tsx c2c13decde4e64d9f7bd5b504629328d905daab2e38c7612a28f5bd76a05e180
// input: apps/web/app/(main)/admin/lottery/page.tsx ea4bf9a7a38b0402c8a0c94053e390e68d6468aeec3ba58f0440f8574ee20701
// input: apps/web/app/(main)/admin/member-groups/page.tsx b89f72449e6563d8091b83bdbd7b273b2fb63b61f1c9b7989f391ab74289a539
// input: apps/web/app/(main)/admin/member/blacklist/page.tsx 83b767df8ad9e75c6b8c7c830c2a8ff7b0c33eea99b4a4395f94b900535e59dd
// input: apps/web/app/(main)/admin/member/companies/page.tsx 0c4072466560064ecef9916f83810a100a7de847a77befc930c6b53df3a758ee
// input: apps/web/app/(main)/admin/member/company-types/page.tsx 07f41d327abd4138e666e9d0bf4ec182078b1d033638104310252480b019fc09
// input: apps/web/app/(main)/admin/member/departments/page.tsx c77684646042daf5efdd6e88c7b98f160e0df4389f570005bde53d0f482da251
// input: apps/web/app/(main)/admin/member/logs/page.tsx 7d70ea31663da1a8e105a84f0153f5b687be9d270af95939a76b70540508b8af
// input: apps/web/app/(main)/admin/member/permissions/page.tsx aafb3ebb96e19382fdba348c70291157ae32079c1adc9da9d1f6b2d0dee04585
// input: apps/web/app/(main)/admin/member/roles/page.tsx 4a78fcbea79cd4cb6096fa27f2c8a11a131a7da4680e627e113bfede93f38361
// input: apps/web/app/(main)/admin/member/unaudited/page.tsx e94abba25ed869f46407d8e1aafd43b5218b8fa9eb8efbb6e3031dbd9c420a0e
// input: apps/web/app/(main)/admin/member/users/page.tsx 7410fda556c24fa2942b19c3f0d48827fa30e7b6738f036082fff0c813fce004
// input: apps/web/app/(main)/admin/members/levels/page.tsx 0392253cb7960712fdd76882c12233d64a36cb49b61dade879712067ae7ee258
// input: apps/web/app/(main)/admin/members/page.tsx 80986d6e620d35f50db46fa04c658d5641c3538776554a368013a5d285ee1fe9
// input: apps/web/app/(main)/admin/menu-permission/page.tsx e051ca92a71e75c2d4d24960f649dc93dfbfa43825464d975234823ded0fe356
// input: apps/web/app/(main)/admin/menu/page.tsx 0ab9b5569858abaebab5cb8880a93a3cc88e0eaca5ef20e83cb503cae55eb3f6
// input: apps/web/app/(main)/admin/message-overview/page.tsx a1983602b36ce71df37ba779b30499ae1d154b268c4522aa57d7a4cc79aac3a4
// input: apps/web/app/(main)/admin/message-templates/page.tsx 8a0241e77c4e3573bf3754aa2c58da75171020a8c03731d04a9c053092e13197
// input: apps/web/app/(main)/admin/meta-learner/page.tsx ff7ff74899336954cd5b84ee731010768a8fd6220da172e9170e36445643ce54
// input: apps/web/app/(main)/admin/mobile-adapter/page.tsx c2bfd0020f0a86113265fcddac633806aa965a9d7f57555cbc223fd9d266697f
// input: apps/web/app/(main)/admin/model-pricing/page.tsx 92585726a1e35d5f2bbd6f923e0ebb6a8a8804b119c6f2262454a6c6fb622500
// input: apps/web/app/(main)/admin/monitor/alerts/page.tsx d37aedd862057efd75cd446558a24ed6f31028bb187a5b00112e0823669f0e82
// input: apps/web/app/(main)/admin/monitor/dashboard/page.tsx 4d40e008b73375e79d42e76f737affeb62ab0c255d0e1ddfa61b6f60948c180e
// input: apps/web/app/(main)/admin/monitor/funnel/page.tsx fccf80df86515aea32233a101e3fe1cf6b4f62cd28240b5d941b86843da09cd1
// input: apps/web/app/(main)/admin/monitor/panels/page.tsx 49b030075d3ae91fce46597dc578856497c725ea60a383226e94ed84763eb555
// input: apps/web/app/(main)/admin/monitor/wallboard/page.tsx 7de7cab6caa56c00de5ad4fcadd921dbb0a8fbc15e17cb0770b8b4bc3a91cb21
// input: apps/web/app/(main)/admin/monitoring-dashboard/page.tsx dc2f568f889f4664f578ca8a2a3e39afad0876cd8547b56b0faa8e47e4c45e8e
// input: apps/web/app/(main)/admin/news/categories/page.tsx e9ec5a4b82ac0e9685832b64e0448d6be2477434bef8e28bfaba089f298b9065
// input: apps/web/app/(main)/admin/news/page.tsx 716de66cc2de48c66a7a565e2a5c2ab008a2dedd6c29f2d1ef0cd95c52946856
// input: apps/web/app/(main)/admin/notification-channels/page.tsx 6c80cf633e6f1ff1834d83e7917df11ef9d2d6861a59863da07b724795793f7e
// input: apps/web/app/(main)/admin/notification-dispatch/page.tsx bfbfc2c33201bcf2de1f44207883148a13c8e239cb7ac60cbe4714227b4e0c80
// input: apps/web/app/(main)/admin/notification-logs/page.tsx 51bb2a40603c7bff983e1617869e460111a6e8ac8147f7ac1f1e577d1ef3b08e
// input: apps/web/app/(main)/admin/notification-preferences/page.tsx b1dda24332b4e81f6066db7c2697de81fc248558090ad755ba0dd0729f41fabf
// input: apps/web/app/(main)/admin/oauth-apps/page.tsx 972060269ac7af5912a465022ae3446de8525d1878bfbb9d58c3ad9d48fb7361
// input: apps/web/app/(main)/admin/oauth-audit-dashboard/page.tsx 086112fc36066c06369f3291e947ea9ad956d325ac15701e5012e523005418a2
// input: apps/web/app/(main)/admin/oauth/apps/page.tsx e6a751d5ef33e54ddd98c045eb5ce2888340e03e9d1024a31cb2f18a506ef53b
// input: apps/web/app/(main)/admin/oauth/audit/page.tsx 0c87eda22b6dbbdf3f63feb026fe1a711087347fe08dca797b67ae9d315b73b2
// input: apps/web/app/(main)/admin/oauth/tokens/page.tsx c7ae41d46cf41fe9cb6e90172600e05f897b59b44169acf528abea4734c1e9b0
// input: apps/web/app/(main)/admin/online-users/page.tsx af17521f298a1adeee812e2e74b16fd7dfd0f9f4bdb220a39fb57958b2c24b66
// input: apps/web/app/(main)/admin/operlog/page.tsx e1e1a0837b9581914aeeae63da4c8af3b2714a7f2359d1633f022e73ebb867a8
// input: apps/web/app/(main)/admin/orders/page.tsx b70deeaa53e112ac1acde03876332fb4d522554af64f4cdeaa74062c9052baba
// input: apps/web/app/(main)/admin/org-governance/page.tsx c299d84608edc4e3b84b72d04994280cb999916b71c7401c21204be85a1b000b
// input: apps/web/app/(main)/admin/oss-config/page.tsx 7f698575232bf13a3dc015033643925f8daec0c24be224438a4967351120d50e
// input: apps/web/app/(main)/admin/oss/files/page.tsx 3a11e031a5a54a86ecedc9befb227a9725e7ae86459eae32f686756e1a3db26d
// input: apps/web/app/(main)/admin/oss/page.tsx a4099f971b9efa8efaa2c82c23e715d7200839cd1ab4ac59335a3e09d1841011
// input: apps/web/app/(main)/admin/page.tsx d06b47b76f357b7793b46765028c047c0f7fed0e46761299c05066f2c97c00ac
// input: apps/web/app/(main)/admin/performance-dashboard/page.tsx fb8b448608242371d0e3432df44d9a9264b75cee33d541ca7d1dd9c11132d0b4
// input: apps/web/app/(main)/admin/permissions/page.tsx c9a5638cb1002713a446d5884c551c0cba798e0921aa10e1595663280eff4a16
// input: apps/web/app/(main)/admin/plugins-stats/page.tsx 527b2a8e83c90cb9351d32db771cb4efe5edbd097a249ffc15e2e8dc768fe57b
// input: apps/web/app/(main)/admin/point/page.tsx 01bd9f793dc54a1ca0c073590b90fb70b302e8394bb86237c4fd3e22163607bf
// input: apps/web/app/(main)/admin/point/records/page.tsx 2b78e725e31aa555bcf1069b40af79711988a21323fdb82e7e73ea9d25df9a50
// input: apps/web/app/(main)/admin/point/rules/page.tsx 0fbf71bcfb4efa4200531b0651506cfe03d47d4d074e881395e088d4bd00ff1a
// input: apps/web/app/(main)/admin/points-mall/page.tsx c92bb1baef1e87d181488ad8e6175168b0b5a7fb5ef4ba74975aaf22fa9f9f69
// input: apps/web/app/(main)/admin/post/page.tsx da9d6d18937a12f3e72010e86b24b4e1051e86fd9fc3b61f0065c410e379ca15
// input: apps/web/app/(main)/admin/private-letters/page.tsx 40230c3302184bce5fad9e44951ebde043e956bf607944a541caff3746607fea
// input: apps/web/app/(main)/admin/product-identity/page.tsx f4c777dc4694d94bd9f66ffa98364faa599981af365888cc5951dc7d64d5b33b
// input: apps/web/app/(main)/admin/projects/page.tsx fc1cea7c35070ad15d0a2eb7cf894abff8f078b570be2eadfa174c3130bde6cf
// input: apps/web/app/(main)/admin/promotion-rule/page.tsx 2d53c6f363605858955e60447aae86603aa60b8481ce16522f0ba3f82c7f3bd1
// input: apps/web/app/(main)/admin/providers-health/page.tsx 3b95e6109f2065651684c744f96f4011fa1adb760ed5ca8dbbbdc5316065030f
// input: apps/web/app/(main)/admin/realname-audit/page.tsx f99ba27274775129e5dda8c0cc1c60774c41dd3e716f27b712d393785c5347d2
// input: apps/web/app/(main)/admin/recommendation-config/page.tsx 9d95671d972c3398c61f84c41e74a32ddcba7d5e26071a752488f8b485479534
// input: apps/web/app/(main)/admin/redis-monitor/page.tsx 5efb026586ae3e445ad5faaefff8e8f22475f9bc7273a3473222aaf31de99a1c
// input: apps/web/app/(main)/admin/refund/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/admin/refund/page.tsx 5354bd330a9d2e4aed74b987fda52a4c42800739871fe8ac74bddcda4ba8507a
// input: apps/web/app/(main)/admin/relay-param-ops/page.tsx ea5d50a5f17c33b3767f77ad81a297178083aa363120b8b8800bbbb24eab0947
// input: apps/web/app/(main)/admin/relay/account-pool/page.tsx e0b212be3aa22d00af77fa22106b0c8e47e34498236d7a4c466e75bc44a29693
// input: apps/web/app/(main)/admin/relay/account-proxy/page.tsx b2c990e60630134dd7466e3dba261a2480142cb1c6dd72879c5b83e43b5d1e0e
// input: apps/web/app/(main)/admin/relay/alert-rules/page.tsx fedc05b330b5a0f92bb81fccd737c8532e80cd23c9cb7ef72eee20a8e3312040
// input: apps/web/app/(main)/admin/relay/capacity/page.tsx 48763f3c6314af0bdc7e7c0343790a7f303ae7454f64ccc9708c17fba4de2e14
// input: apps/web/app/(main)/admin/relay/channels/page.tsx 20fb63eded036a46db22717fd0eeaa79b0f904a16af53a968cbecf8fa914cc6f
// input: apps/web/app/(main)/admin/relay/data-management/page.tsx cdf06bd253df536c0898d124f5a145e46795dc3c9c5a70eebddb7477c46e8614
// input: apps/web/app/(main)/admin/relay/discovery/page.tsx 8211c26023764bacb819b87f7a6fd4549569ed78d62de0b0b05448c6119553ce
// input: apps/web/app/(main)/admin/relay/enterprise/page.tsx 735e27f81b2bc80056bf8eca0fc5c33a9f98ac76f85d840a6a3cab02665eb09d
// input: apps/web/app/(main)/admin/relay/error-rules/page.tsx 567257efce45d8cfb6ecb6c6971bb1e9b43f97bf313254cdbab33ebf1f951342
// input: apps/web/app/(main)/admin/relay/insights/page.tsx 1ff97d29ac4d9803fe4bbee0d3ae29e573c6b1f712c2d2d77caf06cb36484eca
// input: apps/web/app/(main)/admin/relay/key-pool/page.tsx 004384b1fc7a011ad69b63742278391cc20f1cd1a08c07c2a5f39588a1ad87ce
// input: apps/web/app/(main)/admin/relay/key-scheduling/page.tsx 1a798fa9d6202053e12804847f3d14bba52dba0254019bc12718dcf350801860
// input: apps/web/app/(main)/admin/relay/logs/page.tsx bf7ecee5ab55048e5106a6482a98b2b1fa29ee237f6733d59f491fa61d039146
// input: apps/web/app/(main)/admin/relay/models/page.tsx ff2bcc42f4ec0b965560bbdef4662d695b2b354b850a7174b61ee7f5bcae8615
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
// input: apps/web/app/(main)/admin/search-hot-words/page.tsx 7fa858e45ef6052910df88924b4b2aa5b96e289ead2b812578edf9cc6de760a8
// input: apps/web/app/(main)/admin/security/anomalies/page.tsx 913873a0017170acf81b75366e6617cb4ee74ae4029b281bd1a7cd59bfb860e7
// input: apps/web/app/(main)/admin/security/ip-reputation/page.tsx 54cc085bf5f6aa2278058e7bfca3ca60f7543cda537d9eb628b7f85a53443d61
// input: apps/web/app/(main)/admin/security/threat-dashboard/page.tsx de510b4fff4a2621ac9ee53aafd66dd7d74f6d1d807e4aba43714b59230820e5
// input: apps/web/app/(main)/admin/sensitive-word/page.tsx 224651bae88c2d92042cbaf2c09f0a7428e796072b2f60f875fa709445705237
// input: apps/web/app/(main)/admin/sensitive-words/page.tsx 0f13f58853a12388cd1966603eacbfa101c9a490df1a358f5549d77dfceab811
// input: apps/web/app/(main)/admin/shop/funds/page.tsx 16e6066e61c9fb6482fb853ef75ce8d26a9c4b23bb37c571df834fc634c26372
// input: apps/web/app/(main)/admin/shop/payments/page.tsx b1bc9ab5531a789325a5014aa89ff2766ff9bf4f5eba558e78bf253ca9621e09
// input: apps/web/app/(main)/admin/shop/products/page.tsx ca7e2f546db8956243f57296378d8b6c7cb466266e6f076fad0066088ae54e97
// input: apps/web/app/(main)/admin/shop/withdrawals/page.tsx 0b45835201072d796d5b8cac52a54c3b16190de4101f0493f45090ee37772026
// input: apps/web/app/(main)/admin/signin-rule/page.tsx fcd2218c408001fc4717f50deab4313a8e4915ae1a8036d804d7da3f4b9c8925
// input: apps/web/app/(main)/admin/skill-batch/page.tsx 2f75906c0ec8e004fd1d1ef0f1d7fc13318e80e0605365f3a9e8f7e8d494b95d
// input: apps/web/app/(main)/admin/skill-categories/page.tsx 1d38feda1ed53edd28b29deed17baf994378c9a987228805b6bce86175336c98
// input: apps/web/app/(main)/admin/skill-stats/page.tsx 991e25cff285e901c0c8bbabb82af26832e6570b578daf67686f407f320d8c51
// input: apps/web/app/(main)/admin/skill-versions/page.tsx 2f508287b80cc679d5b7287b5f734724f51c677398981bd2efc36486f6738ace
// input: apps/web/app/(main)/admin/skills/page.tsx ec133e44c28944baa809162c2c651d88b608a99ea26ae0c2e43e64775b718323
// input: apps/web/app/(main)/admin/sms-receive/page.tsx 020cf25e55d18243b9ba5837068fbad09438f383f6d31e23a350014cec707bbe
// input: apps/web/app/(main)/admin/sms/operations/page.tsx b8f3a6d37aca3a061361b806eaf5f80b7e29dff3157d283663f726a79356ca8a
// input: apps/web/app/(main)/admin/sms/page.tsx 6df4260e6e5e9dc4b44ba8b4c4cd6e656a4491e6a7dade583ad26c9b480d48bc
// input: apps/web/app/(main)/admin/statistics/page.tsx 4dce3da16b8dfe4fa96cf2086195ac30eb1588c04e30a2ecf44d9224336182e5
// input: apps/web/app/(main)/admin/system/login-logs/page.tsx a142c03cc5f3ab5389ca9e4a1515d54a464c128a162bfc6987111b1db74edfc8
// input: apps/web/app/(main)/admin/system/monitor/page.tsx 2349e2ee1fa68c68be01d8dc2fb369460f959d700010601e9f5afa8059235319
// input: apps/web/app/(main)/admin/system/operation-logs/page.tsx 8614dc2156cb0b693095d4b48e17cdd4338d59ca37e86838833e8038d39e403b
// input: apps/web/app/(main)/admin/system/tasks/log/page.tsx e4dfae3c6eb435edd7e2a9ef64947eb21ee82e2e86d26ad1b09465a99171b589
// input: apps/web/app/(main)/admin/system/tasks/page.tsx 3f23a25d5e4f6a11be1fa534703b780acb4a3b81ec794cdfbc3786f51e07cfeb
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
// input: apps/web/app/(main)/admin/topup-config/page.tsx f3acf85aa417b712920d6034134cc8a201ef9c838bb9461cd50f88f6efa9d052
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
// input: apps/web/app/(main)/admin/visit-tracking/page.tsx 5cdebb8e5e3276de7c4e0c141d56185bdd13d4ce58e1e751f929a052b8a40265
// input: apps/web/app/(main)/admin/visit-trend/page.tsx e5eacabe4b563e19f4518e4b50293c10b6827e1ebfa88cf76a8436a7100bbbf2
// input: apps/web/app/(main)/admin/wallet/page.tsx deaef6ae0728c51f4f40ed331a2c425bde1ea2bd7c7874b49955d8d7646f896a
// input: apps/web/app/(main)/admin/withdrawal/page.tsx 019f493a36aa6e19502efcdf1a5e7d232db61fe9512af8777a96fb6f4f9e5536
// input: apps/web/app/(main)/admin/workflows/page.tsx 7477e1e3bf6181cbae375a0c88ea56bdfcaceba18145113499697a8b047bf6be
// input: apps/web/app/(main)/admin/zhs-activity/page.tsx 9b6ecdef68ed3fa071c6b7e2f4d049d11bc31dd4976637fe68cbcea74d6721ae
// input: apps/web/app/(main)/admin/zhs-agent/page.tsx e91c1c3e20cc0b6073d3a33ee789ee297ba7548094b8f74cf07b4e086b447d77
// input: apps/web/app/(main)/admin/zhs-user/page.tsx aa46e86bf903890a2686538c5a0b7ad1b5cdc722bf25c9c4eeb6123fca644223
// input: apps/web/app/(main)/agent-canvas/page.tsx 1b33f7ec304881b404c28d68d8c69b41e41d60d3866828ff2c9c2fbe7decb232
// input: apps/web/app/(main)/agent-kanban/page.tsx 407708aa64c2e3312a29b075597f5186a32517d3c250659b2a5c20e08839af12
// input: apps/web/app/(main)/agent-plan/page.tsx b9bfb43736fa7955ec0aef8ff68c5bf1122fd3eedbe520f3e5adac1361974473
// input: apps/web/app/(main)/agent-plan/progress/page.tsx 2b207a3b9d225102d04dbf3a44bc236fa938346068cd3d9c4a00315764b1ec0a
// input: apps/web/app/(main)/agent-runtime/page.tsx e3c11f471373c4122a254ec7f7b598b79d45d501ee522cb2955814e0ed8a2708
// input: apps/web/app/(main)/agent-step-recorder/page.tsx 98cd749050fc99a2ed07e2e0e9a73cbfc22994ad60da2fe1887c5fbab5cf1864
// input: apps/web/app/(main)/agent-teams/page.tsx 5d1ee067d4bf99fe3dc9271977cf285ec655e4b152a85d108e6efcc35898c9a9
// input: apps/web/app/(main)/agent-timeline/page.tsx c176b9da05b78d179a83e405b4af3db95258d7623cebed517070149cf20bfdbe
// input: apps/web/app/(main)/agent-workbench/page.tsx 0266bee677a42234d42b728ba375d1ad20d964983c82a615c66fea7d5a636949
// input: apps/web/app/(main)/agents/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/agents/categories/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/agents/categories/page.tsx 6288b83b1015470d8bdfd2e00a1bd938e10a1f2688a7306bf8f9ee4c87020567
// input: apps/web/app/(main)/agents/create/page.tsx 3eaa7a71ba1f4bb7b38f28bc0489112ac17c46d08a9e13fc30e10f65adc8f7f2
// input: apps/web/app/(main)/agents/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/agents/featured/page.tsx c05a7989b36a5979799aa7d6d906a028de4225eb27d452749fdea9afe064d702
// input: apps/web/app/(main)/agents/my/page.tsx c242e10be586c8c3c8a0c95aea3badecd87fb348065663e730a68495c14ecc98
// input: apps/web/app/(main)/agents/page.tsx 71db76f2fd7ae1d5c358cf3173ed1e935bc114b29e500a3212422f7c7290e9bb
// input: apps/web/app/(main)/agents/stats/page.tsx 2be7e0863b31dbe5a1d15c9186f8fdb3c0ed6e08545e6967eaa9b8bdc35ca40b
// input: apps/web/app/(main)/agreement/[type]/page.tsx 2fdfa2b9b1de35ab72faab4733c4743b37f0845e976b32661cfc06d5e85159db
// input: apps/web/app/(main)/agreement/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/ai-career/page.tsx 8101c415cdae8b0f949f1b40b4cc816b1ccf93735f95a697cc944e84565b797f
// input: apps/web/app/(main)/ai-generation/page.tsx a910eeb39c53b9c6c3280ba8cda7662d1d9814e8b7541e57754142faa28a2dbd
// input: apps/web/app/(main)/ai-generation/video-tasks/page.tsx d7e7e599be959478c5cd397e5c0f67aeb2498848a4ab5bd59c8a23a747f6a9b4
// input: apps/web/app/(main)/ai-news/page.tsx c9d13918b45feff87376005332735215d78d980e7a9da40d1690efcfbffe9ec7
// input: apps/web/app/(main)/ai-skills/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/ai-skills/page.tsx 84e608aed20bceae83d3bd6e3a54da8967657bff065bf6a4091fe87692ec8e7b
// input: apps/web/app/(main)/ai-world/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/ai-world/create/page.tsx 50e791dd84614899d09a015d91b37a23402155885cf25238830ba615c7ae854f
// input: apps/web/app/(main)/ai-world/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/ai-world/favorites/page.tsx b8d0d540321896c6423fba14265eb00649500aa0b583e0cf3558198398e1ff49
// input: apps/web/app/(main)/ai-world/history/page.tsx 865e2baad1fc1cc7e333c2b131d8862494b7e199b33e318fcb1a42bdba14725a
// input: apps/web/app/(main)/ai-world/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/ai-world/share/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/announcements/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/announcements/page.tsx db78fc0e76f00465fa9d4cdf1a084ce9e88341a7c9c646793babdddc59363eb2
// input: apps/web/app/(main)/api-test/page.tsx b64ed204d8f253096c7e46c53d6038002335d015534577e7a1bc3bd930308a2b
// input: apps/web/app/(main)/app-permissions/page.tsx 010b9540d3cc52c563bf607ff4083169f752816124e6e6cfbaa7988f91808420
// input: apps/web/app/(main)/article/page.tsx 3be8cc21f72dd604fb3eb6600b920077394f24997281f4444f6ea429ac8dd74d
// input: apps/web/app/(main)/articles/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/articles/edit/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/articles/hot/page.tsx 320050e5793a12a9a8bfd9f63c14c6845e760afee9428b6f848c042aac1e6185
// input: apps/web/app/(main)/articles/page.tsx 52d3c0a836d8d55f4d8b477063d55401313cb0179528af9e69ec973da97b3d4b
// input: apps/web/app/(main)/artifacts/page.tsx 893da27d71ad48fa5989c9221647abf04d605ab3584b1c20c15fbbe7c49b1ccc
// input: apps/web/app/(main)/ask/page.tsx 78a7b752303eaca2fbdc8d28229eb7f3def29c9cf10b8c15119d06d5d05301d2
// input: apps/web/app/(main)/asks/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/asks/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/asks/edit/page.tsx dde4fcddcddee62cc561858d31984347322f7f636a2092c1afabd9b545d5e22c
// input: apps/web/app/(main)/asks/page.tsx 1c9d4df95e8354dcdf2f044b7affadeb88f2e50f921659683becb115f155cee1
// input: apps/web/app/(main)/automations/page.tsx 579d2e1d0248c88a39c7c170a5e7738828a4a0abd7882a524405801f27f65f46
// input: apps/web/app/(main)/available-channels/page.tsx d0f2f3006c18ddbf8bf97b97786b224e4c3135e7f33d9642a33df88d92c92eae
// input: apps/web/app/(main)/bi-dashboard/page.tsx ba36d5d9f9d0a5c5080b17ba059882f3b3e5126da3c665022606c331e00efde1
// input: apps/web/app/(main)/blog/[slug]/page.tsx b698057b460a3f264054824e2a58c523caf7ba840073351296b66bbbf0bee21a
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
// input: apps/web/app/(main)/certificate/verify/page.tsx 726394fead6d996f29e51da3d2f887ba92a4e8cc1830e3d9bc1a6985a005ad5a
// input: apps/web/app/(main)/channel-status/page.tsx cd96a600eeba925827c9f73793fb4458e3585216ee01365efaf23e47378b5319
// input: apps/web/app/(main)/chat/favorites/page.tsx 0abc78ad901d884d13db4677ae68f0fc9a378daf45aaeba24e076eded10084e7
// input: apps/web/app/(main)/chat/history/page.tsx 526d0a7a3635b5e46e80b9593d6f92580906d64177a987a7bf77f65081d6cfe0
// input: apps/web/app/(main)/chat/page.tsx 1ab20ab06a1d9d14453d3834e942258d7a1d14ec8a09c3563bf645b25d379d62
// input: apps/web/app/(main)/chat/settings/page.tsx abb886fd65be9622f07112095f4c22055d5f6bd642f6c6286af722ef7886c9d2
// input: apps/web/app/(main)/chat/share/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/chat/templates/page.tsx b22721ff90f032f5d67a6220eba3b04cb89bbc298c5085b4ab3315043d2b40b9
// input: apps/web/app/(main)/chat/workbench/page.tsx 806a03649e52ae6b4b4d8487136387510df62de97b00fb6501add78d189d4c7f
// input: apps/web/app/(main)/checkin/page.tsx f6b494eee0d24b5b71ff2e5a17215f8d7adde2909a44f6f73ebfd3aedff52c42
// input: apps/web/app/(main)/circles/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/circles/page.tsx 5dc5b147cc4e060a352c51f9480deb7b0063dfeae971c07933cd0a4fbbfd9cdd
// input: apps/web/app/(main)/circles/post/page.tsx 0edf499258e2bd30be4d431381a8e8853196ccb9aea3b69fc14d5c41b20d7680
// input: apps/web/app/(main)/cloud-agent/page.tsx d0fdf66eab368c19e4158b4427237157f60017c0e067d49447ddda6b398b49ae
// input: apps/web/app/(main)/cloud-run/page.tsx 33ecf8d6d2bf8844eb45d5d7257fd2b6bbdc0c891acc33382a8bbf94ffbaa13c
// input: apps/web/app/(main)/comments/page.tsx 5ce339f4885a779bbf4dc12138881c8316bb1ee14c14aa256278ec2a29d7e806
// input: apps/web/app/(main)/commission/plan/page.tsx 864ee4da4e8ade35e8787c611562bc8b5fcd7af78fbbf07ba08c8add3c0a3a3c
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
// input: apps/web/app/(main)/compare/page.tsx 5ca15a46da9b40dd459dac5a7e6718ee3ee88cfc2b5a8c07177b713c8c308b9d
// input: apps/web/app/(main)/computer-use/page.tsx 620b263cdeb1b5cf2da2486fcaa7e31d6e39609db614a26ef963d1ceb0b01839
// input: apps/web/app/(main)/connectors/page.tsx efe0c3dfc82f0add7377bd131e6fd6497ec9868e79b7366b241042d79c9994f0
// input: apps/web/app/(main)/contact/page.tsx d0cb65c2c24df77cddd00f8e82bd9d5bf8ac39850a4fa0423c645a111f91ac7f
// input: apps/web/app/(main)/context-compaction/page.tsx 71c0c574c0b38d2b9e98b5b8d810636a2d9cdf90858ca2b281bd043cb6360c71
// input: apps/web/app/(main)/context/compression/page.tsx ee8741912a7056b6de719c34f572c76e78c0b2a5efe03926b22d6173d316d679
// input: apps/web/app/(main)/context/mentions/page.tsx 0b12293321bcee4648ee88287486494310e987ed38ff4910e7e5c8ebde9789c5
// input: apps/web/app/(main)/context/page.tsx 0473c645dc5669d1641c158d84383c59212737edff01b991f2462694df5a130b
// input: apps/web/app/(main)/context/visualization/page.tsx 2721e2971dc78612ebe8752f1541334d04e06bbeea3176493c7319c9b8bcf552
// input: apps/web/app/(main)/cost-dashboard/page.tsx b1eefba458c3badc887f02ed355fcbe69a2f26a48bc29c2224fa038a45419be0
// input: apps/web/app/(main)/dashboard/page.tsx 811f42bce3ee198be01608c2232625759b6f1e8cb4f858cc2bd8de5c2dda9022
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
// input: apps/web/app/(main)/distribution/token/page.tsx 009cca72b3c185d184e685f59939992a36672cf004f2180bf0818d985c213d87
// input: apps/web/app/(main)/distribution/withdraw/page.tsx 7f9111c7dd56e3e536f08da514f6303ce8ba8569b89376a288347aa4881fbec9
// input: apps/web/app/(main)/distribution/withdraw/records/page.tsx 3266de32a62f6afbe02f1a952d63f3aee665756995beca9d484ed21d0d6732ec
// input: apps/web/app/(main)/docs/[slug]/page.tsx d9e39fe33ef0fb967b1a6d248330be44f86ef1f4383ea8eeff3e6596d4f58284
// input: apps/web/app/(main)/docs/agent/page.tsx 761ea4b0970fd8af67b7d23919a5a02526b0c5c8567eb7c784896e3dae76d8ff
// input: apps/web/app/(main)/docs/api/page.tsx 11c310ecd7f8b90e17396f3d23c3204d715d3acf1249d8c2fbad32ba013672a2
// input: apps/web/app/(main)/docs/manual/account/page.tsx 54618a5604bac2556dee2b466be46cf1a97f8af93b130090a27b6da16b61e933
// input: apps/web/app/(main)/docs/manual/agent/page.tsx 723d901cec9ec6f9e336694198c36b58201fc112e02256b6aefc2dd84fdd1cd4
// input: apps/web/app/(main)/docs/manual/ai-chat/page.tsx 0c454bfe6d9c5cffe5dd2d703c395b63a51c7678a8f8a2bd2bc08222d38775a9
// input: apps/web/app/(main)/docs/manual/billing/page.tsx 1b78a0c59af3537575e6dedbbca8983b7ef312ef082972c0088a4b824e9222ba
// input: apps/web/app/(main)/docs/manual/faq/page.tsx 2eebbdd552ad5052c5d402143068041648af61bf40cf8b2f6a61aeed96c89249
// input: apps/web/app/(main)/docs/manual/getting-started/page.tsx a59f3986da9535a34c116aa3bab6cd349bd887a233e213b8ae42153f54ef4240
// input: apps/web/app/(main)/docs/manual/knowledge-base/page.tsx 857eb889340d36cd2fc18dbd895f10581a08c00994da676d75226de2108029c7
// input: apps/web/app/(main)/docs/manual/page.tsx d6e9ccd6beff010611e7368175110ee0a8d85dbd18752e23ecf687d43d699d5d
// input: apps/web/app/(main)/docs/mcp/page.tsx c750c33e0783e4185873a09115fca8eab0d619fbcda5dfbe47560e4f86623516
// input: apps/web/app/(main)/docs/models/page.tsx 565eabc8e55f0f413130cf0a11ebd637b1a1dc6b96448271388c30b6be0c1b72
// input: apps/web/app/(main)/docs/page.tsx be75c7ffff1a07565919edb5b8eec54a057d6a851a0e76d4cc4e355ab4805394
// input: apps/web/app/(main)/docs/quickstart/page.tsx 6cf2bf373205673e3238223ad94c3b8fa94e7acd23be4eb4a413fc491ba00d79
// input: apps/web/app/(main)/docs/rag/page.tsx 7822397a828e2acd8251c38d6cd6297b238d590991204059d01a4c44a0b812c3
// input: apps/web/app/(main)/docs/self-host/page.tsx 46184d1f8ad42a70265b94708cf3c705ce039468f6a9b43ab8d37511d2fa33a3
// input: apps/web/app/(main)/docs/team/page.tsx 95ce7534182184f524cd2d75a19ccde7bb83fdf2d98978764e893cfeafca5765
// input: apps/web/app/(main)/docs/workflow/page.tsx 265c4a0e409b780cabd0125b04c316ba3790fc03d9b1ac3a9819c9a856320c60
// input: apps/web/app/(main)/domains/ai/page.tsx 1a06ad7c1c2aa734cc2adf9cbe2196dcf8e52e766328ce76b55c53892e4c2cd8
// input: apps/web/app/(main)/domains/content/page.tsx 5f2aadcd2744e25d3e55f3329446167280360de8d78bf2a8d48c36f2bb426e7c
// input: apps/web/app/(main)/domains/edu/page.tsx 610d37bec54c738e573d24150b1a36c173a9344cb559da2ed18aeb7386026fd2
// input: apps/web/app/(main)/domains/personal/page.tsx 329a5d2bbc5fa9b6ec73b84cb77f6c673bf0e5273e92264fbb2c8c4a1a0988fb
// input: apps/web/app/(main)/domains/trade/page.tsx 81b8bcc37d1565a1ffdbbb0abbcf9f8eb077f08bdc9b8d8b789fb789c2368949
// input: apps/web/app/(main)/download/[platform]/page.tsx d3bbb195572d6316c2547bd8fda8e9107c05cc60a2a2925e9b02002c7c29ee85
// input: apps/web/app/(main)/download/page.tsx 59bc8557ed62a53fa3608ec75132263f58a438dd8c09e066e49f8a07bb726c04
// input: apps/web/app/(main)/drama/page.tsx d58458eee29202858ad423b2a3302e0a4e9171ace1039df55cd32abfb5be3b5e
// input: apps/web/app/(main)/earnings/page.tsx afc5f32edc78ecaad674bc498944baa5c7b3961b51d5da9f2d4edf6e504ab948
// input: apps/web/app/(main)/ecosystem/connectors/[key]/page.tsx 8393c69c5ff681ca5d2aa9dd26f6c2474d62f0e1af2f9eba3c138003af32eb69
// input: apps/web/app/(main)/ecosystem/expert-packs/[slug]/page.tsx 098fab45a09bd2cf6ceecccf47cef0ed94dff9daa2efc87dc98ee3ec6ba51d7d
// input: apps/web/app/(main)/ecosystem/expert-packs/page.tsx b3874012bca5399c92bc75fb664ca004babb2448ab83f7853548e1aede67dec7
// input: apps/web/app/(main)/ecosystem/page.tsx f0dbfb332b9a6d22dde55a80d763e3aacf88436996ad4b44a76eadab0e95ea88
// input: apps/web/app/(main)/edu-ai/aigc-tools/page.tsx 5bd64c26440bea49c7ec6763b0510dce8c3349f1e4350ab90498f6d372d4df20
// input: apps/web/app/(main)/edu-ai/certification/page.tsx d4fe95080c44d40043f302f057a8d0b8d2218c7b2a0ac79bd3760970cb66ac60
// input: apps/web/app/(main)/edu-ai/courses/page.tsx 876a87f3064e9e7054b5b736a40a92f4241a1e5a64e844c79ae429436108fe40
// input: apps/web/app/(main)/edu-ai/map/page.tsx 08ee5b3ad18e1a9bf628bf8482bc395b7f105a9e9e8896ed6b071af16ebfe83e
// input: apps/web/app/(main)/edu-ai/marking/page.tsx b799d22dcb5fb7d640d573ad5159757ab9105907c81581732c388256daaac69c
// input: apps/web/app/(main)/edu-ai/outbound/page.tsx d6926fb727208d88b5b53970cf310897650e548759ce69a679a6f05a3a11478c
// input: apps/web/app/(main)/edu-ai/page.tsx b9b0cda9b604916f23f82f1b13c0f5e8d93ba97624e5b111f7b0cf524aa47a2f
// input: apps/web/app/(main)/edu-ai/policy/page.tsx 6aa326a1d92577260d55cc53d022d17cb962d42655c0d16f8357d4670b95db41
// input: apps/web/app/(main)/edu-ai/tbox/page.tsx 8d39a2ab460c8f918cf500220ae49a47f0ba3bed3bc928a6a60df9a79612a35e
// input: apps/web/app/(main)/edu-ai/video-compose/page.tsx 411d7554d019c3de2c9597ae6c616ace3b16d700089437f1722ce6702579c11d
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
// input: apps/web/app/(main)/edu/edu-management/enrollment/page.tsx 1b6b313d6d21e44702feae1220dac72e39d51c24b2b15d769fa6e3e8877625fb
// input: apps/web/app/(main)/edu/edu-management/finance/page.tsx 86f482ba4ee20f15b8ca07b1e3d55e4012eb2465f62fe1f1d708d32d17399f84
// input: apps/web/app/(main)/edu/edu-management/grades/page.tsx 995cbff800387b67319592f4b6ef107859ff49a08f1e944bf8092c45c8d557c7
// input: apps/web/app/(main)/edu/edu-management/grades/trend/[studentId]/page.tsx bc6a04718ae14638d59ed11026b720cb0706d9b6b1009a08362b9486c21ff94a
// input: apps/web/app/(main)/edu/edu-management/homework/page.tsx 8a544efa39c6f7c569f8ebba0a92c54a670ad7c29bb295ef6c88698a9a29dfba
// input: apps/web/app/(main)/edu/edu-management/meal/page.tsx 98533e9d26ebf80bb2333c7383f74e9ddfb08482448c7a6cfc1e49ce621e0403
// input: apps/web/app/(main)/edu/edu-management/procurement/page.tsx 36cabf775b6c1ba1df970571a577251869c477b3b9838701de2b7ffda3d6e058
// input: apps/web/app/(main)/edu/edu-management/schedule/page.tsx 7b9ca2cdb8c5e2acb3f76e8eeec24b98961fa46f70d19c84a147ae32f0e1140c
// input: apps/web/app/(main)/edu/edu-management/scheduling/page.tsx 5ee1d0f6e76fb0e6bd806814d02a02d914c30a18f754e2def172d3c39a856864
// input: apps/web/app/(main)/edu/edu-management/study-plan/page.tsx a694a3bcf917afe21dab9bf015fcc45374464695a31d9812080d144a00503899
// input: apps/web/app/(main)/edu/exam/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/edu/exam/[id]/result/page.tsx fd23d193dee43ff51841125e799a6c64265e22b0499200947c6404d12b2e2954
// input: apps/web/app/(main)/edu/exam/page.tsx 3ff633a99bc64eeb5013570b024c2fb55b7252c64209ff8959e23d67ef2180da
// input: apps/web/app/(main)/edu/notes/page.tsx bf1bc737bc956c52dabb000dba96c98c891ab777ac8c27551c7eb74b62816373
// input: apps/web/app/(main)/edu/page.tsx 5676e95679d2502f6cd77fd60b3b482af8b4cd19de696436b62fb18f3c71c222
// input: apps/web/app/(main)/edu/parent/bind/page.tsx c0269dbb2af60f155f021d3d4b436414eee33eaa6d873ed9c7917220ebc00214
// input: apps/web/app/(main)/edu/parent/children/[childId]/attendance/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/courses/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/grades/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/meals/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/study-plans/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/page.tsx 4476e1a203b6f207cffb8b1918ab8808496820fa628b828d9dd1eb269840bd7d
// input: apps/web/app/(main)/edu/progress/page.tsx 0841f7a55d2525edc145012e449f8116b8dba58079f9187c6056d62449071c61
// input: apps/web/app/(main)/edu/qa/page.tsx f31adeeddecf8d7617d61f2c04e7ed3caab9c9856de97d0679a5da617ebb2dbb
// input: apps/web/app/(main)/edu/schedule/page.tsx e9e437e30879b9b76ba946e4cfe775e69b8219794f022b5561b84e372b0aa1f6
// input: apps/web/app/(main)/edu/shop/page.tsx 1ddf710d7e838de64a12a61909cb6db037ede39730ea8a3fa8a722cd9d2664b1
// input: apps/web/app/(main)/en/use-cases/ai-design/page.tsx 48d354182224e70cff0d60aaac1096c5b6692d34b327a0b4426f05ae1622dd1f
// input: apps/web/app/(main)/en/use-cases/ai-edu/page.tsx 40369fcfc032dce2b63de97055cd057547ad116ae3f04c21d6b424742a67e90f
// input: apps/web/app/(main)/en/use-cases/ai-marketing/page.tsx badd59700e95e8bafc9463ffb8e035543f93cb6f5d547efbbfa38146ca9a6b99
// input: apps/web/app/(main)/en/use-cases/ai-research/page.tsx e055d8f8959520d495839b3ed2ba48cbb2f54d6ffcd6a59ac406ce085b671ec0
// input: apps/web/app/(main)/en/use-cases/ai-translation/page.tsx 832bbd4c0da975196856be22796f6b4f4466ac1b9ce21ae168f5da7c80f4c345
// input: apps/web/app/(main)/enterprise/inquiry/page.tsx aa20b6854cdfc1f1f0f2614c4b5e3e21eaba22a79345ba034c58b3f110901353
// input: apps/web/app/(main)/enterprise/page.tsx e92a22969539402162bd1794714526c8d2c5e84cad577a2d26bc1ab7a35a86f9
// input: apps/web/app/(main)/exam/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/exam/[id]/result/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/exam/page.tsx 73bbcdabef6e7929d6afa047044991155ca7e8205dce49cd958cd6fc0ea63816
// input: apps/web/app/(main)/exam/wrong-questions/page.tsx a0db631f41096fd55a3da281a2085f3c3fa31aae5047fecc8ed2393fc71504e0
// input: apps/web/app/(main)/faq/page.tsx 340204418a12d33f01f6b30c7e8f7eb3ee65729d4a4484c5dc083a92a8e7e29d
// input: apps/web/app/(main)/favorites/page.tsx b90632d04032514bac52a414a04088e9eb09a877661587ce2a2d1355c3ff4750
// input: apps/web/app/(main)/feature-center/agents/page.tsx 433444fa348c25f0add761c5282ceeadff0539f4898be9efeef7816d8d60caca
// input: apps/web/app/(main)/feature-center/apis/page.tsx 23b20f154ed76a89bb411eb47ed297fc5b6dde0ab1e284b7dd57e251b82defa6
// input: apps/web/app/(main)/feature-center/documents/page.tsx b5eb2c0b222808c0bbcedea46c251dcd008d50bebd12ea23647226ee9d3a97a5
// input: apps/web/app/(main)/feature-center/models/page.tsx c3a31d9294c7b032abdf2bbd36d2edbab15eb06d8acf8dbad883c317119837c6
// input: apps/web/app/(main)/feature-center/page.tsx 824e9140d9b9a05c71bef2c4834d7171e8658b434a258475a5db70adf5065e97
// input: apps/web/app/(main)/feature-center/sdks/page.tsx 293c189449b762b76579e96699f8c3df9e8a9fce5373d764bead611b407fd38a
// input: apps/web/app/(main)/feedback/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/feedback/page.tsx 1cf98e5100a5ca708e220f1e02a7f2913ef830218ccbf161e22e487b04846cc4
// input: apps/web/app/(main)/figma-import/page.tsx d646438f571ef064cfc9308916bb18de94e24fb41b522d1048c7494d97994d5b
// input: apps/web/app/(main)/following/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/free-ai/page.tsx 14251afe2b1cbca09b1bd672b0d3d4283992db241dbd30d8075e0418c6bc0edd
// input: apps/web/app/(main)/fund-data/page.tsx 0df023488c947c49f8bbd0b540c959848e397aef1e50a41ddad1585d9f8548b1
// input: apps/web/app/(main)/groups/page.tsx f4ff97c2afc04098f9abade4781d565f39b500f76e3442f2f78624a6e62830d6
// input: apps/web/app/(main)/help/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/help/page.tsx d1644c08611015d3db00edfb7b9101eeb8ee97e9b4e0dde52bff308ded930383
// input: apps/web/app/(main)/home/page.tsx c363a3b298783696813c1ff6c01ea43d10ac6a57a18ffeb7a2aabf1356e1c93a
// input: apps/web/app/(main)/hooks/page.tsx c7aed66054b4f50815c7b49434e711bb1b5049c02878b5f1521d6499f663936e
// input: apps/web/app/(main)/image-gen/favorites/page.tsx e936e7c2f7f59b7f467e61be0a237f3717c9a8f6853ea0da306e98733f85c21a
// input: apps/web/app/(main)/image-gen/gallery/page.tsx 9128bfd6904129c9927ce55dfa332bbde22346f4fd34406ab0e932bd340d92a5
// input: apps/web/app/(main)/image-gen/history/page.tsx 3908e9c9f4cb1fbe50b88f55d497cf12e41e0bf4615f4e1052e217395feb66ab
// input: apps/web/app/(main)/image-gen/page.tsx d9b2bce51bdee11c132733696856243b0bc2d35367e743cad5c3819819a14804
// input: apps/web/app/(main)/image-gen/templates/page.tsx 187a4b877d15dabbbd4fee642e81bdac30668eb46ee7445579087345206e1f0c
// input: apps/web/app/(main)/invitations/page.tsx e37d0a9d9191042a16ce4f03abe48077cc04a4cb96e6543554d347cd44d5c3d8
// input: apps/web/app/(main)/invoices/page.tsx 308d4d880f67fd68329aacc33fdfad1a34d6c37fc67b75b69dd9669ccf1a54be
// input: apps/web/app/(main)/ja/use-cases/ai-design/page.tsx 5299e2075b545ef0da482d44aca17c578bc8484cc665cdbc380c108c3c19c165
// input: apps/web/app/(main)/ja/use-cases/ai-edu/page.tsx 996c359eae80691140a0a37b877d27003ab80d9cf8a2b51415a83c3b90045f30
// input: apps/web/app/(main)/ja/use-cases/ai-marketing/page.tsx b8604af60072843880be121b5b4d5ffc3177d2d0bd5128bd8a4d20b5efd3caa5
// input: apps/web/app/(main)/ja/use-cases/ai-research/page.tsx b35804347340550fceb61896a7917ef7773bb8bb0a68609e533d814ec38051d8
// input: apps/web/app/(main)/ja/use-cases/ai-translation/page.tsx 63c564de2abca3212448c1cd32576ebe305936736e651b64fa6a52a9e4ed60ca
// input: apps/web/app/(main)/knowledge-base/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-base/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-base/edit/page.tsx c6e65d154925400103999d8f876c185fe55261fbf723f41c8fd4430bc16e696a
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
// input: apps/web/app/(main)/ko/use-cases/ai-design/page.tsx f442211fb93885c8d105cf605b45cd472b8d9058ebe4515a2da1c3a1db26f16c
// input: apps/web/app/(main)/ko/use-cases/ai-edu/page.tsx 6408cc13b5fc0a70e4fcd30efc7d4c6bc55e459fabc9e3c7c5792632b07a0d77
// input: apps/web/app/(main)/ko/use-cases/ai-marketing/page.tsx 177ecd6941b97ee6efa4c7e35747127cca8c8abaaf4a1579bb0eb7ae9b31836a
// input: apps/web/app/(main)/ko/use-cases/ai-research/page.tsx 24cb2601e827aeffd2966bdd27f8c29ea9dead03323583642af68bfb42a9cf44
// input: apps/web/app/(main)/ko/use-cases/ai-translation/page.tsx 5e9deae8762937331bed7a1e4ebe55d839f28a20aedf0964505d67ec8f87a71f
// input: apps/web/app/(main)/learn/[id]/homework/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/[id]/rate/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/buyconfirm/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/learn/map/page.tsx 872e5e5414775527ff60bebf4c869e156bb72b345f93805a8400f8c67a0692b9
// input: apps/web/app/(main)/learn/page.tsx fc9fab38a6c51b65566960e7e4e491b0a4cf97ce8a3407db7916ff10c5f94d27
// input: apps/web/app/(main)/learn/payment/confirm/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/learn/review/page.tsx 4672e0db0a483e5a2a7bbb4c2f6dacfb41bafc8d64428b37fae53c4f5ee60fc2
// input: apps/web/app/(main)/learn/topic/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/topic/page.tsx 73f588334758554b4f3673ff4534b11bf8fd021cce400af3d390ca6adefafca2
// input: apps/web/app/(main)/lecturers/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/lecturers/page.tsx 556e2cb3c25c2c4a47ff43cd6b0c0e0f069b5f6458f3664fb7ebb708674738da
// input: apps/web/app/(main)/legal/service-specific-terms/page.tsx e8302bb6ad605c6f03d4cf974438e8d2b76a3f9f9f906ea76eae80d1647bd3c2
// input: apps/web/app/(main)/legal/supported-regions/page.tsx b41a39b4d7c831340b1db82b138e5f3d22c2112e9930a0802e02fb74e3a7dfe9
// input: apps/web/app/(main)/legal/terms/page.tsx 2b0d58df9fee1daef1f8420cd93933e938a156376cde7cd81b6ae79b0fdf56af
// input: apps/web/app/(main)/legal/usage-policy/page.tsx aadc5fcb9674399d1774a4f943de346b068c26a151243fc5eeb88a72baca4b85
// input: apps/web/app/(main)/letters/page.tsx e36021e7ee1add67ac7925b7abee87233f2d41c21ce5a24d99c24d642f7ead4a
// input: apps/web/app/(main)/live/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/live/[id]/play/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/live/host/page.tsx d7679bb9e235a047785b94a11392ba6678e171b7141a6c09f449b1348857d42d
// input: apps/web/app/(main)/live/page.tsx d6c83bfa37b1ff2f151bc75b0cf62a518d215ce8e778a91e5b3e1be37729e3f3
// input: apps/web/app/(main)/mcp-projects/page.tsx 8083d86a1ffdc43d0480d154482c92eeb73b0ea5ca834c4ff5d3811cc1194eca
// input: apps/web/app/(main)/mcp-store/page.tsx 3801930b21799b9b5fdfda53588178b765ed08d5dcf53aedd69fa6f0591fae38
// input: apps/web/app/(main)/media-tasks/page.tsx 0d25f6dd87d853c2ec502afbad5261286ff52f60b04c7e7a187c79a2adf7c8a1
// input: apps/web/app/(main)/member/addresses/page.tsx ecfb5face40e3934d44991392fc96a7ccc3eb6d9cfe4d0007ed730ee50a48d88
// input: apps/web/app/(main)/member/benefits/page.tsx 87b8b25432a2bc87fce3819f47105c8f1bee8571d23a3481178991d7cdc3fdeb
// input: apps/web/app/(main)/member/coupons/page.tsx 7402a3a0d4da0a88aa1adb823864fe5209327ea6a5d1934742b90c5e976109de
// input: apps/web/app/(main)/member/dashboard/page.tsx 90b75c8114b0b10fbcd7ca79dab933ce34fc9314b05349ea88248b5c5ded5cb6
// input: apps/web/app/(main)/member/exam/record/page.tsx a901960abc562b4fc0de2724b04f553b29105200c2ddae6d8d244a51f6b1296c
// input: apps/web/app/(main)/member/exam/sign-up/page.tsx ef36e6f0c3ad9864387aa359af530c94c0ca8490d11a7ccb87b29d0544b6d012
// input: apps/web/app/(main)/member/favorites/page.tsx 8aa0644759bd00d261fa7e8cfb32b11808b45fe69e9563909ffab5b03cca4a87
// input: apps/web/app/(main)/member/feedback/page.tsx 691b8abc393f7aad7588aac47a3e8b2452b49da93113b5d94536183a2a9abf86
// input: apps/web/app/(main)/member/help/page.tsx 97ef1fccd46eecea0a2d5b47016b4d14e54546a1dcb07f2c310cd563a81b3b7b
// input: apps/web/app/(main)/member/history/page.tsx c26cabdff4224fdedebba3fb6c5fdbafdebf4c938b37ae8e26c112edd1d1bbc7
// input: apps/web/app/(main)/member/page.tsx 2ec34f6d459cd8edd9922fe77f8e3564dc33c57e44abc0508bdc5a724afa498e
// input: apps/web/app/(main)/member/settings/page.tsx ee560e6d306ff80dae87fe465c5d4cb48f4c0d4ee8f8b0c7384f2580e7aab82b
// input: apps/web/app/(main)/member/subscription/page.tsx fa44f0d8e2b79d002210372a8c2fbdc1a174c3992951000b72ac92926e6858bc
// input: apps/web/app/(main)/members/page.tsx cf8b5291eb01c73def32e6cff0eea7a9e8579bc4582d1f04c671aab8f7db5329
// input: apps/web/app/(main)/memory-manager/page.tsx a2039c3793c1a9c1245a30e89240cafc932d1adacc6ed3d80c345c46d66ae92f
// input: apps/web/app/(main)/memory/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/memory/new/page.tsx 890f7e4951858962b7dc5a216d0f20d83a2ba1e887db6b4fd460675a40b02c77
// input: apps/web/app/(main)/memory/page.tsx c2dac71b900432ea56e2847c21dbe26ce2e0d7f2353a6800819ea37e2df567f1
// input: apps/web/app/(main)/memory/scope/[scope]/page.tsx d3cf5def475b03c0fd96f57fa00a6557e248e9439786c0875dad1c82b69d41fa
// input: apps/web/app/(main)/messages/[type]/page.tsx 2fdfa2b9b1de35ab72faab4733c4743b37f0845e976b32661cfc06d5e85159db
// input: apps/web/app/(main)/messages/page.tsx 99330cdb8f783573854dc167c8b6e8f9c2b730cebc14844b3c49e988f9998f1b
// input: apps/web/app/(main)/mobile-dashboard/page.tsx f842ccb24512e07fcec014c94c08af18d0eeb34b699579956b0202688479c55d
// input: apps/web/app/(main)/models-pricing/page.tsx d52e3cbdfd30d7d66fcdd54ea0e4b6a277874fff8c29467374fe50011468b3ea
// input: apps/web/app/(main)/models/api-docs/page.tsx a5cc8405dba768a5d5c4727296e6422a1b2b0f335ea3241ebf97af3089d00717
// input: apps/web/app/(main)/models/billing/page.tsx 8fe2fa25eeae1cdfb7cfb3702f128e15936e6682a119a9eedae4f1ec5b449ea7
// input: apps/web/app/(main)/models/channels/page.tsx 594ff458d743e9332b9b904df359a6edae2ca93c0b9b46f57432bc11d1e2272f
// input: apps/web/app/(main)/models/chats/page.tsx 7919b71c56db335b046ffc557f969f25752eb9f5b75e523328390866a3921de3
// input: apps/web/app/(main)/models/contact/page.tsx a2eb81be89b71c92673eab422d496691142cf9c96bc00d491b79fd3a237b78c9
// input: apps/web/app/(main)/models/eval/page.tsx 36162509a885e45b6053c752e6b8813020a4e04e6e81cae5a519d6312c36be3a
// input: apps/web/app/(main)/models/groups/page.tsx c8d0241b0cc4da20fef8ef24e167804bb3579145d0bcf0ed33d978d5c3fdfbe3
// input: apps/web/app/(main)/models/keys/page.tsx 3c3a0325df8ecc12cd9dfeafdbe1114e2699cabcb46fbee613b41128eea3dc0a
// input: apps/web/app/(main)/models/logs/page.tsx 25c20545805972a81246d5cfd70749749115715055e5c05082589383c9447fd4
// input: apps/web/app/(main)/models/openclaw/page.tsx 4f94e0876d499d18a401b04cec554b3b5f80a593e6641e3f689a1d5e0b4a54b5
// input: apps/web/app/(main)/models/overview/page.tsx efc6eb799926e8dae7c5aefa8ed795ae32647377390992db2e36b099bf4b1fd7
// input: apps/web/app/(main)/models/page.tsx 5a4e9722c8358f30a37324c373fadcdc5121019f3eca7f2aa587006928f3c1f6
// input: apps/web/app/(main)/models/prompts/page.tsx d79ad556b1bbb2621b5e898c766f64ed85cf55ccbc3468fd4e55615903f4fb9c
// input: apps/web/app/(main)/models/redeem/page.tsx 935d36a577b8e77cdb56de39c06c0fe24df2286f4329b5cb36bf8e180a289e5c
// input: apps/web/app/(main)/models/referral/page.tsx 3593c495ce0cc35e1c05b335fc8c3f03a088f28785c07ea69b0bcc844d5f1555
// input: apps/web/app/(main)/models/skills/page.tsx 842201f8eb699683b246873a47c025b9b2b4727e2068e6287dd1ecddc8fd382f
// input: apps/web/app/(main)/models/trajectory/page.tsx bae73d36caa41f8bb21dff1c70074a3a0d744d8f678a7216c66c9c78897e9947
// input: apps/web/app/(main)/models/usage/page.tsx 0790932c25642e2753c4697043e3f65c43f29a85171647b061f03e3e9dab1d5f
// input: apps/web/app/(main)/models/users/page.tsx 2c5714268b4b5a292d03fd083eaaa1a75065427b00de697178c5770e8a01cfc3
// input: apps/web/app/(main)/n8n-agents/page.tsx 7b97c1af57e81a44a56ecb211d8f8871dee02fa83c562954887193edbccdd4c0
// input: apps/web/app/(main)/news/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/news/category/[id]/page.tsx 9a4a74a52e0389d02f9c16d560907b2ba26abd2591906028fe504fbad9b58ccd
// input: apps/web/app/(main)/news/page.tsx 9dbb7eeb354b0b2c4224fd9e59ed3348b7e6e6a231a39cb278400fdaea3f2720
// input: apps/web/app/(main)/newsletter/page.tsx cdba2b84b0d8d5fb0819ab75d90ff7f6483e66c9e333899f77dea5a129224d67
// input: apps/web/app/(main)/notifications/page.tsx 2a3062ef800e744ca268fa660e68545b9345a85ed2066ed2f1bc1a44318a5816
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
// input: apps/web/app/(main)/payment/page.tsx db4b532aa185490bf29b42a41a59b7d927328abb654af5640c1da661df16c49b
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
// input: apps/web/app/(main)/points/page.tsx adf0fe74f48837ba3291f419840aaa6d75d91f31c6dc460f31b8fb641f047c21
// input: apps/web/app/(main)/points/sign-in/page.tsx 03e28ad52e905196c8fcb4957c4b9160fbe53f0c36dc945a3bdc52178624a226
// input: apps/web/app/(main)/points/tasks/page.tsx ee0c20de33c0f9125c2eacdf6564003c6206390449d0956c126146c4be1d6b9c
// input: apps/web/app/(main)/pricing/page.tsx 0a1c3717f2391db2cc15487136f202ec89b2a8366aceed099f40d0567d45f3d1
// input: apps/web/app/(main)/products/page.tsx bca2f8e745373d271291e554192cd1728570e61ba957c65a3ea48893a687b6e3
// input: apps/web/app/(main)/publish/accounts/page.tsx 30dd09eb771343cb66a2bb4fc7d873be11121543ef018b3f3030db1c516ff58b
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
// input: apps/web/app/(main)/resources/page.tsx ab362ceed9985b50ea8dfc71b7bf0a26e699522aa71f3b8be7c60030bc70f947
// input: apps/web/app/(main)/rules/page.tsx fded796d761de0925cc5ca6bc9fd7bf01bd616c0e497cd528e1aa5a532b69e68
// input: apps/web/app/(main)/schedule/page.tsx e21bf50c94b7d96e2acf1ee6d479043c02d2e5f0bb49d3f7c4d72d6272b318e9
// input: apps/web/app/(main)/search/history/page.tsx 1b1b3dbaf7c50e8b141f3cfef02d6e7af399cd94219c7bc6181ac6f06e649713
// input: apps/web/app/(main)/search/page.tsx 9e7de3a1fc1f2c59c7b05b9081944bd9a9a77554dfa96971cff5d08fe67a5ebe
// input: apps/web/app/(main)/security-audit/page.tsx c4c233157b74229b01583840865533b8a11e9f2d65fdce556d9bdd10e3567023
// input: apps/web/app/(main)/self-healing/page.tsx c04ec29796018c246ab0256185f5395bc653c17645ebae90292145e8b11772b8
// input: apps/web/app/(main)/self-media/automation/page.tsx d9a8599cd4e16eae479470b0cb6254c2c5c9c889dcda280647262a9b1be7ba8a
// input: apps/web/app/(main)/self-media/koubo/page.tsx ef36a73376d8ad4784db041acb58033fa4d2bb5712a679f8e41f25f5314176ff
// input: apps/web/app/(main)/self-media/wechat/page.tsx 26013635b79d6a515a8ebef8c5f396c3653440933a0007de863207fa62f4dfd3
// input: apps/web/app/(main)/services/page.tsx b54ca5c46d6700ea0fd78c5cac5efde5d04098a2be51feba7d745667d6dc7c8b
// input: apps/web/app/(main)/settings/account-deletion/page.tsx b59b4e906cfc507036cbe14f567bc8efd3ff51df4cb9f8e1a57bd320e6a27fc3
// input: apps/web/app/(main)/settings/activity/page.tsx e01b30e9f2d8be4089a668bc58f192390b9d9b1d8f145f7f48fe0f8904c32859
// input: apps/web/app/(main)/settings/agent-security/page.tsx 43c685aa16a4268f677b366eddd03370573e878a1c9d5b74faf161b7a2f6c620
// input: apps/web/app/(main)/settings/api-keys/page.tsx 64eb416eb0f634d712d8ae232d5b8c03fb584b07493ec184f93ed7efc412ebe4
// input: apps/web/app/(main)/settings/authorizations/page.tsx b7936264911cfd42d04115e66179e1eaef5e45d55ee18809fde6fdcb10722e34
// input: apps/web/app/(main)/settings/billing/page.tsx 59dd63ab12f4afd588c08fae35006bacc20cb0d65b495146006ec02ba1ccbcdb
// input: apps/web/app/(main)/settings/connected-accounts/page.tsx 9b44514461d055e191dbf96253267b25ccb27cacf5bcfeebeee73b3dc7d86f1b
// input: apps/web/app/(main)/settings/dashboard/page.tsx be0a8fd47191f47f85f5beb176646fe61384e7bb349fcb59295551371bc256a3
// input: apps/web/app/(main)/settings/data-export/page.tsx c05d63c5712ac971b2f188a098dac035584b486afd4937484f89035c8b13b543
// input: apps/web/app/(main)/settings/data-rights/page.tsx 8bf0e15afe1d117a8255f05dda2d86621ddc739d5cc499827f96107c3b9fb70e
// input: apps/web/app/(main)/settings/devices/page.tsx 64151a76c1fe271f15986544dfd58fbd16dc11bb08a283d3c6e6b626320eb142
// input: apps/web/app/(main)/settings/gateway/page.tsx 4eef35b03c2dbdef89ee8baff5d817d53877f8ba5b13218e177ea03a6fd1049e
// input: apps/web/app/(main)/settings/icp-record/page.tsx 086a622c4ad237cc72982c7eed82ca55c167321c1b9a4c1c08a7378311986819
// input: apps/web/app/(main)/settings/import/page.tsx 336e2fb0d88d41c8e7da3dfa5b4827f58e655c9db9b06337ddec6677a16ad800
// input: apps/web/app/(main)/settings/llm/page.tsx 33971a847f01d8bdf10692af698fe91335feac6e9ed338a50d259cc3d29ace13
// input: apps/web/app/(main)/settings/login-security/page.tsx 51fadf5ed924c886fb0851f253f573e8bf06c6258373608cd5192bea3591ba46
// input: apps/web/app/(main)/settings/model-record/page.tsx 61e8dab86044ed61293eef313452347a997f01e03fe21b8096362f3e26b5f968
// input: apps/web/app/(main)/settings/notifications/page.tsx a14962c808d4a004f3aaa1a656dc0f00b85bbe0040119e30c41d94360cda151f
// input: apps/web/app/(main)/settings/page.tsx cd858cf8ddf233183ee7ac6eb877f7987436aed3099e0a34a92f6c0a7e867f27
// input: apps/web/app/(main)/settings/preferences/page.tsx 74445a50663525ba349504048b13b969f9d9229f85d58d7836f466f324f5e612
// input: apps/web/app/(main)/settings/privacy/page.tsx c6fa6c334e98b0976f7f9f559fd8d58ad627be4842c99d3f3fb3c4294c77edbe
// input: apps/web/app/(main)/settings/security-log/page.tsx 46a448161593748b49328a8d778c8dc035384da1f4692ee69fb1099b239388c3
// input: apps/web/app/(main)/settings/usage/page.tsx c0574fbb4759c30926fea307f27df91e44eaa7aa41b2ab20a01caf8f4407452d
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
// input: apps/web/app/(main)/stock/page.tsx 2d05a93c825d909441c1dba2debd6ed84b7d0a57661ad7d179906fbc8edff9db
// input: apps/web/app/(main)/student/certificates/page.tsx 3d70199b693738782f22df922eee7ac6ba53ea2e473438910ceebe4a129e8b86
// input: apps/web/app/(main)/student/my-articles/page.tsx 7eaa615ada4d46a1735aeabdeeecffae9b134128f77f3367088f76a1e942c7eb
// input: apps/web/app/(main)/student/my-asks/page.tsx 5fbfdcd92de2c3248c9b50648d18ffd99416bbba72b0b9d89622c5c3ccbcc6cb
// input: apps/web/app/(main)/student/my-circles/page.tsx 8c44806b91c76963cb498c89289a2d76949151b5543c87fbd815e61b08e13e7a
// input: apps/web/app/(main)/student/my-comments/page.tsx 4d28a2f4db5da02b18b330ac5a211e0aa38c8248df63edbcd2cb300766e47334
// input: apps/web/app/(main)/student/my-lessons/page.tsx f30d187064a0bd45bf2645e5bdf9bdceaeed7c9ddb6e045a53cb3d0842d99941
// input: apps/web/app/(main)/student/my-resources/page.tsx 3fa00c4a2f443038f9950fb14b0063fae597b78242198dbb921898b837b8e5fe
// input: apps/web/app/(main)/student/notes/page.tsx 8eb7e4ca8dc6baf0d083778d10f4a3f74628a35b2eef22600e3f1f9edcfed1b6
// input: apps/web/app/(main)/student/offline-records/page.tsx cfe32632645752cf1cbc88b62b15fc0034510629a6837430527d56f819ef15a5
// input: apps/web/app/(main)/student/page.tsx 4cf84e0db605112662020d524721a5cc405700c56df08b533e010ae55731d48e
// input: apps/web/app/(main)/student/papers/page.tsx 4a91c82b358b71e9b038c0a09801dcdf28c76f222bdddc0095135d53d6836cc7
// input: apps/web/app/(main)/student/wrong-book/page.tsx a0656d1ddef4779d722e17a118798e4bbe42e6e8dd88d1d5fdeb8b90e7a5e2c9
// input: apps/web/app/(main)/subagents/detail/page.tsx 984254f7629aa023a7c03c41296bd1170dd8a986e7d14635b8beb70d4b844a35
// input: apps/web/app/(main)/subagents/dispatch/page.tsx 5aef88d1913fbe3697c2eaae09179e3c501db547c94cacd79860e9785baf2a78
// input: apps/web/app/(main)/subagents/page.tsx bea0a2df4d15de0b3e4d7c7538a583b6acf0584d2929d1605d54bef49cf7a13c
// input: apps/web/app/(main)/subagents/topology/page.tsx 609fb6028d39528b8eff849ffe08e8c0cd2fe894edbb85080498cb2b431574f3
// input: apps/web/app/(main)/subscriptions/page.tsx 25d93d0e11d82a3a531a0eb8e7e355d51f447715e58b29dec44134113fc5b6aa
// input: apps/web/app/(main)/support/page.tsx 8a7fd053723f9f4b96773445a799b0f0b5e364887e422c8d2181ec3a6e3e4491
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
// input: apps/web/app/(main)/tools/voice-stt/page.tsx 1387d19a3e54cca21d236957f64fb9c82d7c0d81a9f222d585dd2e2e47c0b173
// input: apps/web/app/(main)/topics/page.tsx 2eaaae49934b1d9d72ee2406da6801b685e98d1a444e24c95be04cd748724bf3
// input: apps/web/app/(main)/traders/page.tsx 80b1b09d006d7f3cb5980301178b9c1272ba7b2459e181d4d9f9b1fb43784fc8
// input: apps/web/app/(main)/use-cases/ai-design/page.tsx d23711fba7c7ddb46432cc61bd71bd5b46d2f27659608c4a10cae754eb51cabf
// input: apps/web/app/(main)/use-cases/ai-edu/page.tsx fce7bd4d79dd7b00bc61d2aebec02dbba41875db244eccd85cd134cb0f0ae618
// input: apps/web/app/(main)/use-cases/ai-marketing/page.tsx 9323cfb616e361c0c66a71725642596af354a955e4e94f6e303d74e2b1760b90
// input: apps/web/app/(main)/use-cases/ai-research/page.tsx ded82533510c68aa77fe7347adf05c6c3aea1bcbf5a511c29369550fd34f4601
// input: apps/web/app/(main)/use-cases/ai-translation/page.tsx 4f00e4e8645d68e1b170c2d86004ed6f03e9268c11dfafd5d9f330431841da7d
// input: apps/web/app/(main)/use-cases/code-assistant/page.tsx 807f10e2e032b92096db24674119d7f6b986515cb478e901eace5252b2cdb3d0
// input: apps/web/app/(main)/use-cases/content-generation/page.tsx 774300a10ff8e5fd66bea169a75b3cc1be0989fbd422e73776048f202e2b8bd6
// input: apps/web/app/(main)/use-cases/customer-support/page.tsx 0c5d38e03a57257117f9979ae2d68680bc68a843850ee17f3e472449e5a29f73
// input: apps/web/app/(main)/use-cases/data-analysis/page.tsx 45026ea13fbc2f405c4149fbfafc7c9f32c47f1790f11f08f933008a143ccbe3
// input: apps/web/app/(main)/use-cases/hr-recruiting/page.tsx b4741657ca12a7a06d90ead26f3de508ff7eb011730a22be4c8c844596314f36
// input: apps/web/app/(main)/use-cases/it-ops/page.tsx c4f4973d9b4dc2ad8eab1787824dc021d0ed86383686eb2bc7d3250b3a3009ef
// input: apps/web/app/(main)/use-cases/knowledge-base/page.tsx cf548c1885b98fbf0d57fa5a6fa9b0044ef87f84b4c2de12c74c97e32e361542
// input: apps/web/app/(main)/use-cases/market-analysis/page.tsx 6a28cc38e3bcab324d18819733bd5e306086334a9ce324d8a3c4bb32823d47ef
// input: apps/web/app/(main)/use-cases/page.tsx 709aa2c28f4c37157818137b3136e6c6f476355200702c0121e8272caf40f374
// input: apps/web/app/(main)/use-cases/product-analysis/page.tsx 8907fb6e5156ed3317f2fa2520f45ee0ece7ce2ad1d31d6ca075c2ecad4de076
// input: apps/web/app/(main)/use-cases/sales/page.tsx bb0bd7506000a263c20aeab4a2e4024d127b6fc2a59b1320e5b08138084f7826
// input: apps/web/app/(main)/user/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/user/articles/page.tsx f540f7b139bcd1859f4216688a8f946ae1e5d531d9e016e4c48b9b69cbe7106e
// input: apps/web/app/(main)/user/ask/page.tsx ad551bb68f2e385c4d5c7014cb4f037d887e71ce083cd5d15fa50d4bd1877abf
// input: apps/web/app/(main)/user/circle/page.tsx f9ebcd82814b24a71736749010c039a10d65cc81521b7d583563ce57908ed222
// input: apps/web/app/(main)/user/comment/page.tsx 176b270b1dc675f8f597ba6accdfc1b5b0eaecbf50fd525104553250112725a5
// input: apps/web/app/(main)/user/exam/page.tsx bfdf1c221e70f9a22120af6c3b6a12e48a7511dbc4ff44f97c0abe4e9545d019
// input: apps/web/app/(main)/user/fans/page.tsx 3bec412b75f14223ce9061108267d661c65eb81c647432246fe0e4d479b19b54
// input: apps/web/app/(main)/user/follow/page.tsx fabcd1c058dc78ca15c493270ddef7933731e3719416175fc1383888ba4a2f2b
// input: apps/web/app/(main)/user/learn-record/page.tsx 416f84a485441dcaf0b3d8008a95f4032cc03238c183301a3dbbb32b5ec2eec6
// input: apps/web/app/(main)/user/page.tsx 90e1734021e341936e8414bbeece0e57c26a418454139749805082f243b1370b
// input: apps/web/app/(main)/user/profile/page.tsx 50d9f39353538bd85d6ae4893d3a4d2b40933df8d92df7e52f95da8a9801b8b7
// input: apps/web/app/(main)/user/qr-code/page.tsx 0449910812e78aad9b6555f8ff2a8adccde7788535406624ca0b1b5d752dfdb6
// input: apps/web/app/(main)/user/realname/page.tsx eb8f7740121d35d50f610da70f2626b9f91385ec95ce4210addb1692dcb7adfe
// input: apps/web/app/(main)/user/resource/page.tsx 8035b963b0f9257e50661e9cc94737bc71e32f16b16e650bd544f74986092e07
// input: apps/web/app/(main)/user/security/page.tsx d50691f523947446c88f1b54d13c376d114564873f45a49b754dc5bf716b6a0a
// input: apps/web/app/(main)/user/sign-up/page.tsx e0566d9d6f2166b98a99e831c8864ff1d81a15f710e63db92742aa1b32602396
// input: apps/web/app/(main)/user/subscription/page.tsx 0a278195eb3beb4265d3fb29dd495f85cd7da1526ee4027996a797d9006e8513
// input: apps/web/app/(main)/vip/details/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/vip/page.tsx e9ec8ed1b69f8b87b8c58b937fb3f0b5bc9d787bfa4cff3886db49084f7fef23
// input: apps/web/app/(main)/vip/trader/page.tsx 0673efe46df37b9553d2b72d2cd9aa1c95886bb0c43ed7e68dea6822428d7f3e
// input: apps/web/app/(main)/voices/page.tsx c68d2a84a3398bad4944fdef278c577f9f209c0b0511806544c49ba78f095124
// input: apps/web/app/(main)/wallet/page.tsx b4781e27db81bdcff9f27107e6d1b7d3cba3c658878efa7f465c99c358a0eccd
// input: apps/web/app/(main)/wallet/recharge/fail/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/wallet/recharge/page.tsx 77292296d2d4384f8185a620ca156cddfbc849718326f08ab62234ebda340fa4
// input: apps/web/app/(main)/wallet/recharge/success/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/wallet/withdraw/page.tsx 542e0955b900ff92da029aac7de475e3cc6760d3b1d24d488cb8bfc21bdfc1c4
// input: apps/web/app/(main)/wallet/withdraw/records/page.tsx 9477479de2bfbda133d82ce9ddf934aa364432cc7e37e2504236b1a6934a2a4e
// input: apps/web/app/(main)/web-tools/page.tsx 00a7975c51aa5cf85bc1a937e993e763c3e18935d551639bb42f049d84bce87b
// input: apps/web/app/(main)/workbuddy-reset/page.tsx e8f6797d00dab9b1c71316e7fdc7d1ab2ea7681389e824bdf61f59a7582aff37
// input: apps/web/app/(main)/workflows/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/workflows/instances/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/workflows/page.tsx 04023d6b22d63b60eceb775e64e213bddfab0a02b4ad697969fb33d9a199ddfe
// input: apps/web/app/(main)/workspace/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/workspace/page.tsx 3a1b0bb2a5a7185007b6cc0c51743b8b53923561bce1f77275f03b611e440a51
// input: apps/web/app/(main)/workspace/permissions/page.tsx 38886a323039fdee621a08d3965eaae3710bffb83ae28538fdb303e0d980cad1
// input: apps/web/app/(main)/zh-TW/use-cases/ai-design/page.tsx 5c51d4abd53209b2b14612bafdb905fe51554e01ee75f8df735a2903317918bb
// input: apps/web/app/(main)/zh-TW/use-cases/ai-edu/page.tsx b85c70ef46d5768292932acd308dcd3ee80f6ea5384a006b6221286c1ffbb619
// input: apps/web/app/(main)/zh-TW/use-cases/ai-marketing/page.tsx cb064c1d6a7ee78b8988aec5b763949aeb24351dc0396d6a4948b9815bd58723
// input: apps/web/app/(main)/zh-TW/use-cases/ai-research/page.tsx db52516707beb2fae2bd7dfa2b64e34d115a936e846b5a14b4d101a97d14826c
// input: apps/web/app/(main)/zh-TW/use-cases/ai-translation/page.tsx c7c0170f598a1af19d65151fb3e563cd6a9417fccb3a37928ac9a576ba3a0133
// input: apps/web/app/(marketing)/page.tsx 8004f807b187bbd827d227e7bc43dff4efd301968e177cfdf807c1d700681c97
// input: apps/web/app/(pilot)/shared-pilot/page.tsx d5664785dc04ee9f0cbdc55c2a9720e5c9010b4f83464f093fe36a8487334d0b
// input: apps/web/app/e2e-harness/markdown-stream/page.tsx bb6709962fc89b42c92d9c1f56750ecdb12a85bac9bd6add9afdfb15c5f22d5f
// input: apps/web/app/en/agents/page.tsx 10b327a0a31a1070ebd2fa5262363dc7788bd1ecfa139540eac3a370d131d68f
// input: apps/web/app/en/docs/page.tsx 529c775bd22eb952b5be3a8647385c8980bbf460cae7a411d722e6d6a0382c03
// input: apps/web/app/en/models/page.tsx c803fb9bee56402a15715981b93bbfd515dd1c0095f5143bc6dd1a9557624002
// input: apps/web/app/en/page.tsx f5237c873f9b67f76cc698e8d884d2f8ea827d712e05efd7412fa45ab78df4f4
// input: apps/web/app/en/pricing/page.tsx e074ec7fc571dacc448f678a8dc60cbeb2a6cb17be3bc7078c0d4cc61b698999
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
// generatedAt: 2026-11-04T11:14:55.623Z
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
