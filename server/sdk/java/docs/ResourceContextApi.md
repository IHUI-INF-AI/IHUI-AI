# ResourceContextApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getAgentWithDeductionApiV1ResourceContextAgentAgentIdGet**](ResourceContextApi.md#getAgentWithDeductionApiV1ResourceContextAgentAgentIdGet) | **GET** /api/v1/resource/context/agent/{agent_id} | 获取Agent调用（含token扣除） |
| [**getContextApiV1ResourceContextGetGet**](ResourceContextApi.md#getContextApiV1ResourceContextGetGet) | **GET** /api/v1/resource/context/get | 获取用户上下文 |
| [**getFieldApiV1ResourceContextFieldGet**](ResourceContextApi.md#getFieldApiV1ResourceContextFieldGet) | **GET** /api/v1/resource/context/field | 获取指定字段值 |
| [**getSampleContextApiV1ResourceContextSampleGet**](ResourceContextApi.md#getSampleContextApiV1ResourceContextSampleGet) | **GET** /api/v1/resource/context/sample | Get sample context data |
| [**getUsageHistoryApiV1ResourceContextHistoryPost**](ResourceContextApi.md#getUsageHistoryApiV1ResourceContextHistoryPost) | **POST** /api/v1/resource/context/history | Query usage history |
| [**queryContextRawApiV1ResourceContextQueryPost**](ResourceContextApi.md#queryContextRawApiV1ResourceContextQueryPost) | **POST** /api/v1/resource/context/query | Query user agent context (raw SQL) |
| [**removeFieldApiV1ResourceContextRemoveFieldPost**](ResourceContextApi.md#removeFieldApiV1ResourceContextRemoveFieldPost) | **POST** /api/v1/resource/context/remove/field | 删除指定字段 |
| [**saveContextApiV1ResourceContextSavePost**](ResourceContextApi.md#saveContextApiV1ResourceContextSavePost) | **POST** /api/v1/resource/context/save | 保存用户上下文 |


<a id="getAgentWithDeductionApiV1ResourceContextAgentAgentIdGet"></a>
# **getAgentWithDeductionApiV1ResourceContextAgentAgentIdGet**
> Object getAgentWithDeductionApiV1ResourceContextAgentAgentIdGet(agentId)

获取Agent调用（含token扣除）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceContextApi apiInstance = new ResourceContextApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    try {
      Object result = apiInstance.getAgentWithDeductionApiV1ResourceContextAgentAgentIdGet(agentId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceContextApi#getAgentWithDeductionApiV1ResourceContextAgentAgentIdGet");
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

<a id="getContextApiV1ResourceContextGetGet"></a>
# **getContextApiV1ResourceContextGetGet**
> Object getContextApiV1ResourceContextGetGet(agentId, contextKey)

获取用户上下文

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceContextApi apiInstance = new ResourceContextApi(defaultClient);
    String agentId = "agentId_example"; // String | Agent ID
    String contextKey = "contextKey_example"; // String | Context key (optional filter)
    try {
      Object result = apiInstance.getContextApiV1ResourceContextGetGet(agentId, contextKey);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceContextApi#getContextApiV1ResourceContextGetGet");
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
| **agentId** | **String**| Agent ID | |
| **contextKey** | **String**| Context key (optional filter) | [optional] |

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

<a id="getFieldApiV1ResourceContextFieldGet"></a>
# **getFieldApiV1ResourceContextFieldGet**
> Object getFieldApiV1ResourceContextFieldGet(agentId, fieldName)

获取指定字段值

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceContextApi apiInstance = new ResourceContextApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    String fieldName = "fieldName_example"; // String | 
    try {
      Object result = apiInstance.getFieldApiV1ResourceContextFieldGet(agentId, fieldName);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceContextApi#getFieldApiV1ResourceContextFieldGet");
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
| **fieldName** | **String**|  | |

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

<a id="getSampleContextApiV1ResourceContextSampleGet"></a>
# **getSampleContextApiV1ResourceContextSampleGet**
> Object getSampleContextApiV1ResourceContextSampleGet(limit)

Get sample context data

Return a few sample rows for debugging / display.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceContextApi apiInstance = new ResourceContextApi(defaultClient);
    Integer limit = 5; // Integer | Number of rows
    try {
      Object result = apiInstance.getSampleContextApiV1ResourceContextSampleGet(limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceContextApi#getSampleContextApiV1ResourceContextSampleGet");
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
| **limit** | **Integer**| Number of rows | [optional] [default to 5] |

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

<a id="getUsageHistoryApiV1ResourceContextHistoryPost"></a>
# **getUsageHistoryApiV1ResourceContextHistoryPost**
> Object getUsageHistoryApiV1ResourceContextHistoryPost(historyRequest)

Query usage history

Query user&#39;s agent usage history with model name join and pagination.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceContextApi apiInstance = new ResourceContextApi(defaultClient);
    HistoryRequest historyRequest = new HistoryRequest(); // HistoryRequest | 
    try {
      Object result = apiInstance.getUsageHistoryApiV1ResourceContextHistoryPost(historyRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceContextApi#getUsageHistoryApiV1ResourceContextHistoryPost");
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
| **historyRequest** | [**HistoryRequest**](HistoryRequest.md)|  | |

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

<a id="queryContextRawApiV1ResourceContextQueryPost"></a>
# **queryContextRawApiV1ResourceContextQueryPost**
> Object queryContextRawApiV1ResourceContextQueryPost(rawContextRequest)

Query user agent context (raw SQL)

Query zhs_user_agent_context by user_uuid + model_name + chat_id. Returns messages list with user/assistant role alternation.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceContextApi apiInstance = new ResourceContextApi(defaultClient);
    RawContextRequest rawContextRequest = new RawContextRequest(); // RawContextRequest | 
    try {
      Object result = apiInstance.queryContextRawApiV1ResourceContextQueryPost(rawContextRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceContextApi#queryContextRawApiV1ResourceContextQueryPost");
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
| **rawContextRequest** | [**RawContextRequest**](RawContextRequest.md)|  | |

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

<a id="removeFieldApiV1ResourceContextRemoveFieldPost"></a>
# **removeFieldApiV1ResourceContextRemoveFieldPost**
> Object removeFieldApiV1ResourceContextRemoveFieldPost(fieldRemoveRequest)

删除指定字段

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceContextApi apiInstance = new ResourceContextApi(defaultClient);
    FieldRemoveRequest fieldRemoveRequest = new FieldRemoveRequest(); // FieldRemoveRequest | 
    try {
      Object result = apiInstance.removeFieldApiV1ResourceContextRemoveFieldPost(fieldRemoveRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceContextApi#removeFieldApiV1ResourceContextRemoveFieldPost");
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
| **fieldRemoveRequest** | [**FieldRemoveRequest**](FieldRemoveRequest.md)|  | |

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

<a id="saveContextApiV1ResourceContextSavePost"></a>
# **saveContextApiV1ResourceContextSavePost**
> Object saveContextApiV1ResourceContextSavePost(contextSaveRequest)

保存用户上下文

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceContextApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceContextApi apiInstance = new ResourceContextApi(defaultClient);
    ContextSaveRequest contextSaveRequest = new ContextSaveRequest(); // ContextSaveRequest | 
    try {
      Object result = apiInstance.saveContextApiV1ResourceContextSavePost(contextSaveRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceContextApi#saveContextApiV1ResourceContextSavePost");
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
| **contextSaveRequest** | [**ContextSaveRequest**](ContextSaveRequest.md)|  | |

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

