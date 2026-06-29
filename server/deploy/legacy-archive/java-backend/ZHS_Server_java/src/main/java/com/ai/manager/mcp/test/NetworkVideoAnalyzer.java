package com.ai.manager.mcp.test;

import org.bytedeco.javacv.FFmpegFrameGrabber;
import org.bytedeco.javacv.FrameGrabber;

import java.util.concurrent.TimeUnit;

public class NetworkVideoAnalyzer {

    // 超时设置（毫秒）
    private static final int TIMEOUT = 15000;

    public static void main(String[] args) {
        // 网络视频地址示例
        String videoUrl = "https://file.aizhs.top/sys-backs/2025/09/18/luyala_video_0e7f757d9c03499bbcb4592a62607721_20250918090618A147.mp4"; // 替换为实际视频URL

        try {
            // 创建网络视频抓取器
            FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(videoUrl);

//            // 设置网络超时参数
//            configureNetworkTimeout(grabber);

            // 启动抓取器
            System.out.println("正在连接到视频源: " + videoUrl);
            grabber.start();

//            // 分析视频参数
//            analyzeVideoParameters(grabber);

            // 视频分辨率
            int width = grabber.getImageWidth();
            int height = grabber.getImageHeight();
            // 视频比例
            String aspectRatio = calculateAspectRatio(width, height);
            System.out.println(aspectRatio);

            // 释放资源
            grabber.stop();
            grabber.release();

        } catch (FrameGrabber.Exception e) {
            System.err.println("分析网络视频时发生错误: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * 配置网络连接超时参数
     */
    private static void configureNetworkTimeout(FFmpegFrameGrabber grabber) {
        // 设置连接超时
        grabber.setOption("timeout", String.valueOf(TIMEOUT * 1000)); // FFmpeg使用微秒
        // 对于RTSP等协议可以设置更多参数
        grabber.setOption("rtsp_transport", "tcp"); // 使用TCP传输以提高稳定性
    }

    /**
     * 分析并打印视频参数
     */
    private static void analyzeVideoParameters(FFmpegFrameGrabber grabber) throws FrameGrabber.Exception {
        // 视频分辨率
        int width = grabber.getImageWidth();
        int height = grabber.getImageHeight();

        // 视频长度(毫秒转换为时分秒)
        long durationMs = grabber.getLengthInTime();
        long hours = TimeUnit.MILLISECONDS.toHours(durationMs);
        long minutes = TimeUnit.MILLISECONDS.toMinutes(durationMs) -
                TimeUnit.HOURS.toMinutes(hours);
        long seconds = TimeUnit.MILLISECONDS.toSeconds(durationMs) -
                TimeUnit.MINUTES.toSeconds(TimeUnit.MILLISECONDS.toMinutes(durationMs));

        // 视频比例
        String aspectRatio = calculateAspectRatio(width, height);

        // 帧率
        double frameRate = grabber.getFrameRate();

        // 视频编码格式
        String videoCodec = grabber.getVideoCodecName();

        // 打印分析结果
        System.out.println("\n===== 视频参数分析结果 =====");
        System.out.println("视频地址: " + grabber.getVideoCodecName());
        System.out.println("分辨率: " + width + "x" + height);
        System.out.println("宽高比: " + aspectRatio);
        System.out.println("时长: " + String.format("%02d:%02d:%02d", hours, minutes, seconds));
        System.out.println("帧率: " + String.format("%.2f", frameRate) + " fps");
        System.out.println("视频编码: " + videoCodec);
        System.out.println("==========================");
    }

    /**
     * 计算视频宽高比
     */
    private static String calculateAspectRatio(int width, int height) {
        if (width <= 0 || height <= 0) {
            return "未知";
        }

        // 计算最大公约数
        int gcd = gcd(width, height);
        int ratioWidth = width / gcd;
        int ratioHeight = height / gcd;

        return ratioWidth + ":" + ratioHeight;
    }

    /**
     * 计算最大公约数
     */
    private static int gcd(int a, int b) {
        return b == 0 ? a : gcd(b, a % b);
    }
}
