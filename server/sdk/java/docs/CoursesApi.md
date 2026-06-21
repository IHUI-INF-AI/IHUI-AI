# CoursesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createCourseApiV1CoursesCreatePost**](CoursesApi.md#createCourseApiV1CoursesCreatePost) | **POST** /api/v1/courses/create | Create course |
| [**deleteCourseApiV1CoursesCourseIdDelete**](CoursesApi.md#deleteCourseApiV1CoursesCourseIdDelete) | **DELETE** /api/v1/courses/{course_id} | Delete course (soft) |
| [**delistCourseApiV1CoursesCourseIdDelistPost**](CoursesApi.md#delistCourseApiV1CoursesCourseIdDelistPost) | **POST** /api/v1/courses/{course_id}/delist | Delist (hide) course |
| [**getCourseApiV1CoursesCourseIdGet**](CoursesApi.md#getCourseApiV1CoursesCourseIdGet) | **GET** /api/v1/courses/{course_id} | Get course detail |
| [**listCoursesApiV1CoursesListGet**](CoursesApi.md#listCoursesApiV1CoursesListGet) | **GET** /api/v1/courses/list | List courses |
| [**updateCourseApiV1CoursesCourseIdPut**](CoursesApi.md#updateCourseApiV1CoursesCourseIdPut) | **PUT** /api/v1/courses/{course_id} | Update course |


<a id="createCourseApiV1CoursesCreatePost"></a>
# **createCourseApiV1CoursesCreatePost**
> Object createCourseApiV1CoursesCreatePost(courseCreate)

Create course

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesApi apiInstance = new CoursesApi(defaultClient);
    CourseCreate courseCreate = new CourseCreate(); // CourseCreate | 
    try {
      Object result = apiInstance.createCourseApiV1CoursesCreatePost(courseCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesApi#createCourseApiV1CoursesCreatePost");
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
| **courseCreate** | [**CourseCreate**](CourseCreate.md)|  | |

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

<a id="deleteCourseApiV1CoursesCourseIdDelete"></a>
# **deleteCourseApiV1CoursesCourseIdDelete**
> Object deleteCourseApiV1CoursesCourseIdDelete(courseId)

Delete course (soft)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesApi apiInstance = new CoursesApi(defaultClient);
    Integer courseId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteCourseApiV1CoursesCourseIdDelete(courseId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesApi#deleteCourseApiV1CoursesCourseIdDelete");
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

<a id="delistCourseApiV1CoursesCourseIdDelistPost"></a>
# **delistCourseApiV1CoursesCourseIdDelistPost**
> Object delistCourseApiV1CoursesCourseIdDelistPost(courseId)

Delist (hide) course

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesApi apiInstance = new CoursesApi(defaultClient);
    Integer courseId = 56; // Integer | 
    try {
      Object result = apiInstance.delistCourseApiV1CoursesCourseIdDelistPost(courseId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesApi#delistCourseApiV1CoursesCourseIdDelistPost");
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

<a id="getCourseApiV1CoursesCourseIdGet"></a>
# **getCourseApiV1CoursesCourseIdGet**
> Object getCourseApiV1CoursesCourseIdGet(courseId)

Get course detail

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CoursesApi apiInstance = new CoursesApi(defaultClient);
    Integer courseId = 56; // Integer | 
    try {
      Object result = apiInstance.getCourseApiV1CoursesCourseIdGet(courseId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesApi#getCourseApiV1CoursesCourseIdGet");
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

<a id="listCoursesApiV1CoursesListGet"></a>
# **listCoursesApiV1CoursesListGet**
> Object listCoursesApiV1CoursesListGet(page, limit, keyword, stage, isHidden, auditStatus)

List courses

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CoursesApi apiInstance = new CoursesApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String keyword = "keyword_example"; // String | 
    String stage = "stage_example"; // String | 
    Integer isHidden = 56; // Integer | 
    Integer auditStatus = 56; // Integer | 
    try {
      Object result = apiInstance.listCoursesApiV1CoursesListGet(page, limit, keyword, stage, isHidden, auditStatus);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesApi#listCoursesApiV1CoursesListGet");
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
| **keyword** | **String**|  | [optional] |
| **stage** | **String**|  | [optional] |
| **isHidden** | **Integer**|  | [optional] |
| **auditStatus** | **Integer**|  | [optional] |

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

<a id="updateCourseApiV1CoursesCourseIdPut"></a>
# **updateCourseApiV1CoursesCourseIdPut**
> Object updateCourseApiV1CoursesCourseIdPut(courseId, courseUpdate)

Update course

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CoursesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CoursesApi apiInstance = new CoursesApi(defaultClient);
    Integer courseId = 56; // Integer | 
    CourseUpdate courseUpdate = new CourseUpdate(); // CourseUpdate | 
    try {
      Object result = apiInstance.updateCourseApiV1CoursesCourseIdPut(courseId, courseUpdate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CoursesApi#updateCourseApiV1CoursesCourseIdPut");
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
| **courseUpdate** | [**CourseUpdate**](CourseUpdate.md)|  | |

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

