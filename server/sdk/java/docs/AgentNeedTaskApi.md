# AgentNeedTaskApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**acceptTaskApiV1AgentNeedTaskTidAcceptPost**](AgentNeedTaskApi.md#acceptTaskApiV1AgentNeedTaskTidAcceptPost) | **POST** /api/v1/agent-need-task/{tid}/accept | 开发者认领 |
| [**acceptTaskApiV1AgentNeedTaskTidAcceptPost_0**](AgentNeedTaskApi.md#acceptTaskApiV1AgentNeedTaskTidAcceptPost_0) | **POST** /api/v1/agent-need-task/{tid}/accept | 开发者认领 |
| [**bidTaskApiV1AgentNeedTaskTidBidPost**](AgentNeedTaskApi.md#bidTaskApiV1AgentNeedTaskTidBidPost) | **POST** /api/v1/agent-need-task/{tid}/bid | 开发者报价 |
| [**bidTaskApiV1AgentNeedTaskTidBidPost_0**](AgentNeedTaskApi.md#bidTaskApiV1AgentNeedTaskTidBidPost_0) | **POST** /api/v1/agent-need-task/{tid}/bid | 开发者报价 |
| [**createTaskApiV1AgentNeedTaskPost**](AgentNeedTaskApi.md#createTaskApiV1AgentNeedTaskPost) | **POST** /api/v1/agent-need-task | 发布需求 |
| [**createTaskApiV1AgentNeedTaskPost_0**](AgentNeedTaskApi.md#createTaskApiV1AgentNeedTaskPost_0) | **POST** /api/v1/agent-need-task | 发布需求 |
| [**deleteTaskApiV1AgentNeedTaskTidDelete**](AgentNeedTaskApi.md#deleteTaskApiV1AgentNeedTaskTidDelete) | **DELETE** /api/v1/agent-need-task/{tid} | 删除需求 |
| [**deleteTaskApiV1AgentNeedTaskTidDelete_0**](AgentNeedTaskApi.md#deleteTaskApiV1AgentNeedTaskTidDelete_0) | **DELETE** /api/v1/agent-need-task/{tid} | 删除需求 |
| [**getTaskApiV1AgentNeedTaskTidGet**](AgentNeedTaskApi.md#getTaskApiV1AgentNeedTaskTidGet) | **GET** /api/v1/agent-need-task/{tid} | 需求详情 |
| [**getTaskApiV1AgentNeedTaskTidGet_0**](AgentNeedTaskApi.md#getTaskApiV1AgentNeedTaskTidGet_0) | **GET** /api/v1/agent-need-task/{tid} | 需求详情 |
| [**listBidsApiV1AgentNeedTaskTidBidsGet**](AgentNeedTaskApi.md#listBidsApiV1AgentNeedTaskTidBidsGet) | **GET** /api/v1/agent-need-task/{tid}/bids | 任务报价列表 |
| [**listBidsApiV1AgentNeedTaskTidBidsGet_0**](AgentNeedTaskApi.md#listBidsApiV1AgentNeedTaskTidBidsGet_0) | **GET** /api/v1/agent-need-task/{tid}/bids | 任务报价列表 |
| [**listTasksApiV1AgentNeedTaskListGet**](AgentNeedTaskApi.md#listTasksApiV1AgentNeedTaskListGet) | **GET** /api/v1/agent-need-task/list | 需求列表 |
| [**listTasksApiV1AgentNeedTaskListGet_0**](AgentNeedTaskApi.md#listTasksApiV1AgentNeedTaskListGet_0) | **GET** /api/v1/agent-need-task/list | 需求列表 |
| [**updateTaskApiV1AgentNeedTaskTidPut**](AgentNeedTaskApi.md#updateTaskApiV1AgentNeedTaskTidPut) | **PUT** /api/v1/agent-need-task/{tid} | 修改需求 |
| [**updateTaskApiV1AgentNeedTaskTidPut_0**](AgentNeedTaskApi.md#updateTaskApiV1AgentNeedTaskTidPut_0) | **PUT** /api/v1/agent-need-task/{tid} | 修改需求 |


<a id="acceptTaskApiV1AgentNeedTaskTidAcceptPost"></a>
# **acceptTaskApiV1AgentNeedTaskTidAcceptPost**
> Object acceptTaskApiV1AgentNeedTaskTidAcceptPost(tid)

开发者认领

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    Integer tid = 56; // Integer | 
    try {
      Object result = apiInstance.acceptTaskApiV1AgentNeedTaskTidAcceptPost(tid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#acceptTaskApiV1AgentNeedTaskTidAcceptPost");
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
| **tid** | **Integer**|  | |

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

<a id="acceptTaskApiV1AgentNeedTaskTidAcceptPost_0"></a>
# **acceptTaskApiV1AgentNeedTaskTidAcceptPost_0**
> Object acceptTaskApiV1AgentNeedTaskTidAcceptPost_0(tid)

开发者认领

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    Integer tid = 56; // Integer | 
    try {
      Object result = apiInstance.acceptTaskApiV1AgentNeedTaskTidAcceptPost_0(tid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#acceptTaskApiV1AgentNeedTaskTidAcceptPost_0");
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
| **tid** | **Integer**|  | |

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

<a id="bidTaskApiV1AgentNeedTaskTidBidPost"></a>
# **bidTaskApiV1AgentNeedTaskTidBidPost**
> Object bidTaskApiV1AgentNeedTaskTidBidPost(tid, bid, remark)

开发者报价

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    Integer tid = 56; // Integer | 
    Integer bid = 56; // Integer | 
    String remark = "remark_example"; // String | 
    try {
      Object result = apiInstance.bidTaskApiV1AgentNeedTaskTidBidPost(tid, bid, remark);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#bidTaskApiV1AgentNeedTaskTidBidPost");
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
| **tid** | **Integer**|  | |
| **bid** | **Integer**|  | |
| **remark** | **String**|  | [optional] |

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

<a id="bidTaskApiV1AgentNeedTaskTidBidPost_0"></a>
# **bidTaskApiV1AgentNeedTaskTidBidPost_0**
> Object bidTaskApiV1AgentNeedTaskTidBidPost_0(tid, bid, remark)

开发者报价

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    Integer tid = 56; // Integer | 
    Integer bid = 56; // Integer | 
    String remark = "remark_example"; // String | 
    try {
      Object result = apiInstance.bidTaskApiV1AgentNeedTaskTidBidPost_0(tid, bid, remark);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#bidTaskApiV1AgentNeedTaskTidBidPost_0");
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
| **tid** | **Integer**|  | |
| **bid** | **Integer**|  | |
| **remark** | **String**|  | [optional] |

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

<a id="createTaskApiV1AgentNeedTaskPost"></a>
# **createTaskApiV1AgentNeedTaskPost**
> Object createTaskApiV1AgentNeedTaskPost(title, description, type, agentId, agentName, priority, budget, deadline)

发布需求

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    String title = "title_example"; // String | 
    String description = "description_example"; // String | 
    String type = "develop"; // String | 
    String agentId = "agentId_example"; // String | 
    String agentName = "agentName_example"; // String | 
    Integer priority = 1; // Integer | 
    Integer budget = 0; // Integer | 
    OffsetDateTime deadline = OffsetDateTime.now(); // OffsetDateTime | 
    try {
      Object result = apiInstance.createTaskApiV1AgentNeedTaskPost(title, description, type, agentId, agentName, priority, budget, deadline);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#createTaskApiV1AgentNeedTaskPost");
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
| **title** | **String**|  | |
| **description** | **String**|  | |
| **type** | **String**|  | [optional] [default to develop] |
| **agentId** | **String**|  | [optional] |
| **agentName** | **String**|  | [optional] |
| **priority** | **Integer**|  | [optional] [default to 1] |
| **budget** | **Integer**|  | [optional] [default to 0] |
| **deadline** | **OffsetDateTime**|  | [optional] |

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

<a id="createTaskApiV1AgentNeedTaskPost_0"></a>
# **createTaskApiV1AgentNeedTaskPost_0**
> Object createTaskApiV1AgentNeedTaskPost_0(title, description, type, agentId, agentName, priority, budget, deadline)

发布需求

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    String title = "title_example"; // String | 
    String description = "description_example"; // String | 
    String type = "develop"; // String | 
    String agentId = "agentId_example"; // String | 
    String agentName = "agentName_example"; // String | 
    Integer priority = 1; // Integer | 
    Integer budget = 0; // Integer | 
    OffsetDateTime deadline = OffsetDateTime.now(); // OffsetDateTime | 
    try {
      Object result = apiInstance.createTaskApiV1AgentNeedTaskPost_0(title, description, type, agentId, agentName, priority, budget, deadline);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#createTaskApiV1AgentNeedTaskPost_0");
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
| **title** | **String**|  | |
| **description** | **String**|  | |
| **type** | **String**|  | [optional] [default to develop] |
| **agentId** | **String**|  | [optional] |
| **agentName** | **String**|  | [optional] |
| **priority** | **Integer**|  | [optional] [default to 1] |
| **budget** | **Integer**|  | [optional] [default to 0] |
| **deadline** | **OffsetDateTime**|  | [optional] |

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

<a id="deleteTaskApiV1AgentNeedTaskTidDelete"></a>
# **deleteTaskApiV1AgentNeedTaskTidDelete**
> Object deleteTaskApiV1AgentNeedTaskTidDelete(tid)

删除需求

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    Integer tid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteTaskApiV1AgentNeedTaskTidDelete(tid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#deleteTaskApiV1AgentNeedTaskTidDelete");
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
| **tid** | **Integer**|  | |

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

<a id="deleteTaskApiV1AgentNeedTaskTidDelete_0"></a>
# **deleteTaskApiV1AgentNeedTaskTidDelete_0**
> Object deleteTaskApiV1AgentNeedTaskTidDelete_0(tid)

删除需求

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    Integer tid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteTaskApiV1AgentNeedTaskTidDelete_0(tid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#deleteTaskApiV1AgentNeedTaskTidDelete_0");
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
| **tid** | **Integer**|  | |

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

<a id="getTaskApiV1AgentNeedTaskTidGet"></a>
# **getTaskApiV1AgentNeedTaskTidGet**
> Object getTaskApiV1AgentNeedTaskTidGet(tid)

需求详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    Integer tid = 56; // Integer | 
    try {
      Object result = apiInstance.getTaskApiV1AgentNeedTaskTidGet(tid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#getTaskApiV1AgentNeedTaskTidGet");
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
| **tid** | **Integer**|  | |

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

<a id="getTaskApiV1AgentNeedTaskTidGet_0"></a>
# **getTaskApiV1AgentNeedTaskTidGet_0**
> Object getTaskApiV1AgentNeedTaskTidGet_0(tid)

需求详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    Integer tid = 56; // Integer | 
    try {
      Object result = apiInstance.getTaskApiV1AgentNeedTaskTidGet_0(tid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#getTaskApiV1AgentNeedTaskTidGet_0");
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
| **tid** | **Integer**|  | |

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

<a id="listBidsApiV1AgentNeedTaskTidBidsGet"></a>
# **listBidsApiV1AgentNeedTaskTidBidsGet**
> Object listBidsApiV1AgentNeedTaskTidBidsGet(tid)

任务报价列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    Integer tid = 56; // Integer | 
    try {
      Object result = apiInstance.listBidsApiV1AgentNeedTaskTidBidsGet(tid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#listBidsApiV1AgentNeedTaskTidBidsGet");
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
| **tid** | **Integer**|  | |

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

<a id="listBidsApiV1AgentNeedTaskTidBidsGet_0"></a>
# **listBidsApiV1AgentNeedTaskTidBidsGet_0**
> Object listBidsApiV1AgentNeedTaskTidBidsGet_0(tid)

任务报价列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    Integer tid = 56; // Integer | 
    try {
      Object result = apiInstance.listBidsApiV1AgentNeedTaskTidBidsGet_0(tid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#listBidsApiV1AgentNeedTaskTidBidsGet_0");
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
| **tid** | **Integer**|  | |

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

<a id="listTasksApiV1AgentNeedTaskListGet"></a>
# **listTasksApiV1AgentNeedTaskListGet**
> Object listTasksApiV1AgentNeedTaskListGet(page, limit, status, type, userId, developerId, keyword)

需求列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 
    String type = "type_example"; // String | 
    String userId = "userId_example"; // String | 
    String developerId = "developerId_example"; // String | 
    String keyword = "keyword_example"; // String | 
    try {
      Object result = apiInstance.listTasksApiV1AgentNeedTaskListGet(page, limit, status, type, userId, developerId, keyword);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#listTasksApiV1AgentNeedTaskListGet");
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
| **status** | **Integer**|  | [optional] |
| **type** | **String**|  | [optional] |
| **userId** | **String**|  | [optional] |
| **developerId** | **String**|  | [optional] |
| **keyword** | **String**|  | [optional] |

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

<a id="listTasksApiV1AgentNeedTaskListGet_0"></a>
# **listTasksApiV1AgentNeedTaskListGet_0**
> Object listTasksApiV1AgentNeedTaskListGet_0(page, limit, status, type, userId, developerId, keyword)

需求列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 
    String type = "type_example"; // String | 
    String userId = "userId_example"; // String | 
    String developerId = "developerId_example"; // String | 
    String keyword = "keyword_example"; // String | 
    try {
      Object result = apiInstance.listTasksApiV1AgentNeedTaskListGet_0(page, limit, status, type, userId, developerId, keyword);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#listTasksApiV1AgentNeedTaskListGet_0");
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
| **status** | **Integer**|  | [optional] |
| **type** | **String**|  | [optional] |
| **userId** | **String**|  | [optional] |
| **developerId** | **String**|  | [optional] |
| **keyword** | **String**|  | [optional] |

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

<a id="updateTaskApiV1AgentNeedTaskTidPut"></a>
# **updateTaskApiV1AgentNeedTaskTidPut**
> Object updateTaskApiV1AgentNeedTaskTidPut(tid, title, description, priority, budget, status, deliverable, remark)

修改需求

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    Integer tid = 56; // Integer | 
    String title = "title_example"; // String | 
    String description = "description_example"; // String | 
    Integer priority = 56; // Integer | 
    Integer budget = 56; // Integer | 
    Integer status = 56; // Integer | 
    String deliverable = "deliverable_example"; // String | 
    String remark = "remark_example"; // String | 
    try {
      Object result = apiInstance.updateTaskApiV1AgentNeedTaskTidPut(tid, title, description, priority, budget, status, deliverable, remark);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#updateTaskApiV1AgentNeedTaskTidPut");
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
| **tid** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **priority** | **Integer**|  | [optional] |
| **budget** | **Integer**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **deliverable** | **String**|  | [optional] |
| **remark** | **String**|  | [optional] |

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

<a id="updateTaskApiV1AgentNeedTaskTidPut_0"></a>
# **updateTaskApiV1AgentNeedTaskTidPut_0**
> Object updateTaskApiV1AgentNeedTaskTidPut_0(tid, title, description, priority, budget, status, deliverable, remark)

修改需求

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentNeedTaskApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentNeedTaskApi apiInstance = new AgentNeedTaskApi(defaultClient);
    Integer tid = 56; // Integer | 
    String title = "title_example"; // String | 
    String description = "description_example"; // String | 
    Integer priority = 56; // Integer | 
    Integer budget = 56; // Integer | 
    Integer status = 56; // Integer | 
    String deliverable = "deliverable_example"; // String | 
    String remark = "remark_example"; // String | 
    try {
      Object result = apiInstance.updateTaskApiV1AgentNeedTaskTidPut_0(tid, title, description, priority, budget, status, deliverable, remark);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentNeedTaskApi#updateTaskApiV1AgentNeedTaskTidPut_0");
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
| **tid** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **priority** | **Integer**|  | [optional] |
| **budget** | **Integer**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **deliverable** | **String**|  | [optional] |
| **remark** | **String**|  | [optional] |

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

