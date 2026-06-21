# RuleSpec

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Name** | Pointer to **string** | 规则名 (可空, 便于日志) | [optional] [default to ""]
**SourceMatch** | Pointer to **map[string]interface{}** | source 侧 matchers (AND) | [optional] 
**TargetMatch** | Pointer to **map[string]interface{}** | target 侧 matchers (AND) | [optional] 
**Equal** | Pointer to **[]string** | equal 字段列表, None&#x3D;alertname | [optional] 

## Methods

### NewRuleSpec

`func NewRuleSpec() *RuleSpec`

NewRuleSpec instantiates a new RuleSpec object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewRuleSpecWithDefaults

`func NewRuleSpecWithDefaults() *RuleSpec`

NewRuleSpecWithDefaults instantiates a new RuleSpec object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetName

`func (o *RuleSpec) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *RuleSpec) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *RuleSpec) SetName(v string)`

SetName sets Name field to given value.

### HasName

`func (o *RuleSpec) HasName() bool`

HasName returns a boolean if a field has been set.

### GetSourceMatch

`func (o *RuleSpec) GetSourceMatch() map[string]interface{}`

GetSourceMatch returns the SourceMatch field if non-nil, zero value otherwise.

### GetSourceMatchOk

`func (o *RuleSpec) GetSourceMatchOk() (*map[string]interface{}, bool)`

GetSourceMatchOk returns a tuple with the SourceMatch field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSourceMatch

`func (o *RuleSpec) SetSourceMatch(v map[string]interface{})`

SetSourceMatch sets SourceMatch field to given value.

### HasSourceMatch

`func (o *RuleSpec) HasSourceMatch() bool`

HasSourceMatch returns a boolean if a field has been set.

### GetTargetMatch

`func (o *RuleSpec) GetTargetMatch() map[string]interface{}`

GetTargetMatch returns the TargetMatch field if non-nil, zero value otherwise.

### GetTargetMatchOk

`func (o *RuleSpec) GetTargetMatchOk() (*map[string]interface{}, bool)`

GetTargetMatchOk returns a tuple with the TargetMatch field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTargetMatch

`func (o *RuleSpec) SetTargetMatch(v map[string]interface{})`

SetTargetMatch sets TargetMatch field to given value.

### HasTargetMatch

`func (o *RuleSpec) HasTargetMatch() bool`

HasTargetMatch returns a boolean if a field has been set.

### GetEqual

`func (o *RuleSpec) GetEqual() []string`

GetEqual returns the Equal field if non-nil, zero value otherwise.

### GetEqualOk

`func (o *RuleSpec) GetEqualOk() (*[]string, bool)`

GetEqualOk returns a tuple with the Equal field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEqual

`func (o *RuleSpec) SetEqual(v []string)`

SetEqual sets Equal field to given value.

### HasEqual

`func (o *RuleSpec) HasEqual() bool`

HasEqual returns a boolean if a field has been set.

### SetEqualNil

`func (o *RuleSpec) SetEqualNil(b bool)`

 SetEqualNil sets the value for Equal to be an explicit nil

### UnsetEqual
`func (o *RuleSpec) UnsetEqual()`

UnsetEqual ensures that no value is present for Equal, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


