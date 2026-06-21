# CategoryDictionaryApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createDictApiV1CategoryDictionaryPost**](#createdictapiv1categorydictionarypost) | **POST** /api/v1/category-dictionary | 新增字典|
|[**createDictApiV1CategoryDictionaryPost_0**](#createdictapiv1categorydictionarypost_0) | **POST** /api/v1/category-dictionary | 新增字典|
|[**deleteDictApiV1CategoryDictionaryDidDelete**](#deletedictapiv1categorydictionarydiddelete) | **DELETE** /api/v1/category-dictionary/{did} | 删除字典|
|[**deleteDictApiV1CategoryDictionaryDidDelete_0**](#deletedictapiv1categorydictionarydiddelete_0) | **DELETE** /api/v1/category-dictionary/{did} | 删除字典|
|[**dictTypesApiV1CategoryDictionaryTypeGet**](#dicttypesapiv1categorydictionarytypeget) | **GET** /api/v1/category-dictionary/type | 字典类型列表|
|[**dictTypesApiV1CategoryDictionaryTypeGet_0**](#dicttypesapiv1categorydictionarytypeget_0) | **GET** /api/v1/category-dictionary/type | 字典类型列表|
|[**getDictApiV1CategoryDictionaryDidGet**](#getdictapiv1categorydictionarydidget) | **GET** /api/v1/category-dictionary/{did} | 字典详情|
|[**getDictApiV1CategoryDictionaryDidGet_0**](#getdictapiv1categorydictionarydidget_0) | **GET** /api/v1/category-dictionary/{did} | 字典详情|
|[**listDictApiV1CategoryDictionaryListGet**](#listdictapiv1categorydictionarylistget) | **GET** /api/v1/category-dictionary/list | 字典列表|
|[**listDictApiV1CategoryDictionaryListGet_0**](#listdictapiv1categorydictionarylistget_0) | **GET** /api/v1/category-dictionary/list | 字典列表|
|[**updateDictApiV1CategoryDictionaryDidPut**](#updatedictapiv1categorydictionarydidput) | **PUT** /api/v1/category-dictionary/{did} | 修改字典|
|[**updateDictApiV1CategoryDictionaryDidPut_0**](#updatedictapiv1categorydictionarydidput_0) | **PUT** /api/v1/category-dictionary/{did} | 修改字典|

# **createDictApiV1CategoryDictionaryPost**
> any createDictApiV1CategoryDictionaryPost()


### Example

```typescript
import {
    CategoryDictionaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CategoryDictionaryApi(configuration);

let dictType: string; // (default to undefined)
let code: string; // (default to undefined)
let label: string; // (default to undefined)
let value: string; // (optional) (default to undefined)
let sortOrder: number; // (optional) (default to 0)
let isShow: boolean; // (optional) (default to true)
let description: string; // (optional) (default to undefined)
let parentId: number; // (optional) (default to 0)
let extra: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createDictApiV1CategoryDictionaryPost(
    dictType,
    code,
    label,
    value,
    sortOrder,
    isShow,
    description,
    parentId,
    extra
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **dictType** | [**string**] |  | defaults to undefined|
| **code** | [**string**] |  | defaults to undefined|
| **label** | [**string**] |  | defaults to undefined|
| **value** | [**string**] |  | (optional) defaults to undefined|
| **sortOrder** | [**number**] |  | (optional) defaults to 0|
| **isShow** | [**boolean**] |  | (optional) defaults to true|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **parentId** | [**number**] |  | (optional) defaults to 0|
| **extra** | [**string**] |  | (optional) defaults to undefined|


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

# **createDictApiV1CategoryDictionaryPost_0**
> any createDictApiV1CategoryDictionaryPost_0()


### Example

```typescript
import {
    CategoryDictionaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CategoryDictionaryApi(configuration);

let dictType: string; // (default to undefined)
let code: string; // (default to undefined)
let label: string; // (default to undefined)
let value: string; // (optional) (default to undefined)
let sortOrder: number; // (optional) (default to 0)
let isShow: boolean; // (optional) (default to true)
let description: string; // (optional) (default to undefined)
let parentId: number; // (optional) (default to 0)
let extra: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createDictApiV1CategoryDictionaryPost_0(
    dictType,
    code,
    label,
    value,
    sortOrder,
    isShow,
    description,
    parentId,
    extra
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **dictType** | [**string**] |  | defaults to undefined|
| **code** | [**string**] |  | defaults to undefined|
| **label** | [**string**] |  | defaults to undefined|
| **value** | [**string**] |  | (optional) defaults to undefined|
| **sortOrder** | [**number**] |  | (optional) defaults to 0|
| **isShow** | [**boolean**] |  | (optional) defaults to true|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **parentId** | [**number**] |  | (optional) defaults to 0|
| **extra** | [**string**] |  | (optional) defaults to undefined|


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

# **deleteDictApiV1CategoryDictionaryDidDelete**
> any deleteDictApiV1CategoryDictionaryDidDelete()


### Example

```typescript
import {
    CategoryDictionaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CategoryDictionaryApi(configuration);

let did: number; // (default to undefined)

const { status, data } = await apiInstance.deleteDictApiV1CategoryDictionaryDidDelete(
    did
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **did** | [**number**] |  | defaults to undefined|


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

# **deleteDictApiV1CategoryDictionaryDidDelete_0**
> any deleteDictApiV1CategoryDictionaryDidDelete_0()


### Example

```typescript
import {
    CategoryDictionaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CategoryDictionaryApi(configuration);

let did: number; // (default to undefined)

const { status, data } = await apiInstance.deleteDictApiV1CategoryDictionaryDidDelete_0(
    did
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **did** | [**number**] |  | defaults to undefined|


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

# **dictTypesApiV1CategoryDictionaryTypeGet**
> any dictTypesApiV1CategoryDictionaryTypeGet()


### Example

```typescript
import {
    CategoryDictionaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CategoryDictionaryApi(configuration);

const { status, data } = await apiInstance.dictTypesApiV1CategoryDictionaryTypeGet();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **dictTypesApiV1CategoryDictionaryTypeGet_0**
> any dictTypesApiV1CategoryDictionaryTypeGet_0()


### Example

```typescript
import {
    CategoryDictionaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CategoryDictionaryApi(configuration);

const { status, data } = await apiInstance.dictTypesApiV1CategoryDictionaryTypeGet_0();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getDictApiV1CategoryDictionaryDidGet**
> any getDictApiV1CategoryDictionaryDidGet()


### Example

```typescript
import {
    CategoryDictionaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CategoryDictionaryApi(configuration);

let did: number; // (default to undefined)

const { status, data } = await apiInstance.getDictApiV1CategoryDictionaryDidGet(
    did
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **did** | [**number**] |  | defaults to undefined|


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

# **getDictApiV1CategoryDictionaryDidGet_0**
> any getDictApiV1CategoryDictionaryDidGet_0()


### Example

```typescript
import {
    CategoryDictionaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CategoryDictionaryApi(configuration);

let did: number; // (default to undefined)

const { status, data } = await apiInstance.getDictApiV1CategoryDictionaryDidGet_0(
    did
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **did** | [**number**] |  | defaults to undefined|


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

# **listDictApiV1CategoryDictionaryListGet**
> any listDictApiV1CategoryDictionaryListGet()


### Example

```typescript
import {
    CategoryDictionaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CategoryDictionaryApi(configuration);

let dictType: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 100)

const { status, data } = await apiInstance.listDictApiV1CategoryDictionaryListGet(
    dictType,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **dictType** | [**string**] |  | (optional) defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 100|


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

# **listDictApiV1CategoryDictionaryListGet_0**
> any listDictApiV1CategoryDictionaryListGet_0()


### Example

```typescript
import {
    CategoryDictionaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CategoryDictionaryApi(configuration);

let dictType: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 100)

const { status, data } = await apiInstance.listDictApiV1CategoryDictionaryListGet_0(
    dictType,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **dictType** | [**string**] |  | (optional) defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 100|


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

# **updateDictApiV1CategoryDictionaryDidPut**
> any updateDictApiV1CategoryDictionaryDidPut()


### Example

```typescript
import {
    CategoryDictionaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CategoryDictionaryApi(configuration);

let did: number; // (default to undefined)
let label: string; // (optional) (default to undefined)
let value: string; // (optional) (default to undefined)
let sortOrder: number; // (optional) (default to undefined)
let isShow: boolean; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateDictApiV1CategoryDictionaryDidPut(
    did,
    label,
    value,
    sortOrder,
    isShow,
    description
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **did** | [**number**] |  | defaults to undefined|
| **label** | [**string**] |  | (optional) defaults to undefined|
| **value** | [**string**] |  | (optional) defaults to undefined|
| **sortOrder** | [**number**] |  | (optional) defaults to undefined|
| **isShow** | [**boolean**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|


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

# **updateDictApiV1CategoryDictionaryDidPut_0**
> any updateDictApiV1CategoryDictionaryDidPut_0()


### Example

```typescript
import {
    CategoryDictionaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CategoryDictionaryApi(configuration);

let did: number; // (default to undefined)
let label: string; // (optional) (default to undefined)
let value: string; // (optional) (default to undefined)
let sortOrder: number; // (optional) (default to undefined)
let isShow: boolean; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateDictApiV1CategoryDictionaryDidPut_0(
    did,
    label,
    value,
    sortOrder,
    isShow,
    description
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **did** | [**number**] |  | defaults to undefined|
| **label** | [**string**] |  | (optional) defaults to undefined|
| **value** | [**string**] |  | (optional) defaults to undefined|
| **sortOrder** | [**number**] |  | (optional) defaults to undefined|
| **isShow** | [**boolean**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|


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

