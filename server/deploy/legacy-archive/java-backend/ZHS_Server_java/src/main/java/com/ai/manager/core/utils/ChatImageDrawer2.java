package com.ai.manager.core.utils;

import com.ai.manager.small.domain.ZhsUserAgentContext;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.Rectangle2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 聊天对话图片绘制工具类
 * 功能：将用户与AI的对话消息（文本+媒体）绘制为完整PNG截图
 * 无FontMetrics依赖，解决灰框空白、智汇值文本溢出问题
 * @author DevTeam
 * @date 2026-01-19
 */
public class ChatImageDrawer2 {
    // ===================== 全局可配置项 =====================
    /** 生成图片的固定宽度（像素）- 超高清版本（2倍分辨率） */
    private static final int IMAGE_WIDTH = 2400;
    /** 图片整体内边距（像素） - 同时也是用户问题距离右侧边界的距离和AI回答的左右边距 */
    private static final int PADDING = 120;
    /** 文本区域内边距（像素） */
    private static final int TEXT_PADDING = 90;
    /** 媒体文件专属内边距（像素）- 减少空白 */
    private static final int MEDIA_PADDING = 30;
    /** 文本行间距（像素） */
    private static final int LINE_SPACING = 60;
    /** 消息之间的间距（像素） */
    private static final int MESSAGE_SPACING = 60;
    /** 对话容器圆角半径（像素）- 超高清版本90px */
    private static final int BORDER_RADIUS = 90;
    /** AI消息文本最大显示宽度（像素），超出自动换行 */
    private static final int TEXT_MAX_WIDTH = IMAGE_WIDTH - PADDING * 2 - TEXT_PADDING * 2;
    /** 用户消息框最小左边距（像素）- 蓝色对话框左侧到画布左边缘的最小距离 */
    private static final int USER_MSG_MIN_LEFT_MARGIN = 400;
    /** 用户消息文本最大显示宽度（像素）- 保证左侧有固定边距 */
    private static final int USER_TEXT_MAX_WIDTH = IMAGE_WIDTH - PADDING - USER_MSG_MIN_LEFT_MARGIN - TEXT_PADDING * 2;
    /** 媒体文件缩略图尺寸（宽高一致，像素） */
    private static final int MEDIA_THUMB_SIZE = 720;
    /** 媒体文件之间的间距（像素） */
    private static final int MEDIA_SPACING = 60;
    /** 文本与媒体区域之间的间距（像素） */
    private static final int TEXT_MEDIA_GAP = 30;
    /** 智汇值文本区域内边距（像素）- 比普通文本更紧凑 */
    private static final int COST_TEXT_PADDING = 30;

    // 字体配置（阿里妈妈方圆体 - 可变字体）
    // 此字体实际参数：wght(字重) 200-700, BEVL(圆角) 1-100（只有这两个轴）
    /** 字体文件路径 */
//    private static final String FONT_PATH = "E:\\job\\aaa\\AlimamaFangYuanTiVF-Thin.ttf";
    private static final String FONT_PATH = "/home/ubuntu/AlimamaFangYuanTiVF-Thin.ttf";

    /** 
     * 字体圆角度（BEVL）值：1-100（1=直角，100=最圆）
     */
    private static final int FONT_BEVL = 100;
    
    /** 正文字重值（wght轴：200-700）- 正文使用 */
    private static final int FONT_WEIGHT_REGULAR = 450;
    /** 三级标题字重值（wght轴：200-700）- 三级标题使用 */
    private static final int FONT_WEIGHT_MEDIUM = 500;
    /** 二级标题字重值（wght轴：200-700）- 二级标题使用 */
    private static final int FONT_WEIGHT_SEMIBOLD = 600;
    /** 一级标题/URL链接字重值（wght轴：200-700）- 一级标题和URL使用 */
    private static final int FONT_WEIGHT_BOLD = 700;
    
    /** 缓存的不同字重和圆角的字体（键格式：weight * 10000 + bevl，确保唯一性） */
    private static Map<Integer, Font> weightFontCache = new HashMap<>();
    
    /**
     * 修改可变字体的 fvar 表，设置 BEVL 和 wght 轴的默认值，同时修改所有命名实例的坐标
     * @param fontData 原始字体文件字节数组
     * @param bevlValue BEVL 轴的目标值（1-100，100=最圆）
     * @param weightValue wght 轴的目标值（200-700）
     * @return 修改后的字体字节数组
     */
    private static byte[] modifyFvarTable(byte[] fontData, int bevlValue, int weightValue) {
        try {
            ByteBuffer buffer = ByteBuffer.wrap(fontData);
            buffer.order(ByteOrder.BIG_ENDIAN);
            
            // 跳过字体文件头签名（4字节）
            buffer.position(4);
            // 读取表数量
            int numTables = buffer.getShort() & 0xFFFF;
            // 跳过 searchRange, entrySelector, rangeShift（各2字节）
            buffer.position(12);
            
            // 遍历表目录，找到 fvar 表
            int fvarOffset = -1;
            int fvarLength = -1;
            for (int i = 0; i < numTables; i++) {
                int tableOffset = 12 + i * 16;
                buffer.position(tableOffset);
                
                // 读取表标签（4字节）
                byte[] tagBytes = new byte[4];
                buffer.get(tagBytes);
                String tag = new String(tagBytes, "ASCII");
                
                if ("fvar".equals(tag)) {
                    buffer.position(tableOffset + 8); // 跳过 checksum
                    fvarOffset = buffer.getInt();
                    fvarLength = buffer.getInt();
                    break;
                }
            }
            
            if (fvarOffset == -1) {
                System.err.println("未找到 fvar 表，字体可能不是可变字体");
                return fontData;
            }
            
            // 解析 fvar 表头
            buffer.position(fvarOffset);
            int majorVersion = buffer.getShort() & 0xFFFF;
            int minorVersion = buffer.getShort() & 0xFFFF;
            int axesArrayOffset = buffer.getShort() & 0xFFFF;
            buffer.getShort(); // reserved
            int axisCount = buffer.getShort() & 0xFFFF;
            int axisSize = buffer.getShort() & 0xFFFF;
            int instanceCount = buffer.getShort() & 0xFFFF;
            int instanceSize = buffer.getShort() & 0xFFFF;
            
            System.out.println("字体包含 " + axisCount + " 个可变轴, " + instanceCount + " 个命名实例:");
            
            // 记录轴的顺序（wght=0, BEVL=1）
            int wghtAxisIndex = -1;
            int bevlAxisIndex = -1;
            
            // 遍历轴数组，设置 BEVL 和 wght 轴默认值，并记录轴索引
            for (int i = 0; i < axisCount; i++) {
                int axisOffset = fvarOffset + axesArrayOffset + i * axisSize;
                buffer.position(axisOffset);
                
                // 读取轴标签
                byte[] axisTagBytes = new byte[4];
                buffer.get(axisTagBytes);
                String axisTag = new String(axisTagBytes, "ASCII");
                
                // 读取当前轴的范围信息
                buffer.position(axisOffset + 4);
                int minFixed = buffer.getInt();
                int defFixed = buffer.getInt();
                int maxFixed = buffer.getInt();
                float minVal = minFixed / 65536.0f;
                float defVal = defFixed / 65536.0f;
                float maxVal = maxFixed / 65536.0f;
                System.out.println("  轴[" + i + "] " + axisTag + ": min=" + minVal + ", default=" + defVal + ", max=" + maxVal);
                
                // 轴结构：tag(4) + minValue(4) + defaultValue(4) + maxValue(4) + flags(2) + nameID(2)
                int defaultValueOffset = axisOffset + 8; // 默认值在偏移8处
                
                if ("BEVL".equals(axisTag)) {
                    bevlAxisIndex = i;
                    // 设置 BEVL 轴默认值（Fixed 16.16 格式）
                    int fixedValue = bevlValue << 16;
                    fontData[defaultValueOffset] = (byte) ((fixedValue >> 24) & 0xFF);
                    fontData[defaultValueOffset + 1] = (byte) ((fixedValue >> 16) & 0xFF);
                    fontData[defaultValueOffset + 2] = (byte) ((fixedValue >> 8) & 0xFF);
                    fontData[defaultValueOffset + 3] = (byte) (fixedValue & 0xFF);
                    System.out.println("  -> 设置 BEVL 轴默认值为: " + bevlValue);
                } else if ("wght".equals(axisTag)) {
                    wghtAxisIndex = i;
                    // 设置 wght 轴默认值（Fixed 16.16 格式）
                    int fixedValue = weightValue << 16;
                    fontData[defaultValueOffset] = (byte) ((fixedValue >> 24) & 0xFF);
                    fontData[defaultValueOffset + 1] = (byte) ((fixedValue >> 16) & 0xFF);
                    fontData[defaultValueOffset + 2] = (byte) ((fixedValue >> 8) & 0xFF);
                    fontData[defaultValueOffset + 3] = (byte) (fixedValue & 0xFF);
                    System.out.println("  -> 设置 wght 轴默认值为: " + weightValue);
                }
            }
            
            // 修改所有命名实例的坐标值
            int instanceArrayOffset = fvarOffset + axesArrayOffset + axisCount * axisSize;
            System.out.println("修改所有 " + instanceCount + " 个命名实例的坐标...");
            
            for (int i = 0; i < instanceCount; i++) {
                int instOffset = instanceArrayOffset + i * instanceSize;
                // 实例结构：subfamilyNameID(2) + flags(2) + coordinates[axisCount](每个4字节)
                int coordsOffset = instOffset + 4; // 坐标数组起始位置
                
                // 修改每个轴的坐标
                for (int j = 0; j < axisCount; j++) {
                    int coordOffset = coordsOffset + j * 4;
                    int fixedValue;
                    if (j == wghtAxisIndex) {
                        fixedValue = weightValue << 16;
                    } else if (j == bevlAxisIndex) {
                        fixedValue = bevlValue << 16;
                    } else {
                        continue; // 其他轴保持不变
                    }
                    fontData[coordOffset] = (byte) ((fixedValue >> 24) & 0xFF);
                    fontData[coordOffset + 1] = (byte) ((fixedValue >> 16) & 0xFF);
                    fontData[coordOffset + 2] = (byte) ((fixedValue >> 8) & 0xFF);
                    fontData[coordOffset + 3] = (byte) (fixedValue & 0xFF);
                }
            }
            System.out.println("所有实例已修改为: wght=" + weightValue + ", BEVL=" + bevlValue);
            
            return fontData;
        } catch (Exception e) {
            System.err.println("修改 fvar 表失败: " + e.getMessage());
            return fontData;
        }
    }
    
