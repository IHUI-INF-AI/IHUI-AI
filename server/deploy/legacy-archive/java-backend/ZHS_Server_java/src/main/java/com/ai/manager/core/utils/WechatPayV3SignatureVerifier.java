package com.ai.manager.core.utils;

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.Map;



/**
 * 微信支付V3证书签名验证工具
 */
public class WechatPayV3SignatureVerifier {

    /**
     * 验证微信支付V3签名
     * @param certificate 微信支付平台证书
     * @param message 待签名的消息（HTTP请求的body）
     * @param signature 签名（HTTP头中的Wechatpay-Signature字段）
     * @param nonce 随机串（HTTP头中的Wechatpay-Nonce字段）
     * @param timestamp 时间戳（HTTP头中的Wechatpay-Timestamp字段）
     * @return 签名是否合法
     */
    public static boolean verify(X509Certificate certificate, String message,
                                 String signature, String nonce, String timestamp) {

        try {
            // 构建签名原始字符串
            String signStr = buildSignString(timestamp, nonce, message);

            // 转换签名为字节数组（Base64解码）
            byte[] signBytes = Base64.getDecoder().decode(signature);

            // 获取公钥
            PublicKey publicKey = certificate.getPublicKey();

            // 验证签名
            Signature sign = Signature.getInstance("SHA256withRSA");
            sign.initVerify(publicKey);
            sign.update(signStr.getBytes(StandardCharsets.UTF_8));
            return sign.verify(signBytes);
        } catch (NoSuchAlgorithmException | InvalidKeyException | SignatureException e) {
            throw new RuntimeException("签名验证失败", e);
        }
    }

    /**
     * 从PEM文件加载X509证书
     * @param certPath 证书文件路径
     * @return X509证书对象
     */
    public static X509Certificate loadCertificate(String certPath) {
        try (FileInputStream fis = new FileInputStream(certPath)) {
            CertificateFactory factory = CertificateFactory.getInstance("X.509");
            return (X509Certificate) factory.generateCertificate(fis);
        } catch (FileNotFoundException | CertificateException e) {
            throw new RuntimeException("加载证书失败", e);
        } catch (IOException e) {
            throw new RuntimeException("读取证书文件失败", e);
        }
    }

    /**
     * 从PEM格式字符串加载X509证书
     * @param certContent 证书内容（PEM格式）
     * @return X509证书对象
     */
    public static X509Certificate loadCertificateFromContent(String certContent) {
        try {
            // 移除PEM格式的头尾标记
            String content = certContent
                    .replace("-----BEGIN CERTIFICATE-----", "")
                    .replace("-----END CERTIFICATE-----", "")
                    .replaceAll("\\s+", "");

            byte[] certBytes = Base64.getDecoder().decode(content);
            ByteArrayInputStream bis = new ByteArrayInputStream(certBytes);

            CertificateFactory factory = CertificateFactory.getInstance("X.509");
            return (X509Certificate) factory.generateCertificate(bis);
        } catch (CertificateException e) {
            throw new RuntimeException("解析证书失败", e);
        }
    }

    /**
     * 构建签名原始字符串
     */
    private static String buildSignString(String timestamp, String nonce, String message) {
        return timestamp + "\n" + nonce + "\n" + message + "\n";
    }

    /**
     * 验证HTTP请求的签名
     * @param certificate 微信支付平台证书
     * @param headers HTTP请求头
     * @param body HTTP请求体
     * @return 签名是否合法
     */
    public static boolean verifyHttpRequest(X509Certificate certificate,
                                            Map<String, String> headers, String body) {
        String timestamp = headers.get("Wechatpay-Timestamp");
        String nonce = headers.get("Wechatpay-Nonce");
        String signature = headers.get("Wechatpay-Signature");
        String serialNo = headers.get("Wechatpay-Serial");

        if (timestamp == null || nonce == null || signature == null || serialNo == null) {
            throw new IllegalArgumentException("缺少必要的HTTP头信息");
        }

        return verify(certificate, body, signature, nonce, timestamp);
    }

    // 示例用法
    public static void main(String[] args) {
        // 从文件加载证书（替换为实际证书路径）
        X509Certificate certificate = loadCertificate("path/to/wechatpay_cert.pem");

        // 示例请求信息
        String timestamp = "1630401023";
        String nonce = "a1b2c3d4e5";
        String message = "{\"out_trade_no\":\"20230101001\",\"total_fee\":1}";

        // 注意：此处的signature仅为示例，实际使用时需替换为真实签名
        String signature = "example_signature_here";

        // 验证签名
        boolean isValid = verify(certificate, message, signature, nonce, timestamp);
        System.out.println("签名验证结果: " + isValid);
    }
}