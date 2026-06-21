# LLMModelsUnifyApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**modelsUnifyApiV1LlmModelsUnifyGet**](#modelsunifyapiv1llmmodelsunifyget) | **GET** /api/v1/llm/models-unify | 大模型统一列表 (兼容 ihui-ai-api)|

# **modelsUnifyApiV1LlmModelsUnifyGet**
> any modelsUnifyApiV1LlmModelsUnifyGet()

返回前端 AIModelInfo[] 格式，字段映射: - id, name, source, description, icon, status, sort - 前端别名: modelCode, displayName, img, remark, type, category, manufacturer

### Example

```typescript
import {
    LLMModelsUnifyApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LLMModelsUnifyApi(configuration);

let name: string; // (optional) (default to undefined)
let type: number; // (optional) (default to undefined)
let isDel: number; // (optional) (default to 0)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 100)

const { status, data } = await apiInstance.modelsUnifyApiV1LlmModelsUnifyGet(
    name,
    type,
    isDel,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**number**] |  | (optional) defaults to undefined|
| **isDel** | [**number**] |  | (optional) defaults to 0|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 100|


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