    /** 
     * 加载指定字重的基础字体（支持修改可变字体轴参数）
     * @param weightValue 字重值（200-700）
     */
    private static Font getBaseFont(int weightValue) {
        // 生成包含 BEVL 值的缓存键（weight * 10000 + bevl，确保唯一性）
        // 这样当 FONT_BEVL 改变时，会重新加载字体
        int cacheKey = weightValue * 10000 + FONT_BEVL;
        
        // 检查缓存
        if (weightFontCache.containsKey(cacheKey)) {
            return weightFontCache.get(cacheKey);
        }
        
        try {
            File fontFile = new File(FONT_PATH);
            byte[] fontData = Files.readAllBytes(fontFile.toPath());
            
            // 修改 fvar 表，应用 BEVL 和 weight 值
            fontData = modifyFvarTable(fontData, FONT_BEVL, weightValue);
            
            // 写入临时文件再加载（确保 Java 使用修改后的数据）
            // 临时文件名也包含 BEVL 值，避免不同 BEVL 值的字体文件冲突
            File tempFile = File.createTempFile("font_" + weightValue + "_bevl" + FONT_BEVL + "_", ".ttf");
            tempFile.deleteOnExit();
            Files.write(tempFile.toPath(), fontData);
            Font font = Font.createFont(Font.TRUETYPE_FONT, tempFile);
            
            weightFontCache.put(cacheKey, font);
            System.out.println("字体加载成功，BEVL=" + FONT_BEVL + ", wght=" + weightValue + ", cacheKey=" + cacheKey);
            return font;
        } catch (Exception e) {
            System.err.println("加载字体失败(wght=" + weightValue + ", BEVL=" + FONT_BEVL + "): " + e.getMessage());
            e.printStackTrace();
            Font fallback = new Font("微软雅黑", Font.PLAIN, 12);
            weightFontCache.put(cacheKey, fallback);
            return fallback;
        }
    }
    
    /**
     * 清除字体缓存（当修改 FONT_BEVL 后调用此方法以重新加载字体）
     */
    public static void clearFontCache() {
        weightFontCache.clear();
        System.out.println("字体缓存已清除，下次使用时会重新加载字体（BEVL=" + FONT_BEVL + "）");
    }
    
    /** 
     * 加载自定义字体（指定大小和字重）
     * @param size 字体大小
     * @param wghtValue 字重值（200-700）
     */
    private static Font loadFont(float size, int wghtValue) {
        // 获取指定字重的基础字体
        Font baseFont = getBaseFont(wghtValue);
        // 派生指定大小的字体
        return baseFont.deriveFont(size);
    }

    /**
     * 绘制文本（模拟加粗）
     */
    private static void drawText(Graphics2D g2d, String text, int x, int y, boolean isBold) {
        for (int dx = 0; dx <= 3; dx++) {
            for (int dy = 0; dy <= 2; dy++) {
                g2d.drawString(text, x + dx, y + dy);
            }
        }
    }
    
    /**
     * 绘制URL文本（带下划线）
     */
    private static void drawUrlText(Graphics2D g2d, String text, int x, int y, Font font) {
        // 绘制文字
        g2d.drawString(text, x, y);
        
        // 绘制下划线
        Rectangle2D bounds = font.getStringBounds(text, g2d.getFontRenderContext());
        int textWidth = (int) bounds.getWidth();
        int underlineY = y + 8; // 下划线位置在文字下方（2倍分辨率）
        g2d.setStroke(new BasicStroke(4f));  // 2倍线条粗细
        g2d.drawLine(x, underlineY, x + textWidth, underlineY);
    }

    // ===================== 层级字体配置 =====================
    /** 一级标题字体（# 标题）- 大号加粗，突出显示（2倍分辨率） */
    private static final Font H1_FONT = loadFont(108f, FONT_WEIGHT_BOLD);
    /** 二级标题字体（## 标题）- 中等大小半粗（2倍分辨率） */
    private static final Font H2_FONT = loadFont(96f, FONT_WEIGHT_SEMIBOLD);
    /** 三级标题字体（### 标题）- 正常大小中等字重（2倍分辨率） */
    private static final Font H3_FONT = loadFont(88f, FONT_WEIGHT_MEDIUM);
    /** 正文字体 - 普通大小普通字重（2倍分辨率） */
    private static final Font BASE_FONT = loadFont(84f, FONT_WEIGHT_REGULAR);
    /** 加粗文本字体（**加粗**）- 正文大小加粗字重（2倍分辨率） */
    private static final Font BOLD_FONT = loadFont(84f, FONT_WEIGHT_BOLD);
    /** 智汇值消耗文本字体 - 小号普通字重（2倍分辨率） */
    private static final Font COST_FONT = loadFont(60f, FONT_WEIGHT_REGULAR);
    /** 标题字体（2倍分辨率，比H1大两个字号，使用最粗字重确保加粗效果） */
    private static final Font TITLE_FONT = loadFont(132f, FONT_WEIGHT_BOLD);  // 108 + 24 (两个字号单位)，使用700字重
    /** 标题区域高度（像素，2倍分辨率，增加上下间距） */
    private static final int TITLE_HEIGHT = 180;  // 增加高度以容纳上下间距
    /** 标题上下内边距（像素，2倍分辨率，增大上边距） */
    private static final int TITLE_VERTICAL_PADDING = 80;  // 增大上边距，使标题上方有更多空白
    /** 标题区域内边距（像素，2倍分辨率） */
    private static final int TITLE_PADDING = 30;
    /** 头像尺寸（像素，2倍分辨率） */
    private static final int AVATAR_SIZE = 108;
    
    // 标题颜色配置（层级递减：一级最深 → 正文最浅）
    /** 一级标题颜色 - 最深（接近纯黑） */
    private static final Color H1_COLOR = new Color(25, 25, 25);
    /** 二级标题颜色 - 次深 */
    private static final Color H2_COLOR = new Color(50, 50, 50);
    /** 三级标题颜色 - 中等深度 */
    private static final Color H3_COLOR = new Color(75, 75, 75);
    /** 正文颜色 - 较浅（易读但不抢眼） */
    private static final Color BODY_TEXT_COLOR = new Color(95, 95, 95);

    // 颜色配置
    /** 用户消息背景色（浅紫蓝） */
    private static final Color USER_BG_COLOR = new Color(154, 153, 243);
    /** AI助手消息背景色（浅灰色） */
    private static final Color AGENT_BG_COLOR = new Color(246, 246, 246);
    /** 媒体播放窗口背景色（黑色） */
    private static final Color MEDIA_BG_COLOR = Color.BLACK;
    /** 用户消息文本颜色（白色） */
    private static final Color USER_TEXT_COLOR = Color.WHITE;
    /** AI助手消息文本颜色 - 使用正文颜色 */
    private static final Color AGENT_TEXT_COLOR = BODY_TEXT_COLOR;
    /** 智汇值消耗文本颜色（#999 浅灰色） */
    private static final Color COST_TEXT_COLOR = new Color(153, 153, 153);
    /** URL链接颜色（蓝色） */
    private static final Color URL_COLOR = new Color(56, 132, 255);
    /** URL字体 - 加粗字重700（2倍分辨率） */
    private static final Font URL_FONT = loadFont(76f, FONT_WEIGHT_BOLD);
    // ========================================================

    /**
     * 文本类型枚举：区分不同层级的文本样式
     */
    private enum TextType {
        H1,      // 一级标题
        H2,      // 二级标题
        H3,      // 三级标题
        BODY,    // 正文
        BOLD,    // 加粗文本
        COST,    // 智汇值文本
        URL      // URL链接
    }

    /**
     * 文本分段实体类：存储文本内容、类型、字体样式
     */
    private static class TextSegment {
        String text;
        boolean isBold;
        Font font;
        TextType type;
        Color color;

        public TextSegment(String text, boolean isBold, Font font, TextType type, Color color) {
            this.text = text;
            this.isBold = isBold;
            this.font = font;
            this.type = type;
            this.color = color;
        }

        public TextSegment(String text, boolean isBold, Font font) {
            this(text, isBold, font, isBold ? TextType.BOLD : TextType.BODY, null);
        }

        @SuppressWarnings("unused")
        public TextSegment(String text, boolean isBold) {
            this(text, isBold, isBold ? BOLD_FONT : BASE_FONT);
        }
    }

    /**
     * 媒体类型枚举：区分图片/音频/视频/未知类型
     */
    private enum MediaType {
        IMAGE, AUDIO, VIDEO, UNKNOWN
    }
    
    /**
     * 媒体比例枚举
     */
    private enum MediaAspectRatio {
        RATIO_1_1(1, 1, "1:1"),           // 正方形
        RATIO_2_3(2, 3, "2:3"),           // 竖屏
        RATIO_3_2(3, 2, "3:2"),           // 横屏
        RATIO_9_16(9, 16, "9:16"),        // 手机竖屏
        RATIO_16_9(16, 9, "16:9"),        // 标准横屏
        RATIO_21_9(21, 9, "21:9"),        // 超宽屏
        RATIO_9_21(9, 21, "9:21");        // 超窄竖屏
        
        final int widthRatio;
        final int heightRatio;
        final String label;
        
