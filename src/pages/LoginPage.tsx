import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox';
import { IconEye, IconEyeOff } from '@/components/ui/icons';
import { useAuthStore, useLanguageStore, useNotificationStore } from '@/stores';
import { detectApiBaseFromLocation, normalizeApiBase } from '@/utils/connection';
import { LANGUAGE_LABEL_KEYS, LANGUAGE_ORDER } from '@/utils/constants';
import { isSupportedLanguage } from '@/utils/language';
import { INLINE_LOGO_JPEG } from '@/assets/logoInline';
import type { ApiError } from '@/types';
import styles from './LoginPage.module.scss';

/**
 * 将 API 错误转换为本地化的用户友好消息
 */
type RedirectState = { from?: { pathname?: string } };

function getLocalizedErrorMessage(
  error: unknown,
  t: (key: string) => string,
  mode?: 'management' | 'user' | 'register'
): string {
  const apiError = error as Partial<ApiError>;
  const status = typeof apiError.status === 'number' ? apiError.status : undefined;
  const code = typeof apiError.code === 'string' ? apiError.code : undefined;
  const message =
    error instanceof Error
      ? error.message
      : typeof apiError.message === 'string'
        ? apiError.message
        : typeof error === 'string'
          ? error
          : '';

  const withHttpStatus = (summary: string) => {
    if (!status) {
      return summary;
    }

    const genericAxiosMessage = `Request failed with status code ${status}`;
    const detail = message.trim();
    const backendDetail =
      detail && detail !== genericAxiosMessage
        ? ` (${t('login.error_backend_detail')}: ${detail})`
        : '';

    return `HTTP ${status}: ${summary}${backendDetail}`;
  };

  const msgLower = message.toLowerCase();

  // 注册模式的专属错误
  if (mode === 'register') {
    if (status === 409) {
      return withHttpStatus(t('login.error_register_duplicate'));
    }
    if (
      status === 400 &&
      (msgLower.includes('exist') ||
        msgLower.includes('duplicate') ||
        msgLower.includes('conflict') ||
        msgLower.includes('already') ||
        msgLower.includes('taken') ||
        msgLower.includes('已存在') ||
        msgLower.includes('重复'))
    ) {
      return withHttpStatus(t('login.error_register_duplicate'));
    }
    if (status && status >= 400 && status < 500) {
      return withHttpStatus(t('login.error_register_failed'));
    }
  }

  // 用户登录模式的专属错误
  if (mode === 'user') {
    if (status === 401) {
      return withHttpStatus(t('login.error_user_login_failed'));
    }
    if (status === 403) {
      if (msgLower.includes('pending') || msgLower.includes('审批') || msgLower.includes('approval')) {
        return withHttpStatus(t('login.error_user_pending'));
      }
      if (msgLower.includes('reject') || msgLower.includes('denied') || msgLower.includes('拒绝')) {
        return withHttpStatus(t('login.error_user_rejected'));
      }
      if (msgLower.includes('suspend') || msgLower.includes('暂停')) {
        return withHttpStatus(t('login.error_user_suspended'));
      }
      return withHttpStatus(t('login.error_user_forbidden'));
    }
  }

  // 通用 HTTP 状态码判断（管理员模式及兜底）
  if (status === 401) {
    return withHttpStatus(t('login.error_unauthorized'));
  }
  if (status === 403) {
    return withHttpStatus(t('login.error_forbidden'));
  }
  if (status === 404) {
    return withHttpStatus(t('login.error_not_found'));
  }
  if (status && status >= 500) {
    return withHttpStatus(t('login.error_server'));
  }

  // 根据 axios 错误码判断
  if (code === 'ECONNABORTED' || msgLower.includes('timeout')) {
    return t('login.error_timeout');
  }
  if (code === 'ERR_NETWORK' || msgLower.includes('network error')) {
    return t('login.error_network');
  }
  if (code === 'ERR_CERT_AUTHORITY_INVALID' || msgLower.includes('certificate')) {
    return t('login.error_ssl');
  }

  // 检查 CORS 错误
  if (msgLower.includes('cors') || msgLower.includes('cross-origin')) {
    return t('login.error_cors');
  }

  // 默认错误消息
  return withHttpStatus(t('login.error_invalid'));
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { showNotification } = useNotificationStore();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);
  const userLogin = useAuthStore((state) => state.userLogin);
  const registerUser = useAuthStore((state) => state.registerUser);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const storedBase = useAuthStore((state) => state.apiBase);
  const storedKey = useAuthStore((state) => state.managementKey);
  const storedRememberPassword = useAuthStore((state) => state.rememberPassword);

  const { mode: modeParam } = useParams<{ mode: string }>();
  const mode: 'management' | 'user' | 'register' =
    modeParam === 'user' || modeParam === 'register' ? modeParam : 'management';

  const [apiBase, setApiBase] = useState('');
  const [managementKey, setManagementKey] = useState('');
  const [identity, setIdentity] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [showCustomBase, setShowCustomBase] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(true);
  const [autoLoginSuccess, setAutoLoginSuccess] = useState(false);
  const [error, setError] = useState('');

  const detectedBase = useMemo(() => detectApiBaseFromLocation(), []);
  const languageOptions = useMemo(
    () =>
      LANGUAGE_ORDER.map((lang) => ({
        value: lang,
        label: t(LANGUAGE_LABEL_KEYS[lang])
      })),
    [t]
  );
  const handleLanguageChange = useCallback(
    (selectedLanguage: string) => {
      if (!isSupportedLanguage(selectedLanguage)) {
        return;
      }
      setLanguage(selectedLanguage);
    },
    [setLanguage]
  );

  useEffect(() => {
    const init = async () => {
      try {
        const autoLoggedIn = await restoreSession();
        if (autoLoggedIn) {
          setAutoLoginSuccess(true);
          // 延迟跳转，让用户看到成功动画
          setTimeout(() => {
            const redirect = (location.state as RedirectState | null)?.from?.pathname || '/';
            navigate(redirect, { replace: true });
          }, 1500);
        } else {
          setApiBase(storedBase || detectedBase);
          setManagementKey(storedKey || '');
          setRememberPassword(storedRememberPassword || Boolean(storedKey));
        }
      } finally {
        // 自动登录成功时 showSplash 仍由 autoLoginSuccess 维持，可无条件结束 loading
        setAutoLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = useCallback(async () => {
    if (mode === 'management' && !managementKey.trim()) {
      setError(t('login.error_required'));
      return;
    }
    if (mode === 'user' && (!identity.trim() || !userPassword.trim())) {
      setError(t('login.error_required'));
      return;
    }
    if (mode === 'register' && (!username.trim() || !email.trim() || !userPassword.trim())) {
      setError(t('login.error_required'));
      return;
    }

    const baseToUse = apiBase ? normalizeApiBase(apiBase) : detectedBase;
    setLoading(true);
    setError('');
    try {
      if (mode === 'user') {
        await userLogin({
          apiBase: baseToUse,
          identity: identity.trim(),
          password: userPassword,
          rememberPassword
        });
        showNotification(t('common.connected_status'), 'success');
        navigate('/', { replace: true });
        return;
      }
      if (mode === 'register') {
        await registerUser({
          apiBase: baseToUse,
          username: username.trim(),
          email: email.trim(),
          password: userPassword,
          display_name: displayName.trim() || undefined
        });
        showNotification(t('login.registration_submitted', { defaultValue: '注册申请已提交' }), 'success');
        setIdentity(username.trim() || email.trim());
        navigate('/login/user', { replace: true });
        return;
      }
      await login({
        apiBase: baseToUse,
        managementKey: managementKey.trim(),
        rememberPassword
      });
      showNotification(t('common.connected_status'), 'success');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message = getLocalizedErrorMessage(err, t, mode);
      setError(message);
      showNotification(`${t('notification.login_failed')}: ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [
    apiBase,
    detectedBase,
    displayName,
    email,
    identity,
    login,
    managementKey,
    mode,
    navigate,
    registerUser,
    rememberPassword,
    showNotification,
    t,
    userLogin,
    userPassword,
    username,
  ]);

  const handleSubmitKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !loading) {
        event.preventDefault();
        handleSubmit();
      }
    },
    [loading, handleSubmit]
  );

  if (isAuthenticated && !autoLoading && !autoLoginSuccess) {
    const redirect = (location.state as RedirectState | null)?.from?.pathname || '/';
    return <Navigate to={redirect} replace />;
  }

  // 显示启动动画（自动登录中或自动登录成功）
  const showSplash = autoLoading || autoLoginSuccess;

  return (
    <div className={styles.container}>
      {/* 左侧品牌展示区 */}
      <div className={styles.brandPanel}>
        <div className={styles.brandContent}>
          <span className={styles.brandWord}>User Auth  </span>
          <span className={styles.brandWord}>AI Proxy</span>
          <span className={styles.brandWord}></span>
        </div>
      </div>

      {/* 右侧功能交互区 */}
      <div className={styles.formPanel}>
        {showSplash ? (
          /* 启动动画 */
          <div className={styles.splashContent}>
            <img src={INLINE_LOGO_JPEG} alt="FREESHARE" className={styles.splashLogo} />
            <h1 className={styles.splashTitle}>{t('splash.title')}</h1>
            <p className={styles.splashSubtitle}>{t('splash.subtitle')}</p>
            <div className={styles.splashLoader}>
              <div className={styles.splashLoaderBar} />
            </div>
          </div>
        ) : (
          /* 登录表单 */
          <div className={styles.formContent}>
            {/* Logo */}
            <img src={INLINE_LOGO_JPEG} alt="Logo" className={styles.logo} />

            {/* 登录表单卡片 */}
            <div className={styles.loginCard}>
              <div className={styles.loginHeader}>
                <div className={styles.titleRow}>
                  <div className={styles.title}>{t('title.login')}</div>
                  <Select
                    className={styles.languageSelect}
                    value={language}
                    options={languageOptions}
                    onChange={handleLanguageChange}
                    fullWidth={false}
                    ariaLabel={t('language.switch')}
                  />
                </div>
                <div className={styles.subtitle}>{t('login.subtitle')}</div>
              </div>

              <div className={styles.modeTabs}>
                {(mode === 'management'
                  ? [
                      ['management', t('login.management_mode', { defaultValue: '管理密钥' })],
                      ['user', t('login.user_mode', { defaultValue: '用户登录' })],
                      ['register', t('login.register_mode', { defaultValue: '用户注册' })],
                    ]
                  : [
                      ['user', t('login.user_mode', { defaultValue: '用户登录' })],
                      ['register', t('login.register_mode', { defaultValue: '用户注册' })],
                    ]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.modeTab} ${mode === value ? styles.modeTabActive : ''}`}
                    onClick={() => {
                      setError('');
                      navigate(`/login/${value}`);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className={styles.connectionBox}>
                <div className={styles.label}>{t('login.connection_current')}</div>
                <div className={styles.value}>{apiBase || detectedBase}</div>
                <div className={styles.hint}>{t('login.connection_auto_hint')}</div>
              </div>

              <div className={styles.toggleAdvanced}>
                <SelectionCheckbox
                  checked={showCustomBase}
                  onChange={setShowCustomBase}
                  ariaLabel={t('login.custom_connection_label')}
                  label={t('login.custom_connection_label')}
                  labelClassName={styles.toggleLabel}
                />
              </div>

              {showCustomBase && (
                <Input
                  label={t('login.custom_connection_label')}
                  placeholder={t('login.custom_connection_placeholder')}
                  value={apiBase}
                  onChange={(e) => setApiBase(e.target.value)}
                  hint={t('login.custom_connection_hint')}
                />
              )}

              {mode === 'management' ? (
                <Input
                  autoFocus
                  label={t('login.management_key_label')}
                  placeholder={t('login.management_key_placeholder')}
                  type={showKey ? 'text' : 'password'}
                  name="cpa-management-key"
                  autoComplete="current-password"
                  value={managementKey}
                  onChange={(e) => setManagementKey(e.target.value)}
                  onKeyDown={handleSubmitKeyDown}
                  rightElement={
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShowKey((prev) => !prev)}
                      aria-label={
                        showKey
                          ? t('login.hide_key', { defaultValue: '隐藏密钥' })
                          : t('login.show_key', { defaultValue: '显示密钥' })
                      }
                      title={
                        showKey
                          ? t('login.hide_key', { defaultValue: '隐藏密钥' })
                          : t('login.show_key', { defaultValue: '显示密钥' })
                      }
                    >
                      {showKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    </button>
                  }
                />
              ) : (
                <>
                  {mode === 'register' && (
                    <>
                      <Input
                        autoFocus
                        label={t('login.username_label', { defaultValue: '用户名' })}
                        placeholder={t('login.username_placeholder', { defaultValue: '请输入用户名' })}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                      <Input
                        label={t('login.email_label', { defaultValue: '邮箱' })}
                        placeholder={t('login.email_placeholder', { defaultValue: '请输入邮箱' })}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <Input
                        label={t('login.display_name_label', { defaultValue: '显示名称' })}
                        placeholder={t('common.optional')}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </>
                  )}
                  {mode === 'user' && (
                    <Input
                      autoFocus
                      label={t('login.identity_label', { defaultValue: '用户名或邮箱' })}
                      placeholder={t('login.identity_placeholder', { defaultValue: '请输入用户名或邮箱' })}
                      value={identity}
                      onChange={(e) => setIdentity(e.target.value)}
                      onKeyDown={handleSubmitKeyDown}
                    />
                  )}
                  <Input
                    label={t('login.password_label', { defaultValue: '密码' })}
                    placeholder={t('login.password_placeholder', { defaultValue: '请输入密码' })}
                    type={showKey ? 'text' : 'password'}
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    onKeyDown={handleSubmitKeyDown}
                    rightElement={
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowKey((prev) => !prev)}
                        aria-label={
                          showKey
                            ? t('login.hide_key', { defaultValue: '隐藏密钥' })
                            : t('login.show_key', { defaultValue: '显示密钥' })
                        }
                        title={
                          showKey
                            ? t('login.hide_key', { defaultValue: '隐藏密钥' })
                            : t('login.show_key', { defaultValue: '显示密钥' })
                        }
                      >
                        {showKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                      </button>
                    }
                  />
                </>
              )}

              <div className={styles.toggleAdvanced}>
                <SelectionCheckbox
                  checked={rememberPassword}
                  onChange={setRememberPassword}
                  ariaLabel={t('login.remember_password_label')}
                  label={t('login.remember_password_label')}
                  labelClassName={styles.toggleLabel}
                />
              </div>

              <Button fullWidth onClick={handleSubmit} loading={loading}>
                {loading
                  ? t('login.submitting')
                  : mode === 'register'
                    ? t('login.register_submit', { defaultValue: '提交注册' })
                    : t('login.submit_button')}
              </Button>

              {error && <div className={styles.errorBox}>{error}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
