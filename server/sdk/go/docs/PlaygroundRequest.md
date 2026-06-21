# PlaygroundRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Alerts** | [**[]AlertIn**](AlertIn.md) | 待测告警列表 | 
**Rules** | Pointer to [**[]RuleSpec**](RuleSpec.md) | 自定义规则 (可选) | [optional] 
**UseDefaultPresets** | Pointer to **bool** | 叠加 ZHS 平台预设规则 | [optional] [default to false]

## Methods

### NewPlaygroundRequest

`func NewPlaygroundRequest(alerts []AlertIn, ) *PlaygroundRequest`

NewPlaygroundRequest instantiates a new PlaygroundRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewPlaygroundRequestWithDefaults

`func NewPlaygroundRequestWithDefaults() *PlaygroundRequest`

NewPlaygroundRequestWithDefaults instantiates a new PlaygroundRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetAlerts

`func (o *PlaygroundRequest) GetAlerts() []AlertIn`

GetAlerts returns the Alerts field if non-nil, zero value otherwise.

### GetAlertsOk

`func (o *PlaygroundRequest) GetAlertsOk() (*[]AlertIn, bool)`

GetAlertsOk returns a tuple with the Alerts field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAlerts

`func (o *PlaygroundRequest) SetAlerts(v []AlertIn)`

SetAlerts sets Alerts field to given value.


### GetRules

`func (o *PlaygroundRequest) GetRules() []RuleSpec`

GetRules returns the Rules field if non-nil, zero value otherwise.

### GetRulesOk

`func (o *PlaygroundRequest) GetRulesOk() (*[]RuleSpec, bool)`

GetRulesOk returns a tuple with the Rules field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRules

`func (o *PlaygroundRequest) SetRules(v []RuleSpec)`

SetRules sets Rules field to given value.

### HasRules

`func (o *PlaygroundRequest) HasRules() bool`

HasRules returns a boolean if a field has been set.

### GetUseDefaultPresets

`func (o *PlaygroundRequest) GetUseDefaultPresets() bool`

GetUseDefaultPresets returns the UseDefaultPresets field if non-nil, zero value otherwise.

### GetUseDefaultPresetsOk

`func (o *PlaygroundRequest) GetUseDefaultPresetsOk() (*bool, bool)`

GetUseDefaultPresetsOk returns a tuple with the UseDefaultPresets field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUseDefaultPresets

`func (o *PlaygroundRequest) SetUseDefaultPresets(v bool)`

SetUseDefaultPresets sets UseDefaultPresets field to given value.

### HasUseDefaultPresets

`func (o *PlaygroundRequest) HasUseDefaultPresets() bool`

HasUseDefaultPresets returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


