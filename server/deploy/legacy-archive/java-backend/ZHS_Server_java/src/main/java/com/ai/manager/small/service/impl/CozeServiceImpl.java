package com.ai.manager.small.service.impl;

import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.small.domain.vo.CozeTokenBean;
import com.ai.manager.small.service.CozeService;
import com.ai.manager.core.utils.JsonUtils;
import com.ai.manager.core.utils.NonceRandomUtils;
import com.ai.manager.core.utils.SSLClient;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.google.common.collect.Maps;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.interfaces.RSAKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class CozeServiceImpl implements CozeService {

    @Value("${coze.private.key.pem.num}")
    private String COZE_PRIVATE_NUM;
    @Value("${coze.private.key.pem.url}")
    private String COZE_PRIVATE_KEY;
    @Value("${coze.oauth.token.url}")
    private String COZE_TOKEN_URL;

    @Value("${coze.oauth.app.id}")
    private String COZE_APP_ID;
    @Value("${coze.oauth.app.aud}")
    private String COZE_APP_AUD;

    // TODO 大访问量会有堆溢出
    private final Map<String, CozeTokenBean> openIdToToken = Maps.newHashMap();

    @Override
    public String getAccessToken(String uuid) {
        Instant now = Instant.now();

        // 判断是否存在
        if(openIdToToken.containsKey(uuid)){
            CozeTokenBean cozeTokenBean = openIdToToken.get(uuid);
            Long time = cozeTokenBean.getTime();
            if(now.getEpochSecond() < time){
                return cozeTokenBean.getToken();
            }
        }

        // 根据私钥文件创建私钥
        try {
            Algorithm algorithm = Algorithm.RSA256((RSAKey) getPrivateKey());

            ZonedDateTime zonedDateTime = now.atZone(ZoneId.systemDefault()).plusDays(1L);
            // 使用jwt创建Authorization
            String sign = JWT.create()
//                    .withHeader(headerClaims)
                    .withKeyId(COZE_PRIVATE_NUM)
//                    .withPayload(payloadClaims)
                    .withIssuer(COZE_APP_ID)
                    .withAudience(COZE_APP_AUD)
                    .withJWTId(NonceRandomUtils.getRandomString(32))
                    .withClaim("session_name", uuid)

                    .withIssuedAt(now)
                    .withExpiresAt(zonedDateTime.toInstant())
                    .sign(algorithm);

            // 根据私钥获取token
            Map<String, Object> header = Maps.newHashMap();
            header.put(BeanConfig.ZHS_CONTENT_TYPE, "application/json");
            header.put(BeanConfig.ZHS_AUTHORIZATION, String.format("Bearer %s", sign));
            Map<String, Object> body = Maps.newHashMap();
            body.put("grant_type","urn:ietf:params:oauth:grant-type:jwt-bearer");
            body.put("duration_seconds",86399);

            SSLClient sslClient = new SSLClient();
            String s1 = sslClient.doPost(COZE_TOKEN_URL, JsonUtils.toJson(body), header);
            Map map = JsonUtils.fromJson(s1, Map.class);
            if(!map.containsKey("access_token")){
                return null;
            }
            String accessToken = map.get("access_token").toString();
            // 存堆中
            CozeTokenBean build = CozeTokenBean.builder()
                    .time(now.getEpochSecond() + 86399)
                    .token(accessToken)
                    .build();
            openIdToToken.put(uuid, build);

            // 清理无效token
            List<String> openIds = openIdToToken.entrySet().stream()
                    .filter(entry -> entry.getValue().getTime() < now.getEpochSecond())
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toList());
            openIds.forEach(openIdToToken::remove);

            return accessToken;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private PrivateKey getPrivateKey() throws Exception {
        String privateKeyPEM = new String(Files.readAllBytes(Paths.get(COZE_PRIVATE_KEY)));
        privateKeyPEM = privateKeyPEM
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");

        byte[] decodedKey = Base64.getDecoder().decode(privateKeyPEM);
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");
        return keyFactory.generatePrivate(new PKCS8EncodedKeySpec(decodedKey));
    }


}
