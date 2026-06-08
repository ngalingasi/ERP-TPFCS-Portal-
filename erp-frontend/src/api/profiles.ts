import client from './client';
import type { SoftwareProfile } from '../types';

export const profilesApi = {
  list: (activeOnly = true) =>
    client.get<{ status: boolean; results: number; data: SoftwareProfile[] }>(
      `/profiles${activeOnly ? '' : '?active=false'}`
    ),

  get: (id: number) =>
    client.get<{ status: boolean; data: SoftwareProfile }>(`/profiles/${id}`),

  create: (body: Partial<SoftwareProfile> & { erp_secret: string }) =>
    client.post<{ status: boolean; data: SoftwareProfile }>('/profiles', body),

  update: (id: number, body: Partial<SoftwareProfile> & { erp_secret?: string }) =>
    client.patch<{ status: boolean; data: SoftwareProfile }>(`/profiles/${id}`, body),

  setDefault: (id: number) =>
    client.patch<{ status: boolean; data: SoftwareProfile }>(`/profiles/${id}/set-default`),

  remove: (id: number) =>
    client.delete(`/profiles/${id}`),
};
