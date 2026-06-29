package com.ai.manager.core.utils;

import lombok.Builder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.security.jwt.Jwt;
import org.springframework.security.jwt.JwtHelper;
import org.springframework.security.jwt.crypto.sign.RsaSigner;
import org.springframework.security.jwt.crypto.sign.RsaVerifier;
import org.springframework.security.oauth2.provider.token.store.KeyStoreKeyFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.KeyPair;
import java.security.interfaces.RSAPrivateKey;

/**
 * JWT认证
 * @Auther: Raindrop_L
 */
@Builder
@Component
public class JWTUtils {

    private static final Logger log = LoggerFactory.getLogger(JWTUtils.class);

    private String PRIVATE_URL;
    private String PUBLIC_URL;
    private String CERT_URL;
    private String KEYPASS;
    private String ALIAS;
    private String PASSWORD;
    @Autowired
    public JWTUtils(@Value("${ai.wx.mini.login.private}") String private_url,
                    @Value("${ai.wx.mini.login.public}") String public_url,
                    @Value("${ai.wx.mini.login.cert}") String cert_url,
                    @Value("${ai.wx.mini.login.keypass}") String keypass,
                    @Value("${ai.wx.mini.login.alias}") String alias,
                    @Value("${ai.wx.mini.login.password}") String password) {
        this.PRIVATE_URL = private_url;
        this.PUBLIC_URL = public_url;
        this.CERT_URL = cert_url;
        this.KEYPASS = keypass;
        this.ALIAS = alias;
        this.PASSWORD = password;
    }

//    public JWTUtils(Class<T> type) {
//        this.type = type;
//    }

    public <T> String createJWT(T  map) {
        //基于私钥生成JWT
        //创建一个密钥工厂
        //密钥库的密码
        FileSystemResource fileSystemResource = new FileSystemResource(Paths.get(PRIVATE_URL));
        /**
         * 参数1 私钥的位置
         * 参数2 密钥库的密码
         */
        KeyStoreKeyFactory keyStoreKeyFactory = new KeyStoreKeyFactory(fileSystemResource,KEYPASS.toCharArray());
        /**
         * 参数1 密钥的别名
         * 参数2 密钥的密码
         */
        KeyPair keyPair = keyStoreKeyFactory.getKeyPair(ALIAS, PASSWORD.toCharArray());
        //将当前的私钥转为RSA的私钥
        RSAPrivateKey rsaPrivateKey = (RSAPrivateKey) keyPair.getPrivate();
        //生成jwt
//        Map<String,String > map = new HashMap<>();
//        map.put("company","zhsLogin");
//        map.put("address","Raindrop_L");

//        String json = JsonUtils.toJson(map);
        // 增加失效时间
//        Map<String, Object> jwtMap = JsonUtils.fromJson(JsonUtils.toJson(map), Map.class);
//        long epochSecond = Instant.now().atZone(ZoneId.systemDefault()).minusHours(2).toInstant().getEpochSecond();
//        jwtMap.put(BeanConfig.ZHS_CERT_TIME_KEY, epochSecond);

        /**
         * 参数1 当前的令牌的内容
         * 参数2 签名（用RSA的私钥来做签名）
         */
//        Jwt jwt = JwtHelper.encode(JsonUtils.toJson(jwtMap), new RsaSigner(rsaPrivateKey));
        Jwt jwt = JwtHelper.encode(JsonUtils.toJson(map), new RsaSigner(rsaPrivateKey));
        String jwtEncoded = jwt.getEncoded();

        log.info("生成令牌：" + jwtEncoded);
        return jwtEncoded;
//        System.out.println(jwtEncoded);
    }

