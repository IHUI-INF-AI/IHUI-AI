package com.ai.manager.core.utils;

import org.apache.commons.io.IOUtils;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 网络文件下载工具
 */
public class NetFileDownloadUtil {

    /**
     * 下载网络文件到字节数组（小文件）/ 临时文件（大文件）
     * @param netUrl 网络文件URL
     * @return 字节数组 + ContentType（数组第一位：字节数组，第二位：ContentType）
     * @throws Exception 异常
     */
    public static Object[] downloadNetFile(String netUrl) throws Exception {
        if (!StringUtils.hasText(netUrl)) {
            throw new IllegalArgumentException("网络文件URL不能为空");
        }

        URL url = new URL(netUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(15000);
        conn.setRequestProperty("User-Agent", "Mozilla/5.0"); // 模拟浏览器，避免被拦截

        try (InputStream inputStream = conn.getInputStream();
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            // 缓存网络流到字节数组（小文件推荐，大文件建议用临时文件）
            IOUtils.copy(inputStream, baos);
            return new Object[]{baos.toByteArray(), conn.getContentType()};
        } finally {
            conn.disconnect();
        }
    }
}