package com.ai.manager.mcp.test;

import java.io.*;
import java.util.Base64;

public class FileStreamToBase64 {

    /**
     * 读取文件流并转换为Base64编码字符串
     * @param filePath 文件路径
     * @return Base64编码字符串，转换失败返回null
     */
    public static String fileStreamToBase64(String filePath) {
        File file = new File(filePath);
        // 检查文件是否存在
        if (!file.exists() || !file.isFile()) {
            System.err.println("文件不存在或不是有效的文件: " + filePath);
            return null;
        }

        try (InputStream inputStream = new FileInputStream(file);
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            byte[] buffer = new byte[4096];
            int bytesRead;

            // 读取文件流到字节数组输出流
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, bytesRead);
            }

            // 将字节数组转换为Base64编码
            return Base64.getEncoder().encodeToString(outputStream.toByteArray());

        } catch (FileNotFoundException e) {
            System.err.println("文件未找到: " + e.getMessage());
        } catch (IOException e) {
            System.err.println("文件读取错误: " + e.getMessage());
        }

        return null;
    }

    public static void main(String[] args) {
        // 示例用法
        String filePath = "D:\\Users\\Administrator\\Pictures\\微信图片_20250917142127_9_131.jpg"; // 替换为你的文件路径
        String base64String = fileStreamToBase64(filePath);

        if (base64String != null) {
            System.out.println("文件转换为Base64成功！");
            System.out.println(base64String);

//            // 打印前100个字符（完整字符串可能很长）
//            System.out.println("Base64前100字符: " +
//                    base64String.substring(0, Math.min(100, base64String.length())) + "...");
        } else {
            System.out.println("文件转换为Base64失败！");
        }
    }
}
