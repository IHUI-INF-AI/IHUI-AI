# CourseAuditApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**auditCourseApiV1CourseAuditAidAuditPut**](#auditcourseapiv1courseauditaidauditput) | **PUT** /api/v1/course-audit/{aid}/audit | 审核操作|
|[**auditCourseApiV1CourseAuditAidAuditPut_0**](#auditcourseapiv1courseauditaidauditput_0) | **PUT** /api/v1/course-audit/{aid}/audit | 审核操作|
|[**courseAuditSubmit**](#courseauditsubmit) | **POST** /api/v1/course-audit/submit | 提交课程审核|
|[**courseAuditSubmit_0**](#courseauditsubmit_0) | **POST** /api/v1/course-audit/submit | 提交课程审核|
|[**getAuditApiV1CourseAuditAidGet**](#getauditapiv1courseauditaidget) | **GET** /api/v1/course-audit/{aid} | 审核详情|
|[**getAuditApiV1CourseAuditAidGet_0**](#getauditapiv1courseauditaidget_0) | **GET** /api/v1/course-audit/{aid} | 审核详情|
|[**listAuditsApiV1CourseAuditListGet**](#listauditsapiv1courseauditlistget) | **GET** /api/v1/course-audit/list | 审核列表|
|[**listAuditsApiV1CourseAuditListGet_0**](#listauditsapiv1courseauditlistget_0) | **GET** /api/v1/course-audit/list | 审核列表|

# **auditCourseApiV1CourseAuditAidAuditPut**
> any auditCourseApiV1CourseAuditAidAuditPut()


### Example

```typescript
import {
    CourseAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CourseAuditApi(configuration);

let aid: number; // (default to undefined)
let status: number; // (default to undefined)
let remark: string; // (optional) (default to undefined)
let score: number; // (optional) (default to 0)
let isFinal: boolean; // (optional) (default to false)

const { status, data } = await apiInstance.auditCourseApiV1CourseAuditAidAuditPut(
    aid,
    status,
    remark,
    score,
    isFinal
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|
| **status** | [**number**] |  | defaults to undefined|
| **remark** | [**string**] |  | (optional) defaults to undefined|
| **score** | [**number**] |  | (optional) defaults to 0|
| **isFinal** | [**boolean**] |  | (optional) defaults to false|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **auditCourseApiV1CourseAuditAidAuditPut_0**
> any auditCourseApiV1CourseAuditAidAuditPut_0()


### Example

```typescript
import {
    CourseAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CourseAuditApi(configuration);

let aid: number; // (default to undefined)
let status: number; // (default to undefined)
let remark: string; // (optional) (default to undefined)
let score: number; // (optional) (default to 0)
let isFinal: boolean; // (optional) (default to false)

const { status, data } = await apiInstance.auditCourseApiV1CourseAuditAidAuditPut_0(
    aid,
    status,
    remark,
    score,
    isFinal
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|
| **status** | [**number**] |  | defaults to undefined|
| **remark** | [**string**] |  | (optional) defaults to undefined|
| **score** | [**number**] |  | (optional) defaults to 0|
| **isFinal** | [**boolean**] |  | (optional) defaults to false|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **courseAuditSubmit**
> any courseAuditSubmit()


### Example

```typescript
import {
    CourseAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CourseAuditApi(configuration);

let courseId: number; // (default to undefined)
let courseTitle: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.courseAuditSubmit(
    courseId,
    courseTitle
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **courseId** | [**number**] |  | defaults to undefined|
| **courseTitle** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **courseAuditSubmit_0**
> any courseAuditSubmit_0()


### Example

```typescript
import {
    CourseAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CourseAuditApi(configuration);

let courseId: number; // (default to undefined)
let courseTitle: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.courseAuditSubmit_0(
    courseId,
    courseTitle
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **courseId** | [**number**] |  | defaults to undefined|
| **courseTitle** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getAuditApiV1CourseAuditAidGet**
> any getAuditApiV1CourseAuditAidGet()


### Example

```typescript
import {
    CourseAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CourseAuditApi(configuration);

let aid: number; // (default to undefined)

const { status, data } = await apiInstance.getAuditApiV1CourseAuditAidGet(
    aid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getAuditApiV1CourseAuditAidGet_0**
> any getAuditApiV1CourseAuditAidGet_0()


### Example

```typescript
import {
    CourseAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CourseAuditApi(configuration);

let aid: number; // (default to undefined)

const { status, data } = await apiInstance.getAuditApiV1CourseAuditAidGet_0(
    aid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listAuditsApiV1CourseAuditListGet**
> any listAuditsApiV1CourseAuditListGet()


### Example

```typescript
import {
    CourseAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CourseAuditApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; // (optional) (default to undefined)
let courseId: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listAuditsApiV1CourseAuditListGet(
    page,
    limit,
    status,
    courseId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **courseId** | [**number**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listAuditsApiV1CourseAuditListGet_0**
> any listAuditsApiV1CourseAuditListGet_0()


### Example

```typescript
import {
    CourseAuditApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CourseAuditApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; // (optional) (default to undefined)
let courseId: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listAuditsApiV1CourseAuditListGet_0(
    page,
    limit,
    status,
    courseId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **courseId** | [**number**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

