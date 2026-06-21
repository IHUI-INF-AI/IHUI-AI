# CoursesApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createCourseApiV1CoursesCreatePost**](#createcourseapiv1coursescreatepost) | **POST** /api/v1/courses/create | Create course|
|[**deleteCourseApiV1CoursesCourseIdDelete**](#deletecourseapiv1coursescourseiddelete) | **DELETE** /api/v1/courses/{course_id} | Delete course (soft)|
|[**delistCourseApiV1CoursesCourseIdDelistPost**](#delistcourseapiv1coursescourseiddelistpost) | **POST** /api/v1/courses/{course_id}/delist | Delist (hide) course|
|[**getCourseApiV1CoursesCourseIdGet**](#getcourseapiv1coursescourseidget) | **GET** /api/v1/courses/{course_id} | Get course detail|
|[**listCoursesApiV1CoursesListGet**](#listcoursesapiv1courseslistget) | **GET** /api/v1/courses/list | List courses|
|[**updateCourseApiV1CoursesCourseIdPut**](#updatecourseapiv1coursescourseidput) | **PUT** /api/v1/courses/{course_id} | Update course|

# **createCourseApiV1CoursesCreatePost**
> any createCourseApiV1CoursesCreatePost(courseCreate)


### Example

```typescript
import {
    CoursesApi,
    Configuration,
    CourseCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesApi(configuration);

let courseCreate: CourseCreate; //

const { status, data } = await apiInstance.createCourseApiV1CoursesCreatePost(
    courseCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **courseCreate** | **CourseCreate**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteCourseApiV1CoursesCourseIdDelete**
> any deleteCourseApiV1CoursesCourseIdDelete()


### Example

```typescript
import {
    CoursesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesApi(configuration);

let courseId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteCourseApiV1CoursesCourseIdDelete(
    courseId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **courseId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delistCourseApiV1CoursesCourseIdDelistPost**
> any delistCourseApiV1CoursesCourseIdDelistPost()


### Example

```typescript
import {
    CoursesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesApi(configuration);

let courseId: number; // (default to undefined)

const { status, data } = await apiInstance.delistCourseApiV1CoursesCourseIdDelistPost(
    courseId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **courseId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getCourseApiV1CoursesCourseIdGet**
> any getCourseApiV1CoursesCourseIdGet()


### Example

```typescript
import {
    CoursesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesApi(configuration);

let courseId: number; // (default to undefined)

const { status, data } = await apiInstance.getCourseApiV1CoursesCourseIdGet(
    courseId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **courseId** | [**number**] |  | defaults to undefined|


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

# **listCoursesApiV1CoursesListGet**
> any listCoursesApiV1CoursesListGet()


### Example

```typescript
import {
    CoursesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let keyword: string; // (optional) (default to undefined)
let stage: string; // (optional) (default to undefined)
let isHidden: number; // (optional) (default to undefined)
let auditStatus: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listCoursesApiV1CoursesListGet(
    page,
    limit,
    keyword,
    stage,
    isHidden,
    auditStatus
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **keyword** | [**string**] |  | (optional) defaults to undefined|
| **stage** | [**string**] |  | (optional) defaults to undefined|
| **isHidden** | [**number**] |  | (optional) defaults to undefined|
| **auditStatus** | [**number**] |  | (optional) defaults to undefined|


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

# **updateCourseApiV1CoursesCourseIdPut**
> any updateCourseApiV1CoursesCourseIdPut(courseUpdate)


### Example

```typescript
import {
    CoursesApi,
    Configuration,
    CourseUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesApi(configuration);

let courseId: number; // (default to undefined)
let courseUpdate: CourseUpdate; //

const { status, data } = await apiInstance.updateCourseApiV1CoursesCourseIdPut(
    courseId,
    courseUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **courseUpdate** | **CourseUpdate**|  | |
| **courseId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

