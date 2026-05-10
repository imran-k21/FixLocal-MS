
import axios from "./axios";

const PAGE_SIZE = 10;

export const adminService = {
  getStats: () => axios.get("/admin/stats"),
  getUsers: (page = 0, search = "") =>
    axios.get(
      `/admin/users?page=${page}&size=${PAGE_SIZE}${search ? `&search=${encodeURIComponent(search)}` : ""}`
    ),
  getTradespersons: (page = 0, search = "") =>
    axios.get(
      `/admin/trades?page=${page}&size=${PAGE_SIZE}${search ? `&search=${encodeURIComponent(search)}` : ""}`
    ),
  getDisputes: () => axios.get("/disputes"),
  getDisputeById: (id) => axios.get(`/disputes/${id}`),
  updateDispute: (id, data) => axios.put(`/disputes/${id}`, data),
  blockUser: (userId) => axios.put(`/admin/users/${userId}/block`),
  unblockUser: (userId) => axios.put(`/admin/users/${userId}/unblock`),
  deleteUser: (userId) => axios.delete(`/admin/users/${userId}`),
  addDisputeNote: (id, payload) => axios.post(`/disputes/${id}/messages`, payload),
};

export const getAdminStats = () => adminService.getStats();
export const getAllDisputes = () => adminService.getDisputes();
export const updateDispute = (id, data) => adminService.updateDispute(id, data);
