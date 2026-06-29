package com.ai.manager.small.domain.dto;

import lombok.Data;

import java.util.List;

@Data
public class SharePlanetPublicBatchRequest {
    private List<SharePlanetPublicItemDto> addData;
}