    public <T> T parseJwt(String jwt, Class<T> type) throws IOException {
        //基于公钥解析jwt 这是直接复制的CreateJwtTest.class的打印结果
//        String jwt ="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiUmFpbmRyb3BfTCIsImNvbXBhbnkiOiJ6aHNMb2dpbiJ9.Jq0KelrbOwWzJnzoq8PMvRqg1DQmsolOR-rqbxSe1h9G7WjFYL7l-prpGQzFoIHi4pxnrfdD7b_HcCSjNzlMasy2SgaZQl0RNXe2NPLYK_hHiWbiiJ-rs37PiWkwK36Er1OSifUyTn4_t1I4grfGgymK0SWSw4IK9bI9-cHXmIUpu3UIsJu46Sall7ytTbeEPt8wABh_e27HVBohuZR8kRnktUB-D9VAFQaTlDyfPbzf9yh9c057IxdhqUFofE0XFdJ6ZBXrAfHI-Ae8VHy_CwSOtYvr3T7J8nwWnYRxkfL96C4msetsWnolfdd5BkQ9wvqta7YBdM40c1BAnG581g";
        //公钥,直接复制的Public.key里的公钥,复制时要带着-----BEGIN PUBLIC KEY-----和-----END PUBLIC KEY-----
        String publicKey = new String(Files.readAllBytes(Paths.get(PUBLIC_URL)));

//                "-----BEGIN PUBLIC KEY-----\n" +
//                "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAn54UowWQTO44CqYf781E\n" +
//                "IRqjke/UW3+mkbGtPok+e6QRVcd/43RSVCWOq/rBlG4dQGubDzUx7LHv6/cW1Fe4\n" +
//                "20Pgtw2+3xU4JaOH4tu8rkRrvrliKcgcNaEBstUBCJo92+206uMLo+PNkHi1Gk1j\n" +
//                "d4sG5/+m9Tv2/7R6IUBIX2Wo2i5TNNOLX6QKV61FvhmpuQHIOFphr0vSbMBtNsIy\n" +
//                "dEnN2S6Gylvwu6zXgbP6Q4FbLYZpS/b8K6N2Nmau1IdGQBmvDMY5p0X0uRxKawm3\n" +
//                "IKqe4H5QvlUHeknlkBYFo6FzROrkgBLrMJjXQ0WKnv4aJChsDAnkA9ctvoa1d61L\n" +
//                "8QIDAQAB\n" +
//                "-----END PUBLIC KEY-----";
        //解析和验签jwt，获取令牌
        Jwt token = JwtHelper.decodeAndVerify(jwt, new RsaVerifier(publicKey));
        //解析令牌，获取令牌中的载荷
        String claims = token.getClaims();
        System.out.println(claims);//打印结果为{"address":"beijing","company":"heima"}
        return JsonUtils.fromJson(claims, type);
    }

//    public void parseJwt2(){
//
//
//
//        //基于公钥解析jwt 这是直接复制的CreateJwtTest.class的打印结果
//        String jwt ="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoidGFpeXVhbiIsImNvbXBhbnkiOiJsamYifQ.TpwuJyFJLg10vvrNJI1fj-2xlpuyYJ0zJ-whDqzZ36BmGxB84AqaAuYYpXn2CPuXbAQEqKZfBkNh2WLAYZGI4TAdarVx2k8PMwWbR9Y_JIA8EzDxgyi46ZsKxlTxam0trk_XN4Pu3UVvQEnf5nxko4f_b0M2jkAkTYaoGl8Y5qLSBqZ6y_ArUTIaWd2n7h6WdoRJCRM2Q0JeS2r9CQatMriGVB4TPiISZAGvPqaRthWMRtBxYYqxmMzvQahbQuNph0cyuTd1oc7FYnVerJYupGmc81rtbBVcjwoDMutGzUumfBLLkArSXsPOiFWRdKOurf_u1Nxn2KNZjVnNelv4Cw";
//        //通过ljf.jks文件获取公钥
//        ClassPathResource classPathResource = new ClassPathResource("/ljf.jks");
//        //密钥库的密码
//        String keyPass = "123456";
//        /**
//         * 参数1 私钥的位置
//         * 参数2 密钥库的密码
//         */
//        KeyStoreKeyFactory keyStoreKeyFactory = new KeyStoreKeyFactory(classPathResource,keyPass.toCharArray());
//        //基于工厂获取私钥
//        //密钥的别名
//        String alias = "ljf";
//        //密钥的密码
//        String password ="123456";
//        /**
//         * 参数1 密钥的别名
//         * 参数2 密钥的密码
//         */
//        KeyPair keyPair = keyStoreKeyFactory.getKeyPair(alias, password.toCharArray());
//        //将当前的私钥转为RSA的公钥
//        RSAPublicKey publicKey = (RSAPublicKey) keyPair.getPublic();
//        //解析和验签jwt，获取令牌
//        Jwt token = JwtHelper.decodeAndVerify(jwt, new RsaVerifier(publicKey));
//        //解析令牌，获取令牌中的载荷
//        String claims = token.getClaims();
//        System.out.println(claims);//打印结果为{"address":"beijing","company":"heima"}
//    }

}