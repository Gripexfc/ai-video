import request from '@/utils/request'
import { createCrudApi } from '@/utils/createCrudApi'

export const characterLibraryAPI = createCrudApi(request, '/character-library')
