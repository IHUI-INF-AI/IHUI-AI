//package com.ai.manager.small.controller;
//
//import com.ai.manager.app.domain.users.UsersVO;
//import com.ai.manager.core.annotation.SkipLogin;
//import com.ai.manager.core.config.ResponseResultInfo;
//import com.ai.manager.core.constants.WXConfig;
//import com.ai.manager.small.domain.dto.AgentUploadDTO;
//import com.ai.manager.small.service.AgentUploadService;
//import com.ai.manager.small.service.IZhsUserService;
//import com.alibaba.fastjson.JSON;
//import lombok.RequiredArgsConstructor;
//import org.springframework.http.HttpStatus;
//import org.springframework.http.MediaType;
//import org.springframework.http.ResponseEntity;
//import org.springframework.web.bind.annotation.*;
//import org.springframework.web.server.ResponseStatusException;
//
//import java.util.Map;
//import java.util.Objects;
//
//@RestController
//@RequestMapping("/api/agent")
//@RequiredArgsConstructor
//public class UsersController {
//
//    private final IZhsUserService userService;
//
//    @GetMapping("/info/{uuid}")
//    public ResponseResultInfo<UsersVO> getInfo(@PathVariable("uuid") String uuid, @RequestHeader(WXConfig.DEVICE_TYPE_HEAD) String platformType){
//        UsersVO vo = usersService.getByUuid(uuid, platformType);
//
//        if(Objects.isNull(vo.getThirdPartyAccounts())){
//            System.out.println("结果1：\n" + JSON.toJSONString(vo));
//            vo.setThirdPartyAccounts(accountsService.getByUserUuid(vo.getUuid(), platformType));
//        } else {
//            System.out.println("结果2：\n" + JSON.toJSONString(vo));
//        }
//        return ResponseResultInfo.success(vo);
//    }
//
//}
