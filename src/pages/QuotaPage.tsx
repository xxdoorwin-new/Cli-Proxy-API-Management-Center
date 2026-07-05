/**
 * Quota management page - coordinates the three quota sections.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useAuthStore } from '@/stores';
import { authFilesApi } from '@/services/api';
import {
  QuotaSection,
  ANTIGRAVITY_CONFIG,
  CLAUDE_CONFIG,
  CODEX_CONFIG,
  KIMI_CONFIG,
  XAI_CONFIG,
} from '@/components/quota';
import type { AuthFileItem } from '@/types';
import styles from './QuotaPage.module.scss';

export function QuotaPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const authMode = useAuthStore((state) => state.authMode);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setUserCanViewQuota = useAuthStore((state) => state.setUserCanViewQuota);

  const [files, setFiles] = useState<AuthFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const disableControls = connectionStatus !== 'connected';
  const allowQuotaReset = authMode !== 'user';
  const userOnly = authMode === 'user' && currentUser?.role !== 'admin';

  const isPermissionError = (err: unknown): boolean => {
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      if (msg.includes('admin') || msg.includes('forbidden') || msg.includes('403')) return true;
    }
    const apiErr = err as { status?: number };
    return apiErr?.status === 403;
  };

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authFilesApi.list();
      setFiles(data?.files || []);
      if (userOnly) {
        setUserCanViewQuota(true);
      }
    } catch (err: unknown) {
      if (userOnly && isPermissionError(err)) {
        setUserCanViewQuota(false);
        navigate('/', { replace: true });
        return;
      }
      const errorMessage = err instanceof Error ? err.message : t('notification.refresh_failed');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [t, userOnly, setUserCanViewQuota, navigate]);

  useHeaderRefresh(loadFiles);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('quota_management.title')}</h1>
        <p className={styles.description}>{t('quota_management.description')}</p>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <QuotaSection
        config={CLAUDE_CONFIG}
        files={files}
        loading={loading}
        disabled={disableControls}
        allowReset={allowQuotaReset}
      />
      <QuotaSection
        config={ANTIGRAVITY_CONFIG}
        files={files}
        loading={loading}
        disabled={disableControls}
        allowReset={allowQuotaReset}
      />
      <QuotaSection
        config={CODEX_CONFIG}
        files={files}
        loading={loading}
        disabled={disableControls}
        allowReset={allowQuotaReset}
      />
      <QuotaSection
        config={XAI_CONFIG}
        files={files}
        loading={loading}
        disabled={disableControls}
        allowReset={allowQuotaReset}
      />
      <QuotaSection
        config={KIMI_CONFIG}
        files={files}
        loading={loading}
        disabled={disableControls}
        allowReset={allowQuotaReset}
      />
    </div>
  );
}
