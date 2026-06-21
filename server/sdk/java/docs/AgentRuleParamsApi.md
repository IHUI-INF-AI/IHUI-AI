# AgentRuleParamsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createRuleParamApiV1Post**](AgentRuleParamsApi.md#createRuleParamApiV1Post) | **POST** /api/v1/ | Create rule param |
| [**deleteRuleParamsApiV1ItemIdsDelete**](AgentRuleParamsApi.md#deleteRuleParamsApiV1ItemIdsDelete) | **DELETE** /api/v1/{item_ids} | Delete rule params |
| [**getRuleParamApiV1ItemIdGet**](AgentRuleParamsApi.md#getRuleParamApiV1ItemIdGet) | **GET** /api/v1/{item_id} | Get rule param detail |
| [**listRuleParamsApiV1ListGet**](AgentRuleParamsApi.md#listRuleParamsApiV1ListGet) | **GET** /api/v1/list | List rule params |
| [**updateRuleParamApiV1Put**](AgentRuleParamsApi.md#updateRuleParamApiV1Put) | **PUT** /api/v1/ | Update rule param |


<a id="createRuleParamApiV1Post"></a>
# **createRuleParamApiV1Post**
> Object createRuleParamApiV1Post(ruleParamCreate)

Create rule param

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentRuleParamsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentRuleParamsApi apiInstance = new AgentRuleParamsApi(defaultClient);
    RuleParamCreate ruleParamCreate = new RuleParamCreate(); // RuleParamCreate | 
    try {
      Object result = apiInstance.createRuleParamApiV1Post(ruleParamCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentRuleParamsApi#createRuleParamApiV1Post");
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
| **ruleParamCreate** | [**RuleParamCreate**](RuleParamCreate.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="deleteRuleParamsApiV1ItemIdsDelete"></a>
# **deleteRuleParamsApiV1ItemIdsDelete**
> Object deleteRuleParamsApiV1ItemIdsDelete(itemIds)

Delete rule params

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentRuleParamsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentRuleParamsApi apiInstance = new AgentRuleParamsApi(defaultClient);
    String itemIds = "itemIds_example"; // String | 
    try {
      Object result = apiInstance.deleteRuleParamsApiV1ItemIdsDelete(itemIds);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentRuleParamsApi#deleteRuleParamsApiV1ItemIdsDelete");
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
| **itemIds** | **String**|  | |

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

<a id="getRuleParamApiV1ItemIdGet"></a>
# **getRuleParamApiV1ItemIdGet**
> Object getRuleParamApiV1ItemIdGet(itemId)

Get rule param detail

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentRuleParamsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentRuleParamsApi apiInstance = new AgentRuleParamsApi(defaultClient);
    Integer itemId = 56; // Integer | 
    try {
      Object result = apiInstance.getRuleParamApiV1ItemIdGet(itemId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentRuleParamsApi#getRuleParamApiV1ItemIdGet");
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
| **itemId** | **Integer**|  | |

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

<a id="listRuleParamsApiV1ListGet"></a>
# **listRuleParamsApiV1ListGet**
> Object listRuleParamsApiV1ListGet(page, limit, ruleId)

List rule params

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentRuleParamsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentRuleParamsApi apiInstance = new AgentRuleParamsApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer ruleId = 56; // Integer | 
    try {
      Object result = apiInstance.listRuleParamsApiV1ListGet(page, limit, ruleId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentRuleParamsApi#listRuleParamsApiV1ListGet");
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
| **ruleId** | **Integer**|  | [optional] |

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

<a id="updateRuleParamApiV1Put"></a>
# **updateRuleParamApiV1Put**
> Object updateRuleParamApiV1Put(ruleParamUpdate)

Update rule param

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentRuleParamsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AgentRuleParamsApi apiInstance = new AgentRuleParamsApi(defaultClient);
    RuleParamUpdate ruleParamUpdate = new RuleParamUpdate(); // RuleParamUpdate | 
    try {
      Object result = apiInstance.updateRuleParamApiV1Put(ruleParamUpdate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentRuleParamsApi#updateRuleParamApiV1Put");
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
| **ruleParamUpdate** | [**RuleParamUpdate**](RuleParamUpdate.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

