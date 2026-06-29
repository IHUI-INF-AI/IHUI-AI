package com.ai.manager.course.controller;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.course.domain.ZhsCategoryDictionary;
import com.ai.manager.course.service.IZhsCategoryDictionaryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 赛道字典Controller
 *
 * @author Raindrop_L
 * @date 2025-09-02
 */
@RestController
@RequestMapping("/categoryDictionary")
@Tag(name = "赛道字典管理")
public class ZhsCategoryDictionaryController {
    @Autowired
    private IZhsCategoryDictionaryService zhsCategoryDictionaryService;

    /**
     * 查询赛道字典列表
     */
    @GetMapping("/list")
    @Operation(summary = "列表")
    public ResponseResultInfo list(ZhsCategoryDictionary zhsCategoryDictionary) {
        List<ZhsCategoryDictionary> list = zhsCategoryDictionaryService.getList(zhsCategoryDictionary);
        return ResponseResultInfo.success(list);
    }

    @GetMapping("/get/parent")
    @Operation(summary = "查询父赛道")
    public ResponseResultInfo getParent(@RequestParam String ids){
        Map<String, String> result = zhsCategoryDictionaryService.getParentMap(ids);
        return ResponseResultInfo.success(result);
    }

}
