package com.ai.manager.core.utils;

import com.ai.manager.small.domain.ZhsUserAgentContext;
import org.assertj.core.util.Lists;
import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

/**
 * 聊天对话图片绘制工具类
 * 功能：将用户与AI的对话消息（文本+媒体）绘制为一张完整的PNG格式聊天截图
 * 支持文本加粗、多类型媒体（图片/音频/视频）缩略图展示、智汇值消耗文本标注等特性
 *
 * @author 开发团队
 * @date 2024-XX-XX
 */
public class ChatImageDrawer {
    // ===================== 全局可配置项 =====================
    /** 生成图片的固定宽度（像素） */
    private static final int IMAGE_WIDTH = 300;
    /** 图片整体内边距（像素） */
    private static final int PADDING = 20;
    /** 文本区域内边距（像素） */
    private static final int TEXT_PADDING = 15;
    /** 文本行间距（像素） */
    private static final int LINE_SPACING = 10;
    /** 消息之间的间距（像素） */
    private static final int MESSAGE_SPACING = 30;
    /** 文本最大显示宽度（像素），超出自动换行 */
    private static final int TEXT_MAX_WIDTH = 300;
    /** 媒体文件缩略图尺寸（宽高一致，像素） */
    private static final int MEDIA_THUMB_SIZE = 120;
    /** 媒体文件之间的间距（像素） */
    private static final int MEDIA_SPACING = 10;
    /** 文本与媒体区域之间的间距（像素）- 从10改为5，减小空白 */
    private static final int TEXT_MEDIA_GAP = 5;
    /** 基础文本字体（微软雅黑，常规，16号） */
    private static final Font BASE_FONT = new Font("微软雅黑", Font.PLAIN, 16);
    /** 加粗文本字体（微软雅黑，加粗，16号） */
    private static final Font BOLD_FONT = new Font("微软雅黑", Font.BOLD, 16);
    // 智汇值消耗文本专属配置
    /** 智汇值消耗文本字体（微软雅黑，常规，11号） */
    private static final Font COST_FONT = new Font("微软雅黑", Font.PLAIN, 11);
    /** 标题字体（微软雅黑，加粗，18号） */
    private static final Font TITLE_FONT = new Font("微软雅黑", Font.BOLD, 18);
    /** 标题区域高度（像素） */
    private static final int TITLE_HEIGHT = 60;
    /** 标题区域内边距（像素） */
    private static final int TITLE_PADDING = 15;
    /** 头像尺寸（像素），与字号大小一致 */
    private static final int AVATAR_SIZE = 18;
    /** 智汇值消耗文本颜色（#999 浅灰色） */
    private static final Color COST_TEXT_COLOR = new Color(153, 153, 153);
    // 背景色/字体色配置
    /** 用户消息背景色（浅紫蓝） */
    private static final Color USER_BG_COLOR = new Color(154, 153, 243);
    /** AI助手消息背景色（浅灰色） */
    private static final Color AGENT_BG_COLOR = new Color(246, 246, 246);
    /** 媒体播放窗口背景色（黑色） */
    private static final Color MEDIA_BG_COLOR = Color.BLACK;
    /** 用户消息文本颜色（白色） */
    private static final Color USER_TEXT_COLOR = Color.WHITE;
    /** AI助手消息文本颜色（黑色） */
    private static final Color AGENT_TEXT_COLOR = Color.BLACK;



    /** 媒体文件专属内边距（像素）- 替代全局TEXT_PADDING，减少空白 */
    private static final int MEDIA_PADDING = 5;
    // ========================================================

    /**
     * 文本分段实体类
     * 用于存储文本内容、是否加粗、字体样式，支持文本分段渲染
     */
    private static class TextSegment {
        /** 文本内容 */
        String text;
        /** 是否加粗显示 */
        boolean isBold;
        /** 文本字体 */
        Font font;

        /**
         * 全参构造方法
         * @param text 文本内容
         * @param isBold 是否加粗
         * @param font 字体样式
         */
        public TextSegment(String text, boolean isBold, Font font) {
            this.text = text;
            this.isBold = isBold;
            this.font = font;
        }

        /**
         * 简化构造方法（自动匹配加粗/常规字体）
         * @param text 文本内容
         * @param isBold 是否加粗
         */
        public TextSegment(String text, boolean isBold) {
            this(text, isBold, isBold ? BOLD_FONT : BASE_FONT);
        }
    }

    /**
     * 媒体类型枚举
     * 用于区分不同类型的媒体文件，适配不同的缩略图渲染逻辑
     */
    private enum MediaType {
        /** 图片类型 */
        IMAGE,
        /** 音频类型 */
        AUDIO,
        /** 视频类型 */
        VIDEO,
        /** 未知类型 */
        UNKNOWN
    }

    // ===================== 核心绘制方法 =====================

