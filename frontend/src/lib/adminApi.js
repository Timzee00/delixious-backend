import api from './api.js';

export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  listRestaurants: (params) => api.get('/admin/restaurants', { params }),
  setRestaurantApproval: (id, status) => api.patch(`/admin/restaurants/${id}/approval`, { status }),
  listRiders: (params) => api.get('/admin/riders', { params }),
  setRiderApproval: (id, status) => api.patch(`/admin/riders/${id}/approval`, { status }),
  listUsers: (params) => api.get('/admin/users', { params }),
  setUserSuspension: (id, suspended) => api.patch(`/admin/users/${id}/suspend`, { suspended }),
  listOrders: (params) => api.get('/admin/orders', { params }),
  sendBroadcast: (payload) => api.post('/admin/broadcast', payload),
};
