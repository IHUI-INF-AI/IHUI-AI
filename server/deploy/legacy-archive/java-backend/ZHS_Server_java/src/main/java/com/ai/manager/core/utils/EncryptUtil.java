package com.ai.manager.core.utils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

public class EncryptUtil {

    /**
     * SHA-256加密（不可逆）
     */
    public static String sha256(String str) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(str.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256算法不可用", e);
        }
    }
    /**
     * 验证SHA-256加密是否一致
     */
    public static boolean verifySha256(String raw, String encrypted) {
        return sha256(raw).equalsIgnoreCase(encrypted);
    }

    /**
     * 简单hash加密（不可逆，仅做示例）
     */
    public static String hash(String str) {
        return Integer.toHexString(str.hashCode());
    }
    /**
     * 验证hash加密是否一致
     */
    public static boolean verifyHash(String raw, String encrypted) {
        return hash(raw).equalsIgnoreCase(encrypted);
    }

    /**
     * Base64加密（可逆）
     */
    public static String encodeBase64(String str) {
        return Base64.getEncoder().encodeToString(str.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Base64解密
     */
    public static String decodeBase64(String base64Str) {
        byte[] bytes = Base64.getDecoder().decode(base64Str);
        return new String(bytes, StandardCharsets.UTF_8);
    }

    /**
     * 字节数组转16进制字符串
     */
    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    public static void main(String[] args) {
        String encod = encodeBase64("sk-7c402f3eac5f432f96575f7a390d481a");
        System.out.println(encod);

        System.out.println(decodeBase64("c2stN2M0MDJmM2VhYzVmNDMyZjk2NTc1ZjdhMzkwZDQ4MWE="));
    }
}