# CourseUpdate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Title** | Pointer to **NullableString** |  | [optional] 
**Subtitle** | Pointer to **NullableString** |  | [optional] 
**Content** | Pointer to **NullableString** |  | [optional] 
**Remark** | Pointer to **NullableString** |  | [optional] 
**RemarkFile** | Pointer to **NullableString** |  | [optional] 
**Binding** | Pointer to **NullableString** |  | [optional] 
**Stage** | Pointer to **NullableString** |  | [optional] 
**Label** | Pointer to **NullableString** |  | [optional] 
**Sort** | Pointer to **NullableInt32** |  | [optional] 
**IsHidden** | Pointer to **NullableInt32** |  | [optional] 
**AuditStatus** | Pointer to **NullableInt32** |  | [optional] 

## Methods

### NewCourseUpdate

`func NewCourseUpdate() *CourseUpdate`

NewCourseUpdate instantiates a new CourseUpdate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCourseUpdateWithDefaults

`func NewCourseUpdateWithDefaults() *CourseUpdate`

NewCourseUpdateWithDefaults instantiates a new CourseUpdate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetTitle

`func (o *CourseUpdate) GetTitle() string`

GetTitle returns the Title field if non-nil, zero value otherwise.

### GetTitleOk

`func (o *CourseUpdate) GetTitleOk() (*string, bool)`

GetTitleOk returns a tuple with the Title field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTitle

`func (o *CourseUpdate) SetTitle(v string)`

SetTitle sets Title field to given value.

### HasTitle

`func (o *CourseUpdate) HasTitle() bool`

HasTitle returns a boolean if a field has been set.

### SetTitleNil

`func (o *CourseUpdate) SetTitleNil(b bool)`

 SetTitleNil sets the value for Title to be an explicit nil

### UnsetTitle
`func (o *CourseUpdate) UnsetTitle()`

UnsetTitle ensures that no value is present for Title, not even an explicit nil
### GetSubtitle

`func (o *CourseUpdate) GetSubtitle() string`

GetSubtitle returns the Subtitle field if non-nil, zero value otherwise.

### GetSubtitleOk

`func (o *CourseUpdate) GetSubtitleOk() (*string, bool)`

GetSubtitleOk returns a tuple with the Subtitle field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSubtitle

`func (o *CourseUpdate) SetSubtitle(v string)`

SetSubtitle sets Subtitle field to given value.

### HasSubtitle

`func (o *CourseUpdate) HasSubtitle() bool`

HasSubtitle returns a boolean if a field has been set.

### SetSubtitleNil

`func (o *CourseUpdate) SetSubtitleNil(b bool)`

 SetSubtitleNil sets the value for Subtitle to be an explicit nil

### UnsetSubtitle
`func (o *CourseUpdate) UnsetSubtitle()`

UnsetSubtitle ensures that no value is present for Subtitle, not even an explicit nil
### GetContent

`func (o *CourseUpdate) GetContent() string`

GetContent returns the Content field if non-nil, zero value otherwise.

### GetContentOk

`func (o *CourseUpdate) GetContentOk() (*string, bool)`

GetContentOk returns a tuple with the Content field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetContent

`func (o *CourseUpdate) SetContent(v string)`

SetContent sets Content field to given value.

### HasContent

`func (o *CourseUpdate) HasContent() bool`

HasContent returns a boolean if a field has been set.

### SetContentNil

`func (o *CourseUpdate) SetContentNil(b bool)`

 SetContentNil sets the value for Content to be an explicit nil

### UnsetContent
`func (o *CourseUpdate) UnsetContent()`

UnsetContent ensures that no value is present for Content, not even an explicit nil
### GetRemark

`func (o *CourseUpdate) GetRemark() string`

GetRemark returns the Remark field if non-nil, zero value otherwise.

### GetRemarkOk

`func (o *CourseUpdate) GetRemarkOk() (*string, bool)`

GetRemarkOk returns a tuple with the Remark field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRemark

`func (o *CourseUpdate) SetRemark(v string)`

SetRemark sets Remark field to given value.

### HasRemark

`func (o *CourseUpdate) HasRemark() bool`

HasRemark returns a boolean if a field has been set.

### SetRemarkNil

`func (o *CourseUpdate) SetRemarkNil(b bool)`

 SetRemarkNil sets the value for Remark to be an explicit nil

### UnsetRemark
`func (o *CourseUpdate) UnsetRemark()`

UnsetRemark ensures that no value is present for Remark, not even an explicit nil
### GetRemarkFile

`func (o *CourseUpdate) GetRemarkFile() string`

GetRemarkFile returns the RemarkFile field if non-nil, zero value otherwise.

### GetRemarkFileOk

`func (o *CourseUpdate) GetRemarkFileOk() (*string, bool)`

GetRemarkFileOk returns a tuple with the RemarkFile field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRemarkFile

`func (o *CourseUpdate) SetRemarkFile(v string)`

SetRemarkFile sets RemarkFile field to given value.

### HasRemarkFile

`func (o *CourseUpdate) HasRemarkFile() bool`

HasRemarkFile returns a boolean if a field has been set.

### SetRemarkFileNil

`func (o *CourseUpdate) SetRemarkFileNil(b bool)`

 SetRemarkFileNil sets the value for RemarkFile to be an explicit nil

