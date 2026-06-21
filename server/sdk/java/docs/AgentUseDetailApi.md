# AgentUseDetailApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**agentUsedetailDailyStats**](AgentUseDetailApi.md#agentUsedetailDailyStats) | **GET** /api/v1/agent-usedetail/stats/daily | 日统计 |
| [**agentUsedetailDailyStats_0**](AgentUseDetailApi.md#agentUsedetailDailyStats_0) | **GET** /api/v1/agent-usedetail/stats/daily | 日统计 |
| [**listDetailsApiV1AgentUsedetailListGet**](AgentUseDetailApi.md#listDetailsApiV1AgentUsedetailListGet) | **GET** /api/v1/agent-usedetail/list | 使用明细 |
| [**listDetailsApiV1AgentUsedetailListGet_0**](AgentUseDetailApi.md#listDetailsApiV1AgentUsedetailListGet_0) | **GET** /api/v1/agent-usedetail/list | 使用明细 |
| [**recordUsageApiV1AgentUsedetailRecordPost**](AgentUseDetailApi.md#recordUsageApiV1AgentUsedetailRecordPost) | **POST** /api/v1/agent-usedetail/record | 记录使用 |
| [**recordUsageApiV1AgentUsedetailRecordPost_0**](AgentUseDetailApi.md#recordUsageApiV1AgentUsedetailRecordPost_0) | **POST** /api/v1/agent-usedetail/record | 记录使用 |
| [**summaryStatsApiV1AgentUsedetailStatsSummaryGet**](AgentUseDetailApi.md#summaryStatsApiV1AgentUsedetailStatsSummaryGet) | **GET** /api/v1/agent-usedetail/stats/summary | 汇总统计 |
| [**summaryStatsApiV1AgentUsedetailStatsSummaryGet_0**](AgentUseDetailApi.md#summaryStatsApiV1AgentUsedetailStatsSummaryGet_0) | **GET** /api/v1/agent-usedetail/stats/summary | 汇总统计 |


<a id="agentUsedetailDailyStats"></a>
# **agentUsedetailDailyStats**
> Object agentUsedetailDailyStats(agentId, startDate, endDate)

日统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentUseDetailApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentUseDetailApi apiInstance = new AgentUseDetailApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    try {
      Object result = apiInstance.agentUsedetailDailyStats(agentId, startDate, endDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentUseDetailApi#agentUsedetailDailyStats");
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
| **agentId** | **String**|  | [optional] |
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |

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

<a id="agentUsedetailDailyStats_0"></a>
# **agentUsedetailDailyStats_0**
> Object agentUsedetailDailyStats_0(agentId, startDate, endDate)

日统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentUseDetailApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentUseDetailApi apiInstance = new AgentUseDetailApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    try {
      Object result = apiInstance.agentUsedetailDailyStats_0(agentId, startDate, endDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentUseDetailApi#agentUsedetailDailyStats_0");
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
| **agentId** | **String**|  | [optional] |
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |

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

<a id="listDetailsApiV1AgentUsedetailListGet"></a>
# **listDetailsApiV1AgentUsedetailListGet**
> Object listDetailsApiV1AgentUsedetailListGet(page, limit, agentId, userId, type, startDate, endDate)

使用明细

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentUseDetailApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentUseDetailApi apiInstance = new AgentUseDetailApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String agentId = "agentId_example"; // String | 
    String userId = "userId_example"; // String | 
    String type = "type_example"; // String | 
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    try {
      Object result = apiInstance.listDetailsApiV1AgentUsedetailListGet(page, limit, agentId, userId, type, startDate, endDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentUseDetailApi#listDetailsApiV1AgentUsedetailListGet");
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
| **agentId** | **String**|  | [optional] |
| **userId** | **String**|  | [optional] |
| **type** | **String**|  | [optional] |
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |

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

<a id="listDetailsApiV1AgentUsedetailListGet_0"></a>
# **listDetailsApiV1AgentUsedetailListGet_0**
> Object listDetailsApiV1AgentUsedetailListGet_0(page, limit, agentId, userId, type, startDate, endDate)

使用明细

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentUseDetailApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentUseDetailApi apiInstance = new AgentUseDetailApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String agentId = "agentId_example"; // String | 
    String userId = "userId_example"; // String | 
    String type = "type_example"; // String | 
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    try {
      Object result = apiInstance.listDetailsApiV1AgentUsedetailListGet_0(page, limit, agentId, userId, type, startDate, endDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentUseDetailApi#listDetailsApiV1AgentUsedetailListGet_0");
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
| **agentId** | **String**|  | [optional] |
| **userId** | **String**|  | [optional] |
| **type** | **String**|  | [optional] |
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |

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

<a id="recordUsageApiV1AgentUsedetailRecordPost"></a>
# **recordUsageApiV1AgentUsedetailRecordPost**
> Object recordUsageApiV1AgentUsedetailRecordPost(agentId, userId, type, model, tokens, amount, cost, requestId, status, remark)

记录使用

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentUseDetailApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentUseDetailApi apiInstance = new AgentUseDetailApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String userId = "userId_example"; // String | 
    String type = "consume"; // String | 
    String model = "model_example"; // String | 
    Integer tokens = 0; // Integer | 
    BigDecimal amount = new BigDecimal("0"); // BigDecimal | 
    BigDecimal cost = new BigDecimal("0"); // BigDecimal | 
    String requestId = "requestId_example"; // String | 
    Integer status = 1; // Integer | 
    String remark = "remark_example"; // String | 
    try {
      Object result = apiInstance.recordUsageApiV1AgentUsedetailRecordPost(agentId, userId, type, model, tokens, amount, cost, requestId, status, remark);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentUseDetailApi#recordUsageApiV1AgentUsedetailRecordPost");
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
| **userId** | **String**|  | |
| **type** | **String**|  | [optional] [default to consume] |
| **model** | **String**|  | [optional] |
| **tokens** | **Integer**|  | [optional] [default to 0] |
| **amount** | **BigDecimal**|  | [optional] [default to 0] |
| **cost** | **BigDecimal**|  | [optional] [default to 0] |
| **requestId** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] [default to 1] |
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

<a id="recordUsageApiV1AgentUsedetailRecordPost_0"></a>
# **recordUsageApiV1AgentUsedetailRecordPost_0**
> Object recordUsageApiV1AgentUsedetailRecordPost_0(agentId, userId, type, model, tokens, amount, cost, requestId, status, remark)

记录使用

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentUseDetailApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentUseDetailApi apiInstance = new AgentUseDetailApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String userId = "userId_example"; // String | 
    String type = "consume"; // String | 
    String model = "model_example"; // String | 
    Integer tokens = 0; // Integer | 
    BigDecimal amount = new BigDecimal("0"); // BigDecimal | 
    BigDecimal cost = new BigDecimal("0"); // BigDecimal | 
    String requestId = "requestId_example"; // String | 
    Integer status = 1; // Integer | 
    String remark = "remark_example"; // String | 
    try {
      Object result = apiInstance.recordUsageApiV1AgentUsedetailRecordPost_0(agentId, userId, type, model, tokens, amount, cost, requestId, status, remark);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentUseDetailApi#recordUsageApiV1AgentUsedetailRecordPost_0");
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
| **userId** | **String**|  | |
| **type** | **String**|  | [optional] [default to consume] |
| **model** | **String**|  | [optional] |
| **tokens** | **Integer**|  | [optional] [default to 0] |
| **amount** | **BigDecimal**|  | [optional] [default to 0] |
| **cost** | **BigDecimal**|  | [optional] [default to 0] |
| **requestId** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] [default to 1] |
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

<a id="summaryStatsApiV1AgentUsedetailStatsSummaryGet"></a>
# **summaryStatsApiV1AgentUsedetailStatsSummaryGet**
> Object summaryStatsApiV1AgentUsedetailStatsSummaryGet(agentId, startDate, endDate)

汇总统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentUseDetailApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentUseDetailApi apiInstance = new AgentUseDetailApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    try {
      Object result = apiInstance.summaryStatsApiV1AgentUsedetailStatsSummaryGet(agentId, startDate, endDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentUseDetailApi#summaryStatsApiV1AgentUsedetailStatsSummaryGet");
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
| **agentId** | **String**|  | [optional] |
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |

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

<a id="summaryStatsApiV1AgentUsedetailStatsSummaryGet_0"></a>
# **summaryStatsApiV1AgentUsedetailStatsSummaryGet_0**
> Object summaryStatsApiV1AgentUsedetailStatsSummaryGet_0(agentId, startDate, endDate)

汇总统计

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentUseDetailApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentUseDetailApi apiInstance = new AgentUseDetailApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String startDate = "startDate_example"; // String | 
    String endDate = "endDate_example"; // String | 
    try {
      Object result = apiInstance.summaryStatsApiV1AgentUsedetailStatsSummaryGet_0(agentId, startDate, endDate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentUseDetailApi#summaryStatsApiV1AgentUsedetailStatsSummaryGet_0");
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
| **agentId** | **String**|  | [optional] |
| **startDate** | **String**|  | [optional] |
| **endDate** | **String**|  | [optional] |

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

