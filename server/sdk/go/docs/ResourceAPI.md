# \ResourceAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddAgentFreeTimeApiV1ResourceAgentFreeTimePost**](ResourceAPI.md#AddAgentFreeTimeApiV1ResourceAgentFreeTimePost) | **Post** /api/v1/resource/agent/free-time | 添加用户 Agent 免费次数
[**CreateShareApiV1ResourceSharePost**](ResourceAPI.md#CreateShareApiV1ResourceSharePost) | **Post** /api/v1/resource/share | 生成分享链接
[**DeveloperPriceApiV1ResourceDeveloperPriceGet**](ResourceAPI.md#DeveloperPriceApiV1ResourceDeveloperPriceGet) | **Get** /api/v1/resource/developer/price | 查询 Agent 开发者价格
[**FileUploadApiV1ResourceFileUploadPost**](ResourceAPI.md#FileUploadApiV1ResourceFileUploadPost) | **Post** /api/v1/resource/file/upload | 上传文件到 MinIO
[**GetAgentFreeTimeApiV1ResourceAgentFreeTimeGet**](ResourceAPI.md#GetAgentFreeTimeApiV1ResourceAgentFreeTimeGet) | **Get** /api/v1/resource/agent/free-time | 获取用户 Agent 免费次数
[**GetCozeAccessTokenApiV1ResourceCozeAccessTokenGet**](ResourceAPI.md#GetCozeAccessTokenApiV1ResourceCozeAccessTokenGet) | **Get** /api/v1/resource/coze-access-token | 获取 Coze AccessToken
[**GoodsListApiV1ResourceGoodsGet**](ResourceAPI.md#GoodsListApiV1ResourceGoodsGet) | **Get** /api/v1/resource/goods | 商品及汇率列表
[**HomeResourcesApiV1ResourceHomeGet**](ResourceAPI.md#HomeResourcesApiV1ResourceHomeGet) | **Get** /api/v1/resource/home | 首页资源聚合
[**PlanetsCourseApiV1ResourcePlanetsCourseGet**](ResourceAPI.md#PlanetsCourseApiV1ResourcePlanetsCourseGet) | **Get** /api/v1/resource/planets/course | 课程星球列表
[**PlanetsKnowledgeApiV1ResourcePlanetsKnowledgeGet**](ResourceAPI.md#PlanetsKnowledgeApiV1ResourcePlanetsKnowledgeGet) | **Get** /api/v1/resource/planets/knowledge | 知识星球列表
[**RechargeCheckApiV1ResourceRechargeGet**](ResourceAPI.md#RechargeCheckApiV1ResourceRechargeGet) | **Get** /api/v1/resource/recharge | 判断是否为会员
[**TokenCountApiV1ResourceTokenCountGet**](ResourceAPI.md#TokenCountApiV1ResourceTokenCountGet) | **Get** /api/v1/resource/token/count | 获取用户 token 余量



## AddAgentFreeTimeApiV1ResourceAgentFreeTimePost

> interface{} AddAgentFreeTimeApiV1ResourceAgentFreeTimePost(ctx).AgentId(agentId).FreeCount(freeCount).Execute()

添加用户 Agent 免费次数



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
	agentId := "agentId_example" // string | Agent ID
	freeCount := int32(56) // int32 | 免费次数

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceAPI.AddAgentFreeTimeApiV1ResourceAgentFreeTimePost(context.Background()).AgentId(agentId).FreeCount(freeCount).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceAPI.AddAgentFreeTimeApiV1ResourceAgentFreeTimePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddAgentFreeTimeApiV1ResourceAgentFreeTimePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceAPI.AddAgentFreeTimeApiV1ResourceAgentFreeTimePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAddAgentFreeTimeApiV1ResourceAgentFreeTimePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** | Agent ID | 
 **freeCount** | **int32** | 免费次数 | 

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


## CreateShareApiV1ResourceSharePost

> interface{} CreateShareApiV1ResourceSharePost(ctx).TargetType(targetType).TargetId(targetId).Execute()

生成分享链接



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
	targetType := "targetType_example" // string | agent/course/chat
	targetId := "targetId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceAPI.CreateShareApiV1ResourceSharePost(context.Background()).TargetType(targetType).TargetId(targetId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceAPI.CreateShareApiV1ResourceSharePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateShareApiV1ResourceSharePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceAPI.CreateShareApiV1ResourceSharePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateShareApiV1ResourceSharePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **targetType** | **string** | agent/course/chat | 
 **targetId** | **string** |  | 

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


## DeveloperPriceApiV1ResourceDeveloperPriceGet

> interface{} DeveloperPriceApiV1ResourceDeveloperPriceGet(ctx).AgentId(agentId).Execute()

查询 Agent 开发者价格



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
	agentId := "agentId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceAPI.DeveloperPriceApiV1ResourceDeveloperPriceGet(context.Background()).AgentId(agentId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceAPI.DeveloperPriceApiV1ResourceDeveloperPriceGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeveloperPriceApiV1ResourceDeveloperPriceGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceAPI.DeveloperPriceApiV1ResourceDeveloperPriceGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeveloperPriceApiV1ResourceDeveloperPriceGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## FileUploadApiV1ResourceFileUploadPost

> interface{} FileUploadApiV1ResourceFileUploadPost(ctx).File(file).Bucket(bucket).Execute()

上传文件到 MinIO



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
	file := os.NewFile(1234, "some_file") // *os.File | 
	bucket := "bucket_example" // string | 存储桶，不传则用默认 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceAPI.FileUploadApiV1ResourceFileUploadPost(context.Background()).File(file).Bucket(bucket).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceAPI.FileUploadApiV1ResourceFileUploadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `FileUploadApiV1ResourceFileUploadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceAPI.FileUploadApiV1ResourceFileUploadPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiFileUploadApiV1ResourceFileUploadPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | ***os.File** |  | 
 **bucket** | **string** | 存储桶，不传则用默认 | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetAgentFreeTimeApiV1ResourceAgentFreeTimeGet

> interface{} GetAgentFreeTimeApiV1ResourceAgentFreeTimeGet(ctx).AgentId(agentId).Execute()

获取用户 Agent 免费次数



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
	agentId := "agentId_example" // string | Agent ID

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceAPI.GetAgentFreeTimeApiV1ResourceAgentFreeTimeGet(context.Background()).AgentId(agentId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceAPI.GetAgentFreeTimeApiV1ResourceAgentFreeTimeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetAgentFreeTimeApiV1ResourceAgentFreeTimeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceAPI.GetAgentFreeTimeApiV1ResourceAgentFreeTimeGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetAgentFreeTimeApiV1ResourceAgentFreeTimeGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** | Agent ID | 

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


## GetCozeAccessTokenApiV1ResourceCozeAccessTokenGet

> interface{} GetCozeAccessTokenApiV1ResourceCozeAccessTokenGet(ctx).Execute()

获取 Coze AccessToken



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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceAPI.GetCozeAccessTokenApiV1ResourceCozeAccessTokenGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceAPI.GetCozeAccessTokenApiV1ResourceCozeAccessTokenGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetCozeAccessTokenApiV1ResourceCozeAccessTokenGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceAPI.GetCozeAccessTokenApiV1ResourceCozeAccessTokenGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGetCozeAccessTokenApiV1ResourceCozeAccessTokenGetRequest struct via the builder pattern


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


## GoodsListApiV1ResourceGoodsGet

> interface{} GoodsListApiV1ResourceGoodsGet(ctx).Execute()

商品及汇率列表



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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceAPI.GoodsListApiV1ResourceGoodsGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceAPI.GoodsListApiV1ResourceGoodsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GoodsListApiV1ResourceGoodsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceAPI.GoodsListApiV1ResourceGoodsGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiGoodsListApiV1ResourceGoodsGetRequest struct via the builder pattern


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


## HomeResourcesApiV1ResourceHomeGet

> interface{} HomeResourcesApiV1ResourceHomeGet(ctx).Execute()

首页资源聚合



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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceAPI.HomeResourcesApiV1ResourceHomeGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceAPI.HomeResourcesApiV1ResourceHomeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `HomeResourcesApiV1ResourceHomeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceAPI.HomeResourcesApiV1ResourceHomeGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiHomeResourcesApiV1ResourceHomeGetRequest struct via the builder pattern


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


## PlanetsCourseApiV1ResourcePlanetsCourseGet

> interface{} PlanetsCourseApiV1ResourcePlanetsCourseGet(ctx).Execute()

课程星球列表



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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceAPI.PlanetsCourseApiV1ResourcePlanetsCourseGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceAPI.PlanetsCourseApiV1ResourcePlanetsCourseGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PlanetsCourseApiV1ResourcePlanetsCourseGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceAPI.PlanetsCourseApiV1ResourcePlanetsCourseGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiPlanetsCourseApiV1ResourcePlanetsCourseGetRequest struct via the builder pattern


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


## PlanetsKnowledgeApiV1ResourcePlanetsKnowledgeGet

> interface{} PlanetsKnowledgeApiV1ResourcePlanetsKnowledgeGet(ctx).Execute()

知识星球列表



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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceAPI.PlanetsKnowledgeApiV1ResourcePlanetsKnowledgeGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceAPI.PlanetsKnowledgeApiV1ResourcePlanetsKnowledgeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PlanetsKnowledgeApiV1ResourcePlanetsKnowledgeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceAPI.PlanetsKnowledgeApiV1ResourcePlanetsKnowledgeGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiPlanetsKnowledgeApiV1ResourcePlanetsKnowledgeGetRequest struct via the builder pattern


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


## RechargeCheckApiV1ResourceRechargeGet

> interface{} RechargeCheckApiV1ResourceRechargeGet(ctx).Execute()

判断是否为会员



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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceAPI.RechargeCheckApiV1ResourceRechargeGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceAPI.RechargeCheckApiV1ResourceRechargeGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RechargeCheckApiV1ResourceRechargeGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceAPI.RechargeCheckApiV1ResourceRechargeGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiRechargeCheckApiV1ResourceRechargeGetRequest struct via the builder pattern


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


## TokenCountApiV1ResourceTokenCountGet

> interface{} TokenCountApiV1ResourceTokenCountGet(ctx).Execute()

获取用户 token 余量

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ResourceAPI.TokenCountApiV1ResourceTokenCountGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ResourceAPI.TokenCountApiV1ResourceTokenCountGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TokenCountApiV1ResourceTokenCountGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ResourceAPI.TokenCountApiV1ResourceTokenCountGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiTokenCountApiV1ResourceTokenCountGetRequest struct via the builder pattern


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

