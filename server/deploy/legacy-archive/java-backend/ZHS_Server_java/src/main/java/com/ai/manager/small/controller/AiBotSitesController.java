package com.ai.manager.small.controller;

import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.small.service.AiBotSitesServlet;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/bot/sites")
@RequiredArgsConstructor
@SkipLogin
public class AiBotSitesController {

    @Autowired
    private AiBotSitesServlet sitesServlet;

    @GetMapping("/kind")
    public ResponseResultInfo getKind(@RequestParam("pageNum")Integer pageNum, @RequestParam("pageSize")Integer pageSize, @RequestParam(value = "section", required = false)String section, @RequestParam(value = "subSection", required = false)String subSection, @RequestParam(value = "type", required = false)Integer type){
        // 查询ai_world
        System.out.println(String.format("当前入参内容如下\n pageNum:%s \n pageSize:%s \n section:%s \n subSection:%s \n type:%s \n", pageNum, pageSize, section, subSection, type));
        return ResponseResultInfo.success(sitesServlet.getKind(pageNum, pageSize, section, subSection, type));
    }

}
