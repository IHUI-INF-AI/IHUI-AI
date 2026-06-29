package com.ai.manager.mcp.test;

import org.bytedeco.javacv.FFmpegFrameGrabber;
import org.bytedeco.javacv.Frame;
import org.bytedeco.javacv.Java2DFrameConverter;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;

/**
 * 视频帧提取工具类（基于JavaCV）
 */
public class VideoFrameExtractor {

    /**
     * 提取视频首帧并保存为图片
     *
     * @param videoPath       视频路径（本地文件路径或网络URL）
     * @param outputImagePath 输出图片路径（如：D:/firstFrame.jpg）
     * @param format          图片格式（如：jpg、png）
     * @return 是否提取成功
     */
    public static boolean extractFirstFrame(String videoPath, String outputImagePath, String format) {
        // 首帧通常在0秒位置
        return extractFrameAtPosition(videoPath, outputImagePath, format, 0);
    }

    /**
     * 提取视频尾帧并保存为图片
     *
     * @param videoPath       视频路径（本地文件路径或网络URL）
     * @param outputImagePath 输出图片路径（如：D:/lastFrame.jpg）
     * @param format          图片格式（如：jpg、png）
     * @return 是否提取成功
     */
    public static boolean extractLastFrame(String videoPath, String outputImagePath, String format) {
        FFmpegFrameGrabber grabber = null;
        try {
            // 初始化抓取器
            grabber = new FFmpegFrameGrabber(videoPath);
            grabber.start();

            // 获取视频总时长（秒），尾帧取总时长前1秒位置（避免取到空帧）
            long totalSeconds = grabber.getLengthInTime() / 1000000; // 转换为秒（FFmpeg时间单位是微秒）
            long lastFramePosition = Math.max(0, totalSeconds - 1); // 确保不小于0

            // 提取尾帧
            return extractFrameAtPosition(grabber, outputImagePath, format, lastFramePosition);
        } catch (Exception e) {
            System.err.println("提取尾帧失败：" + e.getMessage());
            e.printStackTrace();
            return false;
        } finally {
            // 释放资源
            if (grabber != null) {
                try {
                    grabber.stop();
                    grabber.release();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }

    /**
     * 根据指定位置提取视频帧
     *
     * @param videoPath       视频路径
     * @param outputImagePath 输出图片路径
     * @param format          图片格式
     * @param positionSeconds 提取位置（秒）
     * @return 是否成功
     */
    private static boolean extractFrameAtPosition(String videoPath, String outputImagePath, String format, long positionSeconds) {
        FFmpegFrameGrabber grabber = null;
        try {
            grabber = new FFmpegFrameGrabber(videoPath);
            grabber.start();
            return extractFrameAtPosition(grabber, outputImagePath, format, positionSeconds);
        } catch (Exception e) {
            System.err.println("提取指定位置帧失败：" + e.getMessage());
            e.printStackTrace();
            return false;
        } finally {
            if (grabber != null) {
                try {
                    grabber.stop();
                    grabber.release();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }

    /**
     * 内部方法：基于已启动的抓取器提取帧
     */
    private static boolean extractFrameAtPosition(FFmpegFrameGrabber grabber, String outputImagePath, String format, long positionSeconds) throws Exception {
        // 设置抓取位置（微秒）
        grabber.setTimestamp(positionSeconds * 1000000);

        // 获取帧
        Frame frame = grabber.grabImage();
        if (frame == null) {
            System.err.println("未获取到视频帧，位置：" + positionSeconds + "秒");
            return false;
        }

        // 转换为BufferedImage
        Java2DFrameConverter converter = new Java2DFrameConverter();
        BufferedImage bufferedImage = converter.getBufferedImage(frame);
        if (bufferedImage == null) {
            System.err.println("帧转换为图片失败");
            return false;
        }

        // 保存图片
        File outputFile = new File(outputImagePath);
        // 确保父目录存在
        File parentDir = outputFile.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            parentDir.mkdirs();
        }
        ImageIO.write(bufferedImage, format, outputFile);
        System.out.println("图片保存成功：" + outputImagePath);
        return true;
    }
}