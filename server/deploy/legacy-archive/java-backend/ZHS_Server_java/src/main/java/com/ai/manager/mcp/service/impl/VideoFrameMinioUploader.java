package com.ai.manager.mcp.service.impl;
import com.ai.manager.small.service.impl.ISysFileService;
import org.bytedeco.javacv.FFmpegFrameGrabber;
import org.bytedeco.javacv.Frame;
import org.bytedeco.javacv.Java2DFrameConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;

/**
 * 视频帧提取并上传MinIO工具类
 */
@Component
public class VideoFrameMinioUploader {

    @Autowired
    private ISysFileService minioUploadService; // 注入你的MinIO上传服务

    /**
     * 提取视频首帧并上传到MinIO
     * @param videoPath 视频路径（本地或网络URL）
     * @param imageFormat 图片格式（如jpg、png）
     * @return MinIO返回的图片访问URL
     */
    public String extractAndUploadFirstFrame(String videoPath, String imageFormat, long positionSeconds) {
        return extractAndUploadFrame(videoPath, imageFormat, positionSeconds, "first");
    }

    /**
     * 提取视频尾帧并上传到MinIO
     * @param videoPath 视频路径（本地或网络URL）
     * @param imageFormat 图片格式（如jpg、png）
     * @return MinIO返回的图片访问URL
     */
    public String extractAndUploadLastFrame(String videoPath, String imageFormat) {
        FFmpegFrameGrabber grabber = null;
        try {
            grabber = new FFmpegFrameGrabber(videoPath);
            grabber.start();
            long totalSeconds = grabber.getLengthInTime() / 1000000;
            long lastFramePosition = Math.max(0, totalSeconds - 1);
            return extractAndUploadFrame(grabber, videoPath, imageFormat, lastFramePosition, "last");
        } catch (Exception e) {
            throw new RuntimeException("提取尾帧失败：" + e.getMessage(), e);
        } finally {
            closeGrabber(grabber);
        }
    }

    /**
     * 通用方法：提取指定位置帧并上传MinIO
     */
    private String extractAndUploadFrame(String videoPath, String imageFormat, long positionSeconds, String frameType) {
        FFmpegFrameGrabber grabber = null;
        try {
            grabber = new FFmpegFrameGrabber(videoPath);
            grabber.start();
            return extractAndUploadFrame(grabber, videoPath, imageFormat, positionSeconds, frameType);
        } catch (Exception e) {
            throw new RuntimeException("提取" + frameType + "帧失败：" + e.getMessage(), e);
        } finally {
            closeGrabber(grabber);
        }
    }

    /**
     * 内部实现：基于已启动的抓取器处理帧并上传
     */
    private String extractAndUploadFrame(FFmpegFrameGrabber grabber, String videoPath, String imageFormat,
                                         long positionSeconds, String frameType) throws Exception {
        // 1. 设置帧位置并抓取帧
        grabber.setTimestamp(positionSeconds * 1000000);
        Frame frame = grabber.grabImage();
        if (frame == null) {
            throw new RuntimeException("未获取到" + frameType + "帧，位置：" + positionSeconds + "秒");
        }

        // 2. 转换帧为BufferedImage
        Java2DFrameConverter converter = new Java2DFrameConverter();
        BufferedImage bufferedImage = converter.getBufferedImage(frame);
        if (bufferedImage == null) {
            throw new RuntimeException("帧转换为图片失败");
        }

        // 3. 生成图片文件名（基于视频名称）
        String videoFileName = new File(videoPath).getName(); // 从路径中提取视频文件名（如"video.mp4"）
        String imageFileName = generateImageFileName(videoFileName, frameType, imageFormat);

        // 4. 将BufferedImage转为字节数组
        byte[] imageBytes = imageToBytes(bufferedImage, imageFormat);

        // 5. 上传到MinIO并返回URL
        return minioUploadService.uploadMinio(imageBytes, imageFileName);
    }

    /**
     * 生成图片文件名（例如：video.mp4 -> video_first.jpg 或 video_last.png）
     */
    private String generateImageFileName(String videoFileName, String frameType, String imageFormat) {
        int dotIndex = videoFileName.lastIndexOf(".");
        String baseName = (dotIndex != -1) ? videoFileName.substring(0, dotIndex) : videoFileName;
        return baseName + "_" + frameType + "." + imageFormat;
    }

    /**
     * 将BufferedImage转为字节数组
     */
    private byte[] imageToBytes(BufferedImage image, String format) throws IOException {
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            ImageIO.write(image, format, outputStream);
            return outputStream.toByteArray();
        }
    }

    /**
     * 关闭抓取器释放资源
     */
    private void closeGrabber(FFmpegFrameGrabber grabber) {
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