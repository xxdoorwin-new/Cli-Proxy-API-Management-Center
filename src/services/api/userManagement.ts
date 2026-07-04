import { apiClient } from './client';
import type { UserPrincipal, UserRegistrationRequest, UserSession } from '@/types';

export interface UserAPIKey {
  id: string;
  user_id: string;
  name: string;
  prefix: string;
  status: string;
  configured_key_fingerprint: string;
  configured_key_present: boolean;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  last_used_at?: string;
}

export interface ConfiguredAPIKey {
  fingerprint: string;
  prefix: string;
  assigned: boolean;
  assigned_user_id?: string;
  assigned_key_id?: string;
  assigned_key_name?: string;
  assigned_status?: string;
  last_used_at?: string;
  configured_present: boolean;
}

export interface UserManagementSettings {
  enabled: boolean;
}

export interface ModelPolicy {
  subject_type: string;
  subject_id: string;
  allow_all: boolean;
  models: string[];
}

export interface QuotaSummary {
  user_id: string;
  period: string;
  limit_credits: number;
  used_credits: number;
  remaining_credits: number;
  period_start: string;
  period_end: string;
}

export interface UsageLedgerRow {
  id: string;
  user_id: string;
  api_key_id: string;
  request_id: string;
  provider: string;
  model: string;
  model_alias: string;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  reasoning_tokens: number;
  image_count: number;
  credit_cost: number;
  status: string;
  error_code?: string;
  latency_millis: number;
  created_at: string;
}

export interface UsageSummary {
  quota: QuotaSummary;
  recent_usage: UsageLedgerRow[];
}

export interface QuotaPolicy {
  user_id: string;
  period: string;
  limit_credits: number;
  created_at: string;
  updated_at: string;
}

export interface PricingRule {
  model: string;
  input_credits_per_million_tokens: number;
  output_credits_per_million_tokens: number;
  cached_credits_per_million_tokens: number;
  reasoning_credits_per_million_tokens: number;
  image_credits: number;
  request_credits: number;
  created_at: string;
  updated_at: string;
}

export const userSessionApi = {
  register: (request: Omit<UserRegistrationRequest, 'apiBase'>) =>
    apiClient.post<{ user: UserPrincipal }>('/v0/user/register', request, {
      headers: { 'X-CPA-Skip-Auth': 'true' },
    }),

  login: (identity: string, password: string) =>
    apiClient.post<{ session: UserSession }>('/v0/user/login', { identity, password }),

  session: () => apiClient.get<{ session: UserSession }>('/v0/user/session'),

  logout: () => apiClient.post<{ status: string }>('/v0/user/logout'),

  profile: () => apiClient.get<{ user: UserPrincipal }>('/v0/user/profile'),

  apiKeys: () => apiClient.get<{ api_keys: UserAPIKey[] }>('/v0/user/api-keys'),

  models: () => apiClient.get<{ model_policy: ModelPolicy }>('/v0/user/models'),

  quota: () => apiClient.get<{ quota: QuotaSummary }>('/v0/user/quota'),

  usage: (limit = 50, offset = 0) =>
    apiClient.get<{ usage: UsageSummary }>(`/v0/user/usage?limit=${limit}&offset=${offset}`),
};

export const userAdminApi = {
  getUserManagementSettings: () =>
    apiClient.get<UserManagementSettings>('/v0/management/user-management/settings'),

  updateUserManagementSettings: (enabled: boolean) =>
    apiClient.patch<UserManagementSettings>('/v0/management/user-management/settings', {
      enabled,
    }),

  listUsers: (params: { status?: string; role?: string; query?: string } = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const qs = search.toString();
    return apiClient.get<{ users: UserPrincipal[] }>(`/v0/management/users${qs ? `?${qs}` : ''}`);
  },

  pendingUsers: () => apiClient.get<{ users: UserPrincipal[] }>('/v0/management/users/pending'),

  approveUser: (id: string, role = 'user') =>
    apiClient.post<{ user: UserPrincipal }>(`/v0/management/users/${id}/approve`, { role }),

  rejectUser: (id: string) =>
    apiClient.post<{ user: UserPrincipal }>(`/v0/management/users/${id}/reject`),

  suspendUser: (id: string) =>
    apiClient.post<{ user: UserPrincipal }>(`/v0/management/users/${id}/suspend`),

  reactivateUser: (id: string) =>
    apiClient.post<{ user: UserPrincipal }>(`/v0/management/users/${id}/reactivate`),

  listUserKeys: (userID: string) =>
    apiClient.get<{ api_keys: UserAPIKey[] }>(`/v0/management/users/${userID}/api-keys`),

  listConfiguredKeys: () =>
    apiClient.get<{ api_keys: ConfiguredAPIKey[] }>('/v0/management/configured-api-keys'),

  bindUserKey: (userID: string, configuredKeyFingerprint: string, name: string) =>
    apiClient.post<{ api_key: UserAPIKey }>(`/v0/management/users/${userID}/api-keys`, {
      name,
      configured_key_fingerprint: configuredKeyFingerprint,
    }),

  disableUserKey: (userID: string, keyID: string) =>
    apiClient.post<{ api_key: UserAPIKey }>(
      `/v0/management/users/${userID}/api-keys/${keyID}/disable`
    ),

  enableUserKey: (userID: string, keyID: string) =>
    apiClient.post<{ api_key: UserAPIKey }>(
      `/v0/management/users/${userID}/api-keys/${keyID}/enable`
    ),

  unbindUserKey: (userID: string, keyID: string) =>
    apiClient.delete<{ status: string }>(`/v0/management/users/${userID}/api-keys/${keyID}`),

  getUserQuotaSummary: (userID: string) =>
    apiClient.get<{ quota: QuotaSummary }>(`/v0/management/users/${userID}/quota-summary`),

  getUserUsage: (userID: string, limit = 20, offset = 0) =>
    apiClient.get<{ usage: UsageSummary }>(`/v0/management/users/${userID}/usage?limit=${limit}&offset=${offset}`),

  getUserModelPolicy: (userID: string) =>
    apiClient.get<{ model_policy: ModelPolicy }>(`/v0/management/users/${userID}/model-policy`),

  setUserModelPolicy: (userID: string, policy: { allow_all: boolean; models: string[] }) =>
    apiClient.put<{ model_policy: ModelPolicy }>(
      `/v0/management/users/${userID}/model-policy`,
      policy
    ),

  getUserQuotaPolicy: (userID: string) =>
    apiClient.get<{ quota_policy: QuotaPolicy }>(`/v0/management/users/${userID}/quota-policy`),

  setUserQuotaPolicy: (userID: string, policy: { period: string; limit_credits: number }) =>
    apiClient.put<{ quota_policy: QuotaPolicy }>(
      `/v0/management/users/${userID}/quota-policy`,
      policy
    ),

  listPricingRules: () =>
    apiClient.get<{ pricing_rules: PricingRule[] }>('/v0/management/pricing-rules'),

  setPricingRule: (rule: Partial<PricingRule> & { model: string }) =>
    apiClient.put<{ pricing_rule: PricingRule }>('/v0/management/pricing-rules', rule),

  deletePricingRule: (model: string) =>
    apiClient.delete<{ status: string }>(`/v0/management/pricing-rules?model=${encodeURIComponent(model)}`),
};
