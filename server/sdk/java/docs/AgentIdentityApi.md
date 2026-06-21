# AgentIdentityApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createIdentityOrderApiV1AgentsCreatePost**](AgentIdentityApi.md#createIdentityOrderApiV1AgentsCreatePost) | **POST** /api/v1/agents/create | 创建身份订单 |
| [**createProportionApiV1AgentsProportionCreatePost**](AgentIdentityApi.md#createProportionApiV1AgentsProportionCreatePost) | **POST** /api/v1/agents/proportion/create | 创建比例配置 |
| [**listIdentityOrdersApiV1AgentsListGet**](AgentIdentityApi.md#listIdentityOrdersApiV1AgentsListGet) | **GET** /api/v1/agents/list | 身份订单列表 |
| [**listProportionsApiV1AgentsProportionListGet**](AgentIdentityApi.md#listProportionsApiV1AgentsProportionListGet) | **GET** /api/v1/agents/proportion/list | 身份比例列表 |
| [**updateProportionApiV1AgentsProportionProportionIdPut**](AgentIdentityApi.md#updateProportionApiV1AgentsProportionProportionIdPut) | **PUT** /api/v1/agents/proportion/{proportion_id} | 修改比例 |


<a id="createIdentityOrderApiV1AgentsCreatePost"></a>
# **createIdentityOrderApiV1AgentsCreatePost**
> Object createIdentityOrderApiV1AgentsCreatePost(identityId, payType)

创建身份订单

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentIdentityApi apiInstance = new AgentIdentityApi(defaultClient);
    String identityId = "identityId_example"; // String | 产品身份ID
    String payType = "wechat"; // String | 支付方式: wechat / alipay
    try {
      Object result = apiInstance.createIdentityOrderApiV1AgentsCreatePost(identityId, payType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentIdentityApi#createIdentityOrderApiV1AgentsCreatePost");
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
| **identityId** | **String**| 产品身份ID | |
| **payType** | **String**| 支付方式: wechat / alipay | [optional] [default to wechat] |

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

<a id="createProportionApiV1AgentsProportionCreatePost"></a>
# **createProportionApiV1AgentsProportionCreatePost**
> Object createProportionApiV1AgentsProportionCreatePost(identityProportionBody)

创建比例配置

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentIdentityApi apiInstance = new AgentIdentityApi(defaultClient);
    IdentityProportionBody identityProportionBody = new IdentityProportionBody(); // IdentityProportionBody | 
    try {
      Object result = apiInstance.createProportionApiV1AgentsProportionCreatePost(identityProportionBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentIdentityApi#createProportionApiV1AgentsProportionCreatePost");
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
| **identityProportionBody** | [**IdentityProportionBody**](IdentityProportionBody.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listIdentityOrdersApiV1AgentsListGet"></a>
# **listIdentityOrdersApiV1AgentsListGet**
> Object listIdentityOrdersApiV1AgentsListGet(page, limit, status, orderType)

身份订单列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentIdentityApi apiInstance = new AgentIdentityApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 订单状态 0=待支付 1=已支付 2=已退款 3=已取消
    Integer orderType = 2; // Integer | 订单类型, 默认2=身份订单
    try {
      Object result = apiInstance.listIdentityOrdersApiV1AgentsListGet(page, limit, status, orderType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentIdentityApi#listIdentityOrdersApiV1AgentsListGet");
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
| **status** | **Integer**| 订单状态 0&#x3D;待支付 1&#x3D;已支付 2&#x3D;已退款 3&#x3D;已取消 | [optional] |
| **orderType** | **Integer**| 订单类型, 默认2&#x3D;身份订单 | [optional] [default to 2] |

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

<a id="listProportionsApiV1AgentsProportionListGet"></a>
# **listProportionsApiV1AgentsProportionListGet**
> Object listProportionsApiV1AgentsProportionListGet(page, limit, status)

身份比例列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentIdentityApi apiInstance = new AgentIdentityApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 0=stopped 1=active
    try {
      Object result = apiInstance.listProportionsApiV1AgentsProportionListGet(page, limit, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentIdentityApi#listProportionsApiV1AgentsProportionListGet");
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
| **status** | **Integer**| 0&#x3D;stopped 1&#x3D;active | [optional] |

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

<a id="updateProportionApiV1AgentsProportionProportionIdPut"></a>
# **updateProportionApiV1AgentsProportionProportionIdPut**
> Object updateProportionApiV1AgentsProportionProportionIdPut(proportionId, identityProportionBody)

修改比例

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentIdentityApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentIdentityApi apiInstance = new AgentIdentityApi(defaultClient);
    String proportionId = "proportionId_example"; // String | 
    IdentityProportionBody identityProportionBody = new IdentityProportionBody(); // IdentityProportionBody | 
    try {
      Object result = apiInstance.updateProportionApiV1AgentsProportionProportionIdPut(proportionId, identityProportionBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentIdentityApi#updateProportionApiV1AgentsProportionProportionIdPut");
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
| **proportionId** | **String**|  | |
| **identityProportionBody** | [**IdentityProportionBody**](IdentityProportionBody.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

