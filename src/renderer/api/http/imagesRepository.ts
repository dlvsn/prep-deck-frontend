import type { HttpClient } from '../http'
import type { ImagesRepository } from '../repositories'
import type { CardImage } from '../types'

/** prep-deck-backend `/api/images`: multipart upload, with progress. */
export function createHttpImagesRepository(http: HttpClient): ImagesRepository {
  return {
    upload: (file, options = {}) => {
      const form = new FormData()
      form.append('file', file)
      return http.upload<CardImage>('/images', form, options)
    }
  }
}
