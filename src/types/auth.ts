/**
 * 认证相关类型定义
 * 基于原项目 src/modules/login.js 和 src/core/connection.js
 */

// 登录凭据
export interface LoginCredentials {
  apiBase: string;
  managementKey: string;
  rememberPassword?: boolean;
}

export interface UserLoginCredentials {
  apiBase: string;
  identity: string;
  password: string;
  rememberPassword?: boolean;
}

export interface UserRegistrationRequest {
  apiBase: string;
  username: string;
  email: string;
  password: string;
  display_name?: string;
}

export interface UserPrincipal {
  id: string;
  username: string;
  email: string;
  display_name?: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended' | string;
  role: 'user' | 'admin' | string;
}

export interface UserSession {
  token?: string;
  expires_at?: string;
  user: UserPrincipal;
}

export type AuthMode = 'management' | 'user' | null;

// 认证状态
export interface AuthState {
  isAuthenticated: boolean;
  authMode: AuthMode;
  apiBase: string;
  managementKey: string;
  userSessionToken: string;
  currentUser: UserPrincipal | null;
  rememberPassword: boolean;
  serverVersion: string | null;
  serverBuildDate: string | null;
  serverRuntimeKind: ServerRuntimeKind;
  supportsPlugin: boolean;
}

// 连接状态
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';
export type ServerRuntimeKind = 'unknown' | 'cpa' | 'home';

export interface ConnectionInfo {
  status: ConnectionStatus;
  lastCheck: Date | null;
  error: string | null;
}
