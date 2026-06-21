
# VideoCreate


## Properties

Name | Type
------------ | -------------
`courseId` | number
`title` | string
`subtitle` | string
`content` | string
`videoPath` | string
`duration` | number
`adjunctUrl` | string
`isPay` | number
`amount` | number
`lecturer` | string
`label` | string
`stage` | string
`sort` | number
`binding` | string
`remark` | string

## Example

```typescript
import type { VideoCreate } from ''

// TODO: Update the object below with actual values
const example = {
  "courseId": null,
  "title": null,
  "subtitle": null,
  "content": null,
  "videoPath": null,
  "duration": null,
  "adjunctUrl": null,
  "isPay": null,
  "amount": null,
  "lecturer": null,
  "label": null,
  "stage": null,
  "sort": null,
  "binding": null,
  "remark": null,
} satisfies VideoCreate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as VideoCreate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


