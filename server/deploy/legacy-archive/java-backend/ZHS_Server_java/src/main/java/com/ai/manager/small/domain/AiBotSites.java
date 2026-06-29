package com.ai.manager.small.domain;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * AI工具站点信息实体类
 * 对应数据库表：aibot_sites（ai-bot.cn 工具采集表）
 *
 * @author 开发者
 * @date 2026-02-11
 */
@Data
public class AiBotSites implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 主键ID
     */
    private Long id;

    /**
     * 工具名称（详情页标题）
     */
    private String name;

    /**
     * 简介（h1 下第一段）
     */
    private String shortDesc;

    /**
     * 一级分类，如 AI图像工具 / AI办公工具
     */
    private String section;

    /**
     * 二级分类，如 常用AI图像工具|AI图片背景移除
     */
    private String subSection;

    /**
     * 图标地址（封面图）
     */
    private String iconUrl;

    /**
     * 站内详情页链接 /sites/xxx.html
     */
    private String detailUrl;

    /**
     * 官网链接（访问官网按钮）
     */
    private String officialUrl;

    /**
     * 详情页主体 HTML（panel-body single my-4）
     */
    private String panelHtml;

    /**
     * 创建时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;
}