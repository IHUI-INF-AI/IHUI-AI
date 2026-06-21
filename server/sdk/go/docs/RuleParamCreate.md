# RuleParamCreate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**RuleId** | **int32** |  | 
**ParamName** | **string** |  | 
**ParamValue** | Pointer to **NullableString** |  | [optional] 
**ParamType** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewRuleParamCreate

`func NewRuleParamCreate(ruleId int32, paramName string, ) *RuleParamCreate`

NewRuleParamCreate instantiates a new RuleParamCreate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewRuleParamCreateWithDefaults

`func NewRuleParamCreateWithDefaults() *RuleParamCreate`

NewRuleParamCreateWithDefaults instantiates a new RuleParamCreate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetRuleId

`func (o *RuleParamCreate) GetRuleId() int32`

GetRuleId returns the RuleId field if non-nil, zero value otherwise.

### GetRuleIdOk

`func (o *RuleParamCreate) GetRuleIdOk() (*int32, bool)`

GetRuleIdOk returns a tuple with the RuleId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRuleId

`func (o *RuleParamCreate) SetRuleId(v int32)`

SetRuleId sets RuleId field to given value.


### GetParamName

`func (o *RuleParamCreate) GetParamName() string`

GetParamName returns the ParamName field if non-nil, zero value otherwise.

### GetParamNameOk

`func (o *RuleParamCreate) GetParamNameOk() (*string, bool)`

GetParamNameOk returns a tuple with the ParamName field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetParamName

`func (o *RuleParamCreate) SetParamName(v string)`

SetParamName sets ParamName field to given value.


### GetParamValue

`func (o *RuleParamCreate) GetParamValue() string`

GetParamValue returns the ParamValue field if non-nil, zero value otherwise.

### GetParamValueOk

`func (o *RuleParamCreate) GetParamValueOk() (*string, bool)`

GetParamValueOk returns a tuple with the ParamValue field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetParamValue

`func (o *RuleParamCreate) SetParamValue(v string)`

SetParamValue sets ParamValue field to given value.

### HasParamValue

`func (o *RuleParamCreate) HasParamValue() bool`

HasParamValue returns a boolean if a field has been set.

### SetParamValueNil

`func (o *RuleParamCreate) SetParamValueNil(b bool)`

 SetParamValueNil sets the value for ParamValue to be an explicit nil

### UnsetParamValue
`func (o *RuleParamCreate) UnsetParamValue()`

UnsetParamValue ensures that no value is present for ParamValue, not even an explicit nil
### GetParamType

`func (o *RuleParamCreate) GetParamType() string`

GetParamType returns the ParamType field if non-nil, zero value otherwise.

### GetParamTypeOk

`func (o *RuleParamCreate) GetParamTypeOk() (*string, bool)`

GetParamTypeOk returns a tuple with the ParamType field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetParamType

`func (o *RuleParamCreate) SetParamType(v string)`

SetParamType sets ParamType field to given value.

### HasParamType

`func (o *RuleParamCreate) HasParamType() bool`

HasParamType returns a boolean if a field has been set.

### SetParamTypeNil

`func (o *RuleParamCreate) SetParamTypeNil(b bool)`

 SetParamTypeNil sets the value for ParamType to be an explicit nil

### UnsetParamType
`func (o *RuleParamCreate) UnsetParamType()`

UnsetParamType ensures that no value is present for ParamType, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


