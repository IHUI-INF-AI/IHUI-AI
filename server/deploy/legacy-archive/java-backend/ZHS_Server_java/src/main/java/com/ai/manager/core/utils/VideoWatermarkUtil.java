package com.ai.manager.core.utils;

import org.bytedeco.ffmpeg.global.avcodec;
import org.bytedeco.ffmpeg.global.avutil;
import org.bytedeco.javacv.*;
import org.bytedeco.javacv.Frame;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * 视频文件流加水印工具类
 */
public class VideoWatermarkUtil {

    /**
     * 视频流添加文字水印（文件流输入→输出）
     * @param videoInputStream 原视频输入流
     * @param videoOutputStream 加水印后的视频输出流
     * @param watermarkText 水印文字
     * @throws Exception 异常
     */
    public static void addTextWatermarkToVideo(InputStream videoInputStream, OutputStream videoOutputStream,
                                               String watermarkText,String videoFormat) throws Exception {
        // 1. 创建FrameGrabber（读取视频流）
        FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(videoInputStream);
        grabber.start();

        // 2. 创建FrameRecorder（写入视频流）
        FFmpegFrameRecorder recorder = new FFmpegFrameRecorder(videoOutputStream,
                grabber.getImageWidth(), grabber.getImageHeight());
        // 配置编码参数（保持原视频参数）
        recorder.setFormat(videoFormat);
        recorder.setVideoCodec(avcodec.AV_CODEC_ID_H264); // H264编码（通用）
        recorder.setAudioCodec(grabber.getAudioCodec());
        recorder.setFrameRate(grabber.getFrameRate());
        recorder.setSampleRate(grabber.getSampleRate());
        recorder.setAudioChannels(grabber.getAudioChannels());
        recorder.start();

        // 3. 水印样式配置
        Java2DFrameConverter converter = new Java2DFrameConverter();
        Font font = new Font("微软雅黑", Font.PLAIN, 40);
        Color color = new Color(255, 255, 255, 150); // 白色半透明

        // 4. 逐帧处理视频
        Frame frame;
        while ((frame = grabber.grabFrame()) != null) {
            if (frame.image != null) {
                // 将视频帧转为BufferedImage
                BufferedImage bufferedImage = converter.getBufferedImage(frame);
                Graphics2D g2d = bufferedImage.createGraphics();

                // 绘制文字水印（右上角）
                g2d.setColor(color);
                g2d.setFont(font);
                int textWidth = g2d.getFontMetrics().stringWidth(watermarkText);
                int x = bufferedImage.getWidth() - textWidth - 20;
                int y = 50;
                g2d.drawString(watermarkText, x, y);
                g2d.dispose();

                // 将处理后的图片转回Frame并写入
                Frame processedFrame = converter.convert(bufferedImage);
                recorder.record(processedFrame);
            } else {
                // 音频帧直接写入
                recorder.record(frame);
            }
        }

        // 5. 释放资源
        recorder.stop();
        recorder.release();
        grabber.stop();
        grabber.release();
    }

    /**
     * 视频流添加图片水印
     * @param videoInputStream 原视频流
     * @param videoOutputStream 输出流
     * @param watermarkImageStream 水印图片流
     * @throws Exception 异常
     */
    public static void addImageWatermarkToVideo(InputStream videoInputStream,
                                                OutputStream videoOutputStream,
                                                InputStream watermarkImageStream,
                                                String videoFormat) throws Exception {
        // 初始化日志
        avutil.av_log_set_level(avutil.AV_LOG_DEBUG);
        FFmpegLogCallback.set();

        // 创建临时文件
        Path tempFile = Files.createTempFile("video_watermark_", "." + videoFormat);
        tempFile.toFile().deleteOnExit();

        FFmpegFrameGrabber grabber = null;
        FFmpegFrameRecorder recorder = null;
        // 核心：创建 Frame 和 BufferedImage 互转的转换器（修复编译错误的关键）
        Java2DFrameConverter frameConverter = new Java2DFrameConverter();

        try {
            grabber = new FFmpegFrameGrabber(videoInputStream);
            grabber.start();

            recorder = new FFmpegFrameRecorder(tempFile.toAbsolutePath().toString(),
                    grabber.getImageWidth(), grabber.getImageHeight());
            // 配置录制器参数（不变）
            recorder.setFormat(videoFormat);
            recorder.setVideoCodec(avcodec.AV_CODEC_ID_H264);
            recorder.setFrameRate(grabber.getFrameRate());
            recorder.setGopSize((int) grabber.getFrameRate() * 2);
            recorder.setVideoBitrate(grabber.getVideoBitrate());

            // 适配音频流
            if (grabber.getAudioChannels() > 0) {
                recorder.setAudioCodec(grabber.getAudioCodec());
                recorder.setSampleRate(grabber.getSampleRate());
                recorder.setAudioChannels(grabber.getAudioChannels());
                recorder.setAudioBitrate(grabber.getAudioBitrate());
            } else {
                recorder.setAudioChannels(0);
            }

            recorder.start();

            // 读取水印图片
            BufferedImage watermarkImage = ImageIO.read(watermarkImageStream);
            Frame frame;
            while ((frame = grabber.grabFrame()) != null) {
                // 处理视频帧（加水印）
                if (frame.image != null) {
                    // 修复1：替换 frame.getBufferedImage() → frameConverter.convert(frame)
                    BufferedImage videoFrame = frameConverter.convert(frame);
                    if (videoFrame == null) {
                        continue; // 跳过无效帧
                    }

                    Graphics2D g2d = videoFrame.createGraphics();
                    // 绘制原视频帧（无需额外绘制，videoFrame 已包含原帧内容）
                    // 绘制水印（右下角，等比例缩放）
                    int watermarkWidth = watermarkImage.getWidth() / 4;
                    int watermarkHeight = watermarkImage.getHeight() / 4;
                    int x = grabber.getImageWidth() - watermarkWidth - 20;
                    int y = grabber.getImageHeight() - watermarkHeight - 20;
                    g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.7f));
                    g2d.drawImage(watermarkImage, x, y, watermarkWidth, watermarkHeight, null);
                    g2d.dispose();

                    // 修复2：替换 Frame.converterToFrame() → frameConverter.convert(videoFrame)
                    Frame watermarkedFrame = frameConverter.convert(videoFrame);
                    recorder.record(watermarkedFrame);
                }
                // 处理音频帧（直接透传）
                if (frame.samples != null) {
                    recorder.record(frame);
                }
            }

            recorder.stop();
            grabber.stop();

            // 拷贝临时文件到目标输出流
            Files.copy(tempFile, videoOutputStream);

        } catch (Exception e) {
            throw new RuntimeException("视频加水印失败", e);
        } finally {
            // 释放资源
            if (recorder != null) {
                recorder.release();
            }
            if (grabber != null) {
                grabber.release();
            }
            // 删除临时文件
            if (tempFile.toFile().exists()) {
                Files.deleteIfExists(tempFile);
            }
        }
    }

}