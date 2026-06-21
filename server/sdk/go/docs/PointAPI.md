# \PointAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateGoodsApiV1PointGoodsPost**](PointAPI.md#CreateGoodsApiV1PointGoodsPost) | **Post** /api/v1/point/goods | 新增积分商品
[**CreateGoodsApiV1PointGoodsPost_0**](PointAPI.md#CreateGoodsApiV1PointGoodsPost_0) | **Post** /api/v1/point/goods | 新增积分商品
[**CreateRuleApiV1PointRulePost**](PointAPI.md#CreateRuleApiV1PointRulePost) | **Post** /api/v1/point/rule | 新增规则
[**CreateRuleApiV1PointRulePost_0**](PointAPI.md#CreateRuleApiV1PointRulePost_0) | **Post** /api/v1/point/rule | 新增规则
[**DeleteGoodsApiV1PointGoodsGidDelete**](PointAPI.md#DeleteGoodsApiV1PointGoodsGidDelete) | **Delete** /api/v1/point/goods/{gid} | 删除商品
[**DeleteGoodsApiV1PointGoodsGidDelete_0**](PointAPI.md#DeleteGoodsApiV1PointGoodsGidDelete_0) | **Delete** /api/v1/point/goods/{gid} | 删除商品
[**DeleteRuleApiV1PointRuleRidDelete**](PointAPI.md#DeleteRuleApiV1PointRuleRidDelete) | **Delete** /api/v1/point/rule/{rid} | 删除规则
[**DeleteRuleApiV1PointRuleRidDelete_0**](PointAPI.md#DeleteRuleApiV1PointRuleRidDelete_0) | **Delete** /api/v1/point/rule/{rid} | 删除规则
[**ExchangeApiV1PointExchangePost**](PointAPI.md#ExchangeApiV1PointExchangePost) | **Post** /api/v1/point/exchange | 兑换商品
[**ExchangeApiV1PointExchangePost_0**](PointAPI.md#ExchangeApiV1PointExchangePost_0) | **Post** /api/v1/point/exchange | 兑换商品
[**ExchangeListApiV1PointExchangeListGet**](PointAPI.md#ExchangeListApiV1PointExchangeListGet) | **Get** /api/v1/point/exchange/list | 兑换记录
[**ExchangeListApiV1PointExchangeListGet_0**](PointAPI.md#ExchangeListApiV1PointExchangeListGet_0) | **Get** /api/v1/point/exchange/list | 兑换记录
[**GetGoodsApiV1PointGoodsGidGet**](PointAPI.md#GetGoodsApiV1PointGoodsGidGet) | **Get** /api/v1/point/goods/{gid} | 积分商品详情
[**GetGoodsApiV1PointGoodsGidGet_0**](PointAPI.md#GetGoodsApiV1PointGoodsGidGet_0) | **Get** /api/v1/point/goods/{gid} | 积分商品详情
[**GoodsListApiV1PointGoodsListGet**](PointAPI.md#GoodsListApiV1PointGoodsListGet) | **Get** /api/v1/point/goods/list | 积分商品列表
[**GoodsListApiV1PointGoodsListGet_0**](PointAPI.md#GoodsListApiV1PointGoodsListGet_0) | **Get** /api/v1/point/goods/list | 积分商品列表
[**ListLogsApiV1PointLogListGet**](PointAPI.md#ListLogsApiV1PointLogListGet) | **Get** /api/v1/point/log/list | 积分流水
[**ListLogsApiV1PointLogListGet_0**](PointAPI.md#ListLogsApiV1PointLogListGet_0) | **Get** /api/v1/point/log/list | 积分流水
[**MyAccountApiV1PointAccountGet**](PointAPI.md#MyAccountApiV1PointAccountGet) | **Get** /api/v1/point/account | 我的积分账户
[**MyAccountApiV1PointAccountGet_0**](PointAPI.md#MyAccountApiV1PointAccountGet_0) | **Get** /api/v1/point/account | 我的积分账户
[**RuleListApiV1PointRuleListGet**](PointAPI.md#RuleListApiV1PointRuleListGet) | **Get** /api/v1/point/rule/list | 积分规则列表
[**RuleListApiV1PointRuleListGet_0**](PointAPI.md#RuleListApiV1PointRuleListGet_0) | **Get** /api/v1/point/rule/list | 积分规则列表
[**SigninApiV1PointSigninPost**](PointAPI.md#SigninApiV1PointSigninPost) | **Post** /api/v1/point/signin | 每日签到
[**SigninApiV1PointSigninPost_0**](PointAPI.md#SigninApiV1PointSigninPost_0) | **Post** /api/v1/point/signin | 每日签到
[**TriggerApiV1PointTriggerPost**](PointAPI.md#TriggerApiV1PointTriggerPost) | **Post** /api/v1/point/trigger | 触发积分行为
[**TriggerApiV1PointTriggerPost_0**](PointAPI.md#TriggerApiV1PointTriggerPost_0) | **Post** /api/v1/point/trigger | 触发积分行为
[**UpdateGoodsApiV1PointGoodsGidPut**](PointAPI.md#UpdateGoodsApiV1PointGoodsGidPut) | **Put** /api/v1/point/goods/{gid} | 修改商品
[**UpdateGoodsApiV1PointGoodsGidPut_0**](PointAPI.md#UpdateGoodsApiV1PointGoodsGidPut_0) | **Put** /api/v1/point/goods/{gid} | 修改商品
[**UpdateRuleApiV1PointRuleRidPut**](PointAPI.md#UpdateRuleApiV1PointRuleRidPut) | **Put** /api/v1/point/rule/{rid} | 修改规则
[**UpdateRuleApiV1PointRuleRidPut_0**](PointAPI.md#UpdateRuleApiV1PointRuleRidPut_0) | **Put** /api/v1/point/rule/{rid} | 修改规则
[**UserAccountApiV1PointAccountUserIdGet**](PointAPI.md#UserAccountApiV1PointAccountUserIdGet) | **Get** /api/v1/point/account/{user_id} | 指定用户积分账户
[**UserAccountApiV1PointAccountUserIdGet_0**](PointAPI.md#UserAccountApiV1PointAccountUserIdGet_0) | **Get** /api/v1/point/account/{user_id} | 指定用户积分账户



## CreateGoodsApiV1PointGoodsPost

> interface{} CreateGoodsApiV1PointGoodsPost(ctx).Name(name).Description(description).Image(image).PointCost(pointCost).Stock(stock).LimitPerUser(limitPerUser).Type_(type_).SortOrder(sortOrder).Execute()

新增积分商品

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
	name := "name_example" // string | 
	description := "description_example" // string |  (optional)
	image := "image_example" // string |  (optional)
	pointCost := int32(56) // int32 |  (optional) (default to 0)
	stock := int32(56) // int32 |  (optional) (default to 0)
	limitPerUser := int32(56) // int32 |  (optional) (default to 1)
	type_ := "type__example" // string |  (optional) (default to "virtual")
	sortOrder := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.CreateGoodsApiV1PointGoodsPost(context.Background()).Name(name).Description(description).Image(image).PointCost(pointCost).Stock(stock).LimitPerUser(limitPerUser).Type_(type_).SortOrder(sortOrder).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.CreateGoodsApiV1PointGoodsPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateGoodsApiV1PointGoodsPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.CreateGoodsApiV1PointGoodsPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateGoodsApiV1PointGoodsPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **description** | **string** |  | 
 **image** | **string** |  | 
 **pointCost** | **int32** |  | [default to 0]
 **stock** | **int32** |  | [default to 0]
 **limitPerUser** | **int32** |  | [default to 1]
 **type_** | **string** |  | [default to &quot;virtual&quot;]
 **sortOrder** | **int32** |  | [default to 0]

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


## CreateGoodsApiV1PointGoodsPost_0

> interface{} CreateGoodsApiV1PointGoodsPost_0(ctx).Name(name).Description(description).Image(image).PointCost(pointCost).Stock(stock).LimitPerUser(limitPerUser).Type_(type_).SortOrder(sortOrder).Execute()

新增积分商品

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
	name := "name_example" // string | 
	description := "description_example" // string |  (optional)
	image := "image_example" // string |  (optional)
	pointCost := int32(56) // int32 |  (optional) (default to 0)
	stock := int32(56) // int32 |  (optional) (default to 0)
	limitPerUser := int32(56) // int32 |  (optional) (default to 1)
	type_ := "type__example" // string |  (optional) (default to "virtual")
	sortOrder := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.CreateGoodsApiV1PointGoodsPost_0(context.Background()).Name(name).Description(description).Image(image).PointCost(pointCost).Stock(stock).LimitPerUser(limitPerUser).Type_(type_).SortOrder(sortOrder).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.CreateGoodsApiV1PointGoodsPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateGoodsApiV1PointGoodsPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.CreateGoodsApiV1PointGoodsPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateGoodsApiV1PointGoodsPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **description** | **string** |  | 
 **image** | **string** |  | 
 **pointCost** | **int32** |  | [default to 0]
 **stock** | **int32** |  | [default to 0]
 **limitPerUser** | **int32** |  | [default to 1]
 **type_** | **string** |  | [default to &quot;virtual&quot;]
 **sortOrder** | **int32** |  | [default to 0]

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


## CreateRuleApiV1PointRulePost

> interface{} CreateRuleApiV1PointRulePost(ctx).Code(code).Name(name).Action(action).Type_(type_).Point(point).MaxPerDay(maxPerDay).Description(description).Execute()

新增规则

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
	code := "code_example" // string | 
	name := "name_example" // string | 
	action := "action_example" // string | 
	type_ := "type__example" // string |  (optional) (default to "add")
	point := int32(56) // int32 |  (optional) (default to 0)
	maxPerDay := int32(56) // int32 |  (optional) (default to 0)
	description := "description_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.CreateRuleApiV1PointRulePost(context.Background()).Code(code).Name(name).Action(action).Type_(type_).Point(point).MaxPerDay(maxPerDay).Description(description).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.CreateRuleApiV1PointRulePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateRuleApiV1PointRulePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.CreateRuleApiV1PointRulePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateRuleApiV1PointRulePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** |  | 
 **name** | **string** |  | 
 **action** | **string** |  | 
 **type_** | **string** |  | [default to &quot;add&quot;]
 **point** | **int32** |  | [default to 0]
 **maxPerDay** | **int32** |  | [default to 0]
 **description** | **string** |  | 

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


## CreateRuleApiV1PointRulePost_0

> interface{} CreateRuleApiV1PointRulePost_0(ctx).Code(code).Name(name).Action(action).Type_(type_).Point(point).MaxPerDay(maxPerDay).Description(description).Execute()

新增规则

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
	code := "code_example" // string | 
	name := "name_example" // string | 
	action := "action_example" // string | 
	type_ := "type__example" // string |  (optional) (default to "add")
	point := int32(56) // int32 |  (optional) (default to 0)
	maxPerDay := int32(56) // int32 |  (optional) (default to 0)
	description := "description_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.CreateRuleApiV1PointRulePost_0(context.Background()).Code(code).Name(name).Action(action).Type_(type_).Point(point).MaxPerDay(maxPerDay).Description(description).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.CreateRuleApiV1PointRulePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateRuleApiV1PointRulePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.CreateRuleApiV1PointRulePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateRuleApiV1PointRulePost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **string** |  | 
 **name** | **string** |  | 
 **action** | **string** |  | 
 **type_** | **string** |  | [default to &quot;add&quot;]
 **point** | **int32** |  | [default to 0]
 **maxPerDay** | **int32** |  | [default to 0]
 **description** | **string** |  | 

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


## DeleteGoodsApiV1PointGoodsGidDelete

> interface{} DeleteGoodsApiV1PointGoodsGidDelete(ctx, gid).Execute()

删除商品

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
	gid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.DeleteGoodsApiV1PointGoodsGidDelete(context.Background(), gid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.DeleteGoodsApiV1PointGoodsGidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteGoodsApiV1PointGoodsGidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.DeleteGoodsApiV1PointGoodsGidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**gid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteGoodsApiV1PointGoodsGidDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## DeleteGoodsApiV1PointGoodsGidDelete_0

> interface{} DeleteGoodsApiV1PointGoodsGidDelete_0(ctx, gid).Execute()

删除商品

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
	gid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.DeleteGoodsApiV1PointGoodsGidDelete_0(context.Background(), gid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.DeleteGoodsApiV1PointGoodsGidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteGoodsApiV1PointGoodsGidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.DeleteGoodsApiV1PointGoodsGidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**gid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteGoodsApiV1PointGoodsGidDelete_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## DeleteRuleApiV1PointRuleRidDelete

> interface{} DeleteRuleApiV1PointRuleRidDelete(ctx, rid).Execute()

删除规则

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
	rid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.DeleteRuleApiV1PointRuleRidDelete(context.Background(), rid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.DeleteRuleApiV1PointRuleRidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteRuleApiV1PointRuleRidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.DeleteRuleApiV1PointRuleRidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**rid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteRuleApiV1PointRuleRidDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## DeleteRuleApiV1PointRuleRidDelete_0

> interface{} DeleteRuleApiV1PointRuleRidDelete_0(ctx, rid).Execute()

删除规则

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
	rid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.DeleteRuleApiV1PointRuleRidDelete_0(context.Background(), rid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.DeleteRuleApiV1PointRuleRidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteRuleApiV1PointRuleRidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.DeleteRuleApiV1PointRuleRidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**rid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteRuleApiV1PointRuleRidDelete_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## ExchangeApiV1PointExchangePost

> interface{} ExchangeApiV1PointExchangePost(ctx).GoodsId(goodsId).Quantity(quantity).Address(address).Contact(contact).Execute()

兑换商品

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
	goodsId := int32(56) // int32 | 
	quantity := int32(56) // int32 |  (optional) (default to 1)
	address := "address_example" // string |  (optional)
	contact := "contact_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.ExchangeApiV1PointExchangePost(context.Background()).GoodsId(goodsId).Quantity(quantity).Address(address).Contact(contact).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.ExchangeApiV1PointExchangePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExchangeApiV1PointExchangePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.ExchangeApiV1PointExchangePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiExchangeApiV1PointExchangePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **goodsId** | **int32** |  | 
 **quantity** | **int32** |  | [default to 1]
 **address** | **string** |  | 
 **contact** | **string** |  | 

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


## ExchangeApiV1PointExchangePost_0

> interface{} ExchangeApiV1PointExchangePost_0(ctx).GoodsId(goodsId).Quantity(quantity).Address(address).Contact(contact).Execute()

兑换商品

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
	goodsId := int32(56) // int32 | 
	quantity := int32(56) // int32 |  (optional) (default to 1)
	address := "address_example" // string |  (optional)
	contact := "contact_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.ExchangeApiV1PointExchangePost_0(context.Background()).GoodsId(goodsId).Quantity(quantity).Address(address).Contact(contact).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.ExchangeApiV1PointExchangePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExchangeApiV1PointExchangePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.ExchangeApiV1PointExchangePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiExchangeApiV1PointExchangePost_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **goodsId** | **int32** |  | 
 **quantity** | **int32** |  | [default to 1]
 **address** | **string** |  | 
 **contact** | **string** |  | 

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


## ExchangeListApiV1PointExchangeListGet

> interface{} ExchangeListApiV1PointExchangeListGet(ctx).Page(page).Limit(limit).Status(status).Execute()

兑换记录

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.ExchangeListApiV1PointExchangeListGet(context.Background()).Page(page).Limit(limit).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.ExchangeListApiV1PointExchangeListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExchangeListApiV1PointExchangeListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.ExchangeListApiV1PointExchangeListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiExchangeListApiV1PointExchangeListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** |  | 

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


## ExchangeListApiV1PointExchangeListGet_0

> interface{} ExchangeListApiV1PointExchangeListGet_0(ctx).Page(page).Limit(limit).Status(status).Execute()

兑换记录

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.ExchangeListApiV1PointExchangeListGet_0(context.Background()).Page(page).Limit(limit).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.ExchangeListApiV1PointExchangeListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExchangeListApiV1PointExchangeListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.ExchangeListApiV1PointExchangeListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiExchangeListApiV1PointExchangeListGet_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** |  | 

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


## GetGoodsApiV1PointGoodsGidGet

> interface{} GetGoodsApiV1PointGoodsGidGet(ctx, gid).Execute()

积分商品详情

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
	gid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.GetGoodsApiV1PointGoodsGidGet(context.Background(), gid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.GetGoodsApiV1PointGoodsGidGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetGoodsApiV1PointGoodsGidGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.GetGoodsApiV1PointGoodsGidGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**gid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetGoodsApiV1PointGoodsGidGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## GetGoodsApiV1PointGoodsGidGet_0

> interface{} GetGoodsApiV1PointGoodsGidGet_0(ctx, gid).Execute()

积分商品详情

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
	gid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.GetGoodsApiV1PointGoodsGidGet_0(context.Background(), gid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.GetGoodsApiV1PointGoodsGidGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetGoodsApiV1PointGoodsGidGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.GetGoodsApiV1PointGoodsGidGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**gid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetGoodsApiV1PointGoodsGidGet_7Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## GoodsListApiV1PointGoodsListGet

> interface{} GoodsListApiV1PointGoodsListGet(ctx).Page(page).Limit(limit).Keyword(keyword).Execute()

积分商品列表

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	keyword := "keyword_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.GoodsListApiV1PointGoodsListGet(context.Background()).Page(page).Limit(limit).Keyword(keyword).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.GoodsListApiV1PointGoodsListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GoodsListApiV1PointGoodsListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.GoodsListApiV1PointGoodsListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGoodsListApiV1PointGoodsListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **keyword** | **string** |  | 

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


## GoodsListApiV1PointGoodsListGet_0

> interface{} GoodsListApiV1PointGoodsListGet_0(ctx).Page(page).Limit(limit).Keyword(keyword).Execute()

积分商品列表

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	keyword := "keyword_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.GoodsListApiV1PointGoodsListGet_0(context.Background()).Page(page).Limit(limit).Keyword(keyword).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.GoodsListApiV1PointGoodsListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GoodsListApiV1PointGoodsListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.GoodsListApiV1PointGoodsListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGoodsListApiV1PointGoodsListGet_8Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **keyword** | **string** |  | 

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


## ListLogsApiV1PointLogListGet

> interface{} ListLogsApiV1PointLogListGet(ctx).Page(page).Limit(limit).Type_(type_).Action(action).Execute()

积分流水

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	type_ := "type__example" // string |  (optional)
	action := "action_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.ListLogsApiV1PointLogListGet(context.Background()).Page(page).Limit(limit).Type_(type_).Action(action).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.ListLogsApiV1PointLogListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListLogsApiV1PointLogListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.ListLogsApiV1PointLogListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListLogsApiV1PointLogListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **type_** | **string** |  | 
 **action** | **string** |  | 

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


## ListLogsApiV1PointLogListGet_0

> interface{} ListLogsApiV1PointLogListGet_0(ctx).Page(page).Limit(limit).Type_(type_).Action(action).Execute()

积分流水

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	type_ := "type__example" // string |  (optional)
	action := "action_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.ListLogsApiV1PointLogListGet_0(context.Background()).Page(page).Limit(limit).Type_(type_).Action(action).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.ListLogsApiV1PointLogListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListLogsApiV1PointLogListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.ListLogsApiV1PointLogListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListLogsApiV1PointLogListGet_9Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **type_** | **string** |  | 
 **action** | **string** |  | 

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


## MyAccountApiV1PointAccountGet

> interface{} MyAccountApiV1PointAccountGet(ctx).Execute()

我的积分账户

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
	resp, r, err := apiClient.PointAPI.MyAccountApiV1PointAccountGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.MyAccountApiV1PointAccountGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MyAccountApiV1PointAccountGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.MyAccountApiV1PointAccountGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiMyAccountApiV1PointAccountGetRequest struct via the builder pattern


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


## MyAccountApiV1PointAccountGet_0

> interface{} MyAccountApiV1PointAccountGet_0(ctx).Execute()

我的积分账户

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
	resp, r, err := apiClient.PointAPI.MyAccountApiV1PointAccountGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.MyAccountApiV1PointAccountGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `MyAccountApiV1PointAccountGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.MyAccountApiV1PointAccountGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiMyAccountApiV1PointAccountGet_10Request struct via the builder pattern


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


## RuleListApiV1PointRuleListGet

> interface{} RuleListApiV1PointRuleListGet(ctx).Type_(type_).Execute()

积分规则列表

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
	type_ := "type__example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.RuleListApiV1PointRuleListGet(context.Background()).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.RuleListApiV1PointRuleListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RuleListApiV1PointRuleListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.RuleListApiV1PointRuleListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRuleListApiV1PointRuleListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type_** | **string** |  | 

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


## RuleListApiV1PointRuleListGet_0

> interface{} RuleListApiV1PointRuleListGet_0(ctx).Type_(type_).Execute()

积分规则列表

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
	type_ := "type__example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.RuleListApiV1PointRuleListGet_0(context.Background()).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.RuleListApiV1PointRuleListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RuleListApiV1PointRuleListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.RuleListApiV1PointRuleListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRuleListApiV1PointRuleListGet_11Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **type_** | **string** |  | 

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


## SigninApiV1PointSigninPost

> interface{} SigninApiV1PointSigninPost(ctx).Execute()

每日签到

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
	resp, r, err := apiClient.PointAPI.SigninApiV1PointSigninPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.SigninApiV1PointSigninPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SigninApiV1PointSigninPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.SigninApiV1PointSigninPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiSigninApiV1PointSigninPostRequest struct via the builder pattern


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


## SigninApiV1PointSigninPost_0

> interface{} SigninApiV1PointSigninPost_0(ctx).Execute()

每日签到

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
	resp, r, err := apiClient.PointAPI.SigninApiV1PointSigninPost_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.SigninApiV1PointSigninPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SigninApiV1PointSigninPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.SigninApiV1PointSigninPost_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiSigninApiV1PointSigninPost_12Request struct via the builder pattern


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


## TriggerApiV1PointTriggerPost

> interface{} TriggerApiV1PointTriggerPost(ctx).Action(action).Description(description).RefId(refId).RefType(refType).UserId(userId).Execute()

触发积分行为

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
	action := "action_example" // string | 行为code
	description := "description_example" // string |  (optional)
	refId := "refId_example" // string |  (optional)
	refType := "refType_example" // string |  (optional)
	userId := "userId_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.TriggerApiV1PointTriggerPost(context.Background()).Action(action).Description(description).RefId(refId).RefType(refType).UserId(userId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.TriggerApiV1PointTriggerPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TriggerApiV1PointTriggerPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.TriggerApiV1PointTriggerPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTriggerApiV1PointTriggerPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **action** | **string** | 行为code | 
 **description** | **string** |  | 
 **refId** | **string** |  | 
 **refType** | **string** |  | 
 **userId** | **string** |  | 

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


## TriggerApiV1PointTriggerPost_0

> interface{} TriggerApiV1PointTriggerPost_0(ctx).Action(action).Description(description).RefId(refId).RefType(refType).UserId(userId).Execute()

触发积分行为

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
	action := "action_example" // string | 行为code
	description := "description_example" // string |  (optional)
	refId := "refId_example" // string |  (optional)
	refType := "refType_example" // string |  (optional)
	userId := "userId_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.TriggerApiV1PointTriggerPost_0(context.Background()).Action(action).Description(description).RefId(refId).RefType(refType).UserId(userId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.TriggerApiV1PointTriggerPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TriggerApiV1PointTriggerPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.TriggerApiV1PointTriggerPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTriggerApiV1PointTriggerPost_13Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **action** | **string** | 行为code | 
 **description** | **string** |  | 
 **refId** | **string** |  | 
 **refType** | **string** |  | 
 **userId** | **string** |  | 

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


## UpdateGoodsApiV1PointGoodsGidPut

> interface{} UpdateGoodsApiV1PointGoodsGidPut(ctx, gid).Name(name).Description(description).PointCost(pointCost).Stock(stock).Status(status).Execute()

修改商品

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
	gid := int32(56) // int32 | 
	name := "name_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	pointCost := int32(56) // int32 |  (optional)
	stock := int32(56) // int32 |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.UpdateGoodsApiV1PointGoodsGidPut(context.Background(), gid).Name(name).Description(description).PointCost(pointCost).Stock(stock).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.UpdateGoodsApiV1PointGoodsGidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateGoodsApiV1PointGoodsGidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.UpdateGoodsApiV1PointGoodsGidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**gid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateGoodsApiV1PointGoodsGidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **name** | **string** |  | 
 **description** | **string** |  | 
 **pointCost** | **int32** |  | 
 **stock** | **int32** |  | 
 **status** | **int32** |  | 

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


## UpdateGoodsApiV1PointGoodsGidPut_0

> interface{} UpdateGoodsApiV1PointGoodsGidPut_0(ctx, gid).Name(name).Description(description).PointCost(pointCost).Stock(stock).Status(status).Execute()

修改商品

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
	gid := int32(56) // int32 | 
	name := "name_example" // string |  (optional)
	description := "description_example" // string |  (optional)
	pointCost := int32(56) // int32 |  (optional)
	stock := int32(56) // int32 |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.UpdateGoodsApiV1PointGoodsGidPut_0(context.Background(), gid).Name(name).Description(description).PointCost(pointCost).Stock(stock).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.UpdateGoodsApiV1PointGoodsGidPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateGoodsApiV1PointGoodsGidPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.UpdateGoodsApiV1PointGoodsGidPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**gid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateGoodsApiV1PointGoodsGidPut_14Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **name** | **string** |  | 
 **description** | **string** |  | 
 **pointCost** | **int32** |  | 
 **stock** | **int32** |  | 
 **status** | **int32** |  | 

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


## UpdateRuleApiV1PointRuleRidPut

> interface{} UpdateRuleApiV1PointRuleRidPut(ctx, rid).Name(name).Point(point).MaxPerDay(maxPerDay).Status(status).Execute()

修改规则

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
	rid := int32(56) // int32 | 
	name := "name_example" // string |  (optional)
	point := int32(56) // int32 |  (optional)
	maxPerDay := int32(56) // int32 |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.UpdateRuleApiV1PointRuleRidPut(context.Background(), rid).Name(name).Point(point).MaxPerDay(maxPerDay).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.UpdateRuleApiV1PointRuleRidPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateRuleApiV1PointRuleRidPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.UpdateRuleApiV1PointRuleRidPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**rid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateRuleApiV1PointRuleRidPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **name** | **string** |  | 
 **point** | **int32** |  | 
 **maxPerDay** | **int32** |  | 
 **status** | **int32** |  | 

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


## UpdateRuleApiV1PointRuleRidPut_0

> interface{} UpdateRuleApiV1PointRuleRidPut_0(ctx, rid).Name(name).Point(point).MaxPerDay(maxPerDay).Status(status).Execute()

修改规则

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
	rid := int32(56) // int32 | 
	name := "name_example" // string |  (optional)
	point := int32(56) // int32 |  (optional)
	maxPerDay := int32(56) // int32 |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.UpdateRuleApiV1PointRuleRidPut_0(context.Background(), rid).Name(name).Point(point).MaxPerDay(maxPerDay).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.UpdateRuleApiV1PointRuleRidPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateRuleApiV1PointRuleRidPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.UpdateRuleApiV1PointRuleRidPut_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**rid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUpdateRuleApiV1PointRuleRidPut_15Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **name** | **string** |  | 
 **point** | **int32** |  | 
 **maxPerDay** | **int32** |  | 
 **status** | **int32** |  | 

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


## UserAccountApiV1PointAccountUserIdGet

> interface{} UserAccountApiV1PointAccountUserIdGet(ctx, userId).Execute()

指定用户积分账户

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
	userId := "userId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.UserAccountApiV1PointAccountUserIdGet(context.Background(), userId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.UserAccountApiV1PointAccountUserIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UserAccountApiV1PointAccountUserIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.UserAccountApiV1PointAccountUserIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**userId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUserAccountApiV1PointAccountUserIdGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## UserAccountApiV1PointAccountUserIdGet_0

> interface{} UserAccountApiV1PointAccountUserIdGet_0(ctx, userId).Execute()

指定用户积分账户

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
	userId := "userId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.PointAPI.UserAccountApiV1PointAccountUserIdGet_0(context.Background(), userId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `PointAPI.UserAccountApiV1PointAccountUserIdGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UserAccountApiV1PointAccountUserIdGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `PointAPI.UserAccountApiV1PointAccountUserIdGet_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**userId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUserAccountApiV1PointAccountUserIdGet_16Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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