    /**
     * 绘制标题图片
     *
     * @param avatarUrl 头像URL
     * @param titleText 标题文本
     * @param g2d 画布对象
     * @param startY 开始绘制的Y坐标
     * @return 标题区域的高度
     * @throws IOException 头像加载失败
     */
    private static int drawTitle(Graphics2D g2d, String avatarUrl, String titleText, int startY) throws IOException {
        // 绘制标题背景
        g2d.setColor(Color.WHITE);
        g2d.fillRect(0, startY, IMAGE_WIDTH, TITLE_HEIGHT);

        // 计算头像和标题的总宽度
        int totalWidth = 0;
        int avatarTitleGap = 5; // 头像和标题之间的间距（像素）
        if (avatarUrl != null && !avatarUrl.trim().isEmpty()) {
            totalWidth += AVATAR_SIZE;
        }
        if (titleText != null && !titleText.trim().isEmpty()) {
            g2d.setFont(TITLE_FONT);
            FontMetrics fm = g2d.getFontMetrics(TITLE_FONT);
            int textWidth = fm.stringWidth(titleText);
            totalWidth += textWidth;
            if (avatarUrl != null && !avatarUrl.trim().isEmpty()) {
                totalWidth += avatarTitleGap; // 头像和标题之间的间距
            }
        }

        // 计算起始X坐标，使头像和标题居中
        int startX = (IMAGE_WIDTH - totalWidth) / 2;

        // 绘制头像
        if (avatarUrl != null && !avatarUrl.trim().isEmpty()) {
            BufferedImage avatar = ImageIO.read(new URL(avatarUrl));
            // 缩放头像到指定尺寸
            BufferedImage scaledAvatar = new BufferedImage(AVATAR_SIZE, AVATAR_SIZE, BufferedImage.TYPE_INT_ARGB);
            Graphics2D avatarG2d = scaledAvatar.createGraphics();
            avatarG2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            avatarG2d.drawImage(avatar, 0, 0, AVATAR_SIZE, AVATAR_SIZE, null);
            avatarG2d.dispose();

            // 绘制圆形头像
            int avatarX = startX;
            int avatarY = startY + (TITLE_HEIGHT - AVATAR_SIZE) / 2;
            g2d.setClip(new java.awt.geom.Ellipse2D.Float(avatarX, avatarY, AVATAR_SIZE, AVATAR_SIZE));
            g2d.drawImage(scaledAvatar, avatarX, avatarY, null);
            g2d.setClip(null);

            startX += AVATAR_SIZE + avatarTitleGap; // 更新起始X坐标
        }

        // 绘制标题文本
        if (titleText != null && !titleText.trim().isEmpty()) {
            g2d.setFont(TITLE_FONT);
            g2d.setColor(Color.BLACK);
            FontMetrics fm = g2d.getFontMetrics(TITLE_FONT);
            int textY = startY + (TITLE_HEIGHT - fm.getHeight()) / 2 + fm.getAscent();
            g2d.drawString(titleText, startX, textY);
        }

        return TITLE_HEIGHT;
    }

    /**
     * 核心入口方法：绘制聊天对话图片并保存到指定路径（带标题）
     *
     * @param messages 对话消息列表（ZhsUserAgentContext 封装用户/AI的文本+媒体信息）
     * @param avatarUrl 头像URL
     * @param titleText 标题文本
     * @param outputPath 图片输出路径（含文件名，如：E:/chat.png）
     * @throws IOException 图片写入失败、媒体文件加载失败等IO异常
     * @throws IllegalArgumentException 消息列表为空时抛出
     */
    public static void drawChatImage(List<ZhsUserAgentContext> messages, String avatarUrl, String titleText, String outputPath) throws IOException {
        if (messages == null || messages.isEmpty()) {
            throw new IllegalArgumentException("对话消息列表不能为空");
        }
        // 初始化临时图片，用于计算文本/媒体区域尺寸（仅占1x1像素，节省内存）
        BufferedImage tempImage = new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB);
        Graphics2D tempG2d = tempImage.createGraphics();
        // 开启文本抗锯齿，提升文字显示效果
        tempG2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        // 计算所有消息需要的总高度
        int totalHeight = calculateTotalHeight(messages, tempG2d);
        tempG2d.dispose(); // 释放临时画布资源

