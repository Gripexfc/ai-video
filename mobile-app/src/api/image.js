import { post } from './request'

export function createImage(data) {
  return post('/images', data)
}
