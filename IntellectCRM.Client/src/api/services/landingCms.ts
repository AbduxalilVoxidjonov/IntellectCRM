import { api } from '../client'

export interface LandingSocials {
  telegramUrl: string
  instagramUrl: string
  youtubeUrl: string
  facebookUrl: string
  centerEmail: string
  appStoreUrl: string
  playMarketUrl: string
  contactPhone: string
  centerAddress: string
  workingHours: string
}

export interface LandingTeacher {
  id: string
  fullName: string
  subject: string
  photoUrl: string
  badge: string
  shortBio: string
  fullBio: string
  order: number
  isActive: boolean
  createdAt: string
}

export interface LandingCertificate {
  id: string
  title: string
  studentName: string
  imageUrl: string
  category: string
  certType: string
  overallScore: string
  listening?: string
  reading?: string
  writing?: string
  speaking?: string
  resultNote?: string
  order: number
  isActive: boolean
  createdAt: string
}

export interface LandingTestimonial {
  id: string
  authorName: string
  authorRole: string
  avatarUrl: string
  rating: number
  comment: string
  order: number
  isActive: boolean
  createdAt: string
}

export interface LandingFaq {
  id: string
  question: string
  answer: string
  order: number
  isActive: boolean
  createdAt: string
}

export const landingCmsService = {
  // Teachers
  getTeachers: () => api.get<LandingTeacher[]>('/admin/landing/teachers'),
  createTeacher: (data: Partial<LandingTeacher>) => api.post<LandingTeacher>('/admin/landing/teachers', data),
  updateTeacher: (id: string, data: Partial<LandingTeacher>) => api.put<LandingTeacher>(`/admin/landing/teachers/${id}`, data),
  deleteTeacher: (id: string) => api.delete<{ ok: boolean }>(`/admin/landing/teachers/${id}`),

  // Certificates
  getCertificates: () => api.get<LandingCertificate[]>('/admin/landing/certificates'),
  createCertificate: (data: Partial<LandingCertificate>) => api.post<LandingCertificate>('/admin/landing/certificates', data),
  updateCertificate: (id: string, data: Partial<LandingCertificate>) => api.put<LandingCertificate>(`/admin/landing/certificates/${id}`, data),
  deleteCertificate: (id: string) => api.delete<{ ok: boolean }>(`/admin/landing/certificates/${id}`),

  // Testimonials
  getTestimonials: () => api.get<LandingTestimonial[]>('/admin/landing/testimonials'),
  createTestimonial: (data: Partial<LandingTestimonial>) => api.post<LandingTestimonial>('/admin/landing/testimonials', data),
  updateTestimonial: (id: string, data: Partial<LandingTestimonial>) => api.put<LandingTestimonial>(`/admin/landing/testimonials/${id}`, data),
  deleteTestimonial: (id: string) => api.delete<{ ok: boolean }>(`/admin/landing/testimonials/${id}`),

  // FAQs
  getFaqs: () => api.get<LandingFaq[]>('/admin/landing/faqs'),
  createFaq: (data: Partial<LandingFaq>) => api.post<LandingFaq>('/admin/landing/faqs', data),
  updateFaq: (id: string, data: Partial<LandingFaq>) => api.put<LandingFaq>(`/admin/landing/faqs/${id}`, data),
  deleteFaq: (id: string) => api.delete<{ ok: boolean }>(`/admin/landing/faqs/${id}`),

  // Location Map URL
  getMapUrl: () => api.get<{ mapUrl: string }>('/admin/landing/map-url'),
  updateMapUrl: (mapUrl: string) => api.post<{ ok: boolean; mapUrl: string }>('/admin/landing/map-url', { mapUrl }),

  // Socials & Contact Info
  getSocials: () => api.get<LandingSocials>('/admin/landing/socials'),
  updateSocials: (data: Partial<LandingSocials>) => api.post<{ ok: boolean; socials: LandingSocials }>('/admin/landing/socials', data),

  // Image Upload
  uploadImage: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<{ fileName: string; url: string }>('/admin/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
