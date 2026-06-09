import { post } from './request'

export function createVideo(data) {
  return post('/videos', data)
}
