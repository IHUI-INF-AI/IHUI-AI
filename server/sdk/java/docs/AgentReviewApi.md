# AgentReviewApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**approveExamineApiV1AgentsRecordIdApprovePut**](AgentReviewApi.md#approveExamineApiV1AgentsRecordIdApprovePut) | **PUT** /api/v1/agents/{record_id}/approve | Approve agent examination |
| [**examineStatsApiV1AgentsStatsSummaryGet**](AgentReviewApi.md#examineStatsApiV1AgentsStatsSummaryGet) | **GET** /api/v1/agents/stats/summary | Examination statistics |
| [**rejectExamineApiV1AgentsRecordIdRejectPut**](AgentReviewApi.md#rejectExamineApiV1AgentsRecordIdRejectPut) | **PUT** /api/v1/agents/{record_id}/reject | Reject agent examination |
| [**submitExamineApiV1AgentsSubmitPost**](AgentReviewApi.md#submitExamineApiV1AgentsSubmitPost) | **POST** /api/v1/agents/submit | Submit agent for examination |


<a id="approveExamineApiV1AgentsRecordIdApprovePut"></a>
# **approveExamineApiV1AgentsRecordIdApprovePut**
> Object approveExamineApiV1AgentsRecordIdApprovePut(recordId, bodyApproveExamineApiV1AgentsRecordIdApprovePut)

Approve agent examination

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentReviewApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentReviewApi apiInstance = new AgentReviewApi(defaultClient);
    Integer recordId = 56; // Integer | 
    BodyApproveExamineApiV1AgentsRecordIdApprovePut bodyApproveExamineApiV1AgentsRecordIdApprovePut = new BodyApproveExamineApiV1AgentsRecordIdApprovePut(); // BodyApproveExamineApiV1AgentsRecordIdApprovePut | 
    try {
      Object result = apiInstance.approveExamineApiV1AgentsRecordIdApprovePut(recordId, bodyApproveExamineApiV1AgentsRecordIdApprovePut);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentReviewApi#approveExamineApiV1AgentsRecordIdApprovePut");
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
| **bodyApproveExamineApiV1AgentsRecordIdApprovePut** | [**BodyApproveExamineApiV1AgentsRecordIdApprovePut**](BodyApproveExamineApiV1AgentsRecordIdApprovePut.md)|  | [optional] |

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

<a id="examineStatsApiV1AgentsStatsSummaryGet"></a>
# **examineStatsApiV1AgentsStatsSummaryGet**
> Object examineStatsApiV1AgentsStatsSummaryGet()

Examination statistics

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentReviewApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentReviewApi apiInstance = new AgentReviewApi(defaultClient);
    try {
      Object result = apiInstance.examineStatsApiV1AgentsStatsSummaryGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentReviewApi#examineStatsApiV1AgentsStatsSummaryGet");
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

<a id="rejectExamineApiV1AgentsRecordIdRejectPut"></a>
# **rejectExamineApiV1AgentsRecordIdRejectPut**
> Object rejectExamineApiV1AgentsRecordIdRejectPut(recordId, bodyRejectExamineApiV1AgentsRecordIdRejectPut)

Reject agent examination

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentReviewApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentReviewApi apiInstance = new AgentReviewApi(defaultClient);
    Integer recordId = 56; // Integer | 
    BodyRejectExamineApiV1AgentsRecordIdRejectPut bodyRejectExamineApiV1AgentsRecordIdRejectPut = new BodyRejectExamineApiV1AgentsRecordIdRejectPut(); // BodyRejectExamineApiV1AgentsRecordIdRejectPut | 
    try {
      Object result = apiInstance.rejectExamineApiV1AgentsRecordIdRejectPut(recordId, bodyRejectExamineApiV1AgentsRecordIdRejectPut);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentReviewApi#rejectExamineApiV1AgentsRecordIdRejectPut");
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
| **bodyRejectExamineApiV1AgentsRecordIdRejectPut** | [**BodyRejectExamineApiV1AgentsRecordIdRejectPut**](BodyRejectExamineApiV1AgentsRecordIdRejectPut.md)|  | |

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

<a id="submitExamineApiV1AgentsSubmitPost"></a>
# **submitExamineApiV1AgentsSubmitPost**
> Object submitExamineApiV1AgentsSubmitPost(agentId)

Submit agent for examination

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AgentReviewApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AgentReviewApi apiInstance = new AgentReviewApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    try {
      Object result = apiInstance.submitExamineApiV1AgentsSubmitPost(agentId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AgentReviewApi#submitExamineApiV1AgentsSubmitPost");
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

