# FinanceMarginApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**adminAdjustBalanceApiV1FinanceTargetUserUuidPut**](FinanceMarginApi.md#adminAdjustBalanceApiV1FinanceTargetUserUuidPut) | **PUT** /api/v1/finance/{target_user_uuid} | 管理员直接调整用户 Token 余额 |
| [**checkBalanceApiV1FinanceCheckGet**](FinanceMarginApi.md#checkBalanceApiV1FinanceCheckGet) | **GET** /api/v1/finance/check | 检查余额是否充足 |
| [**deductApiV1FinanceDeductPost**](FinanceMarginApi.md#deductApiV1FinanceDeductPost) | **POST** /api/v1/finance/deduct | 扣减用户 token（内部调用） |
| [**expireApiV1FinanceExpirePost**](FinanceMarginApi.md#expireApiV1FinanceExpirePost) | **POST** /api/v1/finance/expire | 过期清零（管理员/定时任务） |
| [**getBalanceApiV1FinanceBalanceGet**](FinanceMarginApi.md#getBalanceApiV1FinanceBalanceGet) | **GET** /api/v1/finance/balance | 查询用户 token 余额（Redis 缓存 5 分钟） |
| [**grantCommissionApiV1FinanceCommissionPost**](FinanceMarginApi.md#grantCommissionApiV1FinanceCommissionPost) | **POST** /api/v1/finance/commission | 佣金入账（邀请分成） |
| [**listFlowsApiV1FinanceFlowsGet**](FinanceMarginApi.md#listFlowsApiV1FinanceFlowsGet) | **GET** /api/v1/finance/flows | 用户 token 流水（支持按类型过滤） |
| [**listTokenFlowAdminApiV1FinanceFlowListGet**](FinanceMarginApi.md#listTokenFlowAdminApiV1FinanceFlowListGet) | **GET** /api/v1/finance/flow/list | Token 操作流水列表（管理员） |
| [**rechargeApiV1FinanceRechargePost**](FinanceMarginApi.md#rechargeApiV1FinanceRechargePost) | **POST** /api/v1/finance/recharge | 充值 token（与支付订单配合使用） |
| [**refundTokenApiV1FinanceRefundPost**](FinanceMarginApi.md#refundTokenApiV1FinanceRefundPost) | **POST** /api/v1/finance/refund | Token 回退（退还指定数量 token 到用户余额） |


<a id="adminAdjustBalanceApiV1FinanceTargetUserUuidPut"></a>
# **adminAdjustBalanceApiV1FinanceTargetUserUuidPut**
> Object adminAdjustBalanceApiV1FinanceTargetUserUuidPut(targetUserUuid, quantity, reason)

管理员直接调整用户 Token 余额

P15-C2 改造: 改用 require_login + 内部 role 断言, 避免 FastAPI 0.116 + Python 3.13 对 Depends(require_role(\&quot;admin\&quot;)) 嵌套闭包的签名解析报错 (no signature for builtin str).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceMarginApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceMarginApi apiInstance = new FinanceMarginApi(defaultClient);
    String targetUserUuid = "targetUserUuid_example"; // String | 
    Integer quantity = 56; // Integer | 调整数量（正数增加/负数扣减）
    String reason = "管理员调整"; // String | 操作原因
    try {
      Object result = apiInstance.adminAdjustBalanceApiV1FinanceTargetUserUuidPut(targetUserUuid, quantity, reason);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceMarginApi#adminAdjustBalanceApiV1FinanceTargetUserUuidPut");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **targetUserUuid** | **String**|  | |
| **quantity** | **Integer**| 调整数量（正数增加/负数扣减） | |
| **reason** | **String**| 操作原因 | [optional] [default to 管理员调整] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="checkBalanceApiV1FinanceCheckGet"></a>
# **checkBalanceApiV1FinanceCheckGet**
> Object checkBalanceApiV1FinanceCheckGet(minTokens)

检查余额是否充足

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceMarginApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceMarginApi apiInstance = new FinanceMarginApi(defaultClient);
    Integer minTokens = 56; // Integer | 所需 token 数
    try {
      Object result = apiInstance.checkBalanceApiV1FinanceCheckGet(minTokens);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceMarginApi#checkBalanceApiV1FinanceCheckGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **minTokens** | **Integer**| 所需 token 数 | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="deductApiV1FinanceDeductPost"></a>
# **deductApiV1FinanceDeductPost**
> Object deductApiV1FinanceDeductPost(quantity, remark)

扣减用户 token（内部调用）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceMarginApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceMarginApi apiInstance = new FinanceMarginApi(defaultClient);
    Integer quantity = 56; // Integer | 扣减数量
    String remark = ""; // String | 操作描述
    try {
      Object result = apiInstance.deductApiV1FinanceDeductPost(quantity, remark);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceMarginApi#deductApiV1FinanceDeductPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **quantity** | **Integer**| 扣减数量 | |
| **remark** | **String**| 操作描述 | [optional] [default to ] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="expireApiV1FinanceExpirePost"></a>
# **expireApiV1FinanceExpirePost**
> Object expireApiV1FinanceExpirePost(quantity, source)

过期清零（管理员/定时任务）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceMarginApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceMarginApi apiInstance = new FinanceMarginApi(defaultClient);
    Integer quantity = 56; // Integer | 过期数量
    String source = "到期清零"; // String | 
    try {
      Object result = apiInstance.expireApiV1FinanceExpirePost(quantity, source);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceMarginApi#expireApiV1FinanceExpirePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **quantity** | **Integer**| 过期数量 | |
| **source** | **String**|  | [optional] [default to 到期清零] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getBalanceApiV1FinanceBalanceGet"></a>
# **getBalanceApiV1FinanceBalanceGet**
> Object getBalanceApiV1FinanceBalanceGet()

查询用户 token 余额（Redis 缓存 5 分钟）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceMarginApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceMarginApi apiInstance = new FinanceMarginApi(defaultClient);
    try {
      Object result = apiInstance.getBalanceApiV1FinanceBalanceGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceMarginApi#getBalanceApiV1FinanceBalanceGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="grantCommissionApiV1FinanceCommissionPost"></a>
# **grantCommissionApiV1FinanceCommissionPost**
> Object grantCommissionApiV1FinanceCommissionPost(quantity, invitedUserId, source)

佣金入账（邀请分成）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceMarginApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceMarginApi apiInstance = new FinanceMarginApi(defaultClient);
    Integer quantity = 56; // Integer | 佣金数量
    String invitedUserId = ""; // String | 被邀请人 uuid
    String source = "invite"; // String | 来源
    try {
      Object result = apiInstance.grantCommissionApiV1FinanceCommissionPost(quantity, invitedUserId, source);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceMarginApi#grantCommissionApiV1FinanceCommissionPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **quantity** | **Integer**| 佣金数量 | |
| **invitedUserId** | **String**| 被邀请人 uuid | [optional] [default to ] |
| **source** | **String**| 来源 | [optional] [default to invite] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listFlowsApiV1FinanceFlowsGet"></a>
# **listFlowsApiV1FinanceFlowsGet**
> Object listFlowsApiV1FinanceFlowsGet(page, limit, opType)

用户 token 流水（支持按类型过滤）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceMarginApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceMarginApi apiInstance = new FinanceMarginApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer opType = 56; // Integer | 0=充值 1=扣减 2=过期 3=退款 4=佣金
    try {
      Object result = apiInstance.listFlowsApiV1FinanceFlowsGet(page, limit, opType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceMarginApi#listFlowsApiV1FinanceFlowsGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **opType** | **Integer**| 0&#x3D;充值 1&#x3D;扣减 2&#x3D;过期 3&#x3D;退款 4&#x3D;佣金 | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listTokenFlowAdminApiV1FinanceFlowListGet"></a>
# **listTokenFlowAdminApiV1FinanceFlowListGet**
> Object listTokenFlowAdminApiV1FinanceFlowListGet(page, limit, userId, opType)

Token 操作流水列表（管理员）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceMarginApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceMarginApi apiInstance = new FinanceMarginApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userId = "userId_example"; // String | 按用户 UUID 过滤
    Integer opType = 56; // Integer | 操作类型过滤
    try {
      Object result = apiInstance.listTokenFlowAdminApiV1FinanceFlowListGet(page, limit, userId, opType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceMarginApi#listTokenFlowAdminApiV1FinanceFlowListGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **userId** | **String**| 按用户 UUID 过滤 | [optional] |
| **opType** | **Integer**| 操作类型过滤 | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="rechargeApiV1FinanceRechargePost"></a>
# **rechargeApiV1FinanceRechargePost**
> Object rechargeApiV1FinanceRechargePost(quantity, outTradeNo)

充值 token（与支付订单配合使用）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceMarginApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceMarginApi apiInstance = new FinanceMarginApi(defaultClient);
    Integer quantity = 56; // Integer | 充值数量
    String outTradeNo = "outTradeNo_example"; // String | 支付订单号
    try {
      Object result = apiInstance.rechargeApiV1FinanceRechargePost(quantity, outTradeNo);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceMarginApi#rechargeApiV1FinanceRechargePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **quantity** | **Integer**| 充值数量 | |
| **outTradeNo** | **String**| 支付订单号 | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="refundTokenApiV1FinanceRefundPost"></a>
# **refundTokenApiV1FinanceRefundPost**
> Object refundTokenApiV1FinanceRefundPost(quantity, remark)

Token 回退（退还指定数量 token 到用户余额）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.FinanceMarginApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    FinanceMarginApi apiInstance = new FinanceMarginApi(defaultClient);
    Integer quantity = 56; // Integer | 回退数量
    String remark = ""; // String | 操作说明
    try {
      Object result = apiInstance.refundTokenApiV1FinanceRefundPost(quantity, remark);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling FinanceMarginApi#refundTokenApiV1FinanceRefundPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **quantity** | **Integer**| 回退数量 | |
| **remark** | **String**| 操作说明 | [optional] [default to ] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

