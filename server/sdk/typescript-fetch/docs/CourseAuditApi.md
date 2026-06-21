# CourseAuditApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**auditCourseApiV1CourseAuditAidAuditPut**](CourseAuditApi.md#auditcourseapiv1courseauditaidauditput) | **PUT** /api/v1/course-audit/{aid}/audit | 审核操作 |
| [**auditCourseApiV1CourseAuditAidAuditPut_0**](CourseAuditApi.md#auditcourseapiv1courseauditaidauditput_0) | **PUT** /api/v1/course-audit/{aid}/audit | 审核操作 |
| [**courseAuditSubmit**](CourseAuditApi.md#courseauditsubmit) | **POST** /api/v1/course-audit/submit | 提交课程审核 |
| [**courseAuditSubmit_0**](CourseAuditApi.md#courseauditsubmit_0) | **POST** /api/v1/course-audit/submit | 提交课程审核 |
| [**getAuditApiV1CourseAuditAidGet**](CourseAuditApi.md#getauditapiv1courseauditaidget) | **GET** /api/v1/course-audit/{aid} | 审核详情 |
| [**getAuditApiV1CourseAuditAidGet_0**](CourseAuditApi.md#getauditapiv1courseauditaidget_0) | **GET** /api/v1/course-audit/{aid} | 审核详情 |
| [**listAuditsApiV1CourseAuditListGet**](CourseAuditApi.md#listauditsapiv1courseauditlistget) | **GET** /api/v1/course-audit/list | 审核列表 |
| [**listAuditsApiV1CourseAuditListGet_0**](CourseAuditApi.md#listauditsapiv1courseauditlistget_0) | **GET** /api/v1/course-audit/list | 审核列表 |



## auditCourseApiV1CourseAuditAidAuditPut

> any auditCourseApiV1CourseAuditAidAuditPut(aid, status, remark, score, isFinal)

审核操作

### Example

```ts
import {
  Configuration,
  CourseAuditApi,
} from '';
import type { AuditCourseApiV1CourseAuditAidAuditPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CourseAuditApi();

  const body = {
    // number
    aid: 56,
    // number
    status: 56,
    // string (optional)
    remark: remark_example,
    // number (optional)
    score: 56,
    // boolean (optional)
    isFinal: true,
  } satisfies AuditCourseApiV1CourseAuditAidAuditPutRequest;

  try {
    const data = await api.auditCourseApiV1CourseAuditAidAuditPut(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **aid** | `number` |  | [Defaults to `undefined`] |
| **status** | `number` |  | [Defaults to `undefined`] |
| **remark** | `string` |  | [Optional] [Defaults to `undefined`] |
| **score** | `number` |  | [Optional] [Defaults to `0`] |
| **isFinal** | `boolean` |  | [Optional] [Defaults to `false`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## auditCourseApiV1CourseAuditAidAuditPut_0

> any auditCourseApiV1CourseAuditAidAuditPut_0(aid, status, remark, score, isFinal)

审核操作

### Example

```ts
import {
  Configuration,
  CourseAuditApi,
} from '';
import type { AuditCourseApiV1CourseAuditAidAuditPut0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CourseAuditApi();

  const body = {
    // number
    aid: 56,
    // number
    status: 56,
    // string (optional)
    remark: remark_example,
    // number (optional)
    score: 56,
    // boolean (optional)
    isFinal: true,
  } satisfies AuditCourseApiV1CourseAuditAidAuditPut0Request;

  try {
    const data = await api.auditCourseApiV1CourseAuditAidAuditPut_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **aid** | `number` |  | [Defaults to `undefined`] |
| **status** | `number` |  | [Defaults to `undefined`] |
| **remark** | `string` |  | [Optional] [Defaults to `undefined`] |
| **score** | `number` |  | [Optional] [Defaults to `0`] |
| **isFinal** | `boolean` |  | [Optional] [Defaults to `false`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## courseAuditSubmit

> any courseAuditSubmit(courseId, courseTitle)

提交课程审核

### Example

```ts
import {
  Configuration,
  CourseAuditApi,
} from '';
import type { CourseAuditSubmitRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CourseAuditApi();

  const body = {
    // number
    courseId: 56,
    // string (optional)
    courseTitle: courseTitle_example,
  } satisfies CourseAuditSubmitRequest;

  try {
    const data = await api.courseAuditSubmit(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **courseId** | `number` |  | [Defaults to `undefined`] |
| **courseTitle** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## courseAuditSubmit_0

> any courseAuditSubmit_0(courseId, courseTitle)

提交课程审核

### Example

```ts
import {
  Configuration,
  CourseAuditApi,
} from '';
import type { CourseAuditSubmit0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CourseAuditApi();

  const body = {
    // number
    courseId: 56,
    // string (optional)
    courseTitle: courseTitle_example,
  } satisfies CourseAuditSubmit0Request;

  try {
    const data = await api.courseAuditSubmit_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **courseId** | `number` |  | [Defaults to `undefined`] |
| **courseTitle** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getAuditApiV1CourseAuditAidGet

> any getAuditApiV1CourseAuditAidGet(aid)

审核详情

### Example

```ts
import {
  Configuration,
  CourseAuditApi,
} from '';
import type { GetAuditApiV1CourseAuditAidGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CourseAuditApi();

  const body = {
    // number
    aid: 56,
  } satisfies GetAuditApiV1CourseAuditAidGetRequest;

  try {
    const data = await api.getAuditApiV1CourseAuditAidGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **aid** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getAuditApiV1CourseAuditAidGet_0

> any getAuditApiV1CourseAuditAidGet_0(aid)

审核详情

### Example

```ts
import {
  Configuration,
  CourseAuditApi,
} from '';
import type { GetAuditApiV1CourseAuditAidGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CourseAuditApi();

  const body = {
    // number
    aid: 56,
  } satisfies GetAuditApiV1CourseAuditAidGet0Request;

  try {
    const data = await api.getAuditApiV1CourseAuditAidGet_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **aid** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listAuditsApiV1CourseAuditListGet

> any listAuditsApiV1CourseAuditListGet(page, limit, status, courseId)

审核列表

### Example

```ts
import {
  Configuration,
  CourseAuditApi,
} from '';
import type { ListAuditsApiV1CourseAuditListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CourseAuditApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    status: 56,
    // number (optional)
    courseId: 56,
  } satisfies ListAuditsApiV1CourseAuditListGetRequest;

  try {
    const data = await api.listAuditsApiV1CourseAuditListGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **courseId** | `number` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listAuditsApiV1CourseAuditListGet_0

> any listAuditsApiV1CourseAuditListGet_0(page, limit, status, courseId)

审核列表

### Example

```ts
import {
  Configuration,
  CourseAuditApi,
} from '';
import type { ListAuditsApiV1CourseAuditListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CourseAuditApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    status: 56,
    // number (optional)
    courseId: 56,
  } satisfies ListAuditsApiV1CourseAuditListGet0Request;

  try {
    const data = await api.listAuditsApiV1CourseAuditListGet_0(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |
| **courseId** | `number` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

