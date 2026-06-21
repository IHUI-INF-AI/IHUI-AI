# \MonitorAlertsAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AlertHistoryApiV1MonitorAlertsHistoryGet**](MonitorAlertsAPI.md#AlertHistoryApiV1MonitorAlertsHistoryGet) | **Get** /api/v1/monitor/alerts/history | 最近告警历史（内存中）
[**AlertmanagerWebhookApiV1MonitorAlertsWebhookPost**](MonitorAlertsAPI.md#AlertmanagerWebhookApiV1MonitorAlertsWebhookPost) | **Post** /api/v1/monitor/alerts/webhook | Alertmanager webhook 接收
[**TestAlertApiV1MonitorAlertsTestPost**](MonitorAlertsAPI.md#TestAlertApiV1MonitorAlertsTestPost) | **Post** /api/v1/monitor/alerts/test | 测试告警推送（手工触发）



## AlertHistoryApiV1MonitorAlertsHistoryGet

> interface{} AlertHistoryApiV1MonitorAlertsHistoryGet(ctx).Execute()

最近告警历史（内存中）



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
	resp, r, err := apiClient.MonitorAlertsAPI.AlertHistoryApiV1MonitorAlertsHistoryGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorAlertsAPI.AlertHistoryApiV1MonitorAlertsHistoryGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AlertHistoryApiV1MonitorAlertsHistoryGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MonitorAlertsAPI.AlertHistoryApiV1MonitorAlertsHistoryGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiAlertHistoryApiV1MonitorAlertsHistoryGetRequest struct via the builder pattern


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


## AlertmanagerWebhookApiV1MonitorAlertsWebhookPost

> interface{} AlertmanagerWebhookApiV1MonitorAlertsWebhookPost(ctx).DryRun(dryRun).Execute()

Alertmanager webhook 接收



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
	dryRun := true // bool |  (optional) (default to false)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MonitorAlertsAPI.AlertmanagerWebhookApiV1MonitorAlertsWebhookPost(context.Background()).DryRun(dryRun).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorAlertsAPI.AlertmanagerWebhookApiV1MonitorAlertsWebhookPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AlertmanagerWebhookApiV1MonitorAlertsWebhookPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MonitorAlertsAPI.AlertmanagerWebhookApiV1MonitorAlertsWebhookPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAlertmanagerWebhookApiV1MonitorAlertsWebhookPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dryRun** | **bool** |  | [default to false]

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


## TestAlertApiV1MonitorAlertsTestPost

> interface{} TestAlertApiV1MonitorAlertsTestPost(ctx).Title(title).Message(message).Severity(severity).Execute()

测试告警推送（手工触发）



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
	title := "title_example" // string |  (optional) (default to "测试告警")
	message := "message_example" // string |  (optional) (default to "ZHS Platform 告警通道测试")
	severity := "severity_example" // string |  (optional) (default to "info")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.MonitorAlertsAPI.TestAlertApiV1MonitorAlertsTestPost(context.Background()).Title(title).Message(message).Severity(severity).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `MonitorAlertsAPI.TestAlertApiV1MonitorAlertsTestPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TestAlertApiV1MonitorAlertsTestPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `MonitorAlertsAPI.TestAlertApiV1MonitorAlertsTestPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTestAlertApiV1MonitorAlertsTestPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **string** |  | [default to &quot;测试告警&quot;]
 **message** | **string** |  | [default to &quot;ZHS Platform 告警通道测试&quot;]
 **severity** | **string** |  | [default to &quot;info&quot;]

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

