const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

// 401 跳转锁，防止并发请求重复跳转
let isRedirecting = false

function getToken() {
  return uni.getStorageSync('user_token') || ''
}

function request({ url, method, data, header = {} }) {
  return new Promise((resolve, reject) => {
    const token = getToken()
    const headers = {
      'Content-Type': 'application/json',
      ...header,
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    uni.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: headers,
      success(res) {
        const { statusCode, data: body } = res

        // 401 未登录 - 清除 token 并跳转登录页
        if (statusCode === 401) {
          if (!isRedirecting) {
            isRedirecting = true
            uni.removeStorageSync('user_token')
            uni.reLaunch({
              url: '/pages/login/index',
              complete() { isRedirecting = false }
            })
          }
          reject(new Error('未登录或登录已过期'))
          return
        }

        // 402 积分不足 - 弹窗提示并提供充值跳转
        if (statusCode === 402) {
          const errMsg =
            typeof body?.error === 'object'
              ? body.error.message
              : body?.error || '积分不足'
          uni.showModal({
            title: '积分不足',
            content: errMsg + '，是否前往充值？',
            confirmText: '去充值',
            success(modalRes) {
              if (modalRes.confirm) {
                // #ifdef H5
                window.open('/pages/mine/index', '_self')
                // #endif
                // #ifndef H5
                uni.navigateTo({ url: '/pages/mine/index' })
                // #endif
              }
            },
          })
          reject(new Error(errMsg))
          return
        }

        // 其他 400+ 错误
        if (statusCode >= 400) {
          const errMsg =
            typeof body?.error === 'object'
              ? body.error.message
              : body?.error || `请求失败 (${statusCode})`
          reject(new Error(errMsg))
          return
        }

        // 成功响应解包
        if (body && body.data !== undefined) {
          resolve(body.data)
        } else {
          resolve(body)
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络请求失败'))
      },
    })
  })
}

export function get(url, params) {
  return request({ url, method: 'GET', data: params })
}

export function post(url, data) {
  return request({ url, method: 'POST', data })
}

export function put(url, data) {
  return request({ url, method: 'PUT', data })
}

export function del(url, data) {
  return request({ url, method: 'DELETE', data })
}
