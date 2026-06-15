import request from '@/utils/request'
import { createCrudApi } from '@/utils/createCrudApi'

export const sceneLibraryAPI = createCrudApi(request, '/scene-library')
