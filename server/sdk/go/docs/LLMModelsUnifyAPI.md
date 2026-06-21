# \LLMModelsUnifyAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ModelsUnifyApiV1LlmModelsUnifyGet**](LLMModelsUnifyAPI.md#ModelsUnifyApiV1LlmModelsUnifyGet) | **Get** /api/v1/llm/models-unify | 大模型统一列表 (兼容 ihui-ai-api)



## ModelsUnifyApiV1LlmModelsUnifyGet

> interface{} ModelsUnifyApiV1LlmModelsUnifyGet(ctx).Name(name).Type_(type_).IsDel(isDel).Page(page).Limit(limit).Execute()

大模型统一列表 (兼容 ihui-ai-api)



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	name := "name_example" // string |  (optional)
	type_ := int32(56) // int32 |  (optional)
	isDel := int32(56) // int32 |  (optional) (default to 0)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 100)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LLMModelsUnifyAPI.ModelsUnifyApiV1LlmModelsUnifyGet(context.Background()).Name(name).Type_(type_).IsDel(isDel).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LLMModelsUnifyAPI.ModelsUnifyApiV1LlmModelsUnifyGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ModelsUnifyApiV1LlmModelsUnifyGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LLMModelsUnifyAPI.ModelsUnifyApiV1LlmModelsUnifyGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiModelsUnifyApiV1LlmModelsUnifyGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **type_** | **int32** |  | 
 **isDel** | **int32** |  | [default to 0]
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 100]

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

