# AgentDevelopersApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**bindCozeApiV1AgentsCozeLinkBindPost**](AgentDevelopersApi.md#bindCozeApiV1AgentsCozeLinkBindPost) | **POST** /api/v1/agents/coze-link/bind | 绑定 Coze 账号 |
| [**bindDeveloperApiV1AgentsBindPost**](AgentDevelopersApi.md#bindDeveloperApiV1AgentsBindPost) | **POST** /api/v1/agents/bind | 绑定 Agent 到当前用户（成为开发者） |
| [**cozeLinkApiV1AgentsCozeLinkGet**](AgentDevelopersApi.md#cozeLinkApiV1AgentsCozeLinkGet) | **GET** /api/v1/agents/coze-link | 查询 Coze 账号绑定 |
| [**getDeveloperApiV1AgentsRecordIdGet**](AgentDevelopersApi.md#getDeveloperApiV1AgentsRecordIdGet) | **GET** /api/v1/agents/{record_id} | 开发者记录详情 |
| [**myDeveloperAgentsApiV1AgentsMyGet**](AgentDevelopersApi.md#myDeveloperAgentsApiV1AgentsMyGet) | **GET** /api/v1/agents/my | 我作为开发者的所有 Agent |
| [**updatePriceApiV1AgentsUpdatePricePost**](AgentDevelopersApi.md#updatePriceApiV1AgentsUpdatePricePost) | **POST** /api/v1/agents/update-price | 更新开发者价格 |


<a id="bindCozeApiV1AgentsCozeLinkBindPost"></a>
# **bindCozeApiV1AgentsCozeLinkBindPost**
> Object bindCozeApiV1AgentsCozeLinkBindPost(cozeAccountId, cozeAccountName)

绑定 Coze 账号

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentDevelopersApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentDevelopersApi apiInstance = new AgentDevelopersApi(defaultClient);
    String cozeAccountId = "cozeAccountId_example"; // String | 
    String cozeAccountName = "cozeAccountName_example"; // String | 
    try {
      Object result = apiInstance.bindCozeApiV1AgentsCozeLinkBindPost(cozeAccountId, cozeAccountName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentDevelopersApi#bindCozeApiV1AgentsCozeLinkBindPost");
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
| **cozeAccountId** | **String**|  | |
| **cozeAccountName** | **String**|  | |

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

<a id="bindDeveloperApiV1AgentsBindPost"></a>
# **bindDeveloperApiV1AgentsBindPost**
> Object bindDeveloperApiV1AgentsBindPost(agentId, price)

绑定 Agent 到当前用户（成为开发者）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentDevelopersApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentDevelopersApi apiInstance = new AgentDevelopersApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    BigDecimal price = new BigDecimal("0.0"); // BigDecimal | 开发者价格
    try {
      Object result = apiInstance.bindDeveloperApiV1AgentsBindPost(agentId, price);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentDevelopersApi#bindDeveloperApiV1AgentsBindPost");
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
| **agentId** | **String**|  | |
| **price** | **BigDecimal**| 开发者价格 | [optional] [default to 0.0] |

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

<a id="cozeLinkApiV1AgentsCozeLinkGet"></a>
# **cozeLinkApiV1AgentsCozeLinkGet**
> Object cozeLinkApiV1AgentsCozeLinkGet()

查询 Coze 账号绑定

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentDevelopersApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentDevelopersApi apiInstance = new AgentDevelopersApi(defaultClient);
    try {
      Object result = apiInstance.cozeLinkApiV1AgentsCozeLinkGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentDevelopersApi#cozeLinkApiV1AgentsCozeLinkGet");
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

<a id="getDeveloperApiV1AgentsRecordIdGet"></a>
# **getDeveloperApiV1AgentsRecordIdGet**
> Object getDeveloperApiV1AgentsRecordIdGet(recordId)

开发者记录详情

根据记录 ID 返回开发者详情。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentDevelopersApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentDevelopersApi apiInstance = new AgentDevelopersApi(defaultClient);
    Integer recordId = 56; // Integer | 
    try {
      Object result = apiInstance.getDeveloperApiV1AgentsRecordIdGet(recordId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentDevelopersApi#getDeveloperApiV1AgentsRecordIdGet");
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
| **recordId** | **Integer**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="myDeveloperAgentsApiV1AgentsMyGet"></a>
# **myDeveloperAgentsApiV1AgentsMyGet**
> Object myDeveloperAgentsApiV1AgentsMyGet()

我作为开发者的所有 Agent

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentDevelopersApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentDevelopersApi apiInstance = new AgentDevelopersApi(defaultClient);
    try {
      Object result = apiInstance.myDeveloperAgentsApiV1AgentsMyGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentDevelopersApi#myDeveloperAgentsApiV1AgentsMyGet");
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

<a id="updatePriceApiV1AgentsUpdatePricePost"></a>
# **updatePriceApiV1AgentsUpdatePricePost**
> Object updatePriceApiV1AgentsUpdatePricePost(agentId, price)

更新开发者价格

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentDevelopersApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentDevelopersApi apiInstance = new AgentDevelopersApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    BigDecimal price = new BigDecimal(78); // BigDecimal | 
    try {
      Object result = apiInstance.updatePriceApiV1AgentsUpdatePricePost(agentId, price);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentDevelopersApi#updatePriceApiV1AgentsUpdatePricePost");
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
| **agentId** | **String**|  | |
| **price** | **BigDecimal**|  | |

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

