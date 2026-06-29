package com.ai.manager.mcp.service.impl;

import com.ai.manager.mcp.service.McpResourceService;
import com.ai.manager.small.service.impl.ISysFileService;
import lombok.SneakyThrows;
import org.bytedeco.ffmpeg.global.avcodec;
import org.bytedeco.javacv.FFmpegFrameGrabber;
import org.bytedeco.javacv.FFmpegFrameRecorder;
import org.bytedeco.javacv.Frame;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.net.URL;

@Service
public class McpResourceServiceImpl implements McpResourceService {

    @Autowired
    private ISysFileService minioUtil;

    @SneakyThrows
    @Override
    public String videoToAudio(String videoSource) {
        // 1. 验证视频源
        validateVideoSource(videoSource);

        // 2. 创建视频抓取器
        FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(videoSource);
        grabber.start();

        try {
            // 1. 获取原视频的音频编码，确定目标格式和后缀
            int audioCodec = grabber.getAudioCodec();
            String[] formatInfo = getTargetFormatAndSuffix(audioCodec);
            String outputFormat = formatInfo[0]; // 容器格式（如 mp3、adts）
            String audioSuffix = formatInfo[1];  // 音频文件后缀（如 .mp3、.aac）

            // 2. 自动生成音频文件名（基于视频名）
            String audioFileName = generateAudioFileName(videoSource, audioSuffix);

            // 3. 提取音频字节数组（传入输出格式）
            byte[] audioBytes = extractAudioToBytes(grabber, outputFormat, audioCodec);

            // 4. 上传到 MinIO
            return minioUtil.uploadMinio(audioBytes, audioFileName);
        } finally {
            grabber.stop();
            grabber.release();
        }
    }

    /**
     * 提取音频为字节数组（接收输出格式参数）
     */
    private static byte[] extractAudioToBytes(FFmpegFrameGrabber grabber, String outputFormat, int targetCodec) throws Exception {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            FFmpegFrameRecorder recorder = new FFmpegFrameRecorder(baos, grabber.getAudioChannels());
            recorder.setFormat(outputFormat); // 显式指定格式
            recorder.setAudioCodec(targetCodec); // 目标编码
            recorder.setSampleRate(grabber.getSampleRate());
            recorder.setAudioBitrate(grabber.getAudioBitrate());
            recorder.start();

            Frame frame;
            while ((frame = grabber.grab()) != null) {
                if (frame.samples != null) {
                    recorder.record(frame);
                }
            }

            recorder.stop();
            recorder.release();
            return baos.toByteArray();
        }
    }

    /**
     * 自动生成音频文件名
     * @param videoSource 视频源（路径或URL）
     * @param audioSuffix 音频后缀（如 .mp3、.aac）
     * @return 生成的音频文件名（如 "video123.mp3"）
     */
    private static String generateAudioFileName(String videoSource, String audioSuffix) {
        // 1. 从路径/URL中提取文件名（如 "https://xxx/video123.mp4" → "video123.mp4"）
        String fileName = videoSource;
        // 处理URL中的文件名
        if (fileName.startsWith("http://") || fileName.startsWith("https://")) {
            try {
                fileName = new URL(fileName).getPath(); // 提取URL中的路径部分
            } catch (Exception e) {
                // 提取失败时直接用原字符串处理
            }
        }
        // 处理本地路径中的文件名（去除路径，保留文件名）
        fileName = fileName.substring(fileName.lastIndexOf("/") + 1);
        fileName = fileName.substring(fileName.lastIndexOf("\\") + 1); // 处理Windows反斜杠

        // 2. 去除视频文件的后缀（如 "video123.mp4" → "video123"）
        String nameWithoutExt = fileName;
        int lastDotIndex = fileName.lastIndexOf(".");
        if (lastDotIndex > 0) {
            nameWithoutExt = fileName.substring(0, lastDotIndex);
        }

        // 3. 拼接音频后缀（如 "video123" + ".mp3" → "video123.mp3"）
        return nameWithoutExt + audioSuffix;
    }

    /**
     * 根据音频编码获取目标格式和后缀
     * @param audioCodec 原视频音频编码
     * @return 数组 [输出格式, 音频后缀]（如 ["mp3", ".mp3"]）
     */
    private static String[] getTargetFormatAndSuffix(int audioCodec) {
        switch (audioCodec) {
            case avcodec.AV_CODEC_ID_MP3:
                return new String[]{"mp3", ".mp3"};
            case avcodec.AV_CODEC_ID_AAC:
                return new String[]{"adts", ".aac"}; // ADTS格式用.aac后缀
            case avcodec.AV_CODEC_ID_PCM_S16LE:
                return new String[]{"wav", ".wav"};
            default:
                // 未知编码默认转为MP3
                return new String[]{"mp3", ".mp3"};
        }

    }

    /**
     * 验证视频源有效性（本地文件存在性 / 网络地址可访问性）
     * @param videoSource 视频源路径或URL
     * @throws Exception 验证失败时抛出异常
     */
    private static void validateVideoSource(String videoSource) throws Exception {
        if (videoSource.startsWith("http://") || videoSource.startsWith("https://")) {
            // 验证网络地址是否可访问
            new URL(videoSource).openConnection().connect();
        } else {
            // 验证本地文件是否存在
            java.io.File file = new java.io.File(videoSource);
            if (!file.exists() || !file.isFile()) {
                throw new IllegalArgumentException("本地视频文件不存在：" + videoSource);
            }
        }
    }

}
