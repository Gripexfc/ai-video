import request from '@/utils/request'

export const activationAPI = {
  getStatus() {
    return request.get('/activation/status')
  },
  getMachineId() {
    return request.get('/activation/machine-id')
  },
  activate(code) {
    return request.post('/activation/activate', { code })
  },
}
