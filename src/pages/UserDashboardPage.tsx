import { useCallback, useEffect, useState } from 'react';
import { userSessionApi, type ModelPolicy, type QuotaSummary, type UsageSummary, type UserAPIKey } from '@/services/api';
import { useAuthStore } from '@/stores';
import styles from './UserDashboardPage.module.scss';

export function UserDashboardPage() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const [keys, setKeys] = useState<UserAPIKey[]>([]);
  const [models, setModels] = useState<ModelPolicy | null>(null);
  const [quota, setQuota] = useState<QuotaSummary | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [error, setError] = useState('');

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
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allowedModels = models?.allow_all ? ['All models'] : models?.models || [];

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>User dashboard</h1>
        <p className={styles.description}>
          {currentUser?.username || currentUser?.email || 'Current user'} usage and access overview.
        </p>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.label}>Used credits</div>
          <div className={styles.value}>{quota?.used_credits ?? '-'}</div>
          <div className={styles.muted}>Limit {quota?.limit_credits ?? '-'}</div>
        </section>
        <section className={styles.panel}>
          <div className={styles.label}>Remaining credits</div>
          <div className={styles.value}>{quota?.remaining_credits ?? '-'}</div>
          <div className={styles.muted}>{quota?.period || 'monthly'}</div>
        </section>
        <section className={styles.panel}>
          <div className={styles.label}>API keys</div>
          <div className={styles.value}>{keys.length}</div>
          <div className={styles.muted}>Active and historical keys</div>
        </section>

        <section className={`${styles.panel} ${styles.panelWide}`}>
          <div className={styles.label}>Allowed models</div>
          <div className={styles.list}>
            {allowedModels.length > 0 ? (
              allowedModels.map((model) => (
                <span className={styles.pill} key={model}>
                  {model}
                </span>
              ))
            ) : (
              <span className={styles.muted}>No models assigned</span>
            )}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.panelWide}`}>
          <div className={styles.label}>API key metadata</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Status</th>
                <th>Last used</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td>{key.prefix}</td>
                  <td>{key.status}</td>
                  <td>{key.last_used_at || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={`${styles.panel} ${styles.panelWide}`}>
          <div className={styles.label}>Recent usage</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Request</th>
                <th>Model</th>
                <th>Credits</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(usage?.recent_usage || []).map((row) => (
                <tr key={row.id}>
                  <td>{row.request_id}</td>
                  <td>{row.model_alias || row.model}</td>
                  <td>{row.credit_cost}</td>
                  <td>{row.status}</td>
                  <td>{row.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
