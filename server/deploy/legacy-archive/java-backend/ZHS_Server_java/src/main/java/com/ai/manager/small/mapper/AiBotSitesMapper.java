package com.ai.manager.small.mapper;

import com.ai.manager.small.domain.AiBotSites;
import com.ai.manager.small.domain.vo.AiBotSitesVO;
import com.baomidou.dynamic.datasource.annotation.DS;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 智能体类型关联Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-08-07
 */
@DS("aibot")
public interface AiBotSitesMapper
{
    List<AiBotSites> groupSubSection(@Param("section") String section, String subSection, Integer type);

    List<AiBotSites> get(@Param("data") AiBotSitesVO build, @Param("type") Integer type);
}