### UnsetRemarkFile
`func (o *CourseUpdate) UnsetRemarkFile()`

UnsetRemarkFile ensures that no value is present for RemarkFile, not even an explicit nil
### GetBinding

`func (o *CourseUpdate) GetBinding() string`

GetBinding returns the Binding field if non-nil, zero value otherwise.

### GetBindingOk

`func (o *CourseUpdate) GetBindingOk() (*string, bool)`

GetBindingOk returns a tuple with the Binding field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBinding

`func (o *CourseUpdate) SetBinding(v string)`

SetBinding sets Binding field to given value.

### HasBinding

`func (o *CourseUpdate) HasBinding() bool`

HasBinding returns a boolean if a field has been set.

### SetBindingNil

`func (o *CourseUpdate) SetBindingNil(b bool)`

 SetBindingNil sets the value for Binding to be an explicit nil

### UnsetBinding
`func (o *CourseUpdate) UnsetBinding()`

UnsetBinding ensures that no value is present for Binding, not even an explicit nil
### GetStage

`func (o *CourseUpdate) GetStage() string`

GetStage returns the Stage field if non-nil, zero value otherwise.

### GetStageOk

`func (o *CourseUpdate) GetStageOk() (*string, bool)`

GetStageOk returns a tuple with the Stage field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStage

`func (o *CourseUpdate) SetStage(v string)`

SetStage sets Stage field to given value.

### HasStage

`func (o *CourseUpdate) HasStage() bool`

HasStage returns a boolean if a field has been set.

### SetStageNil

`func (o *CourseUpdate) SetStageNil(b bool)`

 SetStageNil sets the value for Stage to be an explicit nil

### UnsetStage
`func (o *CourseUpdate) UnsetStage()`

UnsetStage ensures that no value is present for Stage, not even an explicit nil
### GetLabel

`func (o *CourseUpdate) GetLabel() string`

GetLabel returns the Label field if non-nil, zero value otherwise.

### GetLabelOk

`func (o *CourseUpdate) GetLabelOk() (*string, bool)`

GetLabelOk returns a tuple with the Label field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLabel

`func (o *CourseUpdate) SetLabel(v string)`

SetLabel sets Label field to given value.

### HasLabel

`func (o *CourseUpdate) HasLabel() bool`

HasLabel returns a boolean if a field has been set.

### SetLabelNil

`func (o *CourseUpdate) SetLabelNil(b bool)`

 SetLabelNil sets the value for Label to be an explicit nil

### UnsetLabel
`func (o *CourseUpdate) UnsetLabel()`

UnsetLabel ensures that no value is present for Label, not even an explicit nil
### GetSort

`func (o *CourseUpdate) GetSort() int32`

GetSort returns the Sort field if non-nil, zero value otherwise.

### GetSortOk

`func (o *CourseUpdate) GetSortOk() (*int32, bool)`

GetSortOk returns a tuple with the Sort field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSort

`func (o *CourseUpdate) SetSort(v int32)`

SetSort sets Sort field to given value.

### HasSort

`func (o *CourseUpdate) HasSort() bool`

HasSort returns a boolean if a field has been set.

### SetSortNil

`func (o *CourseUpdate) SetSortNil(b bool)`

 SetSortNil sets the value for Sort to be an explicit nil

### UnsetSort
`func (o *CourseUpdate) UnsetSort()`

UnsetSort ensures that no value is present for Sort, not even an explicit nil
### GetIsHidden

`func (o *CourseUpdate) GetIsHidden() int32`

GetIsHidden returns the IsHidden field if non-nil, zero value otherwise.

### GetIsHiddenOk

`func (o *CourseUpdate) GetIsHiddenOk() (*int32, bool)`

GetIsHiddenOk returns a tuple with the IsHidden field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetIsHidden

`func (o *CourseUpdate) SetIsHidden(v int32)`

SetIsHidden sets IsHidden field to given value.

### HasIsHidden

`func (o *CourseUpdate) HasIsHidden() bool`

HasIsHidden returns a boolean if a field has been set.

### SetIsHiddenNil

`func (o *CourseUpdate) SetIsHiddenNil(b bool)`

 SetIsHiddenNil sets the value for IsHidden to be an explicit nil

### UnsetIsHidden
`func (o *CourseUpdate) UnsetIsHidden()`

UnsetIsHidden ensures that no value is present for IsHidden, not even an explicit nil
### GetAuditStatus

`func (o *CourseUpdate) GetAuditStatus() int32`

GetAuditStatus returns the AuditStatus field if non-nil, zero value otherwise.

### GetAuditStatusOk

`func (o *CourseUpdate) GetAuditStatusOk() (*int32, bool)`

GetAuditStatusOk returns a tuple with the AuditStatus field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAuditStatus

`func (o *CourseUpdate) SetAuditStatus(v int32)`

SetAuditStatus sets AuditStatus field to given value.

### HasAuditStatus

`func (o *CourseUpdate) HasAuditStatus() bool`

HasAuditStatus returns a boolean if a field has been set.

### SetAuditStatusNil

`func (o *CourseUpdate) SetAuditStatusNil(b bool)`

 SetAuditStatusNil sets the value for AuditStatus to be an explicit nil

### UnsetAuditStatus
`func (o *CourseUpdate) UnsetAuditStatus()`

UnsetAuditStatus ensures that no value is present for AuditStatus, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


