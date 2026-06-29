package com.ai.manager.small.domain.dto;

import lombok.Data;

@Data
public class KnowledgePlanetCriteria {
    private Integer type;
    private Integer status;
    private String orderBy; // 例如 "Likes", "NumberOfVisitors"
    private String orderDirection; // 例如 "ASC", "DESC"
    private Integer limit;
    private Boolean selectIdAndTitleOnly; // Flag for selecting only id and title
} 