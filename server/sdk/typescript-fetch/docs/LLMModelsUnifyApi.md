# LLMModelsUnifyApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**modelsUnifyApiV1LlmModelsUnifyGet**](LLMModelsUnifyApi.md#modelsunifyapiv1llmmodelsunifyget) | **GET** /api/v1/llm/models-unify | 大模型统一列表 (兼容 ihui-ai-api) |



## modelsUnifyApiV1LlmModelsUnifyGet

> any modelsUnifyApiV1LlmModelsUnifyGet(name, type, isDel, page, limit)

大模型统一列表 (兼容 ihui-ai-api)

返回前端 AIModelInfo[] 格式，字段映射: - id, name, source, description, icon, status, sort - 前端别名: modelCode, displayName, img, remark, type, category, manufacturer

### Example

```ts
import {
  Configuration,
  LLMModelsUnifyApi,
} from '';
import type { ModelsUnifyApiV1LlmModelsUnifyGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new LLMModelsUnifyApi(config);

  const body = {
    // string (optional)
    name: name_example,
    // number (optional)
    type: 56,
    // number (optional)
    isDel: 56,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ModelsUnifyApiV1LlmModelsUnifyGetRequest;

  try {
    const data = await api.modelsUnifyApiV1LlmModelsUnifyGet(body);
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
| **name** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `number` |  | [Optional] [Defaults to `undefined`] |
| **isDel** | `number` |  | [Optional] [Defaults to `0`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `100`] |

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

