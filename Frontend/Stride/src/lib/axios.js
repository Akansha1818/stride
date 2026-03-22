import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
})

api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Extract clean message
    const message =
      error.response?.data?.message ||
      error.message ||
      'Something went wrong'

    // Attach clean message
    error.customMessage = message

    if (
      error.response?.status === 401 &&
      !error.config?.skipAuthRedirect &&
      !window.location.pathname.includes('/login')
    ) {
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

export default api
