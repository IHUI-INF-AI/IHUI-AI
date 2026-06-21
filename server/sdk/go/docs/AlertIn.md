# AlertIn

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Status** | Pointer to **string** | firing / resolved | [optional] [default to "firing"]
**Labels** | Pointer to **map[string]interface{}** | 告警 labels | [optional] 
**Annotations** | Pointer to **map[string]interface{}** | 可选 annotations | [optional] 

## Methods

### NewAlertIn

`func NewAlertIn() *AlertIn`

NewAlertIn instantiates a new AlertIn object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewAlertInWithDefaults

`func NewAlertInWithDefaults() *AlertIn`

NewAlertInWithDefaults instantiates a new AlertIn object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetStatus

`func (o *AlertIn) GetStatus() string`

GetStatus returns the Status field if non-nil, zero value otherwise.

### GetStatusOk

`func (o *AlertIn) GetStatusOk() (*string, bool)`

GetStatusOk returns a tuple with the Status field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStatus

`func (o *AlertIn) SetStatus(v string)`

SetStatus sets Status field to given value.

### HasStatus

`func (o *AlertIn) HasStatus() bool`

HasStatus returns a boolean if a field has been set.

### GetLabels

`func (o *AlertIn) GetLabels() map[string]interface{}`

GetLabels returns the Labels field if non-nil, zero value otherwise.

### GetLabelsOk

`func (o *AlertIn) GetLabelsOk() (*map[string]interface{}, bool)`

GetLabelsOk returns a tuple with the Labels field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLabels

`func (o *AlertIn) SetLabels(v map[string]interface{})`

SetLabels sets Labels field to given value.

### HasLabels

`func (o *AlertIn) HasLabels() bool`

HasLabels returns a boolean if a field has been set.

### GetAnnotations

`func (o *AlertIn) GetAnnotations() map[string]interface{}`

GetAnnotations returns the Annotations field if non-nil, zero value otherwise.

### GetAnnotationsOk

`func (o *AlertIn) GetAnnotationsOk() (*map[string]interface{}, bool)`

GetAnnotationsOk returns a tuple with the Annotations field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAnnotations

`func (o *AlertIn) SetAnnotations(v map[string]interface{})`

SetAnnotations sets Annotations field to given value.

### HasAnnotations

`func (o *AlertIn) HasAnnotations() bool`

HasAnnotations returns a boolean if a field has been set.

### SetAnnotationsNil

`func (o *AlertIn) SetAnnotationsNil(b bool)`

 SetAnnotationsNil sets the value for Annotations to be an explicit nil

### UnsetAnnotations
`func (o *AlertIn) UnsetAnnotations()`

UnsetAnnotations ensures that no value is present for Annotations, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


