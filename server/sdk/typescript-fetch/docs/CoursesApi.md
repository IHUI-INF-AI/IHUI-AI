# CoursesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createCourseApiV1CoursesCreatePost**](CoursesApi.md#createcourseapiv1coursescreatepost) | **POST** /api/v1/courses/create | Create course |
| [**deleteCourseApiV1CoursesCourseIdDelete**](CoursesApi.md#deletecourseapiv1coursescourseiddelete) | **DELETE** /api/v1/courses/{course_id} | Delete course (soft) |
| [**delistCourseApiV1CoursesCourseIdDelistPost**](CoursesApi.md#delistcourseapiv1coursescourseiddelistpost) | **POST** /api/v1/courses/{course_id}/delist | Delist (hide) course |
| [**getCourseApiV1CoursesCourseIdGet**](CoursesApi.md#getcourseapiv1coursescourseidget) | **GET** /api/v1/courses/{course_id} | Get course detail |
| [**listCoursesApiV1CoursesListGet**](CoursesApi.md#listcoursesapiv1courseslistget) | **GET** /api/v1/courses/list | List courses |
| [**updateCourseApiV1CoursesCourseIdPut**](CoursesApi.md#updatecourseapiv1coursescourseidput) | **PUT** /api/v1/courses/{course_id} | Update course |



## createCourseApiV1CoursesCreatePost

> any createCourseApiV1CoursesCreatePost(courseCreate)

Create course

### Example

```ts
import {
  Configuration,
  CoursesApi,
} from '';
import type { CreateCourseApiV1CoursesCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesApi(config);

  const body = {
    // CourseCreate
    courseCreate: ...,
  } satisfies CreateCourseApiV1CoursesCreatePostRequest;

  try {
    const data = await api.createCourseApiV1CoursesCreatePost(body);
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
| **courseCreate** | [CourseCreate](CourseCreate.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteCourseApiV1CoursesCourseIdDelete

> any deleteCourseApiV1CoursesCourseIdDelete(courseId)

Delete course (soft)

### Example

```ts
import {
  Configuration,
  CoursesApi,
} from '';
import type { DeleteCourseApiV1CoursesCourseIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesApi(config);

  const body = {
    // number
    courseId: 56,
  } satisfies DeleteCourseApiV1CoursesCourseIdDeleteRequest;

  try {
    const data = await api.deleteCourseApiV1CoursesCourseIdDelete(body);
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

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## delistCourseApiV1CoursesCourseIdDelistPost

> any delistCourseApiV1CoursesCourseIdDelistPost(courseId)

Delist (hide) course

### Example

```ts
import {
  Configuration,
  CoursesApi,
} from '';
import type { DelistCourseApiV1CoursesCourseIdDelistPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesApi(config);

  const body = {
    // number
    courseId: 56,
  } satisfies DelistCourseApiV1CoursesCourseIdDelistPostRequest;

  try {
    const data = await api.delistCourseApiV1CoursesCourseIdDelistPost(body);
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

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getCourseApiV1CoursesCourseIdGet

> any getCourseApiV1CoursesCourseIdGet(courseId)

Get course detail

### Example

```ts
import {
  Configuration,
  CoursesApi,
} from '';
import type { GetCourseApiV1CoursesCourseIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CoursesApi();

  const body = {
    // number
    courseId: 56,
  } satisfies GetCourseApiV1CoursesCourseIdGetRequest;

  try {
    const data = await api.getCourseApiV1CoursesCourseIdGet(body);
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


## listCoursesApiV1CoursesListGet

> any listCoursesApiV1CoursesListGet(page, limit, keyword, stage, isHidden, auditStatus)

List courses

### Example

```ts
import {
  Configuration,
  CoursesApi,
} from '';
import type { ListCoursesApiV1CoursesListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CoursesApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    keyword: keyword_example,
    // string (optional)
    stage: stage_example,
    // number (optional)
    isHidden: 56,
    // number (optional)
    auditStatus: 56,
  } satisfies ListCoursesApiV1CoursesListGetRequest;

  try {
    const data = await api.listCoursesApiV1CoursesListGet(body);
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
| **keyword** | `string` |  | [Optional] [Defaults to `undefined`] |
| **stage** | `string` |  | [Optional] [Defaults to `undefined`] |
| **isHidden** | `number` |  | [Optional] [Defaults to `undefined`] |
| **auditStatus** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## updateCourseApiV1CoursesCourseIdPut

> any updateCourseApiV1CoursesCourseIdPut(courseId, courseUpdate)

Update course

### Example

```ts
import {
  Configuration,
  CoursesApi,
} from '';
import type { UpdateCourseApiV1CoursesCourseIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CoursesApi(config);

  const body = {
    // number
    courseId: 56,
    // CourseUpdate
    courseUpdate: ...,
  } satisfies UpdateCourseApiV1CoursesCourseIdPutRequest;

  try {
    const data = await api.updateCourseApiV1CoursesCourseIdPut(body);
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
| **courseUpdate** | [CourseUpdate](CourseUpdate.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

