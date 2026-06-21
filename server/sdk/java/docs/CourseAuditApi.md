# CourseAuditApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**auditCourseApiV1CourseAuditAidAuditPut**](CourseAuditApi.md#auditCourseApiV1CourseAuditAidAuditPut) | **PUT** /api/v1/course-audit/{aid}/audit | 审核操作 |
| [**auditCourseApiV1CourseAuditAidAuditPut_0**](CourseAuditApi.md#auditCourseApiV1CourseAuditAidAuditPut_0) | **PUT** /api/v1/course-audit/{aid}/audit | 审核操作 |
| [**courseAuditSubmit**](CourseAuditApi.md#courseAuditSubmit) | **POST** /api/v1/course-audit/submit | 提交课程审核 |
| [**courseAuditSubmit_0**](CourseAuditApi.md#courseAuditSubmit_0) | **POST** /api/v1/course-audit/submit | 提交课程审核 |
| [**getAuditApiV1CourseAuditAidGet**](CourseAuditApi.md#getAuditApiV1CourseAuditAidGet) | **GET** /api/v1/course-audit/{aid} | 审核详情 |
| [**getAuditApiV1CourseAuditAidGet_0**](CourseAuditApi.md#getAuditApiV1CourseAuditAidGet_0) | **GET** /api/v1/course-audit/{aid} | 审核详情 |
| [**listAuditsApiV1CourseAuditListGet**](CourseAuditApi.md#listAuditsApiV1CourseAuditListGet) | **GET** /api/v1/course-audit/list | 审核列表 |
| [**listAuditsApiV1CourseAuditListGet_0**](CourseAuditApi.md#listAuditsApiV1CourseAuditListGet_0) | **GET** /api/v1/course-audit/list | 审核列表 |


<a id="auditCourseApiV1CourseAuditAidAuditPut"></a>
# **auditCourseApiV1CourseAuditAidAuditPut**
> Object auditCourseApiV1CourseAuditAidAuditPut(aid, status, remark, score, isFinal)

审核操作

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CourseAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CourseAuditApi apiInstance = new CourseAuditApi(defaultClient);
    Integer aid = 56; // Integer | 
    Integer status = 56; // Integer | 
    String remark = "remark_example"; // String | 
    Integer score = 0; // Integer | 
    Boolean isFinal = false; // Boolean | 
    try {
      Object result = apiInstance.auditCourseApiV1CourseAuditAidAuditPut(aid, status, remark, score, isFinal);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CourseAuditApi#auditCourseApiV1CourseAuditAidAuditPut");
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
| **aid** | **Integer**|  | |
| **status** | **Integer**|  | |
| **remark** | **String**|  | [optional] |
| **score** | **Integer**|  | [optional] [default to 0] |
| **isFinal** | **Boolean**|  | [optional] [default to false] |

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

<a id="auditCourseApiV1CourseAuditAidAuditPut_0"></a>
# **auditCourseApiV1CourseAuditAidAuditPut_0**
> Object auditCourseApiV1CourseAuditAidAuditPut_0(aid, status, remark, score, isFinal)

审核操作

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CourseAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CourseAuditApi apiInstance = new CourseAuditApi(defaultClient);
    Integer aid = 56; // Integer | 
    Integer status = 56; // Integer | 
    String remark = "remark_example"; // String | 
    Integer score = 0; // Integer | 
    Boolean isFinal = false; // Boolean | 
    try {
      Object result = apiInstance.auditCourseApiV1CourseAuditAidAuditPut_0(aid, status, remark, score, isFinal);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CourseAuditApi#auditCourseApiV1CourseAuditAidAuditPut_0");
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
| **aid** | **Integer**|  | |
| **status** | **Integer**|  | |
| **remark** | **String**|  | [optional] |
| **score** | **Integer**|  | [optional] [default to 0] |
| **isFinal** | **Boolean**|  | [optional] [default to false] |

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

<a id="courseAuditSubmit"></a>
# **courseAuditSubmit**
> Object courseAuditSubmit(courseId, courseTitle)

提交课程审核

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CourseAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CourseAuditApi apiInstance = new CourseAuditApi(defaultClient);
    Integer courseId = 56; // Integer | 
    String courseTitle = "courseTitle_example"; // String | 
    try {
      Object result = apiInstance.courseAuditSubmit(courseId, courseTitle);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CourseAuditApi#courseAuditSubmit");
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
| **courseId** | **Integer**|  | |
| **courseTitle** | **String**|  | [optional] |

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

<a id="courseAuditSubmit_0"></a>
# **courseAuditSubmit_0**
> Object courseAuditSubmit_0(courseId, courseTitle)

提交课程审核

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CourseAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CourseAuditApi apiInstance = new CourseAuditApi(defaultClient);
    Integer courseId = 56; // Integer | 
    String courseTitle = "courseTitle_example"; // String | 
    try {
      Object result = apiInstance.courseAuditSubmit_0(courseId, courseTitle);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CourseAuditApi#courseAuditSubmit_0");
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
| **courseId** | **Integer**|  | |
| **courseTitle** | **String**|  | [optional] |

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

<a id="getAuditApiV1CourseAuditAidGet"></a>
# **getAuditApiV1CourseAuditAidGet**
> Object getAuditApiV1CourseAuditAidGet(aid)

审核详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CourseAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CourseAuditApi apiInstance = new CourseAuditApi(defaultClient);
    Integer aid = 56; // Integer | 
    try {
      Object result = apiInstance.getAuditApiV1CourseAuditAidGet(aid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CourseAuditApi#getAuditApiV1CourseAuditAidGet");
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
| **aid** | **Integer**|  | |

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

<a id="getAuditApiV1CourseAuditAidGet_0"></a>
# **getAuditApiV1CourseAuditAidGet_0**
> Object getAuditApiV1CourseAuditAidGet_0(aid)

审核详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CourseAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CourseAuditApi apiInstance = new CourseAuditApi(defaultClient);
    Integer aid = 56; // Integer | 
    try {
      Object result = apiInstance.getAuditApiV1CourseAuditAidGet_0(aid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CourseAuditApi#getAuditApiV1CourseAuditAidGet_0");
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
| **aid** | **Integer**|  | |

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

<a id="listAuditsApiV1CourseAuditListGet"></a>
# **listAuditsApiV1CourseAuditListGet**
> Object listAuditsApiV1CourseAuditListGet(page, limit, status, courseId)

审核列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CourseAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CourseAuditApi apiInstance = new CourseAuditApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 
    Integer courseId = 56; // Integer | 
    try {
      Object result = apiInstance.listAuditsApiV1CourseAuditListGet(page, limit, status, courseId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CourseAuditApi#listAuditsApiV1CourseAuditListGet");
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
| **courseId** | **Integer**|  | [optional] |

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

<a id="listAuditsApiV1CourseAuditListGet_0"></a>
# **listAuditsApiV1CourseAuditListGet_0**
> Object listAuditsApiV1CourseAuditListGet_0(page, limit, status, courseId)

审核列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CourseAuditApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CourseAuditApi apiInstance = new CourseAuditApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer status = 56; // Integer | 
    Integer courseId = 56; // Integer | 
    try {
      Object result = apiInstance.listAuditsApiV1CourseAuditListGet_0(page, limit, status, courseId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CourseAuditApi#listAuditsApiV1CourseAuditListGet_0");
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
| **courseId** | **Integer**|  | [optional] |

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

