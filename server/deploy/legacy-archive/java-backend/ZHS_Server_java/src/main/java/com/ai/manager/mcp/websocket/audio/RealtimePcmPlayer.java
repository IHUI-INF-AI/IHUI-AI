package com.ai.manager.mcp.websocket.audio;

// src/main/java/com/ai/manager/mcp/audio/RealtimePcmPlayer.java

import javax.sound.sampled.*;
import java.io.*;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * 实时PCM音频处理器
 * 支持实时播放或保存音频数据到文件
 */
public class RealtimePcmPlayer {
    private final int sampleRate;
    private final AudioFormat format;
    private SourceDataLine line;
    private Thread fileWriterThread;
    private final BlockingQueue<byte[]> audioQueue = new LinkedBlockingQueue<>();
    private volatile boolean isRunning = false;
    private FileOutputStream fileOutputStream;
    private String outputFilePath;
    private boolean saveToFile;
    private boolean outputMp3;
    private ByteArrayOutputStream pcmBuffer;

    public RealtimePcmPlayer(int sampleRate) {
        this.sampleRate = sampleRate;
        this.format = new AudioFormat(sampleRate, 16, 1, true, false);
        this.saveToFile = false;
        initThreads();
    }

    public RealtimePcmPlayer(int sampleRate, String outputFilePath) {
        this(sampleRate, outputFilePath, false);
    }
    
    public RealtimePcmPlayer(int sampleRate, String outputFilePath, boolean outputMp3) {
        this.sampleRate = sampleRate;
        this.format = new AudioFormat(sampleRate, 16, 1, true, false);
        this.outputFilePath = outputFilePath;
        this.saveToFile = true;
        this.outputMp3 = outputMp3;
        
        try {
            // 确保目录存在
            File file = new File(outputFilePath);
            file.getParentFile().mkdirs();
            
            if (outputMp3) {
                // 对于MP3输出，我们先收集所有PCM数据，最后转换
                this.pcmBuffer = new ByteArrayOutputStream();
                System.out.println("准备将音频数据保存为MP3: " + outputFilePath);
            } else {
                // 对于PCM输出，直接写入文件
                this.fileOutputStream = new FileOutputStream(file);
                System.out.println("准备将音频数据保存为PCM: " + outputFilePath);
            }
        } catch (IOException e) {
            throw new RuntimeException("无法创建输出文件: " + outputFilePath, e);
        }
        initThreads();
    }

    private void initThreads() {
        fileWriterThread = new Thread(() -> {
            try {
                if (!saveToFile) {
                    // 原有的播放逻辑
                    DataLine.Info info = new DataLine.Info(SourceDataLine.class, format);
                    line = (SourceDataLine) AudioSystem.getLine(info);
                    line.open(format);
                    line.start();
                }

                while (isRunning || !audioQueue.isEmpty()) {
                    byte[] audioChunk = audioQueue.poll(100, TimeUnit.MILLISECONDS);
                    if (audioChunk != null) {
                        if (saveToFile) {
                            if (outputMp3) {
                                // 对于MP3输出，先收集所有PCM数据
                                pcmBuffer.write(audioChunk);
                                System.out.println("收集音频数据: " + audioChunk.length + " 字节");
                            } else {
                                // 直接写入PCM文件
                                fileOutputStream.write(audioChunk);
                                fileOutputStream.flush();
                                System.out.println("写入音频数据: " + audioChunk.length + " 字节");
                            }
                        } else {
                            // 播放音频
                            line.write(audioChunk, 0, audioChunk.length);
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                if (saveToFile) {
                    try {
                        if (outputMp3) {
                            // 转换PCM数据为WAV
                            convertPcmToWav();
                        } else if (fileOutputStream != null) {
                            fileOutputStream.close();
                            System.out.println("PCM文件保存完成: " + outputFilePath);
                        }
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                }
            }
        });
    }

    public void start() {
        isRunning = true;
        fileWriterThread.start();
    }

    public void write(byte[] audioData) {
        if (isRunning) {
            audioQueue.offer(audioData);
        }
    }

    public void cancel() {
        isRunning = false;
        audioQueue.clear();
        if (saveToFile && fileOutputStream != null) {
            try {
                fileOutputStream.close();
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }

    public void waitForComplete() throws InterruptedException {
        if (fileWriterThread != null) {
            // 等待最多10秒钟
            fileWriterThread.join(10000);
            if (fileWriterThread.isAlive()) {
                System.out.println("线程等待超时，强制中断");
                fileWriterThread.interrupt();
            }
        }
        if (!saveToFile && line != null) {
            line.drain();
        }
    }
    
    private void convertPcmToWav() throws IOException {
        try {
            byte[] pcmData = pcmBuffer.toByteArray();
            System.out.println("开始转换PCM到WAV，PCM数据大小: " + pcmData.length + " 字节");
            
            // 创建AudioInputStream
            ByteArrayInputStream bais = new ByteArrayInputStream(pcmData);
            AudioInputStream audioInputStream = new AudioInputStream(bais, format, pcmData.length / format.getFrameSize());
            
            // 写入WAV文件
            File outputFile = new File(outputFilePath);
            AudioFileFormat.Type targetType = AudioFileFormat.Type.WAVE;
            
            AudioSystem.write(audioInputStream, targetType, outputFile);
            System.out.println("WAV音频文件保存完成: " + outputFilePath);
            
            audioInputStream.close();
            pcmBuffer.close();
            
        } catch (Exception e) {
            System.err.println("转换音频格式时出错: " + e.getMessage());
            e.printStackTrace();
            // 如果转换失败，保存为原始PCM文件
            savePcmFallback();
        }
    }
    
    private void savePcmFallback() throws IOException {
        String pcmPath = outputFilePath.replaceAll("\\.(mp3|wav)$", ".pcm");
        try (FileOutputStream fos = new FileOutputStream(pcmPath)) {
            pcmBuffer.writeTo(fos);
            System.out.println("转换失败，已保存为PCM文件: " + pcmPath);
        }
        pcmBuffer.close();
    }

    public void shutdown() {
        isRunning = false;
        if (!saveToFile && line != null) {
            line.close();
        }
    }
}
