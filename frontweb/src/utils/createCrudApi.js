/**
 * 通用 CRUD API 工厂函数
 * 为素材库等标准 REST 资源生成一致的 API 接口
 */
export function createCrudApi(request, basePath) {
  return {
    list: (params) => request.get(basePath, { params }),
    get: (id) => request.get(`${basePath}/${id}`),
    create: (data) => request.post(basePath, data),
    update: (id, data) => request.put(`${basePath}/${id}`, data),
    delete: (id) => request.delete(`${basePath}/${id}`),
  }
}