        MediaAspectRatio(int w, int h, String label) {
            this.widthRatio = w;
            this.heightRatio = h;
            this.label = label;
        }
        
        /** 根据基础宽度计算实际高度 */
        int getHeight(int baseWidth) {
            return baseWidth * heightRatio / widthRatio;
        }
        
        /** 根据基础高度计算实际宽度 */
        int getWidth(int baseHeight) {
            return baseHeight * widthRatio / heightRatio;
        }
    }
    
    /** 媒体比例计数器（用于循环展示不同比例） */
    private static int mediaRatioCounter = 0;
    /** 所有媒体比例数组 */
    private static final MediaAspectRatio[] ALL_RATIOS = MediaAspectRatio.values();

    // ===================== 核心绘制方法 =====================

    /**
     * 绘制标题（头像+标题文本）
     * @param g2d 画布对象
     * @param avatarUrl 头像URL
     * @param titleText 标题文本
     * @param startY 开始绘制的Y坐标
     * @return 标题区域的高度
     * @throws IOException 头像加载失败
     */
    private static int drawTitle(Graphics2D g2d, String avatarUrl, String titleText, int startY) throws IOException {
        // 绘制标题背景（从 startY 开始，包含上下间距）
        g2d.setColor(Color.WHITE);
        g2d.fillRect(0, startY, IMAGE_WIDTH, TITLE_HEIGHT);
        
        // 确保上间距：内容区域从 startY + TITLE_VERTICAL_PADDING 开始（标题区域内部的上间距）

        // 计算头像和标题的总宽度
        int totalWidth = 0;
        int avatarTitleGap = 20; // 头像和标题之间的间距（像素，2倍分辨率，增大以适应更大字体）
        if (avatarUrl != null && !avatarUrl.trim().isEmpty()) {
            totalWidth += AVATAR_SIZE;
        }
        if (titleText != null && !titleText.trim().isEmpty()) {
            g2d.setFont(TITLE_FONT);
            Rectangle2D textBounds = TITLE_FONT.getStringBounds(titleText, g2d.getFontRenderContext());
            int textWidth = (int) Math.ceil(textBounds.getWidth());
            totalWidth += textWidth;
            if (avatarUrl != null && !avatarUrl.trim().isEmpty()) {
                totalWidth += avatarTitleGap; // 头像和标题之间的间距
            }
        }

        // 计算起始X坐标，使头像和标题居中
        int startX = (IMAGE_WIDTH - totalWidth) / 2;

        // 计算内容区域（排除上下间距）
        int contentStartY = startY + TITLE_VERTICAL_PADDING;
        int contentHeight = TITLE_HEIGHT - TITLE_VERTICAL_PADDING * 2;

        // 绘制头像
        if (avatarUrl != null && !avatarUrl.trim().isEmpty()) {
            try {
                BufferedImage avatar = ImageIO.read(new URL(avatarUrl));
                if (avatar != null) {
                    // 缩放头像到指定尺寸
                    BufferedImage scaledAvatar = new BufferedImage(AVATAR_SIZE, AVATAR_SIZE, BufferedImage.TYPE_INT_ARGB);
                    Graphics2D avatarG2d = scaledAvatar.createGraphics();
                    avatarG2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                    avatarG2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                    avatarG2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                    avatarG2d.drawImage(avatar, 0, 0, AVATAR_SIZE, AVATAR_SIZE, null);
                    avatarG2d.dispose();

                    // 绘制圆形头像（在内容区域内垂直居中）
                    int avatarX = startX;
                    int avatarY = contentStartY + (contentHeight - AVATAR_SIZE) / 2;
                    g2d.setClip(new java.awt.geom.Ellipse2D.Float(avatarX, avatarY, AVATAR_SIZE, AVATAR_SIZE));
                    g2d.drawImage(scaledAvatar, avatarX, avatarY, null);
                    g2d.setClip(null);

                    startX += AVATAR_SIZE + avatarTitleGap; // 更新起始X坐标
                }
            } catch (Exception e) {
                System.err.println("头像加载失败: " + e.getMessage());
            }
        }

        // 绘制标题文本（在内容区域内垂直居中，使用加粗效果）
        if (titleText != null && !titleText.trim().isEmpty()) {
            // 确保字体已设置（已经是BOLD字重）
            g2d.setFont(TITLE_FONT);
            g2d.setColor(Color.BLACK);
            // 使用 FontMetrics 计算文本位置，确保文字正确显示
            FontMetrics fm = g2d.getFontMetrics();
            int textY = contentStartY + (contentHeight - fm.getHeight()) / 2 + fm.getAscent();
            // 绘制文本（使用模拟加粗效果，确保加粗明显）
            drawText(g2d, titleText, startX, textY, true);
            System.out.println("标题文本已绘制: " + titleText + ", 位置: (" + startX + ", " + textY + "), 字体大小: " + TITLE_FONT.getSize() + ", 字重: " + FONT_WEIGHT_BOLD);
        }

        return TITLE_HEIGHT;
    }

    /**
     * 核心入口：绘制聊天对话图片并保存到指定路径（带标题）
     *
     * @param messages   对话消息列表
     * @param avatarUrl  头像URL
     * @param titleText  标题文本
     * @param outputPath 图片输出路径（如 "E:/chat.png"）
     * @return
     * @throws IOException IO异常
     */
    public static BufferedImage drawChatImage(List<ZhsUserAgentContext> messages, String avatarUrl, String titleText, String outputPath) throws IOException {
        if (messages == null || messages.isEmpty()) {
            throw new IllegalArgumentException("对话消息列表不能为空");
        }

        // 重置所有计数器
        resetHeightCalcCounter();
        mediaRatioCounter = 0;
        audioPlayerCounter = 0;

        // 临时画布：用于计算文本/媒体尺寸（1x1像素，节省内存）
        BufferedImage tempImage = new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB);
        Graphics2D tempG2d = tempImage.createGraphics();
        tempG2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        int totalHeight = calculateTotalHeight(messages, tempG2d);
        tempG2d.dispose();
        
        // 重置计数器用于实际绘制
        resetHeightCalcCounter();
        mediaRatioCounter = 0;
        audioPlayerCounter = 0;

