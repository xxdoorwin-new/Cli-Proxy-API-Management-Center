import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { userSessionApi, type ModelPolicy, type QuotaSummary, type UsageSummary, type UserAPIKey } from '@/services/api';
import { useAuthStore } from '@/stores';
import { copyToClipboard } from '@/utils/clipboard';
import styles from './UserDashboardPage.module.scss';

function maskAPIKey(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return trimmed || '-';
  return `${trimmed.slice(0, 2)}${'*'.repeat(8)}${trimmed.slice(-2)}`;
}

export function UserDashboardPage() {
  const { t } = useTranslation();
  const currentUser = useAuthStore((state) => state.currentUser);
  const [keys, setKeys] = useState<UserAPIKey[]>([]);
  const [models, setModels] = useState<ModelPolicy | null>(null);
  const [quota, setQuota] = useState<QuotaSummary | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [error, setError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [copiedKeyId, setCopiedKeyId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [keyRes, modelRes, quotaRes, usageRes] = await Promise.all([
        userSessionApi.apiKeys(),
        userSessionApi.models(),
        userSessionApi.quota(),
        userSessionApi.usage(20),
      ]);
      setKeys(keyRes.api_keys);
      setModels(modelRes.model_policy);
      setQuota(quotaRes.quota);
      setUsage(usageRes.usage);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('userDashboard.failedLoad'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allowedModels = models?.allow_all ? ['All models'] : models?.models || [];

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage('');
    if (newPassword !== confirmPassword) {
      setPasswordMessage(t('userDashboard.passwordsNoMatch'));
      return;
    }
    setPasswordSaving(true);
    try {
      await userSessionApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage(t('userDashboard.passwordUpdated'));
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : t('userDashboard.failedUpdatePassword'));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleCopyAPIKey = async (key: UserAPIKey) => {
    if (!key.api_key) return;
    const copied = await copyToClipboard(key.api_key);
    setCopiedKeyId(copied ? key.id : '');
    window.setTimeout(() => {
      setCopiedKeyId((current) => (current === key.id ? '' : current));
    }, 1800);
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('userDashboard.title')}</h1>
        <p className={styles.description}>
          {currentUser?.username || currentUser?.email || 'Current user'} usage and access overview.
        </p>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.label}>{t('userDashboard.usedCredits')}</div>
          <div className={styles.value}>{quota?.used_credits ?? '-'}</div>
          <div className={styles.muted}>{t('userDashboard.creditLimit')} {quota?.limit_credits ?? '-'}</div>
        </section>
        <section className={styles.panel}>
          <div className={styles.label}>{t('userDashboard.remainingCredits')}</div>
          <div className={styles.value}>{quota?.remaining_credits ?? '-'}</div>
          <div className={styles.muted}>{quota?.period || t('userDashboard.period')}</div>
        </section>
        <section className={styles.panel}>
          <div className={styles.label}>{t('userDashboard.apiKeys')}</div>
          <div className={styles.value}>{keys.length}</div>
          <div className={styles.muted}>{t('userDashboard.apiKeysDesc')}</div>
        </section>

        <section className={`${styles.panel} ${styles.panelWide}`}>
          <div className={styles.label}>{t('userDashboard.allowedModels')}</div>
          <div className={styles.list}>
            {allowedModels.length > 0 ? (
              allowedModels.map((model) => (
                <span className={styles.pill} key={model}>
                  {model}
                </span>
              ))
            ) : (
              <span className={styles.muted}>{t('userDashboard.noModelsAssigned')}</span>
            )}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.panelWide}`}>
          <div className={styles.label}>{t('userDashboard.changePassword')}</div>
          <form className={styles.formGrid} onSubmit={handleChangePassword}>
            <label className={styles.fieldLabel}>
              {t('userDashboard.currentPassword')}
              <input
                className={styles.input}
                type="password"
                value={currentPassword}
                autoComplete="current-password"
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label className={styles.fieldLabel}>
              {t('userDashboard.newPassword')}
              <input
                className={styles.input}
                type="password"
                value={newPassword}
                autoComplete="new-password"
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label className={styles.fieldLabel}>
              {t('userDashboard.confirmNewPassword')}
              <input
                className={styles.input}
                type="password"
                value={confirmPassword}
                autoComplete="new-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            <div className={styles.formActions}>
              <button
                className={styles.button}
                type="submit"
                disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              >
                {passwordSaving ? t('userDashboard.updating') : t('userDashboard.updatePassword')}
              </button>
              {passwordMessage ? <span className={styles.muted}>{passwordMessage}</span> : null}
            </div>
          </form>
        </section>

        <section className={`${styles.panel} ${styles.panelWide}`}>
          <div className={styles.label}>{t('userDashboard.apiKeyMetadata')}</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('userDashboard.colName')}</th>
                <th>{t('userDashboard.colApiKey')}</th>
                <th>{t('userDashboard.colStatus')}</th>
                <th>{t('userDashboard.colLastUsed')}</th>
                <th>{t('userDashboard.colAction')}</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td className={styles.monospace}>{maskAPIKey(key.api_key || key.prefix)}</td>
                  <td>{key.status}</td>
                  <td>{key.last_used_at || '-'}</td>
                  <td>
                    <button
                      className={styles.buttonSmall}
                      type="button"
                      disabled={!key.api_key}
                      onClick={() => void handleCopyAPIKey(key)}
                    >
                      {copiedKeyId === key.id ? t('userDashboard.copied') : t('userDashboard.copy')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={`${styles.panel} ${styles.panelWide}`}>
          <div className={styles.label}>{t('userDashboard.recentUsage')}</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('userDashboard.colTime')}</th>
                <th>{t('userDashboard.colModel')}</th>
                <th>{t('userDashboard.colInput')}</th>
                <th>{t('userDashboard.colOutput')}</th>
                <th>{t('userDashboard.colPrefill')}</th>
                <th>{t('userDashboard.colReasoning')}</th>
                <th>{t('userDashboard.colCredits')}</th>
                <th>{t('userDashboard.colStatus')}</th>
                <th>{t('userDashboard.colLatency')}</th>
              </tr>
            </thead>
            <tbody>
              {(usage?.recent_usage || []).map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td>{row.model_alias || row.model}</td>
                  <td>{row.input_tokens}</td>
                  <td>{row.output_tokens}</td>
                  <td>{row.cached_tokens}</td>
                  <td>{row.reasoning_tokens}</td>
                  <td>{row.credit_cost}</td>
                  <td>{row.status}</td>
                  <td>{row.latency_millis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
