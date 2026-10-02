import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  // Auth now rides in an httpOnly cookie set by the backend; send it on every request.
  withCredentials: true,
});

// ─── Response interceptor: handle 401 ────────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect on the auth-probe call itself (App bootstrap handles that)
      const url = error.config?.url || '';
      if (!url.includes('/auth/me') && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  socialLogin: (token) => api.post('/auth/social', { token }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/me', data),
  getPlatformAffiliates: () => api.get('/auth/me/platform-affiliates'),
  getEmailPreferences: () => api.get('/auth/me/email-preferences'),
  updateEmailPreferences: (data) => api.patch('/auth/me/email-preferences', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  saveFcmToken: (token) => api.post('/auth/fcm-token', { token }),
};

// ─── Communities ──────────────────────────────────────────────────────────────
export const communityApi = {
  list: (params) => api.get('/communities', { params }),
  get: (id) => api.get(`/communities/${id}`),
  getByDomain: (domain) => api.get(`/communities/domain/${domain}`),
  create: (data) => api.post('/communities', data),
  update: (id, data) => api.patch(`/communities/${id}`, data),
  join: (id, data) => api.post(`/communities/${id}/join`, data),
  leave: (id) => api.delete(`/communities/${id}/leave`),
  exportMembers: (id) => api.get(`/communities/${id}/export-members`, { responseType: 'blob' }),
  updateMemberRole: (communityId, userId, role) =>
    api.patch(`/communities/${communityId}/members/${userId}/role`, { role }),
  removeMember: (communityId, userId) =>
    api.delete(`/communities/${communityId}/members/${userId}`),
  getPendingMembers: (communityId) => 
    api.get(`/communities/${communityId}/members/pending`),
  updateMemberStatus: (communityId, userId, status) => 
    api.put(`/communities/${communityId}/members/${userId}/status`, { status }),
  sendBroadcast: (communityId, payload) =>
    api.post(`/communities/${communityId}/broadcast`, payload),
  getAnalytics: (id) => api.get(`/communities/${id}/analytics`),
};

// ─── Tiers ────────────────────────────────────────────────────────────────────
export const tierApi = {
  list: (communityId) => api.get(`/communities/${communityId}/tiers`),
  create: (communityId, data) => api.post(`/communities/${communityId}/tiers`, data),
  update: (communityId, tierId, data) => api.put(`/communities/${communityId}/tiers/${tierId}`, data),
  delete: (communityId, tierId) => api.delete(`/communities/${communityId}/tiers/${tierId}`),
};

// ─── Posts ────────────────────────────────────────────────────────────────────
export const postApi = {
  list: (communityId, params) => api.get(`/posts/${communityId}`, { params }),
  get: (communityId, postId) => api.get(`/posts/${communityId}/${postId}`),
  create: (communityId, data) => api.post(`/posts/${communityId}`, data),
  update: (communityId, postId, data) => api.patch(`/posts/${communityId}/${postId}`, data),
  delete: (communityId, postId) => api.delete(`/posts/${communityId}/${postId}`),
  toggleLike: (communityId, postId) => api.post(`/posts/${communityId}/${postId}/like`),
  togglePin: (communityId, postId) => api.post(`/posts/${communityId}/${postId}/pin`),
  addComment: (communityId, postId, data) => api.post(`/posts/${communityId}/${postId}/comments`, data),
  deleteComment: (communityId, postId, commentId) =>
    api.delete(`/posts/${communityId}/${postId}/comments/${commentId}`),
  toggleCommentLike: (communityId, postId, commentId) =>
    api.post(`/posts/${communityId}/${postId}/comments/${commentId}/like`),
  votePoll: (communityId, postId, optionId) =>
    api.post(`/posts/${communityId}/${postId}/poll-vote`, { option_id: optionId }),
  summarize: (communityId, postId) => api.post(`/posts/${communityId}/${postId}/summarize`),
};

// ─── Courses ──────────────────────────────────────────────────────────────────
export const courseApi = {
  list: (communityId) => api.get(`/courses/${communityId}`),
  get: (communityId, courseId) => api.get(`/courses/${communityId}/${courseId}`),
  create: (communityId, data) => api.post(`/courses/${communityId}`, data),
  generateOutline: (communityId, topic) => api.post(`/courses/${communityId}/generate-outline`, { topic }),
  update: (communityId, courseId, data) => api.patch(`/courses/${communityId}/${courseId}`, data),
  delete: (communityId, courseId) => api.delete(`/courses/${communityId}/${courseId}`),
  createModule: (communityId, courseId, data) =>
    api.post(`/courses/${communityId}/${courseId}/modules`, data),
  updateModule: (communityId, courseId, moduleId, data) =>
    api.patch(`/courses/${communityId}/${courseId}/modules/${moduleId}`, data),
  deleteModule: (communityId, courseId, moduleId) =>
    api.delete(`/courses/${communityId}/${courseId}/modules/${moduleId}`),
  createLesson: (communityId, courseId, moduleId, data) =>
    api.post(`/courses/${communityId}/${courseId}/modules/${moduleId}/lessons`, data),
  updateLesson: (communityId, courseId, moduleId, lessonId, data) =>
    api.patch(`/courses/${communityId}/${courseId}/modules/${moduleId}/lessons/${lessonId}`, data),
  deleteLesson: (communityId, courseId, moduleId, lessonId) =>
    api.delete(`/courses/${communityId}/${courseId}/modules/${moduleId}/lessons/${lessonId}`),
  completeLesson: (communityId, courseId, lessonId) =>
    api.post(`/courses/${communityId}/${courseId}/lessons/${lessonId}/complete`),
  submitQuiz: (communityId, courseId, lessonId, answers) =>
    api.post(`/courses/${communityId}/${courseId}/lessons/${lessonId}/quiz`, { answers }),
  getCertificate: (communityId, courseId) =>
    api.get(`/courses/${communityId}/${courseId}/certificate`),
  getProgress: (communityId, courseId) =>
    api.get(`/courses/${communityId}/${courseId}/progress`),
  getVideoUploadUrl: (communityId, courseId) =>
    api.post(`/courses/${communityId}/${courseId}/lessons/upload-url`),
};

// ─── Events ───────────────────────────────────────────────────────────────────
export const eventApi = {
  list: (communityId, params) => api.get(`/events/${communityId}`, { params }),
  get: (communityId, eventId) => api.get(`/events/${communityId}/${eventId}`),
  create: (communityId, data) => api.post(`/events/${communityId}`, data),
  rsvp: (communityId, eventId) => api.post(`/events/${communityId}/${eventId}/rsvp`),
  unrsvp: (communityId, eventId) => api.delete(`/events/${communityId}/${eventId}/rsvp`),
};

// ─── Members ──────────────────────────────────────────────────────────────────
export const memberApi = {
  list: (communityId, params) => api.get(`/members/${communityId}`, { params }),
  get: (communityId, userId) => api.get(`/members/${communityId}/${userId}`),
};

// ─── Gamification ─────────────────────────────────────────────────────────────
export const gamificationApi = {
  leaderboard: (communityId) => api.get(`/gamification/${communityId}/leaderboard`),
  getPointRules: (communityId) => api.get(`/gamification/${communityId}/point-rules`),
  updatePointRules: (communityId, rules) => api.patch(`/gamification/${communityId}/point-rules`, { rules }),
  getBadges: (communityId) => api.get(`/gamification/${communityId}/badges`),
  createBadge: (communityId, data) => api.post(`/gamification/${communityId}/badges`, data),
};

// ─── Spaces ───────────────────────────────────────────────────────────────────
export const spaceApi = {
  list: (communityId) => api.get(`/communities/${communityId}/spaces`),
  get: (communityId, spaceSlug) => api.get(`/communities/${communityId}/spaces/${spaceSlug}`),
  create: (communityId, data) => api.post(`/communities/${communityId}/spaces`, data),
  update: (communityId, spaceId, data) => api.patch(`/communities/${communityId}/spaces/${spaceId}`, data),
  delete: (communityId, spaceId) => api.delete(`/communities/${communityId}/spaces/${spaceId}`),
  reorder: (communityId, order) => api.post(`/communities/${communityId}/spaces/reorder`, { order }),
  listMessages: (communityId, spaceId, params) => api.get(`/communities/${communityId}/spaces/${spaceId}/messages`, { params }),
  sendMessage: (communityId, spaceId, content) => api.post(`/communities/${communityId}/spaces/${spaceId}/messages`, { content }),
};

// ─── Billing ──────────────────────────────────────────────────────────────────
export const billingApi = {
  createCheckout: (communityId, tierId, interval = 'month', referrerId = null) => api.post('/billing/checkout', { communityId, tierId, interval, referrerId }),
  createCourseCheckout: (communityId, courseId) => api.post('/billing/course-checkout', { communityId, courseId }),
  createProductCheckout: (communityId, productId) => api.post('/billing/product-checkout', { communityId, productId }),
  createPortalSession: () => api.post('/billing/portal'),
  mySubscriptions: () => api.get('/billing/subscriptions'),
  creatorDashboard: () => api.get('/billing/creator-dashboard'),
  startConnectOnboarding: (communityId) => api.post('/billing/connect/onboard', { communityId }),
  getConnectStatus: (communityId) => api.get(`/billing/connect/${communityId}/status`),
  startAffiliateOnboarding: () => api.post('/billing/connect/affiliate/onboard'),
  getAffiliateConnectStatus: () => api.get('/billing/connect/affiliate/status'),
};

// ─── Uploads ──────────────────────────────────────────────────────────────────
export const uploadApi = {
  getPresignedUrl: (filename, contentType) => api.post('/upload/presigned-url', { filename, contentType }),
  getMuxUploadUrl: () => api.post('/upload/mux-upload-url'),
  getMuxUploadStatus: (uploadId) => api.get(`/upload/mux-upload/${uploadId}`),
  uploadToS3: (presignedUrl, file) => 
    axios.put(presignedUrl, file, { headers: { 'Content-Type': file.type } }),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationApi = {
  list: (params) => api.get('/notifications', { params }),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/read-all'),
};

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messageApi = {
  getConversations: () => api.get('/messages'),
  getMessages: (conversationId) => api.get(`/messages/${conversationId}`),
  sendMessage: (data) => api.post('/messages', data), // { conversationId, recipientId, content }
};

// ─── Search ───────────────────────────────────────────────────────────────────
export const searchApi = {
  query: (q, communitySlug) => api.get('/search', { params: { q, communitySlug } }),
};

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsApi = {
  getDashboardStats: (communityId) => api.get(`/communities/${communityId}/analytics`),
};

// ─── Webhooks ─────────────────────────────────────────────────────────────────
export const webhookApi = {
  list: (communityId) => api.get(`/communities/${communityId}/webhooks`),
  create: (communityId, data) => api.post(`/communities/${communityId}/webhooks`, data),
  update: (communityId, webhookId, data) => api.put(`/communities/${communityId}/webhooks/${webhookId}`, data),
  delete: (communityId, webhookId) => api.delete(`/communities/${communityId}/webhooks/${webhookId}`),
  deliveries: (communityId, webhookId) => api.get(`/communities/${communityId}/webhooks/${webhookId}/deliveries`),
};

// ─── Products (digital storefront) ────────────────────────────────────────────
export const productApi = {
  list: (communityId) => api.get(`/communities/${communityId}/products`),
  listManage: (communityId) => api.get(`/communities/${communityId}/products/manage`),
  create: (communityId, data) => api.post(`/communities/${communityId}/products`, data),
  update: (communityId, productId, data) => api.patch(`/communities/${communityId}/products/${productId}`, data),
  delete: (communityId, productId) => api.delete(`/communities/${communityId}/products/${productId}`),
  getDownload: (communityId, productId) => api.get(`/communities/${communityId}/products/${productId}/download`),
};

// ─── API Keys (public API / Zapier) ──────────────────────────────────────────
export const apiKeyApi = {
  list: (communityId) => api.get(`/communities/${communityId}/api-keys`),
  create: (communityId, name) => api.post(`/communities/${communityId}/api-keys`, { name }),
  revoke: (communityId, keyId) => api.delete(`/communities/${communityId}/api-keys/${keyId}`),
};

// ─── Reports / Moderation ───────────────────────────────────────────────────
export const reportApi = {
  create: (communityId, data) => api.post(`/communities/${communityId}/reports`, data),
  list: (communityId, status = 'open') => api.get(`/communities/${communityId}/reports`, { params: { status } }),
  resolve: (communityId, reportId, action) => api.patch(`/communities/${communityId}/reports/${reportId}`, { action }),
};

// Affiliates
export const affiliateApi = {
  getConfig: (communityId) => api.get(`/communities/${communityId}/affiliates/config`).then(res => res.data),
  updateConfig: (communityId, config) => api.put(`/communities/${communityId}/affiliates/config`, config).then(res => res.data),
  getLeaderboard: (communityId) => api.get(`/communities/${communityId}/affiliates/leaderboard`).then(res => res.data),
  getMyStats: (communityId) => api.get(`/communities/${communityId}/affiliates/me`).then(res => res.data),
  getOwed: (communityId) => api.get(`/communities/${communityId}/affiliates/owed`).then(res => res.data),
  payout: (communityId, referrerId) => api.post(`/communities/${communityId}/affiliates/payout`, { referrerId }).then(res => res.data),
};

export default api;
