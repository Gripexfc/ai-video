import { get, put } from './request'

export function getEpisodeStoryboards(episodeId) {
  return get(`/episodes/${episodeId}/storyboards`)
}

export function updateStoryboard(id, data) {
  return put(`/storyboards/${id}`, data)
}
