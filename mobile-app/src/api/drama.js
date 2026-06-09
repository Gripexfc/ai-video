import { get, post, del } from './request'
import { put } from './request'

export function listDramas(params) { return get('/dramas', params) }
export function createDrama(data) { return post('/dramas', data) }
export function getDrama(id) { return get(`/dramas/${id}`) }
export function deleteDrama(id) { return del(`/dramas/${id}`) }
export function saveEpisodes(id, data) { return put(`/dramas/${id}/episodes`, data) }
