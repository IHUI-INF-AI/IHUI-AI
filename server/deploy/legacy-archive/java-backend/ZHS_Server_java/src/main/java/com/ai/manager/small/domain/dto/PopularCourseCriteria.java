package com.ai.manager.small.domain.dto;

import lombok.Data;

@Data
public class PopularCourseCriteria {
    private Integer type;
    private String orderBy; // 例如 "time", "NumberOfVisitors"
    private String orderDirection; // 例如 "ASC", "DESC"
    private Integer limit;
} 