        // 创建最终画布（固定宽度，动态高度，包含标题区域）
        int finalHeight = totalHeight + TITLE_HEIGHT;
        BufferedImage image = new BufferedImage(IMAGE_WIDTH, finalHeight, BufferedImage.TYPE_INT_RGB);
        Graphics2D g2d = image.createGraphics();
        // 开启全局抗锯齿（图形+文本），提升整体渲染质量
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        try {
            // 绘制标题
            int currentY = drawTitle(g2d, avatarUrl, titleText, 0);

            // 绘制白色背景（标题下方）
            g2d.setColor(Color.WHITE);
            g2d.fillRect(0, currentY, IMAGE_WIDTH, totalHeight);

            // 逐行绘制每个消息
            currentY += PADDING; // 添加上边距
            for (ZhsUserAgentContext msg : messages) {
                if (msg == null) continue;

                // 绘制用户消息（问题+用户媒体）
                String userText = msg.getProblem();
                String userMediaUrls = msg.getUserUrl();
                if (userText != null && !userText.trim().isEmpty() || (userMediaUrls != null && !userMediaUrls.trim().isEmpty())) {
                    currentY = drawSingleMessage(g2d, userText, userMediaUrls, true, currentY, msg);
                }

                // 绘制AI助手消息（回答+AI媒体）
                String agentText = msg.getAnswer();
                String agentMediaUrls = msg.getAgentUrl();
                if (agentText != null && !agentText.trim().isEmpty() || (agentMediaUrls != null && !agentMediaUrls.trim().isEmpty())) {
                    currentY = drawSingleMessage(g2d, agentText, agentMediaUrls, false, currentY, msg);
                }

                // 消息之间增加间距
                currentY += MESSAGE_SPACING;
            }

            // 保存图片到指定路径
            File outputFile = new File(outputPath);
            if (!outputFile.getParentFile().exists()) {
                outputFile.getParentFile().mkdirs(); // 自动创建父目录
            }
            ImageIO.write(image, "png", outputFile);
        } finally {
            g2d.dispose(); // 确保释放画布资源
        }
    }

    /**
     * 核心入口方法：绘制聊天对话图片并保存到指定路径
     *
     * @param messages 对话消息列表（ZhsUserAgentContext 封装用户/AI的文本+媒体信息）
     * @param outputPath 图片输出路径（含文件名，如：E:/chat.png）
     * @throws IOException 图片写入失败、媒体文件加载失败等IO异常
     * @throws IllegalArgumentException 消息列表为空时抛出
     */
    public static void drawChatImage(List<ZhsUserAgentContext> messages, String outputPath) throws IOException {
        drawChatImage(messages, null, null, outputPath);
    }

    /**
     * 绘制单条消息（用户/AI）的文本+媒体内容
     *
     * @param g2d 画布对象
     * @param text 消息文本内容
     * @param mediaUrls 媒体URL字符串（多个URL以逗号分隔）
     * @param isUser 是否为用户消息（true=用户，false=AI助手）
     * @param startY 该消息绘制的起始Y坐标
     * @param msg 完整的消息上下文（用于获取智汇值消耗信息）
     * @return 该消息绘制完成后的结束Y坐标（供下一条消息使用）
     */
    private static int drawSingleMessage(Graphics2D g2d, String text, String mediaUrls, boolean isUser, int startY, ZhsUserAgentContext msg) {
        // 计算实际灰框宽度
        float actualBgWidth = isUser ? 
            Math.min(TEXT_MAX_WIDTH, calculateTextActualWidth(g2d, text == null ? new ArrayList<>() : parseAndSplitText(g2d, text, false)) + TEXT_PADDING * 2) :
            IMAGE_WIDTH - PADDING * 2;
        float actualMaxLineWidth = actualBgWidth - TEXT_PADDING * 2;

        // 解析并分割文本为可渲染的分段（处理加粗、自动换行）
        List<List<TextSegment>> lineSegments = text == null || text.trim().isEmpty()
                ? new ArrayList<>() : parseAndSplitText(g2d, text, false, actualMaxLineWidth);
        // 解析媒体URL为列表
        List<String> mediaUrlList = parseMediaUrls(mediaUrls);

        // 处理AI助手的智汇值消耗文本
        String costText = null;
        List<List<TextSegment>> costLineSegments = new ArrayList<>();
        int costTextHeight = 0;
        int costTextGap = 0;
        if (!isUser && msg != null) {
            boolean hasContent = (text != null && !text.trim().isEmpty()) || (mediaUrls != null && !mediaUrls.trim().isEmpty());
            if (hasContent) {
                String field1 = msg.getField1();
                costText = "智汇AI生成 消耗智汇值：" + (field1 != null ? field1 : "");
                List<TextSegment> costSegments = new ArrayList<>();
                costSegments.add(new TextSegment(costText, false, COST_FONT));
                costLineSegments = splitSegmentsToLines(g2d, costSegments, actualMaxLineWidth);
                // 计算智汇值文本高度（修正：确保行数计算准确）
                costTextHeight = costLineSegments.isEmpty() ? 0 : costLineSegments.size() * (COST_FONT.getSize() + LINE_SPACING) - LINE_SPACING;
                // 智汇值文本与内容之间的间距（仅当两者都存在时生效），使用TEXT_PADDING与上边框保持一致
                costTextGap = costTextHeight > 0 && (lineSegments.size() > 0 || mediaUrlList.size() > 0) ? TEXT_PADDING : 0;
            }
        }

        // 计算各区域高度（修正：确保所有高度纳入总高度）
        int baseLineHeight = BASE_FONT.getSize() + LINE_SPACING;
        int textTotalHeight = lineSegments.isEmpty() ? 0 : lineSegments.size() * baseLineHeight - LINE_SPACING;
        int mediaTotalHeight = calculateMediaAreaHeight(mediaUrlList);

        // 计算各区域带内边距的高度
        int textAreaHeight = textTotalHeight > 0 ? (textTotalHeight + TEXT_PADDING * 2) : 0;
        // 媒体区域高度：如果只有媒体且没有智汇值文本，加底部内边距；如果有智汇值文本，不加底部内边距
        int mediaAreaHeight = mediaTotalHeight > 0 ? (mediaTotalHeight + (costTextHeight > 0 ? 0 : TEXT_PADDING)) : 0;
        // 文本与媒体之间的间距（仅当两者都存在时生效）
        int gapHeight = (textTotalHeight > 0 && mediaTotalHeight > 0) ? TEXT_MEDIA_GAP : 0;
        // 智汇值文本区域高度（包含底部内边距）
        int costAreaHeight = costTextHeight > 0 ? (costTextHeight + TEXT_PADDING) : 0;
        // 单条消息的总高度（修正：包含智汇值文本的间距和高度）
        int messageHeight = textAreaHeight + mediaAreaHeight + gapHeight + costTextGap + costAreaHeight;

        // 计算消息背景框的宽度和位置
        int textActualWidth = calculateTextActualWidth(g2d, lineSegments);
        int costTextActualWidth = calculateTextActualWidth(g2d, costLineSegments);
        int textBgWidth = Math.min(textActualWidth + TEXT_PADDING * 2, TEXT_MAX_WIDTH);
        int mediaBgWidth = Math.max(textBgWidth, MEDIA_THUMB_SIZE + TEXT_PADDING * 2);
        int contentWidth = Math.max(Math.max(textBgWidth, mediaBgWidth), costTextActualWidth + TEXT_PADDING * 2);

        // AI消息固定宽度，用户消息动态宽度
        int bgWidth;
        if (isUser) {
            // 用户消息宽度根据内容动态调整
            bgWidth = contentWidth;
        } else {
            // AI消息固定宽度，与画布边缘保持PADDING距离
            bgWidth = IMAGE_WIDTH - PADDING * 2;
        }

        // 用户消息右对齐，AI消息左对齐
        int bgX = isUser ? (IMAGE_WIDTH - PADDING - bgWidth) : PADDING;
        int bgY = startY;

        // 绘制消息背景圆角矩形（总高度包含智汇值文本）
        g2d.setColor(isUser ? USER_BG_COLOR : AGENT_BG_COLOR);
        g2d.fillRoundRect(bgX, bgY, bgWidth, messageHeight, 10, 10);

        // 绘制文本内容（修正：文本绘制后坐标直接基于文本区域高度，避免误差）
        int currentY = bgY + TEXT_PADDING;
        if (!lineSegments.isEmpty()) {
            int textX = bgX + TEXT_PADDING;
            int textY = currentY + BASE_FONT.getSize();
            g2d.setColor(isUser ? USER_TEXT_COLOR : AGENT_TEXT_COLOR);
            for (List<TextSegment> line : lineSegments) {
                int segX = textX;
                for (TextSegment seg : line) {
                    g2d.setFont(seg.font);
                    g2d.drawString(seg.text, segX, textY);
                    segX += g2d.getFontMetrics(seg.font).stringWidth(seg.text);
                }
                textY += baseLineHeight;
            }
            // 修正：文本区域结束坐标 = 背景Y + 文本区域高度（包含上下内边距）
            currentY = bgY + textAreaHeight;
        }

        // 绘制媒体内容（修正：确保媒体区域起始位置正确）
        if (!mediaUrlList.isEmpty()) {
            // 如果没有文本，媒体区域从bgY + TEXT_PADDING开始
            if (textTotalHeight == 0) {
                currentY = bgY + TEXT_PADDING;
            } else {
                currentY += gapHeight; // 文本存在时加间距
            }
            int mediaX = bgX + TEXT_PADDING;
            for (String mediaUrl : mediaUrlList) {
                MediaType mediaType = getMediaType(mediaUrl);
                drawSingleMedia(g2d, mediaUrl, mediaType, mediaX, currentY);
                currentY += MEDIA_THUMB_SIZE + MEDIA_SPACING;
            }
            currentY -= MEDIA_SPACING; // 去掉最后一个媒体的间距
        }

        // 绘制智汇值消耗文本（修正：坐标基于媒体区域结束位置，确保在背景框内）
        if (!costLineSegments.isEmpty()) {
            currentY += costTextGap;
            int costTextX = bgX + TEXT_PADDING;
            int costTextY = currentY + COST_FONT.getSize();
            g2d.setColor(COST_TEXT_COLOR);
            for (List<TextSegment> line : costLineSegments) {
                int segX = costTextX;
                for (TextSegment seg : line) {
                    g2d.setFont(seg.font);
                    g2d.drawString(seg.text, segX, costTextY);
                    segX += g2d.getFontMetrics(seg.font).stringWidth(seg.text);
                }
                costTextY += COST_FONT.getSize() + LINE_SPACING;
            }
            currentY = costTextY - LINE_SPACING;
        }

        // 返回当前消息绘制完成后的Y坐标
        return startY + messageHeight + LINE_SPACING;
    }

    // ===================== 补充缺失的核心函数 =====================

    /**
     * 计算媒体区域总高度
     * 逻辑：每个媒体占 [MEDIA_THUMB_SIZE + MEDIA_SPACING] 高度，最后一个媒体去掉间距
     *
     * @param mediaList 媒体URL列表
     * @return 媒体区域总高度（像素）
     */
    private static int calculateMediaAreaHeight(List<String> mediaList) {
        if (mediaList.isEmpty()) return 0;
        return mediaList.size() * (MEDIA_THUMB_SIZE + MEDIA_SPACING) - MEDIA_SPACING;
    }

    // ===================== 其他辅助函数 =====================

    /**
     * 计算所有消息需要的总高度（用于创建画布）
     *
     * @param messages 对话消息列表
     * @param g2d 画布对象（用于计算文本宽度/高度）
     * @return 所有消息+内边距的总高度（像素）
     */
    private static int calculateTotalHeight(List<ZhsUserAgentContext> messages, Graphics2D g2d) {
        int totalHeight = PADDING * 2; // 上下各一个内边距
        for (ZhsUserAgentContext msg : messages) {
            if (msg == null) continue;

            // 计算用户消息高度
            String userText = msg.getProblem();
            String userMediaUrls = msg.getUserUrl();
            if (userText != null && !userText.trim().isEmpty() || (userMediaUrls != null && !userMediaUrls.trim().isEmpty())) {
                // 用户消息动态宽度，最大不超过TEXT_MAX_WIDTH
                float userMaxLineWidth = TEXT_MAX_WIDTH - TEXT_PADDING * 2;
                List<List<TextSegment>> userLines = userText == null ? new ArrayList<>() : parseAndSplitText(g2d, userText, false, userMaxLineWidth);
                List<String> userMediaList = parseMediaUrls(userMediaUrls);
                totalHeight += calculateSingleMessageHeight(g2d, userLines, userMediaList, msg, true, userMaxLineWidth) + MESSAGE_SPACING;
            }

            // 计算AI助手消息高度
            String agentText = msg.getAnswer();
            String agentMediaUrls = msg.getAgentUrl();
            if (agentText != null && !agentText.trim().isEmpty() || (agentMediaUrls != null && !agentMediaUrls.trim().isEmpty())) {
                // AI消息固定宽度
                float agentMaxLineWidth = IMAGE_WIDTH - PADDING * 2 - TEXT_PADDING * 2;
                List<List<TextSegment>> agentLines = agentText == null ? new ArrayList<>() : parseAndSplitText(g2d, agentText, false, agentMaxLineWidth);
                List<String> agentMediaList = parseMediaUrls(agentMediaUrls);
                totalHeight += calculateSingleMessageHeight(g2d, agentLines, agentMediaList, msg, false, agentMaxLineWidth) + MESSAGE_SPACING;
            }
        }
        return totalHeight;
    }

    /**
     * 计算单条消息的高度（文本+媒体+智汇值文本）
     * 修正：添加g2d参数，确保智汇值文本换行计算准确
     *
     * @param g2d 画布对象（用于计算文本宽度）
     * @param lineSegments 文本分段列表（已处理换行）
     * @param mediaList 媒体URL列表
     * @param msg 消息上下文（用于智汇值计算）
     * @param isUser 是否为用户消息
     * @param maxLineWidth 文本最大宽度
     * @return 单条消息的总高度（像素）
     */
    private static int calculateSingleMessageHeight(Graphics2D g2d, List<List<TextSegment>> lineSegments, List<String> mediaList, ZhsUserAgentContext msg, boolean isUser, float maxLineWidth) {
        int baseLineHeight = BASE_FONT.getSize() + LINE_SPACING;
        int textTotalHeight = lineSegments.isEmpty() ? 0 : lineSegments.size() * baseLineHeight - LINE_SPACING;
        int mediaTotalHeight = calculateMediaAreaHeight(mediaList);

        // 计算智汇值文本高度（修正：传入g2d，确保换行计算准确）
        int costTextHeight = 0;
        int costTextGap = 0;
        if (!isUser && msg != null) {
            boolean hasContent = !lineSegments.isEmpty() || !mediaList.isEmpty();
            if (hasContent) {
                String field1 = msg.getField1();
                String costText = "智汇AI生成 消耗智汇值：" + (field1 != null ? field1 : "");
                List<TextSegment> costSegments = new ArrayList<>();
                costSegments.add(new TextSegment(costText, false, COST_FONT));
                List<List<TextSegment>> costLineSegments = splitSegmentsToLines(g2d, costSegments, maxLineWidth);
                costTextHeight = costLineSegments.isEmpty() ? 0 : costLineSegments.size() * (COST_FONT.getSize() + LINE_SPACING) - LINE_SPACING;
                // 智汇值文本与内容之间的间距（仅当两者都存在时生效），使用TEXT_PADDING与上边框保持一致
                costTextGap = costTextHeight > 0 ? TEXT_PADDING : 0;
            }
        }

        // 计算各区域带内边距的高度
        int textAreaHeight = textTotalHeight > 0 ? (textTotalHeight + TEXT_PADDING * 2) : 0;
        // 媒体区域高度：如果只有媒体且没有智汇值文本，加底部内边距；如果有智汇值文本，不加底部内边距
        int mediaAreaHeight = mediaTotalHeight > 0 ? (mediaTotalHeight + (costTextHeight > 0 ? 0 : TEXT_PADDING)) : 0;
        int gapHeight = (textTotalHeight > 0 && mediaTotalHeight > 0) ? TEXT_MEDIA_GAP : 0;
        // 智汇值文本区域高度（包含底部内边距）
        int costAreaHeight = costTextHeight > 0 ? (costTextHeight + TEXT_PADDING) : 0;

        return textAreaHeight + mediaAreaHeight + gapHeight + costTextGap + costAreaHeight;
    }

    /**
     * 解析文本（处理加粗标记）并分割为适配宽度的行
     *
     * @param g2d 画布对象（用于计算文本宽度）
     * @param text 原始文本（支持**加粗标记**）
     * @param isCostText 是否为智汇值消耗文本（适配专属字体）
     * @return 按行分割的文本分段列表
     */
    private static List<List<TextSegment>> parseAndSplitText(Graphics2D g2d, String text, boolean isCostText) {
        return parseAndSplitText(g2d, text, isCostText, TEXT_MAX_WIDTH - TEXT_PADDING * 2);
    }

    private static List<List<TextSegment>> parseAndSplitText(Graphics2D g2d, String text, boolean isCostText, float maxLineWidth) {
        List<TextSegment> segments = parseBoldText(text, isCostText);
        return splitSegmentsToLines(g2d, segments, maxLineWidth);
    }

    /**
     * 解析文本中的加粗标记（**包裹的内容**），分割为文本分段
     *
     * @param text 原始文本（支持**加粗标记**）
     * @param isCostText 是否为智汇值消耗文本（适配专属字体）
     * @return 文本分段列表（区分加粗/常规）
     */
    private static List<TextSegment> parseBoldText(String text, boolean isCostText) {
        List<TextSegment> segments = new ArrayList<>();
        if (text == null || text.trim().isEmpty()) return segments;

        int index = 0;
        int len = text.length();
        while (index < len) {
            int boldStart = text.indexOf("**", index);
            if (boldStart == -1) {
                // 剩余文本无加粗标记，直接添加
                Font font = isCostText ? COST_FONT : BASE_FONT;
                segments.add(new TextSegment(text.substring(index), false, font));
                break;
            }
            // 加粗标记前的常规文本
            if (boldStart > index) {
                Font font = isCostText ? COST_FONT : BASE_FONT;
                segments.add(new TextSegment(text.substring(index, boldStart), false, font));
            }
            // 查找加粗结束标记
            int boldEnd = text.indexOf("**", boldStart + 2);
            if (boldEnd == -1) {
                // 无结束标记，剩余文本按加粗处理
                Font font = isCostText ? COST_FONT : BOLD_FONT;
                segments.add(new TextSegment(text.substring(boldStart), true, font));
                break;
            }
            // 提取加粗文本
            String boldText = text.substring(boldStart + 2, boldEnd);
            if (!boldText.isEmpty()) {
                Font font = isCostText ? COST_FONT : BOLD_FONT;
                segments.add(new TextSegment(boldText, true, font));
            }
            index = boldEnd + 2;
        }
        return segments;
    }

    /**
     * 绘制单个媒体文件的缩略图
     *
     * @param g2d 画布对象
     * @param mediaUrl 媒体文件URL
     * @param mediaType 媒体类型（图片/音频/视频/未知）
     * @param x 缩略图起始X坐标
     * @param y 缩略图起始Y坐标
     */
    private static void drawSingleMedia(Graphics2D g2d, String mediaUrl, MediaType mediaType, int x, int y) {
        switch (mediaType) {
            case IMAGE:
                drawImageThumbnail(g2d, mediaUrl, x, y);
                break;
            case AUDIO:
            case VIDEO:
                drawMediaPlayWindow(g2d, mediaType, x, y);
                break;
            default:
                // 未知类型：绘制浅灰色背景+提示文字
                g2d.setColor(Color.LIGHT_GRAY);
                g2d.fillRect(x, y, MEDIA_THUMB_SIZE, MEDIA_THUMB_SIZE);
                g2d.setColor(Color.GRAY);
                g2d.drawString("未知文件", x + 10, y + MEDIA_THUMB_SIZE / 2);
                break;
        }
    }

    /**
     * 绘制图片缩略图（从URL加载并缩放）
     *
     * @param g2d 画布对象
     * @param imageUrl 图片URL
     * @param x 缩略图起始X坐标
     * @param y 缩略图起始Y坐标
     */
    private static void drawImageThumbnail(Graphics2D g2d, String imageUrl, int x, int y) {
        try {
            URL url = new URL(imageUrl);
            BufferedImage originalImage = ImageIO.read(url);
            if (originalImage == null) {
                throw new IOException("图片加载为空");
            }
            // 缩放图片到指定尺寸
            BufferedImage thumbnail = scaleImage(originalImage, MEDIA_THUMB_SIZE, MEDIA_THUMB_SIZE);
            g2d.drawImage(thumbnail, x, y, null);
            // 绘制图片边框
            g2d.setColor(Color.LIGHT_GRAY);
            g2d.drawRect(x, y, MEDIA_THUMB_SIZE, MEDIA_THUMB_SIZE);
        } catch (Exception e) {
            // 加载失败：绘制浅灰色背景+提示文字
            g2d.setColor(Color.LIGHT_GRAY);
            g2d.fillRect(x, y, MEDIA_THUMB_SIZE, MEDIA_THUMB_SIZE);
            g2d.setColor(Color.GRAY);
            g2d.drawString("图片加载失败", x + 5, y + MEDIA_THUMB_SIZE / 2);
        }
    }

    /**
     * 绘制音频/视频的播放窗口（黑色背景+播放三角+类型文字）
     *
     * @param g2d 画布对象
     * @param mediaType 媒体类型（音频/视频）
     * @param x 播放窗口起始X坐标
     * @param y 播放窗口起始Y坐标
     */
    private static void drawMediaPlayWindow(Graphics2D g2d, MediaType mediaType, int x, int y) {
        // 绘制黑色背景
        g2d.setColor(MEDIA_BG_COLOR);
        g2d.fillRect(x, y, MEDIA_THUMB_SIZE, MEDIA_THUMB_SIZE);

        // 绘制半透明圆形背景
        int centerX = x + MEDIA_THUMB_SIZE / 2;
        int centerY = y + MEDIA_THUMB_SIZE / 2;
        int circleRadius = 25;
        g2d.setColor(new Color(0, 0, 0, 120));
        g2d.fillOval(centerX - circleRadius, centerY - circleRadius, circleRadius * 2, circleRadius * 2);

        // 绘制白色播放三角
        g2d.setColor(Color.WHITE);
        int triangleSize = 12;
        int triangleX = centerX - triangleSize / 2 + 2;
        int triangleY = centerY - triangleSize / 2;
        int[] xPoints = {triangleX, triangleX + triangleSize, triangleX};
        int[] yPoints = {triangleY, triangleY + triangleSize / 2, triangleY + triangleSize};
        g2d.fillPolygon(xPoints, yPoints, 3);

        // 绘制媒体类型文字
        g2d.setFont(BASE_FONT.deriveFont(12f));
        String typeText = mediaType == MediaType.AUDIO ? "音频文件" : "视频文件";
        g2d.setColor(Color.WHITE);
        g2d.drawString(typeText, x + (MEDIA_THUMB_SIZE - g2d.getFontMetrics().stringWidth(typeText)) / 2,
                y + MEDIA_THUMB_SIZE - 10);
    }

    /**
     * 解析媒体URL字符串为列表（多个URL以逗号分隔）
     *
     * @param mediaUrls 媒体URL字符串（如：url1,url2,url3）
     * @return 去重、去空后的媒体URL列表
     */
    private static List<String> parseMediaUrls(String mediaUrls) {
        List<String> urlList = new ArrayList<>();
        if (mediaUrls == null || mediaUrls.trim().isEmpty()) {
            return urlList;
        }
        String[] urls = mediaUrls.split(",");
        for (String url : urls) {
            String trimUrl = url.trim();
            if (!trimUrl.isEmpty()) {
                urlList.add(trimUrl);
            }
        }
        return urlList;
    }

    /**
     * 根据URL后缀判断媒体类型
     *
     * @param mediaUrl 媒体文件URL
     * @return 媒体类型枚举（IMAGE/AUDIO/VIDEO/UNKNOWN）
     */
    private static MediaType getMediaType(String mediaUrl) {
        if (mediaUrl == null || mediaUrl.trim().isEmpty()) {
            return MediaType.UNKNOWN;
        }
        String lowerUrl = mediaUrl.toLowerCase();
        // 图片类型
        if (lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg") || lowerUrl.endsWith(".png")
                || lowerUrl.endsWith(".gif") || lowerUrl.endsWith(".bmp")) {
            return MediaType.IMAGE;
        }
        // 音频类型
        if (lowerUrl.endsWith(".mp3") || lowerUrl.endsWith(".wav") || lowerUrl.endsWith(".m4a")
                || lowerUrl.endsWith(".flac")) {
            return MediaType.AUDIO;
        }
        // 视频类型
        if (lowerUrl.endsWith(".mp4") || lowerUrl.endsWith(".avi") || lowerUrl.endsWith(".mov")
                || lowerUrl.endsWith(".mkv")) {
            return MediaType.VIDEO;
        }
        // 未知类型
        return MediaType.UNKNOWN;
    }

    /**
     * 缩放图片到指定尺寸（等比例缩放，居中显示，空白处透明）
     *
     * @param original 原始图片
     * @param targetWidth 目标宽度（像素）
     * @param targetHeight 目标高度（像素）
     * @return 缩放后的图片
     */
    private static BufferedImage scaleImage(BufferedImage original, int targetWidth, int targetHeight) {
        int originalWidth = original.getWidth();
        int originalHeight = original.getHeight();

        // 计算等比例缩放因子
        double scaleX = (double) targetWidth / originalWidth;
        double scaleY = (double) targetHeight / originalHeight;
        double scale = Math.min(scaleX, scaleY);

        // 计算缩放后的尺寸
        int newWidth = (int) (originalWidth * scale);
        int newHeight = (int) (originalHeight * scale);

        // 创建目标图片（透明背景）
        BufferedImage scaled = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = scaled.createGraphics();
        // 开启插值优化，提升缩放质量
        g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);

        // 居中绘制缩放后的图片
        int x = (targetWidth - newWidth) / 2;
        int y = (targetHeight - newHeight) / 2;
        g2d.drawImage(original, x, y, newWidth, newHeight, null);

        g2d.dispose();
        return scaled;
    }

    /**
     * 计算文本分段的实际显示宽度（取最长行的宽度）
     *
     * @param g2d 画布对象（为空时使用系统默认字体度量）
     * @param lineSegments 按行分割的文本分段列表
     * @return 文本的最大显示宽度（像素）
     */
    private static int calculateTextActualWidth(Graphics2D g2d, List<List<TextSegment>> lineSegments) {
        int maxLineWidth = 0;
        for (List<TextSegment> line : lineSegments) {
            int lineWidth = 0;
            for (TextSegment seg : line) {
                FontMetrics fontMetrics = g2d != null ? g2d.getFontMetrics(seg.font) : Toolkit.getDefaultToolkit().getFontMetrics(seg.font);
                lineWidth += fontMetrics.stringWidth(seg.text);
            }
            maxLineWidth = Math.max(maxLineWidth, lineWidth);
        }
        return maxLineWidth;
    }

    /**
     * 将文本分段分割为适配最大宽度的行（自动换行）
     *
     * @param g2d 画布对象（用于计算文本宽度）
     * @param segments 文本分段列表
     * @return 按行分割后的文本分段列表
     */
    private static List<List<TextSegment>> splitSegmentsToLines(Graphics2D g2d, List<TextSegment> segments) {
        return splitSegmentsToLines(g2d, segments, TEXT_MAX_WIDTH - TEXT_PADDING * 2);
    }

    private static List<List<TextSegment>> splitSegmentsToLines(Graphics2D g2d, List<TextSegment> segments, float maxLineWidth) {
        List<List<TextSegment>> lines = new ArrayList<>();
        if (segments.isEmpty()) return lines;

        List<TextSegment> currentLine = new ArrayList<>();
        float currentWidth = 0;

        for (TextSegment seg : segments) {
            FontMetrics fontMetrics = g2d != null ? g2d.getFontMetrics(seg.font) : Toolkit.getDefaultToolkit().getFontMetrics(seg.font);
            float segWidth = fontMetrics.stringWidth(seg.text);

            // 当前行+该分段超出宽度，且当前行非空：换行
            if (currentWidth + segWidth > maxLineWidth && !currentLine.isEmpty()) {
                lines.add(new ArrayList<>(currentLine));
                currentLine.clear();
                currentWidth = 0;
            }

            // 单个分段超出宽度：按字符拆分
            if (segWidth > maxLineWidth) {
                String longText = seg.text;
                Font longFont = seg.font;
                FontMetrics longFontMetrics = g2d != null ? g2d.getFontMetrics(longFont) : Toolkit.getDefaultToolkit().getFontMetrics(longFont);

                int start = 0;
                while (start < longText.length()) {
                    // 二分查找最大可显示字符数
                    int end = findMaxCharCount(g2d, longFont, longText.substring(start), maxLineWidth);
                    currentLine.add(new TextSegment(longText.substring(start, start + end), seg.isBold, longFont));
                    lines.add(new ArrayList<>(currentLine));
                    currentLine.clear();
                    currentWidth = 0;
                    start += end;
                }
            } else {
                // 单个分段未超出宽度：添加到当前行
                currentLine.add(seg);
                currentWidth += segWidth;
            }
        }

        // 添加最后一行
        if (!currentLine.isEmpty()) {
            lines.add(currentLine);
        }
        return lines;
    }

    /**
     * 二分查找最大可显示字符数（适配指定宽度）
     *
     * @param g2d 画布对象（用于计算文本宽度）
     * @param font 文本字体
     * @param text 待拆分的文本
     * @param maxWidth 最大显示宽度（像素）
     * @return 最大可显示的字符数
     */
    private static int findMaxCharCount(Graphics2D g2d, Font font, String text, float maxWidth) {
        FontMetrics fontMetrics = g2d != null ? g2d.getFontMetrics(font) : Toolkit.getDefaultToolkit().getFontMetrics(font);
        int left = 1;
        int right = text.length();
        int maxCount = 0;

        while (left <= right) {
            int mid = (left + right) / 2;
            String subText = text.substring(0, mid);
            float width = fontMetrics.stringWidth(subText);

            if (width <= maxWidth) {
                maxCount = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        return Math.max(maxCount, 1); // 至少返回1个字符
    }

    /**
     * 测试主方法：验证聊天图片绘制功能
     *
     * @param args 命令行参数（未使用）
     */
    public static void main(String[] args) {
        ArrayList<ZhsUserAgentContext> messages = Lists.newArrayList();
        // 测试消息1：用户提问+AI回答+AI媒体+智汇值
        messages.add(ZhsUserAgentContext.builder()
                .problem("123")
                .answer("'123'是什么意思")
                .field1("100")
                .build());
        // 测试消息2：用户提问+用户媒体
        messages.add(ZhsUserAgentContext.builder()
                .problem("456")
                .userUrl("https://file.aizhs.top/sys-mini/default/logo/guanlogo.png")
                .build());
        // 测试消息3：仅AI回答+智汇值
        messages.add(ZhsUserAgentContext.builder()
                .answer("'789'是什么意思afa啊饿啊的v阿发热gear给他让他绘图软件回复你的同意就等同于觉得干不干活突然的v阿发热gear给他让他绘图软件回复你的同意就等同于觉得干不干活突然")
                .agentUrl("https://file.aizhs.top/sys-mini/default/logo/guanlogo.png")
                .field1("200")
                .build());
        // 测试消息4：仅AI回答+智汇值（无媒体）
        messages.add(ZhsUserAgentContext.builder()
                .answer("我顶你个肺")
                .field1("300")
                .build());

        try {
            // 生成图片到指定路径
            drawChatImage(messages, "https://file.aizhs.top/sys-mini/default/logo/guanlogo.png", "豆包1.6", "E:\\job\\test\\a.png");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}