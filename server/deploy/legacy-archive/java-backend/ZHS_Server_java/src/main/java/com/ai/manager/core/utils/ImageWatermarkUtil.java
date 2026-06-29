package com.ai.manager.core.utils;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * 图片文件流加水印工具类
 */
public class ImageWatermarkUtil {

    /**
     * 文字水印添加（文件流输入→文件流输出）
     * @param inputStream 原图片文件流
     * @param outputStream 加水印后的图片流（需外部创建，如ByteArrayOutputStream）
     * @param watermarkText 水印文字
     * @param format 图片格式（jpg/png/gif等）
     * @throws IOException IO异常
     */
    public static void addTextWatermark(InputStream inputStream, OutputStream outputStream,
                                        String watermarkText, String format) throws IOException {
        // 1. 读取图片流为BufferedImage
        BufferedImage sourceImage = ImageIO.read(inputStream);
        int width = sourceImage.getWidth();
        int height = sourceImage.getHeight();

        // 2. 创建画布（保留原图片透明度）
        BufferedImage watermarkedImage = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = watermarkedImage.createGraphics();

        // 3. 绘制原图片
        g2d.drawImage(sourceImage, 0, 0, width, height, null);

        // 4. 配置水印样式（字体、颜色、透明度、旋转）
        g2d.setColor(new Color(255, 255, 255, 128)); // 白色半透明（最后一位是透明度0-255）
        g2d.setFont(new Font("微软雅黑", Font.PLAIN, 30)); // 字体/样式/大小
        g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.5f)); // 整体透明度（0-1）

        // 5. 计算水印位置（居中显示，可自定义位置）
        FontMetrics fontMetrics = g2d.getFontMetrics();
        int textWidth = fontMetrics.stringWidth(watermarkText);
        int textHeight = fontMetrics.getHeight();
        int x = (width - textWidth) / 2;
        int y = (height + textHeight) / 2;

        // 6. 绘制文字水印（支持旋转，如旋转45度）
        g2d.rotate(Math.toRadians(-45), width / 2.0, height / 2.0); // 旋转角度/旋转中心
        g2d.drawString(watermarkText, x, y);

        // 7. 释放资源
        g2d.dispose();

        // 8. 输出加水印后的图片流
        ImageIO.write(watermarkedImage, format, outputStream);
    }

    /**
     * 图片水印添加（文件流输入→文件流输出）
     * @param inputStream 原图片文件流
     * @param outputStream 加水印后的图片流
     * @param watermarkImageStream 水印图片流（如logo）
     * @param format 图片格式
     * @throws IOException IO异常
     */
    public static void addImageWatermark(InputStream inputStream, OutputStream outputStream,
                                         InputStream watermarkImageStream, String format) throws Exception {
        // 1. 读取原图片和水印图片
        BufferedImage sourceImage = ImageIO.read(inputStream);
        BufferedImage watermarkImage = ImageIO.read(watermarkImageStream);
        int sourceWidth = sourceImage.getWidth();
        int sourceHeight = sourceImage.getHeight();
        int watermarkOrgWidth = watermarkImage.getWidth();
        int watermarkOrgHeight = watermarkImage.getHeight();

        // 2. 创建画布：匹配原始图片类型（解决颜色失真）
        int imageType = "jpeg".equalsIgnoreCase(format) ? BufferedImage.TYPE_INT_RGB : sourceImage.getType();
        BufferedImage watermarkedImage = new BufferedImage(sourceWidth, sourceHeight, imageType);
        Graphics2D g2d = watermarkedImage.createGraphics();

        // 3. 全局渲染优化（抗锯齿+高质量渲染）
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g2d.setRenderingHint(RenderingHints.KEY_COLOR_RENDERING, RenderingHints.VALUE_COLOR_RENDER_QUALITY);
        g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);

        // 4. 绘制原图片
        g2d.drawImage(sourceImage, 0, 0, sourceWidth, sourceHeight, null);

        // 5. 等比例缩小水印（核心逻辑）
        // 自定义：水印宽度不超过原图的10%（可调整，比如0.15=15%）
        double scaleRatio = 0.1;
        double targetWatermarkWidth = sourceWidth * scaleRatio;
        // 计算等比例缩放系数（宽高比不变）
        double scale = targetWatermarkWidth / watermarkOrgWidth;
        // 新的水印宽高（取整，避免小数像素）
        int newWatermarkWidth = (int) (watermarkOrgWidth * scale);
        int newWatermarkHeight = (int) (watermarkOrgHeight * scale);

        // 6. 配置水印透明度（0.7=70%不透明度，可调整）
        if (!"jpeg".equalsIgnoreCase(format)) {
            g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.7f));
        }

        // 7. 绘制缩放后的水印（仍在右下角，偏移量适配缩放后的尺寸）
        int x = sourceWidth - newWatermarkWidth - 20; // 右偏移20px
        int y = sourceHeight - newWatermarkHeight - 20; // 下偏移20px
        // 方式1：直接绘制缩放（简单）
        g2d.drawImage(watermarkImage, x, y, newWatermarkWidth, newWatermarkHeight, null);

        // 方式2：AffineTransform缩放（更高质量，可选）
        // AffineTransform at = new AffineTransform();
        // at.scale(scale, scale);
        // at.translate(x, y); // 偏移到右下角
        // g2d.drawImage(watermarkImage, at, null);

        // 8. 释放资源
        g2d.dispose();

        // 9. 输出流
        ImageIO.write(watermarkedImage, format, outputStream);
    }

}