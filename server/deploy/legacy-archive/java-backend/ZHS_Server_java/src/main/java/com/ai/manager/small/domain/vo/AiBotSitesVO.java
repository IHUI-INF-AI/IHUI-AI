package com.ai.manager.small.domain.vo;
import com.ai.manager.small.domain.AiBotSites;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

/**
 * AI工具站点信息实体类
 * 对应数据库表：aibot_sites（ai-bot.cn 工具采集表）
 *
 * @author 开发者
 * @date 2026-02-11
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class AiBotSitesVO implements Serializable {

    private static final long serialVersionUID = 1L;

    private String section;

    private String subSection;

    private List<AiBotSitesVO> subSections;

    private List<AiBotSites> aiBotSites;

}