        // 创建最终画布（使用ARGB获得更好的颜色质量，包含标题区域和上下间距）
        int finalHeight = totalHeight + TITLE_HEIGHT + TITLE_VERTICAL_PADDING * 2; // 标题区域 + 上间距 + 下间距
        BufferedImage image = new BufferedImage(IMAGE_WIDTH, finalHeight, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = image.createGraphics();
        // 设置最高质量渲染
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_LCD_HRGB);
        g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g2d.setRenderingHint(RenderingHints.KEY_ALPHA_INTERPOLATION, RenderingHints.VALUE_ALPHA_INTERPOLATION_QUALITY);
        g2d.setRenderingHint(RenderingHints.KEY_COLOR_RENDERING, RenderingHints.VALUE_COLOR_RENDER_QUALITY);
        g2d.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
        g2d.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);

        try {
            // 首先填充整个图片为白色背景（确保上边距区域也是白色）
            g2d.setColor(Color.WHITE);
            g2d.fillRect(0, 0, IMAGE_WIDTH, finalHeight);
            
            // 绘制标题（从顶部留出上间距）
            int titleStartY = TITLE_VERTICAL_PADDING; // 标题区域从顶部留出上间距
            drawTitle(g2d, avatarUrl, titleText, titleStartY);
            int currentY = titleStartY + TITLE_HEIGHT; // 标题区域结束位置

            // 绘制白色背景（标题下方）
            g2d.setColor(Color.WHITE);
            g2d.fillRect(0, currentY, IMAGE_WIDTH, totalHeight);

            // 标题与内容之间增加两个字号大小的间距（2倍分辨率，使用BASE_FONT的字号）
            int titleContentGap = BASE_FONT.getSize() * 2;
            currentY += titleContentGap; // 添加标题与内容之间的间距
            for (ZhsUserAgentContext msg : messages) {
                if (msg == null) continue;

                // 绘制用户消息
                String userText = msg.getProblem();
                String userMediaUrls = msg.getUserUrl();
                if (userText != null && !userText.trim().isEmpty() || (userMediaUrls != null && !userMediaUrls.trim().isEmpty())) {
                    currentY = drawSingleMessage(g2d, userText, userMediaUrls, true, currentY, msg);
                    currentY += MESSAGE_SPACING; // 统一间距
                }

                // 绘制AI消息
                String agentText = msg.getAnswer();
                String agentMediaUrls = msg.getAgentUrl();
                if (agentText != null && !agentText.trim().isEmpty() || (agentMediaUrls != null && !agentMediaUrls.trim().isEmpty())) {
                    currentY = drawSingleMessage(g2d, agentText, agentMediaUrls, false, currentY, msg);
                    currentY += MESSAGE_SPACING; // 统一间距
                }
            }

            // 保存图片
//            File outputFile = new File(outputPath);
//            if (!outputFile.getParentFile().exists()) {
//                outputFile.getParentFile().mkdirs();
//            }
//            ImageIO.write(image, "png", outputFile);
//            System.out.println("图片生成成功：" + outputFile.getAbsolutePath());
            return image;
        } finally {
            g2d.dispose();
        }
    }

    /**
     * 核心入口：绘制聊天对话图片并保存到指定路径
     * @param messages 对话消息列表
     * @param outputPath 图片输出路径（如 "E:/chat.png"）
     * @throws IOException IO异常
     */
    public static void drawChatImage(List<ZhsUserAgentContext> messages, String outputPath) throws IOException {
        drawChatImage(messages, null, null, outputPath);
    }

    /**
     * 绘制单条消息（用户/AI）：文本+媒体+智汇值
     * @param g2d 画布对象
     * @param text 消息文本
     * @param mediaUrls 媒体URL（逗号分隔）
     * @param isUser 是否为用户消息
     * @param startY 起始Y坐标
     * @param msg 消息上下文
     * @return 绘制后的结束Y坐标
     */
    private static int drawSingleMessage(Graphics2D g2d, String text, String mediaUrls, boolean isUser, int startY, ZhsUserAgentContext msg) {
        // 根据消息类型选择不同的文字最大宽度
        float maxTextWidth = isUser ? USER_TEXT_MAX_WIDTH : TEXT_MAX_WIDTH;
        
        // 1. 解析文本和媒体（使用对应的最大宽度）
        List<List<TextSegment>> lineSegments = text == null || text.trim().isEmpty()
                ? new ArrayList<>() : parseAndSplitText(g2d, text, false, maxTextWidth);
        List<String> mediaUrlList = parseMediaUrls(mediaUrls);

        // 2. 处理智汇值文本
        List<List<TextSegment>> costLineSegments = new ArrayList<>();
        int costTextHeight = 0;
        int costTextGap = 0;
        if (!isUser && msg != null) {
            boolean hasContent = (text != null && !text.trim().isEmpty()) || (mediaUrls != null && !mediaUrls.trim().isEmpty());
            if (hasContent) {
                String field1 = msg.getField1();
                String costText = "智汇AI生成 消耗智汇值：" + (field1 != null ? field1 : "");
                List<TextSegment> costSegments = new ArrayList<>();
                costSegments.add(new TextSegment(costText, false, COST_FONT));
                costLineSegments = splitSegmentsToLines(g2d, costSegments, maxTextWidth);
                costTextHeight = costLineSegments.isEmpty() ? 0 : costLineSegments.size() * (COST_FONT.getSize() + LINE_SPACING) - LINE_SPACING;
                costTextGap = costTextHeight > 0 ? TEXT_MEDIA_GAP : 0;
            }
        }

        // 3. 计算各区域高度（根据实际字体大小）
        int baseLineHeight = BASE_FONT.getSize() + LINE_SPACING;
        int textTotalHeight = calculateTextTotalHeight(lineSegments, baseLineHeight);
        int mediaTotalHeight = calculateMediaAreaHeight(mediaUrlList);

        // 文本区域高度（带内边距）
        int textAreaHeight = textTotalHeight > 0 ? (textTotalHeight + TEXT_PADDING * 2) : 0;
        // 媒体区域高度（带专属内边距，减少空白）
        int mediaAreaHeight = mediaTotalHeight > 0 ? (mediaTotalHeight + MEDIA_PADDING * 2) : 0;
        // 文本与媒体间距（仅两者都存在时生效）
        int gapHeight = (textTotalHeight > 0 && mediaTotalHeight > 0) ? TEXT_MEDIA_GAP : 0;
        // 智汇值文本区域高度（带紧凑内边距）
        int costTextAreaHeight = costTextHeight > 0 ? (costTextHeight + COST_TEXT_PADDING * 2) : 0;
        // 消息总高度（包含智汇值）
        int messageHeight = textAreaHeight + mediaAreaHeight + gapHeight + costTextGap + costTextAreaHeight;

        // 4. 初始化bgWidth（核心修复：计算灰框宽度）
        int textActualWidth = calculateTextActualWidth(g2d, lineSegments);
        int costTextActualWidth = calculateTextActualWidth(g2d, costLineSegments);
        // AI回答消息：最大背景框宽度 = 画布宽度 - 左右PADDING
        int maxBgWidth = IMAGE_WIDTH - PADDING * 2;
        // 用户消息：最大背景框宽度需要保证左侧至少有 USER_MSG_MIN_LEFT_MARGIN 的间距
        int userMaxBgWidth = IMAGE_WIDTH - PADDING - USER_MSG_MIN_LEFT_MARGIN;
        // 文本背景宽度 = 文本实际宽度 + 左右内边距
        int textBgWidth = textActualWidth + TEXT_PADDING * 2;
        int mediaBgWidth = MEDIA_THUMB_SIZE + MEDIA_PADDING * 2;
        // AI回答消息使用固定宽度，用户消息使用内容宽度（但不超过最大值）
        int bgWidth;
        if (!isUser) {
            bgWidth = maxBgWidth;
        } else {
            // 用户消息框宽度：取内容宽度，但限制在最大值以内
            int contentWidth = Math.max(Math.max(textBgWidth, mediaBgWidth), costTextActualWidth + TEXT_PADDING * 2);
            bgWidth = Math.min(contentWidth, userMaxBgWidth);
        }

        // 5. 绘制灰框（背景圆角矩形）
        // AI回答消息使用固定的PADDING，用户消息也使用PADDING（右对齐）
        int bgX = isUser ? (IMAGE_WIDTH - PADDING - bgWidth) : PADDING;
        int bgY = startY;
        g2d.setColor(isUser ? USER_BG_COLOR : AGENT_BG_COLOR);
        g2d.fillRoundRect(bgX, bgY, bgWidth, messageHeight, BORDER_RADIUS, BORDER_RADIUS);

        // 6. 绘制文本内容（支持不同层级样式）
        int currentY = bgY + TEXT_PADDING;
        if (!lineSegments.isEmpty()) {
            int textX = bgX + TEXT_PADDING;
            int textY = currentY + BASE_FONT.getSize();
            Color defaultTextColor = isUser ? USER_TEXT_COLOR : AGENT_TEXT_COLOR;
            
            for (List<TextSegment> line : lineSegments) {
                int segX = textX;
                // 计算当前行的行高（根据最大字体大小）
                int lineHeight = baseLineHeight;
                for (TextSegment seg : line) {
                    int segLineHeight = seg.font.getSize() + LINE_SPACING;
                    lineHeight = Math.max(lineHeight, segLineHeight);
                }
                
                for (TextSegment seg : line) {
                    g2d.setFont(seg.font);
                    // 根据文本类型设置颜色
                    if (isUser) {
                        g2d.setColor(USER_TEXT_COLOR); // 用户消息始终白色
                    } else if (seg.color != null) {
                        g2d.setColor(seg.color); // 使用指定颜色（标题/URL）
                    } else {
                        g2d.setColor(defaultTextColor); // 默认颜色
                    }
                    // 根据类型绘制文本
                    if (seg.type == TextType.URL && !isUser) {
                        // URL使用下划线样式
                        drawUrlText(g2d, seg.text, segX, textY, seg.font);
                    } else {
                        drawText(g2d, seg.text, segX, textY, seg.isBold);
                    }
                    // 替换FontMetrics：用getStringBounds计算文本宽度
                    Rectangle2D textBounds = seg.font.getStringBounds(seg.text, g2d.getFontRenderContext());
                    segX += (int) textBounds.getWidth();
                }
                textY += lineHeight;
            }
            currentY = bgY + textAreaHeight; // 文本区域结束坐标
        }

        // 7. 绘制媒体内容（与文字左侧对齐）
        if (!mediaUrlList.isEmpty()) {
            if (textTotalHeight > 0) {
                currentY += gapHeight;
            } else {
                currentY = bgY + TEXT_PADDING; // 无文本时媒体置顶，使用TEXT_PADDING保持对齐
            }
            int mediaX = bgX + TEXT_PADDING; // 与文字左侧对齐
            for (String mediaUrl : mediaUrlList) {
                MediaType mediaType = getMediaType(mediaUrl);
                drawSingleMedia(g2d, mediaUrl, mediaType, mediaX, currentY);
                // 根据媒体类型增加不同的高度
                if (mediaType == MediaType.AUDIO) {
                    currentY += AUDIO_PLAYER_HEIGHT_IDLE + MEDIA_SPACING;
                } else {
                    // 图片和视频根据当前比例计算高度（使用前一个计数器值，因为绘制时已经+1）
                    MediaAspectRatio ratio = ALL_RATIOS[(mediaRatioCounter - 1 + ALL_RATIOS.length) % ALL_RATIOS.length];
                    int[] size = getMediaSize(ratio);
                    currentY += size[1] + MEDIA_SPACING;
                }
            }
            currentY -= MEDIA_SPACING; // 去掉最后一个媒体的间距
        }

        // 8. 绘制智汇值文本（确保在灰框内）
        if (!costLineSegments.isEmpty()) {
            currentY += costTextGap;
            // 添加智汇值文本区域的上内边距（使用紧凑间距）
            currentY += COST_TEXT_PADDING;
            int costTextX = bgX + TEXT_PADDING;
            int costTextY = currentY + COST_FONT.getSize();
            g2d.setColor(COST_TEXT_COLOR);
            for (List<TextSegment> line : costLineSegments) {
                int maxCostWidth = bgWidth - TEXT_PADDING * 2;
                int segX = costTextX;
                for (TextSegment seg : line) {
                    String segText = seg.text;
                    g2d.setFont(seg.font);
                    // 替换FontMetrics：用getStringBounds计算文本宽度
                    Rectangle2D textBounds = seg.font.getStringBounds(segText, g2d.getFontRenderContext());
                    float textWidth = (float) textBounds.getWidth();

                    // 超出宽度则截断
                    if (textWidth > maxCostWidth) {
                        // 逐步截断文本直到宽度符合要求
                        while (textWidth > maxCostWidth && segText.length() > 3) {
                            segText = segText.substring(0, segText.length() - 1);
                            textBounds = seg.font.getStringBounds(segText + "...", g2d.getFontRenderContext());
                            textWidth = (float) textBounds.getWidth();
                        }
                        segText += "...";
                    }
                    drawText(g2d, segText, segX, costTextY, false);
                    // 重新计算截断后文本的宽度
                    textBounds = seg.font.getStringBounds(segText, g2d.getFontRenderContext());
                    segX += (int) textBounds.getWidth();
                }
                costTextY += COST_FONT.getSize() + LINE_SPACING;
                // 防止超出灰框高度
                if (costTextY > bgY + messageHeight - TEXT_PADDING) break;
            }
        }

        return startY + messageHeight;
    }

    // ===================== 辅助方法 =====================

    /** 用于高度计算的媒体比例计数器 */
    private static int heightCalcRatioCounter = 0;
    
    /**
     * 计算媒体区域总高度（根据媒体类型和比例返回不同高度）
     */
    private static int calculateMediaAreaHeight(List<String> mediaList) {
        if (mediaList.isEmpty()) return 0;
        int totalHeight = 0;
        for (String mediaUrl : mediaList) {
            MediaType type = getMediaType(mediaUrl);
            if (type == MediaType.AUDIO) {
                totalHeight += AUDIO_PLAYER_HEIGHT_IDLE + MEDIA_SPACING;
            } else {
                // 图片和视频根据比例计算高度
                MediaAspectRatio ratio = ALL_RATIOS[heightCalcRatioCounter % ALL_RATIOS.length];
                int[] size = getMediaSize(ratio);
                totalHeight += size[1] + MEDIA_SPACING;
                heightCalcRatioCounter++;
            }
        }
        return totalHeight - MEDIA_SPACING; // 去掉最后一个间距
    }
    
    /**
     * 重置高度计算计数器（在开始计算前调用）
     */
    private static void resetHeightCalcCounter() {
        heightCalcRatioCounter = 0;
    }

    /**
     * 计算所有消息的总高度
     */
    private static int calculateTotalHeight(List<ZhsUserAgentContext> messages, Graphics2D g2d) {
        int totalHeight = PADDING * 2;
        for (ZhsUserAgentContext msg : messages) {
            if (msg == null) continue;

            // 计算用户消息高度（使用用户消息专用的最大宽度）
            String userText = msg.getProblem();
            String userMediaUrls = msg.getUserUrl();
            if (userText != null && !userText.trim().isEmpty() || (userMediaUrls != null && !userMediaUrls.trim().isEmpty())) {
                List<List<TextSegment>> userLines = userText == null ? new ArrayList<>() : parseAndSplitText(g2d, userText, false, USER_TEXT_MAX_WIDTH);
                List<String> userMediaList = parseMediaUrls(userMediaUrls);
                totalHeight += calculateSingleMessageHeight(g2d, userLines, userMediaList, msg, true) + MESSAGE_SPACING;
            }

            // 计算AI消息高度（使用AI消息专用的最大宽度）
            String agentText = msg.getAnswer();
            String agentMediaUrls = msg.getAgentUrl();
            if (agentText != null && !agentText.trim().isEmpty() || (agentMediaUrls != null && !agentMediaUrls.trim().isEmpty())) {
                List<List<TextSegment>> agentLines = agentText == null ? new ArrayList<>() : parseAndSplitText(g2d, agentText, false, TEXT_MAX_WIDTH);
                List<String> agentMediaList = parseMediaUrls(agentMediaUrls);
                totalHeight += calculateSingleMessageHeight(g2d, agentLines, agentMediaList, msg, false) + MESSAGE_SPACING;
            }
        }
        return totalHeight;
    }

    /**
     * 计算文本总高度（支持不同字体大小的行）
     */
    private static int calculateTextTotalHeight(List<List<TextSegment>> lineSegments, int defaultLineHeight) {
        if (lineSegments.isEmpty()) return 0;
        int totalHeight = 0;
        for (List<TextSegment> line : lineSegments) {
            int lineHeight = defaultLineHeight;
            for (TextSegment seg : line) {
                int segLineHeight = seg.font.getSize() + LINE_SPACING;
                lineHeight = Math.max(lineHeight, segLineHeight);
            }
            totalHeight += lineHeight;
        }
        return totalHeight > 0 ? totalHeight - LINE_SPACING : 0;
    }

    /**
     * 计算单条消息的高度（含文本+媒体+智汇值）
     */
    private static int calculateSingleMessageHeight(Graphics2D g2d, List<List<TextSegment>> lineSegments, List<String> mediaList, ZhsUserAgentContext msg, boolean isUser) {
        int baseLineHeight = BASE_FONT.getSize() + LINE_SPACING;
        int textTotalHeight = calculateTextTotalHeight(lineSegments, baseLineHeight);
        int mediaTotalHeight = calculateMediaAreaHeight(mediaList);

        // 智汇值文本高度
        int costTextHeight = 0;
        int costTextGap = 0;
        if (!isUser && msg != null) {
            boolean hasContent = !lineSegments.isEmpty() || !mediaList.isEmpty();
            if (hasContent) {
                String field1 = msg.getField1();
                String costText = "智汇AI生成 消耗智汇值：" + (field1 != null ? field1 : "");
                List<TextSegment> costSegments = new ArrayList<>();
                costSegments.add(new TextSegment(costText, false, COST_FONT));
                List<List<TextSegment>> costLineSegments = splitSegmentsToLines(g2d, costSegments);
                costTextHeight = costLineSegments.isEmpty() ? 0 : costLineSegments.size() * (COST_FONT.getSize() + LINE_SPACING) - LINE_SPACING;
                costTextGap = costTextHeight > 0 ? TEXT_MEDIA_GAP : 0;
            }
        }

        // 区域高度
        int textAreaHeight = textTotalHeight > 0 ? (textTotalHeight + TEXT_PADDING * 2) : 0;
        int mediaAreaHeight = mediaTotalHeight > 0 ? (mediaTotalHeight + MEDIA_PADDING * 2) : 0;
        int gapHeight = (textTotalHeight > 0 && mediaTotalHeight > 0) ? TEXT_MEDIA_GAP : 0;
        // 智汇值文本区域高度（带紧凑内边距）
        int costTextAreaHeight = costTextHeight > 0 ? (costTextHeight + COST_TEXT_PADDING * 2) : 0;

        return textAreaHeight + mediaAreaHeight + gapHeight + costTextGap + costTextAreaHeight;
    }

    /**
     * 解析文本（处理标题和加粗）并分割为行
     * 支持 Markdown 格式：# 一级标题、## 二级标题、### 三级标题、**加粗**
     */
    private static List<List<TextSegment>> parseAndSplitText(Graphics2D g2d, String text, boolean isCostText) {
        List<TextSegment> segments = parseMarkdownText(text, isCostText);
        return splitSegmentsToLines(g2d, segments, TEXT_MAX_WIDTH);
    }
    
    /**
     * 解析文本（处理标题和加粗）并分割为行，使用指定的最大宽度
     */
    private static List<List<TextSegment>> parseAndSplitText(Graphics2D g2d, String text, boolean isCostText, float maxWidth) {
        List<TextSegment> segments = parseMarkdownText(text, isCostText);
        return splitSegmentsToLines(g2d, segments, maxWidth);
    }

    /**
     * 解析 Markdown 格式文本
     * 支持：# 一级标题、## 二级标题、### 三级标题、**加粗**、普通正文
     */
    private static List<TextSegment> parseMarkdownText(String text, boolean isCostText) {
        List<TextSegment> segments = new ArrayList<>();
        if (text == null || text.trim().isEmpty()) return segments;

        // 按换行符分割处理
        String[] lines = text.split("\n");
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            if (line.isEmpty()) {
                // 空行作为段落分隔
                segments.add(new TextSegment("\n", false, BASE_FONT, TextType.BODY, null));
                continue;
            }

            // 检测标题级别
            if (line.startsWith("### ")) {
                // 三级标题
                String titleText = line.substring(4).trim();
                if (!titleText.isEmpty()) {
                    segments.add(new TextSegment(titleText, true, H3_FONT, TextType.H3, H3_COLOR));
                }
            } else if (line.startsWith("## ")) {
                // 二级标题
                String titleText = line.substring(3).trim();
                if (!titleText.isEmpty()) {
                    segments.add(new TextSegment(titleText, true, H2_FONT, TextType.H2, H2_COLOR));
                }
            } else if (line.startsWith("# ")) {
                // 一级标题
                String titleText = line.substring(2).trim();
                if (!titleText.isEmpty()) {
                    segments.add(new TextSegment(titleText, true, H1_FONT, TextType.H1, H1_COLOR));
                }
            } else {
                // 普通行，解析加粗标记
                List<TextSegment> lineSegments = parseBoldInLine(line, isCostText);
                segments.addAll(lineSegments);
            }

            // 添加换行（除了最后一行）
            if (i < lines.length - 1) {
                segments.add(new TextSegment("\n", false, BASE_FONT, TextType.BODY, null));
            }
        }
        return segments;
    }

    /**
     * URL正则匹配模式
     */
    private static final String URL_PATTERN = "(https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+)";
    
    /**
     * 解析单行文本中的加粗标记（**内容**）和URL链接
     */
    private static List<TextSegment> parseBoldInLine(String line, boolean isCostText) {
        List<TextSegment> segments = new ArrayList<>();
        if (line == null || line.isEmpty()) return segments;
        
        // 先解析URL，再解析加粗
        List<TextSegment> urlParsedSegments = parseUrlInText(line, isCostText);
        
        // 对非URL段落继续解析加粗
        for (TextSegment seg : urlParsedSegments) {
            if (seg.type == TextType.URL) {
                segments.add(seg);
            } else {
                segments.addAll(parseBoldOnly(seg.text, isCostText));
            }
        }
        return segments;
    }
    
    /**
     * 解析文本中的URL链接
     */
    private static List<TextSegment> parseUrlInText(String text, boolean isCostText) {
        List<TextSegment> segments = new ArrayList<>();
        if (text == null || text.isEmpty()) return segments;
        
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(URL_PATTERN);
        java.util.regex.Matcher matcher = pattern.matcher(text);
        
        int lastEnd = 0;
        while (matcher.find()) {
            // 添加URL之前的文本
            if (matcher.start() > lastEnd) {
                String beforeUrl = text.substring(lastEnd, matcher.start());
                segments.add(new TextSegment(beforeUrl, false, isCostText ? COST_FONT : BASE_FONT, TextType.BODY, null));
            }
            // 添加URL
            String url = matcher.group(1);
            segments.add(new TextSegment(url, false, URL_FONT, TextType.URL, URL_COLOR));
            lastEnd = matcher.end();
        }
        
        // 添加剩余文本
        if (lastEnd < text.length()) {
            String remaining = text.substring(lastEnd);
            segments.add(new TextSegment(remaining, false, isCostText ? COST_FONT : BASE_FONT, TextType.BODY, null));
        }
        
        // 如果没有找到URL，返回原文本
        if (segments.isEmpty()) {
            segments.add(new TextSegment(text, false, isCostText ? COST_FONT : BASE_FONT, TextType.BODY, null));
        }
        
        return segments;
    }
    
    /**
     * 仅解析加粗标记（**内容**）
     */
    private static List<TextSegment> parseBoldOnly(String line, boolean isCostText) {
        List<TextSegment> segments = new ArrayList<>();
        if (line == null || line.isEmpty()) return segments;

        int index = 0;
        int len = line.length();
        while (index < len) {
            int boldStart = line.indexOf("**", index);
            if (boldStart == -1) {
                Font font = isCostText ? COST_FONT : BASE_FONT;
                String remaining = line.substring(index);
                if (!remaining.isEmpty()) {
                    segments.add(new TextSegment(remaining, false, font, TextType.BODY, null));
                }
                break;
            }
            if (boldStart > index) {
                Font font = isCostText ? COST_FONT : BASE_FONT;
                segments.add(new TextSegment(line.substring(index, boldStart), false, font, TextType.BODY, null));
            }
            int boldEnd = line.indexOf("**", boldStart + 2);
            if (boldEnd == -1) {
                Font font = isCostText ? COST_FONT : BOLD_FONT;
                segments.add(new TextSegment(line.substring(boldStart), true, font, TextType.BOLD, null));
                break;
            }
            String boldText = line.substring(boldStart + 2, boldEnd);
            if (!boldText.isEmpty()) {
                Font font = isCostText ? COST_FONT : BOLD_FONT;
                segments.add(new TextSegment(boldText, true, font, TextType.BOLD, null));
            }
            index = boldEnd + 2;
        }
        return segments;
    }

    /** 音频播放器高度（像素）- 未播放状态（2倍分辨率） */
    private static final int AUDIO_PLAYER_HEIGHT_IDLE = 240;
    /** 音频播放器高度（像素）- 播放中状态（2倍分辨率） */
    private static final int AUDIO_PLAYER_HEIGHT_PLAYING = 240;
    /** 音频播放器计数器（用于交替显示播放/未播放状态） */
    private static int audioPlayerCounter = 0;
    
    /**
     * 绘制单个媒体文件缩略图（自动循环不同比例）
     */
    private static void drawSingleMedia(Graphics2D g2d, String mediaUrl, MediaType mediaType, int x, int y) {
        // 获取当前比例
        MediaAspectRatio ratio = ALL_RATIOS[mediaRatioCounter % ALL_RATIOS.length];
        
        switch (mediaType) {
            case IMAGE:
                drawImageThumbnail(g2d, mediaUrl, x, y, ratio);
                mediaRatioCounter++;
                break;
            case AUDIO:
                // 交替显示播放中和未播放状态
                boolean isPlaying = (audioPlayerCounter % 2 == 1);
                drawAudioPlayer(g2d, x, y, isPlaying);
                audioPlayerCounter++;
                break;
            case VIDEO:
                drawVideoPlayer(g2d, x, y, ratio);
                mediaRatioCounter++;
                break;
            default:
                g2d.setColor(Color.LIGHT_GRAY);
                g2d.fillRect(x, y, MEDIA_THUMB_SIZE, MEDIA_THUMB_SIZE);
                g2d.setColor(Color.GRAY);
                g2d.setFont(BASE_FONT.deriveFont(12f));
                g2d.drawString("未知文件", x + 10, y + MEDIA_THUMB_SIZE / 2);
                break;
        }
    }
    
    /**
     * 根据比例计算媒体尺寸（基于固定宽度，限制最大高度）
     */
    private static int[] getMediaSize(MediaAspectRatio ratio) {
        int baseWidth = MEDIA_THUMB_SIZE;
        int maxHeight = 1000;  // 最大高度限制（2倍分辨率）
        
        int width = baseWidth;
        int height = ratio.getHeight(baseWidth);
        
        // 如果高度超过最大值，则按高度计算宽度
        if (height > maxHeight) {
            height = maxHeight;
            width = ratio.getWidth(height);
        }
        
        return new int[]{width, height};
    }
    
    /**
     * 绘制音频播放器（支持播放/未播放状态）
     * @param isPlaying 是否正在播放
     */
    private static void drawAudioPlayer(Graphics2D g2d, int x, int y, boolean isPlaying) {
        // 模拟数据
        String totalDuration = "2:35";
        String currentTime = "0:47";
        float progress = isPlaying ? 0.3f : 0f;
        
        // 主题色
        Color accentColor = new Color(64, 158, 255);  // 蓝色主题
        Color darkGray = new Color(80, 80, 85);
        Color mediumGray = new Color(130, 130, 135);
        Color lightGray = new Color(230, 230, 235);
        
        if (isPlaying) {
            // ====== 播放中状态：完整播放器 ======
            int width = MEDIA_THUMB_SIZE + 560;  // 加宽（2倍）
            int height = AUDIO_PLAYER_HEIGHT_PLAYING;
            int cornerRadius = 100;  // 更大圆角（2倍）
            
            // 1. 绘制白色圆角背景 + 阴影
            g2d.setColor(new Color(0, 0, 0, 12));
            g2d.fillRoundRect(x + 6, y + 8, width, height, cornerRadius, cornerRadius);
            g2d.setColor(Color.WHITE);
            g2d.fillRoundRect(x, y, width, height, cornerRadius, cornerRadius);
            
            // 2. 绘制边框
            g2d.setColor(new Color(220, 220, 225));
            g2d.setStroke(new BasicStroke(3f));  // 2倍线条粗细
            g2d.drawRoundRect(x, y, width, height, cornerRadius, cornerRadius);
            
            // 3. 绘制暂停按钮（圆形蓝色背景）
            int btnSize = 120;  // 2倍
            int btnX = x + 50;  // 2倍
            int btnY = y + (height - btnSize) / 2;
            g2d.setColor(accentColor);
            g2d.fillOval(btnX, btnY, btnSize, btnSize);
            
            // 暂停图标（两条白色竖线）
            g2d.setColor(Color.WHITE);
            int pauseBarWidth = 14;  // 2倍
            int pauseBarHeight = 48;  // 2倍
            int pauseX = btnX + btnSize / 2 - 18;  // 2倍
            int pauseY = btnY + (btnSize - pauseBarHeight) / 2;
            g2d.fillRoundRect(pauseX, pauseY, pauseBarWidth, pauseBarHeight, 6, 6);
            g2d.fillRoundRect(pauseX + 24, pauseY, pauseBarWidth, pauseBarHeight, 6, 6);
            
            // 4. 绘制动态声波（5条蓝色竖线）
            int waveX = btnX + btnSize + 40;  // 2倍
            int waveY = y + height / 2;
            g2d.setColor(accentColor);
            int[] waveHeights = {40, 64, 52, 68, 44};  // 2倍
            for (int i = 0; i < 5; i++) {
                int wh = waveHeights[i];
                g2d.fillRoundRect(waveX + i * 24, waveY - wh / 2, 10, wh, 4, 4);  // 2倍
            }
            
            // 5. 绘制进度条
            int progressBarX = waveX + 150;  // 2倍
            int progressBarY = y + height / 2 - 8;  // 2倍
            int progressBarWidth = width - (progressBarX - x) - 60;  // 2倍
            int progressBarHeight = 16;  // 2倍
            
            // 进度条背景
            g2d.setColor(lightGray);
            g2d.fillRoundRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight, 8, 8);
            
            // 已播放部分
            int playedWidth = (int) (progressBarWidth * progress);
            g2d.setColor(accentColor);
            g2d.fillRoundRect(progressBarX, progressBarY, playedWidth, progressBarHeight, 8, 8);
            
            // 进度圆点
            int dotSize = 32;  // 2倍
            g2d.fillOval(progressBarX + playedWidth - dotSize / 2, progressBarY - 8, dotSize, dotSize);
            
            // 6. 绘制时间信息
            g2d.setFont(loadFont(48f, FONT_WEIGHT_REGULAR));  // 2倍
            g2d.setColor(accentColor);
            drawText(g2d, currentTime, progressBarX, y + height - 30, false);  // 2倍
            g2d.setColor(darkGray);
            drawText(g2d, totalDuration, x + width - 150, y + height - 30, false);  // 2倍
            
        } else {
            // ====== 未播放状态：简洁气泡风格 ======
            int bubbleHeight = 200;  // 2倍
            int paddingLeft = 100;     // 左内边距（2倍）
            int paddingRight = 120;    // 右内边距（2倍）
            int waveWidth = 200;      // 声波区域宽度（2倍）
            int gapWidth = 160;        // 声波与时长之间的间距（2倍）
            int cornerRadius = 100;    // 大圆角（胶囊形，2倍）
            
            // 计算时长文字宽度
            g2d.setFont(loadFont(72f, FONT_WEIGHT_REGULAR));  // 2倍
            String durationText = totalDuration.replace(":", "'") + "\"";
            Rectangle2D textBounds = g2d.getFont().getStringBounds(durationText, g2d.getFontRenderContext());
            int textWidth = (int) Math.ceil(textBounds.getWidth());
            
            // 计算气泡总宽度（设置最小宽度保证足够宽）
            int minWidth = 760;  // 2倍
            int calculatedWidth = paddingLeft + waveWidth + gapWidth + textWidth + paddingRight;
            int bubbleWidth = Math.max(minWidth, calculatedWidth);
            
            // 垂直居中
            int allocatedHeight = AUDIO_PLAYER_HEIGHT_IDLE;
            int offsetY = (allocatedHeight - bubbleHeight) / 2;
            int actualY = y + offsetY;
            
            // 1. 绘制阴影
            g2d.setColor(new Color(0, 0, 0, 10));
            g2d.fillRoundRect(x + 4, actualY + 6, bubbleWidth, bubbleHeight, cornerRadius, cornerRadius);  // 2倍
            
            // 2. 绘制白色气泡背景
            g2d.setColor(Color.WHITE);
            g2d.fillRoundRect(x, actualY, bubbleWidth, bubbleHeight, cornerRadius, cornerRadius);
            
            // 3. 绘制边框
            g2d.setColor(new Color(220, 220, 225));
            g2d.setStroke(new BasicStroke(3f));  // 2倍
            g2d.drawRoundRect(x, actualY, bubbleWidth, bubbleHeight, cornerRadius, cornerRadius);
            
            // 4. 绘制静态声波图标（三条弧线，放大版）
            int waveBaseX = x + paddingLeft + 30;  // 2倍
            int waveBaseY = actualY + bubbleHeight / 2;
            g2d.setColor(mediumGray);
            g2d.setStroke(new BasicStroke(7f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));  // 2倍
            
            // 绘制三条递增的弧线
            for (int i = 0; i < 3; i++) {
                int arcRadius = 24 + i * 24;  // 放大弧线（2倍）
                int arcX = waveBaseX - arcRadius;
                int arcY = waveBaseY - arcRadius;
                g2d.drawArc(arcX, arcY, arcRadius * 2, arcRadius * 2, -45, 90);
            }
            
            // 5. 显示时长
            g2d.setFont(loadFont(72f, FONT_WEIGHT_REGULAR));  // 2倍
            g2d.setColor(darkGray);
            int textX = x + bubbleWidth - paddingRight - textWidth;
            int textY = actualY + bubbleHeight / 2 + 12;
            drawText(g2d, durationText, textX, textY, false);
        }
    }
    
    /**
     * 绘制音频播放器（默认未播放状态）
     */
    private static void drawAudioPlayer(Graphics2D g2d, int x, int y) {
        drawAudioPlayer(g2d, x, y, false);
    }

    /**
     * 绘制图片缩略图（支持不同比例）
     */
    private static void drawImageThumbnail(Graphics2D g2d, String imageUrl, int x, int y, MediaAspectRatio ratio) {
        int[] size = getMediaSize(ratio);
        int width = size[0];
        int height = size[1];
        int cornerRadius = 40;  // 2倍
        
        // 模拟图片背景（渐变色）
        Color[] gradientColors = {
            new Color(255, 200, 150),  // 橙色
            new Color(180, 220, 255),  // 蓝色
            new Color(200, 255, 200),  // 绿色
            new Color(255, 200, 220),  // 粉色
            new Color(220, 200, 255),  // 紫色
            new Color(255, 255, 180),  // 黄色
            new Color(200, 255, 255),  // 青色
        };
        Color bgColor = gradientColors[mediaRatioCounter % gradientColors.length];
        
        // 1. 绘制圆角背景
        g2d.setColor(bgColor);
        g2d.fillRoundRect(x, y, width, height, cornerRadius, cornerRadius);
        
        // 2. 绘制装饰图案（模拟图片内容）
        g2d.setColor(new Color(255, 255, 255, 80));
        int centerX = x + width / 2;
        int centerY = y + height / 2;
        // 绘制圆形装饰
        int circleSize = Math.min(width, height) / 3;
        g2d.fillOval(centerX - circleSize / 2, centerY - circleSize / 2 - 40, circleSize, circleSize);  // 2倍
        // 绘制矩形装饰（模拟山脉）
        int[] xPoints = {x + 40, x + width / 3, x + width / 2};  // 2倍
        int[] yPoints = {y + height - 80, y + height / 2, y + height - 80};  // 2倍
        g2d.fillPolygon(xPoints, yPoints, 3);
        int[] xPoints2 = {x + width / 3, x + width * 2 / 3, x + width - 40};  // 2倍
        int[] yPoints2 = {y + height - 80, y + height / 3, y + height - 80};  // 2倍
        g2d.fillPolygon(xPoints2, yPoints2, 3);
        
        // 3. 绘制边框
        g2d.setColor(new Color(0, 0, 0, 30));
        g2d.setStroke(new BasicStroke(4));  // 2倍
        g2d.drawRoundRect(x, y, width, height, cornerRadius, cornerRadius);
        
        // 4. 绘制比例标签（左上角）
        g2d.setColor(new Color(0, 0, 0, 120));
        g2d.fillRoundRect(x + 24, y + 24, 140, 64, 16, 16);  // 2倍
        g2d.setFont(loadFont(44f, FONT_WEIGHT_REGULAR));  // 2倍
        g2d.setColor(Color.WHITE);
        drawText(g2d, ratio.label, x + 44, y + 72, false);  // 2倍
        
        // 5. 绘制图片图标（右下角）
        int iconSize = 72;  // 2倍
        int iconX = x + width - iconSize - 30;  // 2倍
        int iconY = y + height - iconSize - 30;  // 2倍
        g2d.setColor(new Color(0, 0, 0, 100));
        g2d.fillRoundRect(iconX - 10, iconY - 10, iconSize + 20, iconSize + 20, 16, 16);  // 2倍
        // 绘制图片图标
        g2d.setColor(Color.WHITE);
        g2d.setStroke(new BasicStroke(4));  // 2倍
        g2d.drawRoundRect(iconX, iconY, iconSize, iconSize, 12, 12);  // 2倍
        g2d.fillOval(iconX + 16, iconY + 16, 20, 20);  // 太阳（2倍）
        // 山形
        int[] mX = {iconX + 10, iconX + 36, iconX + 62};  // 2倍
        int[] mY = {iconY + iconSize - 16, iconY + 30, iconY + iconSize - 16};  // 2倍
        g2d.fillPolygon(mX, mY, 3);
    }

    /**
     * 绘制视频播放窗口（支持不同比例）
     */
    private static void drawVideoPlayer(Graphics2D g2d, int x, int y, MediaAspectRatio ratio) {
        int[] size = getMediaSize(ratio);
        int width = size[0];
        int height = size[1];
        int cornerRadius = 40;  // 2倍
        
        // 1. 绘制深色背景
        g2d.setColor(new Color(25, 25, 30));
        g2d.fillRoundRect(x, y, width, height, cornerRadius, cornerRadius);
        
        // 2. 绘制渐变底部栏
        int barHeight = Math.min(120, height / 4);  // 2倍
        GradientPaint gradient = new GradientPaint(
            x, y + height - barHeight * 2, new Color(0, 0, 0, 0),
            x, y + height, new Color(0, 0, 0, 200)
        );
        g2d.setPaint(gradient);
        g2d.fillRoundRect(x, y + height - barHeight * 2, width, barHeight * 2, cornerRadius, cornerRadius);
        
        // 3. 绘制中央播放按钮
        int btnRadius = Math.min(90, Math.min(width, height) / 5);  // 2倍
        int btnX = x + width / 2;
        int btnY = y + height / 2 - 20;  // 2倍
        g2d.setColor(new Color(255, 255, 255, 60));
        g2d.fillOval(btnX - btnRadius, btnY - btnRadius, btnRadius * 2, btnRadius * 2);
        
        // 4. 绘制播放三角形
        g2d.setColor(Color.WHITE);
        int triangleSize = btnRadius / 2;
        int[] xPoints = {btnX - triangleSize / 2, btnX + triangleSize, btnX - triangleSize / 2};
        int[] yPoints = {btnY - triangleSize, btnY, btnY + triangleSize};
        g2d.fillPolygon(xPoints, yPoints, 3);
        
        // 5. 绘制比例标签（左上角）
        g2d.setColor(new Color(0, 0, 0, 150));
        g2d.fillRoundRect(x + 24, y + 24, 140, 64, 16, 16);  // 2倍
        g2d.setFont(loadFont(44f, FONT_WEIGHT_REGULAR));  // 2倍
        g2d.setColor(Color.WHITE);
        drawText(g2d, ratio.label, x + 44, y + 72, false);  // 2倍
        
        // 6. 绘制进度条
        int progressY = y + height - 50;  // 2倍
        int progressWidth = width - 80;  // 2倍
        g2d.setColor(new Color(255, 255, 255, 80));
        g2d.fillRoundRect(x + 40, progressY, progressWidth, 12, 6, 6);  // 2倍
        // 已播放部分（30%）
        g2d.setColor(new Color(255, 90, 90));
        g2d.fillRoundRect(x + 40, progressY, (int)(progressWidth * 0.3), 12, 6, 6);  // 2倍
        
        // 7. 绘制时长信息
        g2d.setFont(loadFont(40f, FONT_WEIGHT_REGULAR));  // 2倍
        g2d.setColor(new Color(200, 200, 200));
        drawText(g2d, "01:35", x + 40, y + height - 70, false);  // 2倍
        drawText(g2d, "05:30", x + width - 140, y + height - 70, false);  // 2倍
        
        // 8. 绘制视频图标（右上角）
        g2d.setColor(new Color(255, 90, 90, 200));
        g2d.fillRoundRect(x + width - 110, y + 24, 84, 56, 12, 12);  // 2倍
        g2d.setFont(loadFont(36f, FONT_WEIGHT_REGULAR));  // 2倍
        g2d.setColor(Color.WHITE);
        drawText(g2d, "HD", x + width - 96, y + 64, false);  // 2倍
    }

    /**
     * 解析媒体URL为列表
     */
    private static List<String> parseMediaUrls(String mediaUrls) {
        List<String> urlList = new ArrayList<>();
        if (mediaUrls == null || mediaUrls.trim().isEmpty()) return urlList;
        String[] urls = mediaUrls.split(",");
        for (String url : urls) {
            String trimUrl = url.trim();
            if (!trimUrl.isEmpty()) urlList.add(trimUrl);
        }
        return urlList;
    }

    /**
     * 判断媒体类型
     */
    private static MediaType getMediaType(String mediaUrl) {
        if (mediaUrl == null || mediaUrl.trim().isEmpty()) return MediaType.UNKNOWN;
        String lowerUrl = mediaUrl.toLowerCase();
        if (lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg") || lowerUrl.endsWith(".png") || lowerUrl.endsWith(".gif") || lowerUrl.endsWith(".bmp")) {
            return MediaType.IMAGE;
        } else if (lowerUrl.endsWith(".mp3") || lowerUrl.endsWith(".wav") || lowerUrl.endsWith(".m4a") || lowerUrl.endsWith(".flac")) {
            return MediaType.AUDIO;
        } else if (lowerUrl.endsWith(".mp4") || lowerUrl.endsWith(".avi") || lowerUrl.endsWith(".mov") || lowerUrl.endsWith(".mkv")) {
            return MediaType.VIDEO;
        } else {
            return MediaType.UNKNOWN;
        }
    }

    /**
     * 缩放图片到指定尺寸
     */
    private static BufferedImage scaleImage(BufferedImage original, int targetWidth, int targetHeight) {
        int originalWidth = original.getWidth();
        int originalHeight = original.getHeight();
        double scaleX = (double) targetWidth / originalWidth;
        double scaleY = (double) targetHeight / originalHeight;
        double scale = Math.min(scaleX, scaleY);

        int newWidth = (int) (originalWidth * scale);
        int newHeight = (int) (originalHeight * scale);
        BufferedImage scaled = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = scaled.createGraphics();
        // 设置最高质量缩放
        g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        int x = (targetWidth - newWidth) / 2;
        int y = (targetHeight - newHeight) / 2;
        g2d.drawImage(original, x, y, newWidth, newHeight, null);
        g2d.dispose();
        return scaled;
    }

    /**
     * 计算文本实际显示宽度（替换FontMetrics）
     */
    private static int calculateTextActualWidth(Graphics2D g2d, List<List<TextSegment>> lineSegments) {
        int maxLineWidth = 0;
        for (List<TextSegment> line : lineSegments) {
            int lineWidth = 0;
            for (TextSegment seg : line) {
                // 替换FontMetrics：用getStringBounds计算文本宽度
                Rectangle2D textBounds = seg.font.getStringBounds(seg.text, g2d.getFontRenderContext());
                lineWidth += (int) textBounds.getWidth();
            }
            maxLineWidth = Math.max(maxLineWidth, lineWidth);
        }
        return maxLineWidth;
    }

    /**
     * 将文本分段分割为适配宽度的行（替换FontMetrics）
     * 支持换行符和标题的正确处理
     */
    private static List<List<TextSegment>> splitSegmentsToLines(Graphics2D g2d, List<TextSegment> segments) {
        return splitSegmentsToLines(g2d, segments, TEXT_MAX_WIDTH);
    }
    
    /**
     * 将文本分段分割为适配宽度的行，使用指定的最大宽度
     */
    private static List<List<TextSegment>> splitSegmentsToLines(Graphics2D g2d, List<TextSegment> segments, float maxWidth) {
        List<List<TextSegment>> lines = new ArrayList<>();
        if (segments.isEmpty()) return lines;

        List<TextSegment> currentLine = new ArrayList<>();
        float currentWidth = 0;
        float maxLineWidth = maxWidth;

        for (TextSegment seg : segments) {
            // 处理换行符
            if (seg.text.equals("\n")) {
                if (!currentLine.isEmpty()) {
                    lines.add(new ArrayList<>(currentLine));
                    currentLine.clear();
                    currentWidth = 0;
                }
                continue;
            }

            // 标题单独成行
            if (seg.type == TextType.H1 || seg.type == TextType.H2 || seg.type == TextType.H3) {
                // 先保存当前行
                if (!currentLine.isEmpty()) {
                    lines.add(new ArrayList<>(currentLine));
                    currentLine.clear();
                    currentWidth = 0;
                }
                // 标题可能需要换行
                Rectangle2D textBounds = seg.font.getStringBounds(seg.text, g2d.getFontRenderContext());
                float segWidth = (float) textBounds.getWidth();
                if (segWidth > maxLineWidth) {
                    // 标题过长需要换行
                    String longText = seg.text;
                    int start = 0;
                    while (start < longText.length()) {
                        int end = findMaxCharCount(g2d, seg.font, longText.substring(start), maxLineWidth);
                        currentLine.add(new TextSegment(longText.substring(start, start + end), seg.isBold, seg.font, seg.type, seg.color));
                        lines.add(new ArrayList<>(currentLine));
                        currentLine.clear();
                        start += end;
                    }
                } else {
                    currentLine.add(seg);
                    lines.add(new ArrayList<>(currentLine));
                    currentLine.clear();
                }
                currentWidth = 0;
                continue;
            }

            // 替换FontMetrics：用getStringBounds计算文本宽度
            Rectangle2D textBounds = seg.font.getStringBounds(seg.text, g2d.getFontRenderContext());
            float segWidth = (float) textBounds.getWidth();

            if (currentWidth + segWidth > maxLineWidth && !currentLine.isEmpty()) {
                lines.add(new ArrayList<>(currentLine));
                currentLine.clear();
                currentWidth = 0;
            }

            if (segWidth > maxLineWidth) {
                String longText = seg.text;
                Font longFont = seg.font;
                int start = 0;
                while (start < longText.length()) {
                    int end = findMaxCharCount(g2d, longFont, longText.substring(start), maxLineWidth);
                    currentLine.add(new TextSegment(longText.substring(start, start + end), seg.isBold, longFont, seg.type, seg.color));
                    lines.add(new ArrayList<>(currentLine));
                    currentLine.clear();
                    currentWidth = 0;
                    start += end;
                }
            } else {
                currentLine.add(seg);
                currentWidth += segWidth;
            }
        }

        if (!currentLine.isEmpty()) {
            lines.add(currentLine);
        }
        return lines;
    }

    /**
     * 二分查找最大可显示字符数（替换FontMetrics）
     */
    private static int findMaxCharCount(Graphics2D g2d, Font font, String text, float maxWidth) {
        int left = 1;
        int right = text.length();
        int maxCount = 0;

        while (left <= right) {
            int mid = (left + right) / 2;
            String subText = text.substring(0, mid);
            // 替换FontMetrics：用getStringBounds计算文本宽度
            Rectangle2D textBounds = font.getStringBounds(subText, g2d.getFontRenderContext());
            float width = (float) textBounds.getWidth();

            if (width <= maxWidth) {
                maxCount = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        return Math.max(maxCount, 1); // 至少返回1个字符
    }

    // ===================== 测试方法 =====================
    public static void main(String[] args) {
        List<ZhsUserAgentContext> messages = new ArrayList<>();
        
        // 测试消息1：展示多种比例的图片（1:1, 2:3, 3:2）
        messages.add(ZhsUserAgentContext.builder()
                .problem("能给我看看不同比例的图片吗？")
                .answer("# 图片比例展示\n" +
                        "以下是三种常见图片比例的示例：\n" +
                        "**1:1** - 正方形，适合头像和产品图\n" +
                        "**2:3** - 竖版，适合人像照片\n" +
                        "**3:2** - 横版，适合风景照片")
                .field1("100")
                .agentUrl("https://example.com/img1.png,https://example.com/img2.png,https://example.com/img3.png")
                .build());
        
        // 测试消息2：展示更多比例的图片（9:16, 16:9, 21:9, 9:21）
        messages.add(ZhsUserAgentContext.builder()
                .problem("还有其他特殊比例吗？")
                .answer("# 特殊比例图片\n" +
                        "**9:16** - 手机竖屏，适合短视频封面\n" +
                        "**16:9** - 标准横屏，适合视频缩略图\n" +
                        "**21:9** - 超宽屏，适合电影画面\n" +
                        "**9:21** - 超窄竖屏，适合长图海报")
                .field1("120")
                .agentUrl("https://example.com/img4.png,https://example.com/img5.png,https://example.com/img6.png,https://example.com/img7.png")
                .build());
        
        // 测试消息3：展示多种比例的视频（循环展示）
        messages.add(ZhsUserAgentContext.builder()
                .problem("视频也有不同比例吗？")
                .answer("# 视频比例展示\n" +
                        "是的！以下是几种常见的视频比例：")
                .field1("80")
                .agentUrl("https://example.com/video1.mp4,https://example.com/video2.mp4,https://example.com/video3.mp4")
                .build());
        
        // 测试消息4：音频播放器（未播放状态）
        messages.add(ZhsUserAgentContext.builder()
                .problem("能发一段语音说明吗？")
                .answer("# 语音讲解\n" +
                        "以下是关于设计比例的语音讲解：")
                .field1("60")
                .agentUrl("https://example.com/audio/guide.mp3")
                .build());
        
        // 测试消息5：音频播放器（播放中状态）
        messages.add(ZhsUserAgentContext.builder()
                .problem("再来一段")
                .answer("# 补充讲解\n" +
                        "这段正在播放中：")
                .field1("45")
                .agentUrl("https://example.com/audio/tips.mp3")
                .build());
        
        // 测试消息6：混合媒体（图片+视频+音频）
        messages.add(ZhsUserAgentContext.builder()
                .problem("能综合展示一下吗？")
                .answer("# 综合媒体展示\n" +
                        "以下包含图片、视频和音频：")
                .field1("90")
                .agentUrl("https://example.com/mix1.png,https://example.com/mix2.mp4,https://example.com/mix3.mp3")
                .build());
        
        // 测试消息7：简短对话
        messages.add(ZhsUserAgentContext.builder()
                .problem("太棒了，谢谢！")
                .answer("不客气！这些比例在不同场景下各有优势，希望对您有帮助！")
                .field1("30")
                .build());

        try {
            // drawChatImage(messages, "E:\\job\\test\\a.png");
            drawChatImage(messages, "https://file.aizhs.top/sys-mini/default/logo/guanlogo.png", "豆包1.6", "E:\\job\\test\\a.png");
            System.out.println("预览图已生成到 E:\\job\\test\\a.png");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}