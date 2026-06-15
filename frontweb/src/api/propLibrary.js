import request from '@/utils/request'
import { createCrudApi } from '@/utils/createCrudApi'

export const propLibraryAPI = createCrudApi(request, '/prop-library')
