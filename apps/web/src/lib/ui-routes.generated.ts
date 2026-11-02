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
// sourceCommit: fc60fbb120aecb75957ba116697a17b29f61b6a5
// inputsSha256: 2b2c7ea02ea3ed5095f080f74642bffcaaf122f41c109efb412ebb055d6cfe29
// input: apps/web/app/(auth)/apple/callback/page.tsx f328ceb139ed3b61c0e79bc671e93885a6c1e1b6b7c356febbc97f3255da2075
// input: apps/web/app/(auth)/callback/page.tsx 3d3cf195c8dcb8ec142e08a1d50b9016687a48c3503839f0db0dff7f9bbce67e
// input: apps/web/app/(auth)/forgot-password/page.tsx ebf3e4b50c09d9871131b9fbdc5cddb79c0f9c73bc5775c5ce56dd08a0fa2443
// input: apps/web/app/(auth)/google/callback/page.tsx cde1e4556035c25e575647a27a27b2d58eef2f65726a875747af87d31f0a9cba
// input: apps/web/app/(main)/a2a/page.tsx 8be012b71f9e2a2b736d7c99ef4dc0370b1d25e58566c1931eb8e6a1f57e8a67
// input: apps/web/app/(main)/about/page.tsx 5afd0dd2943e9a1e6b3fa72f8209d79c8c58ba3625c13ba86808b4acfe3806b1
// input: apps/web/app/(main)/account-pool/page.tsx c0433712e5578ca0997a98f65901d14f06cd5503cdf35f46a1fa9286e75dacc9
// input: apps/web/app/(main)/activities/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/activities/page.tsx d78852d79a2616bdf1232529ef43b035d46f51451c0ed72238ddb68d27908e83
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
// input: apps/web/app/(main)/admin/docs/page.tsx fb2fa8db78a495e8b3c622a7d645989adef2cf06a180757b0a4ab3613753c4c1
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
// input: apps/web/app/(main)/admin/edu/page.tsx 2a1703fda2a056278a92a3050df9ff1c085a1d2abaa9ee66850b737a54298f07
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
// input: apps/web/app/(main)/admin/error-dashboard/page.tsx 2d0cc5423273cf70655042f099c292b8cff2a39161e91a93ed97c87a6b9414cd
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
// input: apps/web/app/(main)/admin/monitor/panels/page.tsx 574cf71b3c26bd6bfdab545ba76efb50f08a628b247d3e63957b8060fad9954b
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
// input: apps/web/app/(main)/agent-plan/progress/page.tsx f152ee912c6f0953cfb41145d88e454c711914e4cbb597abdae9da00b3bf9f5c
// input: apps/web/app/(main)/agent-runtime/page.tsx 057cd9ac1298e9691fe7bb210d6e0dd35e7dbcc1bf9a4d916085e0ba6806909d
// input: apps/web/app/(main)/agent-step-recorder/page.tsx f90c4c79e67f11df44847de3e6a0b73dafcd06bb3949475aa147d914e53091df
// input: apps/web/app/(main)/agent-teams/page.tsx 47423cd950c072083618e40998c4b17685ad7e920c459e76e9170f5a7dce07cd
// input: apps/web/app/(main)/agent-timeline/page.tsx 8bd9544b786b7c451bebc81c6b45800cf24a64d76d4a494178820af757103462
// input: apps/web/app/(main)/agent-workbench/page.tsx 4e7fd3b93d23cb822a840f98faa862029745dd335aa737f4049bc49fe578c7a4
// input: apps/web/app/(main)/agents/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/agents/categories/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/agents/categories/page.tsx 616f31f60b3373a66741dd9d52ee4696e7057e0537371378516016d2e11ed2ce
// input: apps/web/app/(main)/agents/create/page.tsx 8e630e2c5f5d77d6d5d99dc7389ed770ef26b71e605ab8ac182ce5559cb6a5a2
// input: apps/web/app/(main)/agents/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/agents/featured/page.tsx 234ab5d7519dbb93d2847baf36f7efdc877f56d3c18262960c0bb446200850eb
// input: apps/web/app/(main)/agents/my/page.tsx 73edb9002a554506fddbf346cf259974b1fdbee7ccc7d484d3597976782e503a
// input: apps/web/app/(main)/agents/page.tsx 71db76f2fd7ae1d5c358cf3173ed1e935bc114b29e500a3212422f7c7290e9bb
// input: apps/web/app/(main)/agents/stats/page.tsx 73741e8c6ae82d3b7122ae3f410cb620123eba0e7f64c2ef068d872e10edf455
// input: apps/web/app/(main)/agreement/[type]/page.tsx 2fdfa2b9b1de35ab72faab4733c4743b37f0845e976b32661cfc06d5e85159db
// input: apps/web/app/(main)/agreement/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/ai-career/page.tsx 8ceeced359d5395e9a075703523959043c05b95dd118ac60f301331136839fb5
// input: apps/web/app/(main)/ai-generation/page.tsx a910eeb39c53b9c6c3280ba8cda7662d1d9814e8b7541e57754142faa28a2dbd
// input: apps/web/app/(main)/ai-generation/video-tasks/page.tsx 89aea3227c8f5c94c49ed1910bff0ce2055949594e488ce121a202cab83b0cef
// input: apps/web/app/(main)/ai-news/page.tsx c9d13918b45feff87376005332735215d78d980e7a9da40d1690efcfbffe9ec7
// input: apps/web/app/(main)/ai-skills/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/ai-skills/page.tsx 84e608aed20bceae83d3bd6e3a54da8967657bff065bf6a4091fe87692ec8e7b
// input: apps/web/app/(main)/ai-world/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/ai-world/create/page.tsx bf8b0a0c59b9dfe8dc97e3f47107e79d9979bf37d43bb09d2c03df8dccfa208d
// input: apps/web/app/(main)/ai-world/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/ai-world/favorites/page.tsx 01d6a4964a601017987cf2cb903312b11f905c919a1aa0661633f405902674e0
// input: apps/web/app/(main)/ai-world/history/page.tsx e8d9f9f4a6fdf8da02dd1c2d31277b202a1f85353ad6995e93f01e7717b3b42e
// input: apps/web/app/(main)/ai-world/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/ai-world/share/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/announcements/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/announcements/page.tsx a8c99cf26892e31acd77b31cf7be34dfd91beaa4ce67127124c2a91bd6a93114
// input: apps/web/app/(main)/api-test/page.tsx 094e1c0ffc5ad41b581bdc3755a86af6528023a6a468b73ab11a3997915258b4
// input: apps/web/app/(main)/app-permissions/page.tsx 38f71b70c07705be705a89e6ff369c38b2da02b3238a530f74e3e12350438819
// input: apps/web/app/(main)/article/page.tsx 3be8cc21f72dd604fb3eb6600b920077394f24997281f4444f6ea429ac8dd74d
// input: apps/web/app/(main)/articles/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/articles/edit/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/articles/hot/page.tsx 58f7893dcd69e5710bc2d0049a8214b85e3f866f3d5ddc3a5c6f836dafc203f0
// input: apps/web/app/(main)/articles/page.tsx 52d3c0a836d8d55f4d8b477063d55401313cb0179528af9e69ec973da97b3d4b
// input: apps/web/app/(main)/artifacts/page.tsx 655d4ee56c921b03afeda3d6fc3eea9809f28b2477c4abc397a35ed1d508e720
// input: apps/web/app/(main)/ask/page.tsx 78a7b752303eaca2fbdc8d28229eb7f3def29c9cf10b8c15119d06d5d05301d2
// input: apps/web/app/(main)/asks/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/asks/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/asks/edit/page.tsx b0516693d9e3750c62c3c4ba0a703c2344613a6b5982fe7aa1a3114801058af5
// input: apps/web/app/(main)/asks/page.tsx 1c9d4df95e8354dcdf2f044b7affadeb88f2e50f921659683becb115f155cee1
// input: apps/web/app/(main)/automations/page.tsx 5aa4e16c3f550bd92f067b6e3e03559f64c41a7d918f72c369d400e0b99643cb
// input: apps/web/app/(main)/available-channels/page.tsx d0f2f3006c18ddbf8bf97b97786b224e4c3135e7f33d9642a33df88d92c92eae
// input: apps/web/app/(main)/bi-dashboard/page.tsx 580bd89606563d748d7ab502c51358f1d6124bb0bee180b8b307ca092c2699c3
// input: apps/web/app/(main)/blog/[slug]/page.tsx b698057b460a3f264054824e2a58c523caf7ba840073351296b66bbbf0bee21a
// input: apps/web/app/(main)/blog/page.tsx 1fa6a7ebe975e47cb5ba45644cfd38ad7958f114f33952b445e08af0e3e42835
// input: apps/web/app/(main)/business-card/edit/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/business-card/favorites/page.tsx 0e86e53330a802820322cee17929b0dff88bee68d58ee34d8d2ddf0f30131c48
// input: apps/web/app/(main)/business-card/page.tsx e4b66dc7c89a43da2444529abf1eba2260aafb3040a3d6066975ee711dc1de90
// input: apps/web/app/(main)/business-card/share/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/business-license/page.tsx 44349580b71ee4ca4050496bdbf07ce1ffe51bdfd984ea57c829c423f0507c05
// input: apps/web/app/(main)/capability-market/page.tsx 9e89193db363da5deaf464c9761bc0492a1b267424452762a75f8d6ec65df25a
// input: apps/web/app/(main)/carte/page.tsx 72860a8d856c5e68f2370afd03bc903f0dc03186c535da2bee4579e17da5e145
// input: apps/web/app/(main)/certificate/[id]/page.tsx 5dcc5b5105320a0545f6b5cee21fa59b7e585f99d35b43760a431322aff0dae0
// input: apps/web/app/(main)/certificate/download/page.tsx cf0a2c50b75ab1e093901cd25638b64276fe8d6420147a63c3cce97fac155449
// input: apps/web/app/(main)/certificate/page.tsx 3e6b9961ae96c8315007d9aa35fe4dc023e4c8461ae154d3b864e09a57643c00
// input: apps/web/app/(main)/certificate/verify/page.tsx a7038966c248cdaefa390f0f6c28b86184234be18f9027fd50ab0da630b4db22
// input: apps/web/app/(main)/channel-status/page.tsx cd96a600eeba925827c9f73793fb4458e3585216ee01365efaf23e47378b5319
// input: apps/web/app/(main)/chat/favorites/page.tsx 366f319edb1d9b33aa101856d89e7aab4e4d4c941368959b9eb121bfaf130c3a
// input: apps/web/app/(main)/chat/history/page.tsx 07ac1b9de9833c70a9093e0e71f06466c7d6a5b7d96691ece7f3638d60bf5539
// input: apps/web/app/(main)/chat/page.tsx 463252e36cfc5653c0f47e2b4c10097e52225cdadc364f654306a75b0056b972
// input: apps/web/app/(main)/chat/settings/page.tsx 44910328e386f976160e6fcc997ff45ae38ce2e950ab987e88ecd8f9943fce5c
// input: apps/web/app/(main)/chat/share/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/chat/templates/page.tsx a6d03098e1b9aaad8ed5a9d7bf1836747f16bf4b2a672caa69f60e93fbfdd741
// input: apps/web/app/(main)/chat/workbench/page.tsx 3dd4663bd30d8ace8c95712a1c3aa323dc6ae8b80894cd68acacc35169669f60
// input: apps/web/app/(main)/checkin/page.tsx cf3878f6d5b257fd7a040bfb1668f8e2ed43bf09bd3b64173358f50987668bb6
// input: apps/web/app/(main)/circles/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/circles/page.tsx 5dc5b147cc4e060a352c51f9480deb7b0063dfeae971c07933cd0a4fbbfd9cdd
// input: apps/web/app/(main)/circles/post/page.tsx 6d12bd242ed7f4f577d82d9aad5bf1e76e67a9fb5fda8f0161dda1c1cdee6fe3
// input: apps/web/app/(main)/cloud-agent/page.tsx d0fdf66eab368c19e4158b4427237157f60017c0e067d49447ddda6b398b49ae
// input: apps/web/app/(main)/cloud-run/page.tsx 33ecf8d6d2bf8844eb45d5d7257fd2b6bbdc0c891acc33382a8bbf94ffbaa13c
// input: apps/web/app/(main)/comments/page.tsx f7d56a6b0662dbaf97708ab38d913153fe595f23789d5f2972637f06c9f19223
// input: apps/web/app/(main)/commission/plan/page.tsx ab5f11ebc82e346ceb4ef254eb1adb1b9663d804e188befbe1962e7f9ad25780
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
// input: apps/web/app/(main)/compare/page.tsx b7cbfa03f2a925e4cbc2849e7e9f336e31eb59589bbcb03e95e8280acf3a2c9c
// input: apps/web/app/(main)/computer-use/page.tsx 1a3256c8d5c2835ef9b18a2bfedfa3dac11f3643a5b5841d13cd5dc6f7f00dd5
// input: apps/web/app/(main)/connectors/page.tsx efe0c3dfc82f0add7377bd131e6fd6497ec9868e79b7366b241042d79c9994f0
// input: apps/web/app/(main)/contact/page.tsx d0cb65c2c24df77cddd00f8e82bd9d5bf8ac39850a4fa0423c645a111f91ac7f
// input: apps/web/app/(main)/context-compaction/page.tsx 71c0c574c0b38d2b9e98b5b8d810636a2d9cdf90858ca2b281bd043cb6360c71
// input: apps/web/app/(main)/context/compression/page.tsx f1d894879e50aa80b2c349d6a32ec510c6e2602597b44dafbe65786591e1a309
// input: apps/web/app/(main)/context/mentions/page.tsx 3b741f076f356fa7f24023f9cba9167f7dc13792da0449538416532d9e862031
// input: apps/web/app/(main)/context/page.tsx 8ef976a6a5261ad89ae11d37e853a444855eb2811a57713ea0414f4e58482143
// input: apps/web/app/(main)/context/visualization/page.tsx cbf05c5c4fa80e962107abd4f6a5f173e7ae9fada0d7e67a87c2567f393d0753
// input: apps/web/app/(main)/cost-dashboard/page.tsx 53fe3fc1ec27f5efe8b47afa1b1392abb9ffeec9a5ebcd4076073441d99136ce
// input: apps/web/app/(main)/dashboard/page.tsx 811f42bce3ee198be01608c2232625759b6f1e8cb4f858cc2bd8de5c2dda9022
// input: apps/web/app/(main)/deep-research/page.tsx f5bbb65f2dd87cd43b44fe2ec0502c0daaba54398d7468e252ca1aada01112b8
// input: apps/web/app/(main)/design-system/page.tsx e2a38caae54802fe2145bc39ce0878275686ad755931024b87ba6f4dee417e97
// input: apps/web/app/(main)/design/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/developer/api-docs/page.tsx 826fd820ab2ed4ee2332511e818706e211d0016800e13892a14f0791106eb342
// input: apps/web/app/(main)/developer/billing/page.tsx adce3fb4d2de624a504effe55a0d5c287428fe2694b43bfff493395d0969bfa4
// input: apps/web/app/(main)/developer/capabilities/page.tsx 408bb101025192ac59d591272fed30fefe5ae11f401e1abf500ae39deb432039
// input: apps/web/app/(main)/developer/conversations/page.tsx bb15a80c27576389b76941531a85a49d9b33d9fd9907242dd7ee358e6a62903d
// input: apps/web/app/(main)/developer/enterprise/page.tsx f8786f262112058ebde1a06db7556c3946a379ea40c3001e04ea3b6b26b02728
// input: apps/web/app/(main)/developer/error-codes/page.tsx d9e553018d8c80277a9c78081d06fb82cb55f94dc86200919e5789bbf26131e8
// input: apps/web/app/(main)/developer/ide/page.tsx d736ab882ef1c6c4080135b303532359e67866559107a5de66d31746b001bf41
// input: apps/web/app/(main)/developer/keys/page.tsx 8bf0974f97e53ca84fc5573315e81d69eb29e34fa3d929409fd1c68f77a3b0c4
// input: apps/web/app/(main)/developer/limits/page.tsx fcbcaf7e308cf90e0322d874009749b14f796dc4d61bee3186b683626aae42c6
// input: apps/web/app/(main)/developer/logs/page.tsx fe689ed68ce7f5bf7405f6c699111ceed54bbaf21390f770cd901780571634ed
// input: apps/web/app/(main)/developer/notifications/page.tsx b2888f324da1948f4940ba93c2a17c43718ac537f57482447062fdb8b8f8a756
// input: apps/web/app/(main)/developer/page.tsx 058d223c910b0e6b113e86d58a7c5892f8110e31508fd90f988248c6ed9f80a6
// input: apps/web/app/(main)/developer/pricing/page.tsx 98ff5a53b9448a91c64ec733e291aea8f124e35458fba949d11d8ac943aa1b42
// input: apps/web/app/(main)/developer/relay/benefits/page.tsx f813cbff15df911f4c0a3f64a719e522d8a6d2300db2f5c167de4df8d41b8be8
// input: apps/web/app/(main)/developer/relay/keys/page.tsx 10fa9bb0d1cc40d929f2c7fde3fcdbb0db1e2da7df731b4c062ef260bdfe32a6
// input: apps/web/app/(main)/developer/relay/page.tsx 82876fc80f250ab04dd5d4ed31587dc0067e563b7a484d769e340331a12b66eb
// input: apps/web/app/(main)/developer/relay/subscriptions/page.tsx 0bdf66497caa4b3d9166c27c1dcef48ec8d1753b50d85e48d71899961458f519
// input: apps/web/app/(main)/developer/relay/usage/page.tsx a3feba28b60c1e5f80ea4b6e58d752bb74a47eb06046967e10caee50d38b00dd
// input: apps/web/app/(main)/developer/sandbox/page.tsx 638155f7846ab915741be4657231d424077b7e7efdbaf7b7583e1bbf03395b40
// input: apps/web/app/(main)/developer/settings/page.tsx 7c1737ed5bb8a23d2610a84e4876bae8c460aac2f5cd5207223d45bb2431c081
// input: apps/web/app/(main)/developer/subscription/page.tsx a03460102886e16e9636efdbf2bf055589e9517edc2b306d0289feb9ea680238
// input: apps/web/app/(main)/developer/team/page.tsx 790a852322429559d0f2ffcb61057f2241f96c8953c49f09308d87c6acc6117f
// input: apps/web/app/(main)/developer/versions/page.tsx 8bae76829c9a41ebb73cf958c972d139df78461947e3041b7b1156888c41388f
// input: apps/web/app/(main)/developer/webhooks/page.tsx 76f05685fca36c2487be9f4851bef84a12809ee840a89a2f5ec33e801d6ad493
// input: apps/web/app/(main)/developers/page.tsx e4a6a847e564c28bb1671478df1925f636facf1e3373d3f391d398746b165fba
// input: apps/web/app/(main)/distribution/commission/page.tsx 3d25e2d34b06b867a2405a411fd1a221984d9a7bd1f4ff4e8f98e3ec528a6571
// input: apps/web/app/(main)/distribution/company/page.tsx 4bc72e168ba5bfb0dca4e4def70ab858f3c622ba8d1a77b6f1446d0a748eb0e9
// input: apps/web/app/(main)/distribution/orders/page.tsx 91b4a0c7f04ca0e5ba158887008a023cb4ab49013c3774fab8ec39016260e7c0
// input: apps/web/app/(main)/distribution/page.tsx ceaad8d26e5f9acbaae40159b9419b80b163637b8efe793319d48848fbef74ac
// input: apps/web/app/(main)/distribution/referrer/page.tsx 555273778be64cc92858452e73e0afaad3c1cd2877ba7efd045b255715dbeb5d
// input: apps/web/app/(main)/distribution/team/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/distribution/team/page.tsx 7da06aa2bf423d3d3560092aabd43e3aa08249039cb51160f263b0d83642df7b
// input: apps/web/app/(main)/distribution/token/page.tsx 8da37ed05f765b58e7bece2aa22027a1467242e77ab01de8d7f1339536f9089c
// input: apps/web/app/(main)/distribution/withdraw/page.tsx 936cd8cab642c51047b8dacbb194246c53142f68517fa2ed12ce04b2d9a77193
// input: apps/web/app/(main)/distribution/withdraw/records/page.tsx f9c516feba81ead942885a854c7d690794e11c952c1323540c4186cf8c099785
// input: apps/web/app/(main)/docs/agent/page.tsx 47e49b3e8e07970f0c922fcec176a658f16aec8167591f60bc7601c6a17f0ceb
// input: apps/web/app/(main)/docs/api/page.tsx c328e8db5c6d263dde6d774515f529bd3969b797a4981fc377ba2bd76b9cd6bd
// input: apps/web/app/(main)/docs/manual/account/page.tsx c57ce7431dcb711cc6f9519828d6cce098605ffde505a6f35338699ff5a752dc
// input: apps/web/app/(main)/docs/manual/agent/page.tsx 8de808d8f86899401b6649d553249f9b4946c401a7d519c6b95fbb7d71111fff
// input: apps/web/app/(main)/docs/manual/ai-chat/page.tsx 98d73679e3bec42262afa7c958df987a8da7f943780f14729d466dd32c8a01d4
// input: apps/web/app/(main)/docs/manual/billing/page.tsx 6f0aec4d7faaa488aca0f8d150086dbd9283fc2567a9c26139dd5e107a71b882
// input: apps/web/app/(main)/docs/manual/faq/page.tsx 4f8320c82f7a2d44d4ac66985cd673f854e3b48f40046ed540a88bb2b0e7e57a
// input: apps/web/app/(main)/docs/manual/getting-started/page.tsx ac1e4fb323192f4aca3d80ba0725b8c67ba3eb3ebfd2a3fa988fc1213b6d8b29
// input: apps/web/app/(main)/docs/manual/knowledge-base/page.tsx 3ab5996a80ee4214749d84b582e8aa638f4bbe718da75a4b839b1977b63e0691
// input: apps/web/app/(main)/docs/manual/page.tsx e05b35cd5da70c8a3bd28ed51ca79e2fb901bebe27f41658aa70823e585170f6
// input: apps/web/app/(main)/docs/mcp/page.tsx 6b826dee30b9908c76b8bdf877a423f14f82cade9db8949de21961a68290f155
// input: apps/web/app/(main)/docs/models/page.tsx 80d4c30011f573628f2fefff31eff235b6800db70dd589c7104470bdb916d046
// input: apps/web/app/(main)/docs/page.tsx 86df462841d18a98cbf76582abb752492734801c026a0ca673c74d6a5b36b99f
// input: apps/web/app/(main)/docs/quickstart/page.tsx a6dbdd255f7d72a7ab6dc2c3ffb8758ee4a0554250d8495d6dfd6ad33ce31207
// input: apps/web/app/(main)/docs/rag/page.tsx e8830c3820ac4ea566e95643920220940e9e5ed53c678eb8ec6dd3ad8992565e
// input: apps/web/app/(main)/docs/self-host/page.tsx df28d88ad9b861e86b917678289fb629454d4d4f66340b39fd81d1e88463253b
// input: apps/web/app/(main)/docs/team/page.tsx 5dfbe4c093792f95ee50032ecc1211cef7bca4e763fc6da6070f09fbd6c65936
// input: apps/web/app/(main)/docs/workflow/page.tsx f30dc00b2e17178502209532bc861bc328444d89816582e87cb54f486cda1b85
// input: apps/web/app/(main)/domains/ai/page.tsx 1a06ad7c1c2aa734cc2adf9cbe2196dcf8e52e766328ce76b55c53892e4c2cd8
// input: apps/web/app/(main)/domains/content/page.tsx 5f2aadcd2744e25d3e55f3329446167280360de8d78bf2a8d48c36f2bb426e7c
// input: apps/web/app/(main)/domains/edu/page.tsx 610d37bec54c738e573d24150b1a36c173a9344cb559da2ed18aeb7386026fd2
// input: apps/web/app/(main)/domains/personal/page.tsx 329a5d2bbc5fa9b6ec73b84cb77f6c673bf0e5273e92264fbb2c8c4a1a0988fb
// input: apps/web/app/(main)/domains/trade/page.tsx 81b8bcc37d1565a1ffdbbb0abbcf9f8eb077f08bdc9b8d8b789fb789c2368949
// input: apps/web/app/(main)/download/[platform]/page.tsx 04bf22574b04954a7418bae2c41138e61083f06317686216af880c1b1529c314
// input: apps/web/app/(main)/download/page.tsx 59bc8557ed62a53fa3608ec75132263f58a438dd8c09e066e49f8a07bb726c04
// input: apps/web/app/(main)/drama/page.tsx ec67ab8b2331b83f6608c9f57abbd017eaf55563d3c4f96a8f79260c8dc43fc9
// input: apps/web/app/(main)/earnings/page.tsx 3d401bfe628901abbfb3d5dc4c78089b3b0b2cd37464003d8a6d04e4a4300c48
// input: apps/web/app/(main)/ecosystem/connectors/[key]/page.tsx 8393c69c5ff681ca5d2aa9dd26f6c2474d62f0e1af2f9eba3c138003af32eb69
// input: apps/web/app/(main)/ecosystem/expert-packs/[slug]/page.tsx 098fab45a09bd2cf6ceecccf47cef0ed94dff9daa2efc87dc98ee3ec6ba51d7d
// input: apps/web/app/(main)/ecosystem/expert-packs/page.tsx b3874012bca5399c92bc75fb664ca004babb2448ab83f7853548e1aede67dec7
// input: apps/web/app/(main)/ecosystem/page.tsx f0dbfb332b9a6d22dde55a80d763e3aacf88436996ad4b44a76eadab0e95ea88
// input: apps/web/app/(main)/edu-ai/aigc-tools/page.tsx 6270bc7beb51f345dcf09e72c0a7d49f5bde1ea3392857a8654e4c3fd8310f28
// input: apps/web/app/(main)/edu-ai/certification/page.tsx e45627e3158896cfce43586459652c987419a4b9b4c309145f4dc4a4fcc0f9a2
// input: apps/web/app/(main)/edu-ai/courses/page.tsx be9aed4c0712eaca7dc6e56a36774e591aa498b3c30f2c8bd275ee19974f0276
// input: apps/web/app/(main)/edu-ai/map/page.tsx 461895eb9785205cb9f3aa1730bf28b394f97ffc72e251880135dc4c441444fb
// input: apps/web/app/(main)/edu-ai/marking/page.tsx 263d764c68ae484c0c80303264fb487808362adad25ccae9eb2f2f88a220516d
// input: apps/web/app/(main)/edu-ai/outbound/page.tsx 0bd27c59def84533d5be56dc8396805237d542dc72ff978e835f714b4112a934
// input: apps/web/app/(main)/edu-ai/page.tsx b9b0cda9b604916f23f82f1b13c0f5e8d93ba97624e5b111f7b0cf524aa47a2f
// input: apps/web/app/(main)/edu-ai/policy/page.tsx d7651d4494485a85e4d532ccc42f5977a60cd47cedc7935a1c266750edf8f115
// input: apps/web/app/(main)/edu-ai/tbox/page.tsx 11abc26732ac47497f42f394020db3032878455656f580d9f49ee147d4a3182a
// input: apps/web/app/(main)/edu-ai/video-compose/page.tsx 94da6c038c4ba910276346e803571d6e537ccc231f19d79a6c3c070430e956cb
// input: apps/web/app/(main)/edu-ai/voice/page.tsx f4a09a35c1eede38d3d5c64175201fbd423a404b6554d9e9a2ce6f923dfcc53a
// input: apps/web/app/(main)/edu-points/page.tsx 75fe873ec4f3d2851663573a66a8141c487d638912deacb89c0e1e05e94bbb82
// input: apps/web/app/(main)/edu/certificates/[id]/page.tsx 30c76c078af2e8d4b7be7c0b2bc032d8e6bef02caa9c6852d6bdd187dc173fcb
// input: apps/web/app/(main)/edu/certificates/page.tsx 53dae18588908c650922f113a1159344e3129b6d9993ef248c469d95a52c950a
// input: apps/web/app/(main)/edu/courses/[id]/learn/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/edu/courses/[id]/page.tsx 3e8b1025fc51b722335ad922830d0eb9363a75759bf9b11aafbf7cb5db4704be
// input: apps/web/app/(main)/edu/courses/page.tsx 85a8f858c53077a481e8a11de4c70ed968b6e717af84f4558d122cd2bb86ec9c
// input: apps/web/app/(main)/edu/dashboard/page.tsx 0984d47cd7b3962ea3e17303b1b45e22297794098cec2fc7614736bd58b9fa32
// input: apps/web/app/(main)/edu/edu-management/attendance/page.tsx ee249673237ea43b362e64ac999eea54c1e170455eb5433939a3fc06835a38ad
// input: apps/web/app/(main)/edu/edu-management/enrollment/page.tsx bc0202921869368f06300fb71f38952639f061819262903badf59d1ec6f59baa
// input: apps/web/app/(main)/edu/edu-management/finance/page.tsx f47d6f6c8bcf6761400c9fb4555ab0fffe83f071fef2c5fde7c272d29477b8ba
// input: apps/web/app/(main)/edu/edu-management/grades/page.tsx 995cbff800387b67319592f4b6ef107859ff49a08f1e944bf8092c45c8d557c7
// input: apps/web/app/(main)/edu/edu-management/grades/trend/[studentId]/page.tsx bc6a04718ae14638d59ed11026b720cb0706d9b6b1009a08362b9486c21ff94a
// input: apps/web/app/(main)/edu/edu-management/homework/page.tsx 8a544efa39c6f7c569f8ebba0a92c54a670ad7c29bb295ef6c88698a9a29dfba
// input: apps/web/app/(main)/edu/edu-management/meal/page.tsx 1589e061d9244e74ded6a15a23e23690b33ac297da3601e866b645fc4a3d7d48
// input: apps/web/app/(main)/edu/edu-management/procurement/page.tsx 4c192286e578a9df6a2cafdd99d252b249b0946194a0ef78b235d5a7091cc917
// input: apps/web/app/(main)/edu/edu-management/schedule/page.tsx a1738edb29dcdfe3f30e45f0f535f2b4bd6f629dc5f847d47c30a1e6b4869cf3
// input: apps/web/app/(main)/edu/edu-management/scheduling/page.tsx 5ee1d0f6e76fb0e6bd806814d02a02d914c30a18f754e2def172d3c39a856864
// input: apps/web/app/(main)/edu/edu-management/study-plan/page.tsx a694a3bcf917afe21dab9bf015fcc45374464695a31d9812080d144a00503899
// input: apps/web/app/(main)/edu/exam/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/edu/exam/[id]/result/page.tsx fd23d193dee43ff51841125e799a6c64265e22b0499200947c6404d12b2e2954
// input: apps/web/app/(main)/edu/exam/page.tsx 3063667254bf8454ffd3be21229452ce79f9d55ef6638b388ad97ff2da46777f
// input: apps/web/app/(main)/edu/notes/page.tsx d1e5188cb439581150ee37c81234a2e8af55e4b5afa9b454bd5ff7cd52ad38a8
// input: apps/web/app/(main)/edu/page.tsx 5676e95679d2502f6cd77fd60b3b482af8b4cd19de696436b62fb18f3c71c222
// input: apps/web/app/(main)/edu/parent/bind/page.tsx ef10510d3162b92bd5ac67a3709535590373b03034161cebcaea9643d4db4ef4
// input: apps/web/app/(main)/edu/parent/children/[childId]/attendance/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/courses/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/grades/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/meals/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/children/[childId]/study-plans/page.tsx 1dfff0a7ded915c98ab6af725586589c87f271ce319059cf48989e7179097589
// input: apps/web/app/(main)/edu/parent/page.tsx 599e179d51a984c4075fca0833a63d4b595001f2777732eb13f862ade85a4699
// input: apps/web/app/(main)/edu/progress/page.tsx 9b7774080c90516729ba1d254db1888d428f0ee3fe30b2d2f94459eee10197fd
// input: apps/web/app/(main)/edu/qa/page.tsx 6a6ba6158803078bbf39231498c17335b8b8c0297d64ff1a61f9c1bda40dee0f
// input: apps/web/app/(main)/edu/schedule/page.tsx bfa846675c5a28ec02e1b2a07cacdaacc418351dc4e6087b3cb42363b2534b7e
// input: apps/web/app/(main)/edu/shop/page.tsx d8dd80e50a1319fddfd1b683f15c72ac50088d32b102123c5243e0c8266fe89f
// input: apps/web/app/(main)/en/use-cases/ai-design/page.tsx 352739cded8f29abec4a478b683971ed30405869977147d9820dacd8862e3345
// input: apps/web/app/(main)/en/use-cases/ai-edu/page.tsx f11cb4cea1dfa7b7f8f87bf526422c6f414443990019137864d4214c8190744b
// input: apps/web/app/(main)/en/use-cases/ai-marketing/page.tsx 3de53fd6c61ecf4558d29294f0560dc26829df63e4113885882a967157e6b9b3
// input: apps/web/app/(main)/en/use-cases/ai-research/page.tsx 168897a4324cfed727681121f3c87ae337c18e03a166dce8d3e653daf12c0e64
// input: apps/web/app/(main)/en/use-cases/ai-translation/page.tsx d2091dad5c3ff2a66afeaa3f78a895363ab82c1f54e8bbe16104c93165977785
// input: apps/web/app/(main)/enterprise/inquiry/page.tsx aa20b6854cdfc1f1f0f2614c4b5e3e21eaba22a79345ba034c58b3f110901353
// input: apps/web/app/(main)/enterprise/page.tsx e92a22969539402162bd1794714526c8d2c5e84cad577a2d26bc1ab7a35a86f9
// input: apps/web/app/(main)/exam/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/exam/[id]/result/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/exam/page.tsx 6abbd26643c8a43cabfea391fc31615e638edd60dc7355dcae6f2e54f19476c8
// input: apps/web/app/(main)/exam/wrong-questions/page.tsx ea1343d9e3dc2a832e23783d24eed974b73c861e696f62e55629127cf578fa99
// input: apps/web/app/(main)/faq/page.tsx 340204418a12d33f01f6b30c7e8f7eb3ee65729d4a4484c5dc083a92a8e7e29d
// input: apps/web/app/(main)/favorites/page.tsx 5eff3fb87e1df3741df0a90ab44c9806a8c2991bf4b64873dc42f3fced056282
// input: apps/web/app/(main)/feature-center/agents/page.tsx fcf5e297611b6b02765b613931396c9b9665cb1028b13dcc5094cafffe38f7c2
// input: apps/web/app/(main)/feature-center/apis/page.tsx ad0b4eb11e49bc4fc494ec3840904d80b2bac3d3bec78cd6ba0eef9c786ad8a6
// input: apps/web/app/(main)/feature-center/documents/page.tsx 2ce7e67ef26bea8de23d91e16ce1a2cdc5102ae31a299a70947980857d530336
// input: apps/web/app/(main)/feature-center/models/page.tsx c7dea6c91b30310fd646b881e7ffec4ce0af71f4e8fb725e83eee8dadb32d5ee
// input: apps/web/app/(main)/feature-center/page.tsx 2064f0bb331f531664cbcb14365dc26f6e961db5cf3dbc9d315ef67e8074690b
// input: apps/web/app/(main)/feature-center/sdks/page.tsx fdd8f6d0b5fe6c3c837d55b355d9fa344dc6344c648c2f042ece9fef5038a233
// input: apps/web/app/(main)/feedback/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/feedback/page.tsx 7097369f5667c53760ace0f24217931d622accf029a2692fa0881a7fdef71afd
// input: apps/web/app/(main)/figma-import/page.tsx d6653db3af379e18150fb1af11b2fd206adc57ddca97c24cc696dcae363248af
// input: apps/web/app/(main)/following/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/free-ai/page.tsx 14251afe2b1cbca09b1bd672b0d3d4283992db241dbd30d8075e0418c6bc0edd
// input: apps/web/app/(main)/fund-data/page.tsx 033bb1e807cc4562842b3730379669c4667be02892e8a8918bcf271e5a9d1b5d
// input: apps/web/app/(main)/groups/page.tsx e46c60d7b6323ce0495d14798503e046c0dd008a849fc206513d7038f65f7e1c
// input: apps/web/app/(main)/help/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/help/page.tsx 4370d4fc0dd52979aba66475b78c2977faf15a95a1f0f3ff016ce49bcbf0da74
// input: apps/web/app/(main)/home/page.tsx c363a3b298783696813c1ff6c01ea43d10ac6a57a18ffeb7a2aabf1356e1c93a
// input: apps/web/app/(main)/hooks/page.tsx c7aed66054b4f50815c7b49434e711bb1b5049c02878b5f1521d6499f663936e
// input: apps/web/app/(main)/image-gen/favorites/page.tsx 1ab67ba946ceb7efd7d33cc0913e81905ae80560bc8d245b4a2d5b88ee621f25
// input: apps/web/app/(main)/image-gen/gallery/page.tsx 0e9d76d474b106f3b3bc99f91001e4cefab09b3f25c5f0dd22d451c60b46bc5c
// input: apps/web/app/(main)/image-gen/history/page.tsx c4136779743012d7df8aada1f724ac55955266bf85b67265be4f406143332a27
// input: apps/web/app/(main)/image-gen/page.tsx f2af7602a8c9eba074ff6880e9e7790ec711ce10260284e7b397a648aa368809
// input: apps/web/app/(main)/image-gen/templates/page.tsx cf9fed1e7716be5e661739f83505e24a34552ccf41bbf2aa2df71630a15abbb8
// input: apps/web/app/(main)/invitations/page.tsx 3a3b3d29509b6d86421b1490332549a432dbe7889c1a2547f282519b1b181039
// input: apps/web/app/(main)/invoices/page.tsx 308d4d880f67fd68329aacc33fdfad1a34d6c37fc67b75b69dd9669ccf1a54be
// input: apps/web/app/(main)/ja/use-cases/ai-design/page.tsx 5b70eb6c2bf324f4d0054cab0cc43a7542496f8a675acf946d5344c33cd70a65
// input: apps/web/app/(main)/ja/use-cases/ai-edu/page.tsx 4f446a9acc8e5a97d82ef23555b51cfd0163ed257c8ee6fd689a0d50a9a13151
// input: apps/web/app/(main)/ja/use-cases/ai-marketing/page.tsx 12c79eab610123f999165fa959bd0ed6ae21f06e3f5416e8546d9eea5eecabc6
// input: apps/web/app/(main)/ja/use-cases/ai-research/page.tsx 633577de5bfb4e3cbf713ae82ab98a0bad96d830d99fce01058d813d57713f41
// input: apps/web/app/(main)/ja/use-cases/ai-translation/page.tsx fd0669f0af318322c5bcf881eebbef1268e0e6b2f312d4d83ad9c4453b7e6723
// input: apps/web/app/(main)/knowledge-base/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-base/edit/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-base/edit/page.tsx f4b8aa9c7040edc24aec7fa9045693eee0a9ee6582b1f7dd0fe1941f5d81eabd
// input: apps/web/app/(main)/knowledge-base/page.tsx f6806ee60537bd39671f905b3171c899e396efbfda870dad928109339179efb1
// input: apps/web/app/(main)/knowledge-base/search/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/knowledge-cards/page.tsx d3f12a4bdc8c933436572ceb89f9ef6c222b8c283366cb5007e153eab2ac57fd
// input: apps/web/app/(main)/knowledge-graph/page.tsx 7b5c4463de09d56eee2549ee0581651e3470014c16caadd87f8735822dd3b732
// input: apps/web/app/(main)/knowledge-planet/page.tsx d7d6f350ffb218bc15e6a198132753fbf4575260cc820d3f664367b178dce9a0
// input: apps/web/app/(main)/knowledge-rag/[id]/chunks/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-rag/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/knowledge-rag/manage/page.tsx 7b33dd453831f3cdcf43f3926665855d38f81a46718e31dfff1acafb15913a16
// input: apps/web/app/(main)/knowledge-rag/page.tsx 6dfc4d7cc321632603972c3204042ba467caa290660e748886d9ef5166c8843c
// input: apps/web/app/(main)/knowledge/page.tsx 6b1f20d5928c23db671cd532beb1209888dab8d135ddb11c8e53b559e5ac213d
// input: apps/web/app/(main)/ko/use-cases/ai-design/page.tsx 6b6b80e1394a464baad24d71230f60a8fbb0e304be25fa4a76dae49f33f67d02
// input: apps/web/app/(main)/ko/use-cases/ai-edu/page.tsx 1c011205f154faf88acd19c72aff671c7481369d17121c6fb626105dcfc0857d
// input: apps/web/app/(main)/ko/use-cases/ai-marketing/page.tsx 615b0c311219c37010683aa0685d590889dbc84a663cc6cc37d991f1221091dc
// input: apps/web/app/(main)/ko/use-cases/ai-research/page.tsx 08c4dcdffd60f576cccea04b767fabc196b248ca3deaf237d054906a8c0d4d18
// input: apps/web/app/(main)/ko/use-cases/ai-translation/page.tsx c0464d4b94e5ff3137ce1edd3dc77917165a17d1948cc40eb69335f45358dc90
// input: apps/web/app/(main)/learn/[id]/homework/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/[id]/rate/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/buyconfirm/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/learn/map/page.tsx 3c93920aba6547e3df75c82b7c7bb33946f97bbb6383158299f4862950445581
// input: apps/web/app/(main)/learn/page.tsx 58f9ab4a39f02807b6f44c197dd4d83be386d06e0488ec5adebd2b0bec4c751c
// input: apps/web/app/(main)/learn/payment/confirm/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/learn/review/page.tsx f7288ca41e4b001c44931a920978a8758b8d70de03560ecc2142335a6b0cc1ff
// input: apps/web/app/(main)/learn/topic/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/learn/topic/page.tsx 66995cc1cb9fd30fd5b9b09fd277b28b3aa68c01b7bc0865f4160d13d205dcbb
// input: apps/web/app/(main)/lecturers/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/lecturers/page.tsx 6fd738a01dc9b50b175af6b117b7122629fac14ccfd9b50e9c201c84fc5c82d2
// input: apps/web/app/(main)/legal/service-specific-terms/page.tsx 12e032225aa329936abea7f030ba3179cb46b1b3ee15c5167386e0af3c3f64ce
// input: apps/web/app/(main)/legal/supported-regions/page.tsx 87f20f60a7a5ba45a1598512f3f1b3704022f2f5a91c5a4c5ce0a0521bcf7351
// input: apps/web/app/(main)/legal/terms/page.tsx 6d65e9d26ec02489a1101836f82101778028173d87c5937fc431280c07aa2bb8
// input: apps/web/app/(main)/legal/usage-policy/page.tsx f77bd29a0903e201d29aed51f3cad181715e04efb9b2dd0755a89d22e3473a2f
// input: apps/web/app/(main)/letters/page.tsx ed2477bd625fd17e4ae1220706f128bbd86aacca7097bc727de84f786ffc66a0
// input: apps/web/app/(main)/live/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/live/[id]/play/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/live/host/page.tsx 4f27da93ae356cb700ae774ad1ec64e18bee488fe7e30d0d12d4ed03b5b836ca
// input: apps/web/app/(main)/live/page.tsx c421590b2b980c743051924764012eee60657bccaa9a5cae4f861d5b9928e63e
// input: apps/web/app/(main)/mcp-projects/page.tsx 8083d86a1ffdc43d0480d154482c92eeb73b0ea5ca834c4ff5d3811cc1194eca
// input: apps/web/app/(main)/mcp-store/page.tsx 3801930b21799b9b5fdfda53588178b765ed08d5dcf53aedd69fa6f0591fae38
// input: apps/web/app/(main)/media-tasks/page.tsx b592f4faf4c9f3748d193d90091b61c23c9032735f69537a2a2f8f7a975d6327
// input: apps/web/app/(main)/member/addresses/page.tsx 5c4777dc192b103939518a648d6035103517c3a147a33ed999178092308787b9
// input: apps/web/app/(main)/member/benefits/page.tsx cd1766ba7a5a826a3eaadc3023486aeacd1ab5e2e1a84aa786932a4ed5533f9c
// input: apps/web/app/(main)/member/coupons/page.tsx ac4dc3edd867f06bb7b2753980ae79281e072bedbcb6174b71dc51b5bd462c57
// input: apps/web/app/(main)/member/dashboard/page.tsx b55c1372d8613a6bfa5cd5dcb67609b418cd1c1694af8ba89a337af89ff5188e
// input: apps/web/app/(main)/member/exam/record/page.tsx 67ae42947953fe6f6b54224c1d173327374fa1cad697692fca94a9f8e8ec3b77
// input: apps/web/app/(main)/member/exam/sign-up/page.tsx 7bfe664201258f9a1e51f5931e956eddb6c51a4e7abe7fc0a2c4ebfc81c768ed
// input: apps/web/app/(main)/member/favorites/page.tsx 9e0eb270d8e97ff6ba65cf6c6f1ae36f68ca9888466db6f91213fc9a31915bc4
// input: apps/web/app/(main)/member/feedback/page.tsx 1c8a1883d594d7943038d70e0e86c6cd2fb18a1978c57b91d9a678f7f287cf94
// input: apps/web/app/(main)/member/help/page.tsx 6da0d5907cd7b02fd1d4a07226c2db0de82dfb579d67cd1734a9d0e11e5c40a8
// input: apps/web/app/(main)/member/history/page.tsx 45e310fe6d68863382cd8e94519496dcf104114bb3afdeb1f5101faf9e01978b
// input: apps/web/app/(main)/member/page.tsx 2ec34f6d459cd8edd9922fe77f8e3564dc33c57e44abc0508bdc5a724afa498e
// input: apps/web/app/(main)/member/settings/page.tsx 3f2503563f930ae7b7f4209dcb66511887a99649add7a63cfa5d470ab88e2ac2
// input: apps/web/app/(main)/member/subscription/page.tsx c84ffd618b0969d4c9d4c1f5f895e171e2aabb5af3fd4f7f1745326748b16481
// input: apps/web/app/(main)/members/page.tsx cf8b5291eb01c73def32e6cff0eea7a9e8579bc4582d1f04c671aab8f7db5329
// input: apps/web/app/(main)/memory-manager/page.tsx 1342cf77800d7c92d8b0aa8a7428ea1a52c6aa73dcc732011b5d482cb9edd82e
// input: apps/web/app/(main)/memory/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/memory/new/page.tsx 890f7e4951858962b7dc5a216d0f20d83a2ba1e887db6b4fd460675a40b02c77
// input: apps/web/app/(main)/memory/page.tsx f3ffd9c643de7b8a93b18efe6f3069b679804ad7479627735579ca43bb5c6d3d
// input: apps/web/app/(main)/memory/scope/[scope]/page.tsx d3cf5def475b03c0fd96f57fa00a6557e248e9439786c0875dad1c82b69d41fa
// input: apps/web/app/(main)/messages/[type]/page.tsx 2fdfa2b9b1de35ab72faab4733c4743b37f0845e976b32661cfc06d5e85159db
// input: apps/web/app/(main)/messages/page.tsx 99330cdb8f783573854dc167c8b6e8f9c2b730cebc14844b3c49e988f9998f1b
// input: apps/web/app/(main)/mobile-dashboard/page.tsx f842ccb24512e07fcec014c94c08af18d0eeb34b699579956b0202688479c55d
// input: apps/web/app/(main)/models-pricing/page.tsx d52e3cbdfd30d7d66fcdd54ea0e4b6a277874fff8c29467374fe50011468b3ea
// input: apps/web/app/(main)/models/api-docs/page.tsx a64c8cd0700bb5e1ce319803ca965ad415026618ca5f564c6f097cfd2260eb96
// input: apps/web/app/(main)/models/billing/page.tsx e4850285dc9d269cdb5ec4db67ef8bf61fa6e85dd9516e7810bed61c6b22b61b
// input: apps/web/app/(main)/models/channels/page.tsx 594ff458d743e9332b9b904df359a6edae2ca93c0b9b46f57432bc11d1e2272f
// input: apps/web/app/(main)/models/chats/page.tsx b4a216a92e8200bc36be31cde9f0f78e5771c94e00eca0fc0e9d2099c5ced5c6
// input: apps/web/app/(main)/models/contact/page.tsx 6c6b69d8252c3297e0e9ef79bdee24601809edb39e26491b2cc5c5dfc82c852a
// input: apps/web/app/(main)/models/eval/page.tsx e8a76194d274fe5d61c7f11f575b55baf8264cff2058a3645b570e7c95a6aad6
// input: apps/web/app/(main)/models/groups/page.tsx 35b16db05d8be703bfb569f6c9ca68521e25b42b1ec573375e9d4a50c979fbe8
// input: apps/web/app/(main)/models/keys/page.tsx abdeabe644a8fee560ebb32b2b460d9d1098d776b771fbb8dface58431113b83
// input: apps/web/app/(main)/models/logs/page.tsx 3f8cfef85e1d26c0a4acac4d0ebc4862226d63c2bb6eef198ff4da057186c8a2
// input: apps/web/app/(main)/models/openclaw/page.tsx 384f46dd2911f775ff384f321402210789b4fc681e2dd32b8a91bba0fed6ea42
// input: apps/web/app/(main)/models/overview/page.tsx 491999893f6c73b07c2cda07e37d7d9ee55b0aef909fdca1f5e5b28a4f256a4c
// input: apps/web/app/(main)/models/page.tsx 5a4e9722c8358f30a37324c373fadcdc5121019f3eca7f2aa587006928f3c1f6
// input: apps/web/app/(main)/models/prompts/page.tsx f49a0c3410e7489a39948b4089e02f9fa26e2ec85ad19e6df7475e87a91da389
// input: apps/web/app/(main)/models/redeem/page.tsx 2d991a00d624b20e55bd43beefe8f80d071a52e4152310798cff6a176814ddf8
// input: apps/web/app/(main)/models/referral/page.tsx cecc531eb978371fc8eb696cd0697d2425e0edee1ae167fa71c51ae5908217ac
// input: apps/web/app/(main)/models/skills/page.tsx 3b3d2dfe88e0bc9dc60ca667becd727489c1c90b112727744d653b24113f29ad
// input: apps/web/app/(main)/models/trajectory/page.tsx cdcd5e20e331d71700f14a3955cc512279e21563362f9c052d7934b3a360a871
// input: apps/web/app/(main)/models/usage/page.tsx 01a885b1b795200fd02f3ee2f5d1a8e9e636ca909a75bd3134e0b6d2e707e118
// input: apps/web/app/(main)/models/users/page.tsx ca7ee659af729e3ce6961968c5e690e8ed719b3720b6693c3c96a0f6adc5d2c0
// input: apps/web/app/(main)/n8n-agents/page.tsx 91b67732e59ef45dbff03b7c8fdad96aba3ffa12b313c81d9ebbf746322e3689
// input: apps/web/app/(main)/news/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/news/category/[id]/page.tsx 9a4a74a52e0389d02f9c16d560907b2ba26abd2591906028fe504fbad9b58ccd
// input: apps/web/app/(main)/news/page.tsx 9dbb7eeb354b0b2c4224fd9e59ed3348b7e6e6a231a39cb278400fdaea3f2720
// input: apps/web/app/(main)/newsletter/page.tsx cdba2b84b0d8d5fb0819ab75d90ff7f6483e66c9e333899f77dea5a129224d67
// input: apps/web/app/(main)/notifications/page.tsx 4345ec02b643554779d349c394f7bd2bc2689f1d671c0475ab9e5042d5564d2a
// input: apps/web/app/(main)/oauth/authorize/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/oauth/my-authorized/page.tsx bf915d4a1b8cffc41a02b2124069e81d8bad43b539be59c77b7ecd20b41af4d8
// input: apps/web/app/(main)/oauth/platform/page.tsx efa4e96b4301a9a16b1596a63f80c188bf97695c4ecc8c02dceb19ac1928785c
// input: apps/web/app/(main)/onboarding/page.tsx 8bed00996fb14cbe15f14d62b6cdb6a962c548287e4896677ffc40ed4fc0a14f
// input: apps/web/app/(main)/openclaw/page.tsx 09621ac592dd05a7df697c55d1368ec1c1fc85b228c5e1ec5092e32dd3a1936f
// input: apps/web/app/(main)/orchestration/page.tsx b23016ac677361689828e235b14bf8b449514c0a4782d51aa5a290dfa499e3d9
// input: apps/web/app/(main)/orders/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/orders/page.tsx 36a6699dd167dfc4397af0ee881c61a0f2343a2b242001e54bfd52985625552d
// input: apps/web/app/(main)/patrol/page.tsx cc7d33fce8f837d62a86461bd683088062cf5aaaf3b677ba9573e9ef37e6b833
// input: apps/web/app/(main)/payment/checkout/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/payment/page.tsx 2be738728f32d6ccac5c01e8490172de76b7bee6cdd26e13d250ce8fc0fe917f
// input: apps/web/app/(main)/personas/page.tsx 3f185537f0fbf9bc32a7d87529e8ee7e6da2fb211292dc6239398695a92d9e34
// input: apps/web/app/(main)/plan/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/plan/new/page.tsx 7617ebc7420477c8b8354f1c55aab2cfa2231d74bf65a1994864ab9aebfb767f
// input: apps/web/app/(main)/plan/page.tsx 6b5c0e0924816b0ace0bf2b02ad06e59cd9582d52eccf78b8dc4f2176c46e0a8
// input: apps/web/app/(main)/play-beta/page.tsx 782878ccc647def051105b9ac08b7fc6a2c19607d43115ab7b792c0df2c9fddf
// input: apps/web/app/(main)/playground/page.tsx 3f172bb9aaf31d8279a914f137ce54d36e2714bd075140093dbf01d3f56b58ab
// input: apps/web/app/(main)/plaza/new/page.tsx a2e5e81722d99ebc2549c39c8482e17bf31dbf527462ffcf21a37165b12fefa8
// input: apps/web/app/(main)/plaza/page.tsx 7646688c9b22bbc29283a41c136cd55162c7bc1c82e0809ac8bafe1a75451148
// input: apps/web/app/(main)/plugins/page.tsx 0b25fee793225c2a5228e7cab6a1cd54759d01f0ee0cadae2e832d52f72b972b
// input: apps/web/app/(main)/points/mall/page.tsx e8e52d09b50fa2637e20b01ad45a0f4ce93ec30fa07e5132a777df72cd6fa16c
// input: apps/web/app/(main)/points/page.tsx 72a0f6f160685eb613cd3b274ed85dcb490aab414e6835e0f3afdd1c198bd82b
// input: apps/web/app/(main)/points/sign-in/page.tsx aaa6aeaf861bf192dcfedb7c81079489c52f100bd59c116434330c34f630aa4e
// input: apps/web/app/(main)/points/tasks/page.tsx 77cfbf214a3f6e31bda377383cf4b7f5b146983ca5e7c07c0eb268ad65872b1b
// input: apps/web/app/(main)/pricing/page.tsx 0a1c3717f2391db2cc15487136f202ec89b2a8366aceed099f40d0567d45f3d1
// input: apps/web/app/(main)/products/page.tsx bca2f8e745373d271291e554192cd1728570e61ba957c65a3ea48893a687b6e3
// input: apps/web/app/(main)/publish/accounts/page.tsx 5c3305bf11b2657e61d0f17baae1776b385e77cd4009769880a9734ee062b789
// input: apps/web/app/(main)/publish/analytics/page.tsx a70391b061c820faab68ce4fcaba8f6bef980edc83c45351c8669efa223e59a2
// input: apps/web/app/(main)/publish/calendar/page.tsx 5ac9cd0aa833dfc8f7c957368a8f1ce19ebf9f17d5bdae8a3331fa3cb5ea309d
// input: apps/web/app/(main)/publish/history/page.tsx e7afca22d441d4ee6d133326e84f4c9cedc7810f794fe5744566b4ba3a02a1fc
// input: apps/web/app/(main)/publish/monitor/page.tsx 09094aacb740c459727a649b41a200c5ddd4de834e2a389214e4988bed6ddba8
// input: apps/web/app/(main)/publish/new/page.tsx 5865f7c704da5c4be7a71bd2d7f421b91109529b129f2c179667b8375f73f48a
// input: apps/web/app/(main)/publish/page.tsx c8db96a527dec17f81d00d0195ba83a0170b7ef84bc975fb318ec5f98ff384cc
// input: apps/web/app/(main)/purchase/page.tsx 9b9037ab03cbfdad16c70fbc52f51f7030a69d6b495c8eeb7b35eb5fe0765d5d
// input: apps/web/app/(main)/qoder-reset/page.tsx 558764f5ce3f53acc6cea1d4b2f10aab530fff8b82bc5b51b6a3e253587f91c3
// input: apps/web/app/(main)/ranking/page.tsx 910974576ec729b0a2ff5e3f79882953043c8799317f4c00fb6d114dbd9bb1f2
// input: apps/web/app/(main)/recruitment/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/recruitment/page.tsx b8bbaa178d862db01eb6d53450d13ecd6387e4fdbe3887c8e63daf8611e9c8a7
// input: apps/web/app/(main)/refund/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/refund/page.tsx 880c442b9d426ee552adfc48d5a9835df8b92ee9e6416da4a45c433d48e5811e
// input: apps/web/app/(main)/registry/page.tsx fab313d84c755eb9c7a3ebdda0ce2005cfd715ff08cb308cbca381cbc6aaf7a8
// input: apps/web/app/(main)/repo-wiki/page.tsx 135a12a29f60dfcf1e0b15d8ce4d4fbd5ab39776fe9768f2895a915c821919ac
// input: apps/web/app/(main)/resources/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/resources/affiliates/page.tsx 6ee0101f481fe2082729a14b5773d16413f70a44ea2d11bc3f784f6de5a728bd
// input: apps/web/app/(main)/resources/edit/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/resources/page.tsx d0905fd34dd83f896fa6e0e52c16c9caa6ed981b286bbc31f71ec5b5c9835482
// input: apps/web/app/(main)/rules/page.tsx c91579782d967f90834a1a7e0332ce8333630883097a7bf96957514388a1ed86
// input: apps/web/app/(main)/schedule/page.tsx 2df5946914fedb465e9aa0516f1c49c81f4e45bd506f95ac34fea9e1a703d47d
// input: apps/web/app/(main)/search/history/page.tsx 181c0c24fb8f670f12a4216041acbd505ac241f00e03b1ed6e2d61a573302250
// input: apps/web/app/(main)/search/page.tsx 9a7d108bde44eb18b8fb896ce95e07c3b72268adfa49fe83f076006e98b99d01
// input: apps/web/app/(main)/security-audit/page.tsx 1dbe06b3b3977f546934d4c08d460e02f10d6b60cd8b5229e34bfd31fd0a3ec1
// input: apps/web/app/(main)/self-healing/page.tsx 1b35d1e959d551f87f322b97b373533b641a88c253e6f8155c5653482c254cca
// input: apps/web/app/(main)/self-media/automation/page.tsx 93a12879f78d9e06683eec0c22df6d9389016a27cf9fa1d3e69ddc275cf85849
// input: apps/web/app/(main)/self-media/koubo/page.tsx 707cae7068587c0103d80cc66ceae269b5bb327d69baee9ef46e7f388652bf11
// input: apps/web/app/(main)/self-media/wechat/page.tsx b816530dcf9403c890aedd4cf35e321dd23d70e6b68f094883f92c52adeaa327
// input: apps/web/app/(main)/services/page.tsx b54ca5c46d6700ea0fd78c5cac5efde5d04098a2be51feba7d745667d6dc7c8b
// input: apps/web/app/(main)/settings/account-deletion/page.tsx 6c4aa17e8f506c1adbb4b6fa0d934080fa44d1df02d0b532431825ee1597b957
// input: apps/web/app/(main)/settings/activity/page.tsx ecdd3da8263fec84e4af6e2e3c920c8a44f64840ac149d6a87c8618a8aee5f07
// input: apps/web/app/(main)/settings/agent-security/page.tsx 7449766635aa73c54ecea91619046d2f37e3a33f47e67b71c1e6c161efcee1fd
// input: apps/web/app/(main)/settings/api-keys/page.tsx ad7c6159f7078d46ef0685de35b247d26bb2aa0c00ab545beda48036890d3ace
// input: apps/web/app/(main)/settings/authorizations/page.tsx 6f1cd1d5f8b4b5cd568bea2eaf3fb4632b16a4bd810f137a6a1742e1046474d2
// input: apps/web/app/(main)/settings/billing/page.tsx eb86dd046bb501c3f0e48d1c2e99257f1e6f0ba07c1947a0d4408bb3555be63d
// input: apps/web/app/(main)/settings/connected-accounts/page.tsx 211e6860f6e7c08e5b3ed1343b9f0709615977b45a887c09a4ace886b41c4d7f
// input: apps/web/app/(main)/settings/dashboard/page.tsx 057e07c075b141dd578c0f501d8144fee277673c3ef3bc838adafc76136bcaf6
// input: apps/web/app/(main)/settings/data-export/page.tsx 38e647cd78fef34ee35b10f80871c1b29aa03518abf74a90822511b9fc071929
// input: apps/web/app/(main)/settings/data-rights/page.tsx d886e64627e16e935e7f4c66daf8850c583c487e65219e6d46bae81a4a6f6e82
// input: apps/web/app/(main)/settings/devices/page.tsx 4ae43184add3d60882889ca4c571c114ffb77ef8c71f81ba7ed2166b0b548da4
// input: apps/web/app/(main)/settings/gateway/page.tsx 4eef35b03c2dbdef89ee8baff5d817d53877f8ba5b13218e177ea03a6fd1049e
// input: apps/web/app/(main)/settings/icp-record/page.tsx cc68380491e8e599eafb7db3e8fe5eb8c4c7cf82bf6bdd023cf7e80b029b0c6a
// input: apps/web/app/(main)/settings/import/page.tsx 2819f5127642ebca6e9785992ac7065a4806039502320dca4ff2df5c48796d1f
// input: apps/web/app/(main)/settings/llm/page.tsx 33971a847f01d8bdf10692af698fe91335feac6e9ed338a50d259cc3d29ace13
// input: apps/web/app/(main)/settings/login-security/page.tsx 10d923762ae80c83ad25b1471e24c833c8afe3145c2a352515dd2a0f88dc0b9f
// input: apps/web/app/(main)/settings/model-record/page.tsx 14fbf795ca1be17902174485c347fbd5a968c8fef2c7e0a6f9f51f0f90cbabbc
// input: apps/web/app/(main)/settings/notifications/page.tsx 83136828fdbaa83e47607450495a122724d3a25dc74d41434986883e34aced9c
// input: apps/web/app/(main)/settings/page.tsx cd858cf8ddf233183ee7ac6eb877f7987436aed3099e0a34a92f6c0a7e867f27
// input: apps/web/app/(main)/settings/preferences/page.tsx 970916781a4b27dd41381177dbf03d5faae577d558cf48e353121629708d324d
// input: apps/web/app/(main)/settings/privacy/page.tsx 06b9f0ede0882debe55e5d8beb001f35ac6062b0588c9c1b565250a84351e612
// input: apps/web/app/(main)/settings/security-log/page.tsx 4c96bf75d4514595393c5def12f5dfdc61d9d6e7fd02a1fc87be9fb004907c5f
// input: apps/web/app/(main)/settings/usage/page.tsx 5e3943aa3ba757982fbc9aa50695d5de834d204e622ad921de13989a1ed3c8fa
// input: apps/web/app/(main)/share/[code]/page.tsx 167c448e4b4a8fc29be5687451d9507f01ee71ce9633cc34fae01875dea45992
// input: apps/web/app/(main)/share/page.tsx d5df784435de4fdc6af70d10d3c1dedeaa4359289d56e9d4da7778f0acddb552
// input: apps/web/app/(main)/skills-market/[id]/page.tsx 22c9297245a249350e204aacc1e1e978198704afda124abd0e11d6e06c91f8f9
// input: apps/web/app/(main)/skills-market/page.tsx a766040ff3b687a5a3d7149bfcc1290d96559d2472a5240a23e5bd2b134ba600
// input: apps/web/app/(main)/skills/market/page.tsx 539be904f0f01657b359b047c3b3e473ab378c02ee50a8bf5f5765f19c05a2dc
// input: apps/web/app/(main)/skills/page.tsx 38765932b5d79e111a9d91fa22317363d4be64742dd17ae1e1d012e9cd098f40
// input: apps/web/app/(main)/spec/[id]/page.tsx aa87c22226e7b4f4618429c44041536bd60b8774b1a7109580b93eadb0363876
// input: apps/web/app/(main)/spec/generate/page.tsx cd1bb7ebbefc82cd11e92d59cafd9318ba7fd8b9fd569445af6f2403391e1e83
// input: apps/web/app/(main)/spec/page.tsx 9d45e9f13c6c6a289c5359613c83cf16aa54d96291cce4b748ca28c26d6facd7
// input: apps/web/app/(main)/spec/templates/page.tsx a793a4ac9c2b9df741477726e7dc6f807813674581930cbead6e876bf14ffdef
// input: apps/web/app/(main)/sponsor/page.tsx e1d0251b33321dc4220e68baad4ac5a70aff6eff218c8a4fa22c42412098556d
// input: apps/web/app/(main)/stock/page.tsx c2ac1bbe3643eca521253f73acab3e0af6107f925162b53f466463c772bc1556
// input: apps/web/app/(main)/student/certificates/page.tsx 6f5d6aec8732889639577c6ffcd7971727ec3323ef00bccf082ee360e8feba13
// input: apps/web/app/(main)/student/my-articles/page.tsx 3b7dfb9453cc0f5afc6abf5b73533daf4b10b354aa88b9fd3b484245a71e094d
// input: apps/web/app/(main)/student/my-asks/page.tsx dc6e3703abe48031412ec5fa7aa90a44912d758bc7c44fdf11e175bc99c9866d
// input: apps/web/app/(main)/student/my-circles/page.tsx 6675905d9374734967f7e7a215bf6a239b966c7c3159e2f2c2c4ceae272ecd4a
// input: apps/web/app/(main)/student/my-comments/page.tsx 5cedb1e79eed69b48931a5f3314259246302550fb4388c049609dd04e7ee7b97
// input: apps/web/app/(main)/student/my-lessons/page.tsx beb5da048e0f66d7e0d8a5f1e8baaf5f798536465ae627e620be6d347b3b2314
// input: apps/web/app/(main)/student/my-resources/page.tsx 20b45317fc3c1441d5afa89ec8866be1dac57be28cf7734285a4fc41d33fe271
// input: apps/web/app/(main)/student/notes/page.tsx b944b6dcebf12c3fc37e8b23994e01fa47f6ad36fe0ac7c91ae929e4083e4612
// input: apps/web/app/(main)/student/offline-records/page.tsx db45d1270c099299526b0982da2f4ecf2661d27d7a5c07e64457167f3c57f381
// input: apps/web/app/(main)/student/page.tsx cd235f467f142e7273ae249b6b0e7974ae98eb0cf3c968fb32f7a7f8365cf52b
// input: apps/web/app/(main)/student/papers/page.tsx b381dbc17567bd2ae6978826cebe1774bd03b25fe2de1b0de71f144fc15c1e6b
// input: apps/web/app/(main)/student/wrong-book/page.tsx ea14ea3ead83719b28002402f0c931af710456767a5a84de0936b5717336318c
// input: apps/web/app/(main)/subagents/detail/page.tsx 67bd2d0c222fa08a830ac3af06e599b5b08194699537fa4d87e95935747bc111
// input: apps/web/app/(main)/subagents/dispatch/page.tsx 6088091bc625e20be10fbb97543bb4fbd39a28d0e60d830c8fbf398c99b59a8f
// input: apps/web/app/(main)/subagents/page.tsx 4dc9115599ea436c22a42726c3363283604893373448af51089a0644913ca00e
// input: apps/web/app/(main)/subagents/topology/page.tsx eed3b754d236397235cb4681489b790b787af6881b742cf4543e7f4205c45a87
// input: apps/web/app/(main)/subscriptions/page.tsx ee6e0b8ce6dfb5044fb685945511466ec3911f4686ac8e3de19553c92897c2fd
// input: apps/web/app/(main)/support/page.tsx eb539833aa4774f8c7bb1dfdeccf5cbd39bb14394102f0aa90a8789704088936
// input: apps/web/app/(main)/tags/[slug]/page.tsx 93876ba68f8766c29fc1a08ffad8b2275c8bd4c1a93e8eb39c557ade8c4c7336
// input: apps/web/app/(main)/tags/page.tsx 012f25e5004149e34c34d27c043ad59d17784996996e023fa807a2b333e79bab
// input: apps/web/app/(main)/task-receiver/page.tsx d2f7ec24e0bcc2e4290862e6e996b4e4ea9c9a632e5cc9839b542a31089f718f
// input: apps/web/app/(main)/team-knowledge/page.tsx e689d8c4eb1663caf966de7bde6334ef0cadcab7f4548525573c1c51dba040f3
// input: apps/web/app/(main)/team-memory/page.tsx f1acb9890fbb698978efaa3409a18f2d215abf8685cc2960b03f53655617cc6b
// input: apps/web/app/(main)/teams/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/teams/page.tsx 90ce699f2032870fa96f47df307b5a1e66571c2425598c9f4e19fb6a5e9cdbc8
// input: apps/web/app/(main)/token-value/page.tsx 0b0b90dac22c67f77026897fdfe6acdd8ff8d6cd99c106e9e4a3b4ced820c175
// input: apps/web/app/(main)/tools/page.tsx 6eb6956c3c230458da3bc98162a75e36f263f85a77c74c9b7bf1d185eb056950
// input: apps/web/app/(main)/tools/pdf/convert/page.tsx 896416df7082843b3e8d235c7602e745403fbe2082b87a0641ab5c583f8e8ab6
// input: apps/web/app/(main)/tools/pdf/merge/page.tsx 85a41758770c58853fded816e0d9432756b5f7d96d6c06449320a5a10021efb5
// input: apps/web/app/(main)/tools/pdf/page.tsx baffccb6e00474cbe4d6642ae4d31d9855444368ff77ff4395fe7adb3b4db4fb
// input: apps/web/app/(main)/tools/pdf/split/page.tsx c98aabd570ae469a454eddc9d091a47ee81442bf7213dd2cc334e80fe4c7e394
// input: apps/web/app/(main)/tools/pdf/watermark/page.tsx e1eedf45077e5a2d472c076d15ad74d98d952d64393d8f08a04720e3c8b1f332
// input: apps/web/app/(main)/tools/voice-stt/page.tsx 100d889cc5a24a158492ee3b0c8c7608aac81e41fdb91cde223f6df255d8fcc7
// input: apps/web/app/(main)/topics/page.tsx f10d53adc363bec3415c3fec05afbc6831e26ad8e0ce26341c5bf37a6c07106f
// input: apps/web/app/(main)/traders/page.tsx dbc893c7ba2dab0d622e120f1603335873f41d6f60e7242cd3f2327d9569afba
// input: apps/web/app/(main)/use-cases/ai-design/page.tsx c32998e9c9e3f4a932252542d1319b283103e5924a449d2ed2af85d99035ec35
// input: apps/web/app/(main)/use-cases/ai-edu/page.tsx f1831a2a508486d6358a48e32949a59ad6de6c9e2b0e128875c249a29f7314a4
// input: apps/web/app/(main)/use-cases/ai-marketing/page.tsx f214f2db1f445a8831d30003ff1c36be982fade9032bfbb9b27f9d1c50e90c9b
// input: apps/web/app/(main)/use-cases/ai-research/page.tsx bc5b5af11f98e48f2545b5bd39ffd2af783b20803219893a1072b87f61476301
// input: apps/web/app/(main)/use-cases/ai-translation/page.tsx 1252e54ecd724c5288a11cc7d37eef959406f42d783482fee49a7dc322e9f72c
// input: apps/web/app/(main)/use-cases/code-assistant/page.tsx 807f10e2e032b92096db24674119d7f6b986515cb478e901eace5252b2cdb3d0
// input: apps/web/app/(main)/use-cases/content-generation/page.tsx 774300a10ff8e5fd66bea169a75b3cc1be0989fbd422e73776048f202e2b8bd6
// input: apps/web/app/(main)/use-cases/customer-support/page.tsx 0c5d38e03a57257117f9979ae2d68680bc68a843850ee17f3e472449e5a29f73
// input: apps/web/app/(main)/use-cases/data-analysis/page.tsx cca987f2f1b6b732c5ce184e7b9ade2e5758675255408a89041ff2373f1ed7a9
// input: apps/web/app/(main)/use-cases/hr-recruiting/page.tsx 83cae7ec5d6e82209d32a85cce48cc99499029bfa7681bc470595cb65f36e14e
// input: apps/web/app/(main)/use-cases/it-ops/page.tsx ce7f9705bde1eeca269168deb91ecfcfccd0d86015846e787f2e49626aec8943
// input: apps/web/app/(main)/use-cases/knowledge-base/page.tsx cf548c1885b98fbf0d57fa5a6fa9b0044ef87f84b4c2de12c74c97e32e361542
// input: apps/web/app/(main)/use-cases/market-analysis/page.tsx a1bd31c6a989e3a3050d440e6a3752c6080111490b843999a0eef1e2489d5d0d
// input: apps/web/app/(main)/use-cases/page.tsx 14be62efae2f55947830952b4e247e0ca8e6d210c943b0c3867c0599b96c2316
// input: apps/web/app/(main)/use-cases/product-analysis/page.tsx 8fbae1cb38dbf60b07fafd3e34fbfd23fe3a37d0eca9c824f7c8fe118446f9aa
// input: apps/web/app/(main)/use-cases/sales/page.tsx 16455b9f7036845aafdd6ccd972a8f522a91a031140d18d633e03ff7c5d7cd39
// input: apps/web/app/(main)/user/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/user/articles/page.tsx d1939eb90e18424436884fae75fb12d0ee9375d9fc31ddabe10f1f4ed868a154
// input: apps/web/app/(main)/user/ask/page.tsx 67d23f15e27467f1ce55c3f4b1256b2be191d4fe86e8a85410f9f1d2b224e983
// input: apps/web/app/(main)/user/circle/page.tsx 9645530c0b3bf616098e63e1c21e0e3b297c0de0a1b95ccc3a91882d4bdaf58f
// input: apps/web/app/(main)/user/comment/page.tsx 57092b1801563cd1f7f3ffa177e521a3a1eb0ff9975a2d6d29e992ef40869cf0
// input: apps/web/app/(main)/user/exam/page.tsx 3d48b81cb664a3c8115ae385b3a61d1dc5077af8d68a88d8c461453cebe1dbb9
// input: apps/web/app/(main)/user/fans/page.tsx b047df6d9e0f52633594f261eedf4c5c66a4ae2a47bc14f064251f8c47794dd2
// input: apps/web/app/(main)/user/follow/page.tsx 66c70dde6065e956ef1c0faf6f0e078da44422ee7ecbc7d31e2cbf65f60414d3
// input: apps/web/app/(main)/user/learn-record/page.tsx 0c99a3720884ded8e8c43f3be636102e664eeaafe1343cb87de37db9c198b322
// input: apps/web/app/(main)/user/page.tsx 90e1734021e341936e8414bbeece0e57c26a418454139749805082f243b1370b
// input: apps/web/app/(main)/user/profile/page.tsx 50d9f39353538bd85d6ae4893d3a4d2b40933df8d92df7e52f95da8a9801b8b7
// input: apps/web/app/(main)/user/qr-code/page.tsx 597695eab437aa44aac5b06ee694b859d14f58a4ba6ff2eda52b76a040fd1f22
// input: apps/web/app/(main)/user/realname/page.tsx ff242b262e357b7dfc46452f037e7b693638564709de386797c3b3fb41c6bfec
// input: apps/web/app/(main)/user/resource/page.tsx 5d4d88b924b4fd37b1b45088c4e4b67e9f131b5e61b3a96f284c28578efb97dc
// input: apps/web/app/(main)/user/security/page.tsx d50691f523947446c88f1b54d13c376d114564873f45a49b754dc5bf716b6a0a
// input: apps/web/app/(main)/user/sign-up/page.tsx 1a5e62af37ed7fe1b76d6678a8d80f40d6b8c475c684b2fc588484f044c2cfe2
// input: apps/web/app/(main)/user/subscription/page.tsx e82ed2968fc94727d99bcf7b29db355eef9f1eeef0d3b2f0f2617d97743b07ef
// input: apps/web/app/(main)/vip/details/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/vip/page.tsx 91a24c9e8c75390ed2a27523380bfa084937ca44714cd2d2433ea602a354c29e
// input: apps/web/app/(main)/vip/trader/page.tsx 18879025a7f8976ccd65f4e01a80210304dce452701e3032e71f61b790d8c2f5
// input: apps/web/app/(main)/voices/page.tsx 7a67602957348c3988afcefebf977cd2bf86510c158e6630ad7593c3b4f19ad6
// input: apps/web/app/(main)/wallet/page.tsx b9bb4c2e07befcb008f1c84ddf56105f02639b6423376164cc01095c0b4ba311
// input: apps/web/app/(main)/wallet/recharge/fail/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/wallet/recharge/page.tsx eafbf6a08d4a1dfacca7d31fc71364e877e8fcc3d8cba876ba79b294ddfdb487
// input: apps/web/app/(main)/wallet/recharge/success/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/(main)/wallet/withdraw/page.tsx 87074b5b3fe61f899129c57b48bc946f42b50e5142e8425d4e31d79573abc4e3
// input: apps/web/app/(main)/wallet/withdraw/records/page.tsx 48774d084a9d8c7f17fadbc2b8e70558653b4dbe1210c24b3e8e5da0737b913e
// input: apps/web/app/(main)/web-tools/page.tsx 35ddee6441ae4f26241a4a3d3cafef7a6e8368ec61ec95fe6ac465b07a62aef3
// input: apps/web/app/(main)/workbuddy-reset/page.tsx 4d1ed62d0c6a5152a9b318b1e043d9b85298ae4c026d2d4a8fa5c1234adba83f
// input: apps/web/app/(main)/workflows/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/workflows/instances/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/workflows/page.tsx 04023d6b22d63b60eceb775e64e213bddfab0a02b4ad697969fb33d9a199ddfe
// input: apps/web/app/(main)/workspace/[id]/page.tsx ed930c0449c1156144740feb073188f994aec8a47595264ce126920f534e594f
// input: apps/web/app/(main)/workspace/page.tsx 71c2ee0cd72da12b3cd4a8effd4aecd42a25651de3f9ad5a0134f274be9cbd6a
// input: apps/web/app/(main)/workspace/permissions/page.tsx 47b5f9a76eadf02e087af7299afa7dffda47f0d3c5edd60922446db016d0794a
// input: apps/web/app/(main)/zh-TW/use-cases/ai-design/page.tsx a6c0294c1e9429a9479e14344de25b7b37a8d3d489a69fa322c6c1aa9be09c6b
// input: apps/web/app/(main)/zh-TW/use-cases/ai-edu/page.tsx 63cb0d1b0e5d600fd1a4664b1557496af42e5243d3f6b9b8fa2651b3e30d912e
// input: apps/web/app/(main)/zh-TW/use-cases/ai-marketing/page.tsx 24d766f2e2502244b55b39778d9d187ad0d89e8431701d3aa00270d9af0ad333
// input: apps/web/app/(main)/zh-TW/use-cases/ai-research/page.tsx 8bffd3724b6fb6b2d2d405fac65b48fe2b8b5d851e4e0b4636ca14b18b2c0cc1
// input: apps/web/app/(main)/zh-TW/use-cases/ai-translation/page.tsx 0e0bc1625a9d5a332ddf09d095a4c12bec9d8e4e01a98046d3ff2827c08dd05d
// input: apps/web/app/(marketing)/page.tsx 8004f807b187bbd827d227e7bc43dff4efd301968e177cfdf807c1d700681c97
// input: apps/web/app/(pilot)/shared-pilot/page.tsx 02826df6073715e3f627280ecf7af5ec12f405452498881153ed8669800080c4
// input: apps/web/app/e2e-harness/markdown-stream/page.tsx bb6709962fc89b42c92d9c1f56750ecdb12a85bac9bd6add9afdfb15c5f22d5f
// input: apps/web/app/en/agents/page.tsx 47c9bf6094d3908577553e726ca5cae71f000092f9efb79787dfdf67da32d605
// input: apps/web/app/en/docs/page.tsx 5405e339218b9237140e47d1966f206e4b8ef9d62eb7add0c98b4e1432dfb983
// input: apps/web/app/en/models/page.tsx 87f9272a83ea3a36fa9db52aa705d9ab28914fc0d32fdc750c4d4db456971d5b
// input: apps/web/app/en/page.tsx 52615d694137ec313d4af2f4b6edea639bd4edd33507fa2278ae0a010b33fb82
// input: apps/web/app/en/pricing/page.tsx cac062ee826a8358ff702e4509b3b948e2fda23df6fe31549abd71bf1124c16a
// input: apps/web/app/forbidden/page.tsx 7e66da391b84e4d0d9f04663f7080dd7ac926b44bd5823780a5e3bd88d9d990f
// input: apps/web/app/h5/share/[code]/page.tsx 167c448e4b4a8fc29be5687451d9507f01ee71ce9633cc34fae01875dea45992
// input: apps/web/app/login/page.tsx f2ee8254da02a265ebf622b16283fd9f31b604d5f19fa26620418a4a5bb5891e
// input: apps/web/app/sso/[provider]/page.tsx 34c4679ae16bbc2e459a0ec8791ff799af932d3c5b4ce5210b5fe58d83f7fdb1
// input: apps/web/app/sso/auth/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/sso/dingtalk/page.tsx fcf9e7746b7f89f487cf7918a46ee7e5b6790029aed1d16430c0366d371a5e2e
// input: apps/web/app/sso/login/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/sso/mobile-auth/page.tsx f6c51a1ea23764b025e27b0dcd5af679feb42a42404a08dd4b0c905e2b2dcfc0
// input: apps/web/app/sso/redirect/page.tsx bdf4f937090bbd2036ff68e338493a2c33db74535aea56f609dede6afd68cec5
// input: apps/web/app/sso/register/page.tsx 832f3347693415d4fce788faeffb0d9441afed480364754afa506b881ca5ceae
// input: apps/web/app/sso/wecom/page.tsx 6df145382f287882d4dfd57434356f055a22a13afc39f5a8efff3edf6f8460a2
// input: apps/web/app/status/page.tsx ebace2ef09a778e578617c923f46a849897d21c8523df9a53d453d714b93d81d
// skipped: excludedTopSegments(sso|h5|api)=9 pages; duplicatePaths(保留先扫描到的)=0
// generatedAt: 2026-11-02T15:01:17.506Z
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
