package com.ai.manager.small.controller;

import com.ai.manager.small.service.DistributionService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/distribution") // 根据 route.php 中的路径结构，基础路径是 /api
@Tag(name = "Distribution", description = "分销系统相关接口")
public class DistributionNowController {

    @Autowired
    private DistributionService distributionService;

}
