import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { userAdminApi, type ConfiguredAPIKey, type ModelPolicy, type PricingRule, type QuotaPolicy, type QuotaSummary, type UsageLedgerRow, type UserAPIKey } from '@/services/api';
import type { UserPrincipal } from '@/types';
import styles from './UserDashboardPage.module.scss';

export function UserManagementPage() {
  const { t } = useTranslation();
  const [userManagementEnabled, setUserManagementEnabled] = useState(false);
  const [allowUserViewTotalRemaining, setAllowUserViewTotalRemaining] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [users, setUsers] = useState<UserPrincipal[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserPrincipal | null>(null);
  const [keys, setKeys] = useState<UserAPIKey[]>([]);
  const [configuredKeys, setConfiguredKeys] = useState<ConfiguredAPIKey[]>([]);
  const [selectedConfiguredKey, setSelectedConfiguredKey] = useState('');
  const [bindingName, setBindingName] = useState('default');
  const [models, setModels] = useState('');
  const [quota, setQuota] = useState('0');
  const [quotaSummary, setQuotaSummary] = useState<QuotaSummary | null>(null);
  const [recentUsage, setRecentUsage] = useState<UsageLedgerRow[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  // Pricing rule form state
  const [prModel, setPrModel] = useState('');
  const [prInput, setPrInput] = useState('0');
  const [prOutput, setPrOutput] = useState('0');
  const [prCached, setPrCached] = useState('0');
  const [prReasoning, setPrReasoning] = useState('0');
  const [prImage, setPrImage] = useState('0');
  const [prRequest, setPrRequest] = useState('0');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setSettingsLoading(true);
      const settings = await userAdminApi.getUserManagementSettings();
      setUserManagementEnabled(settings.enabled);
      setAllowUserViewTotalRemaining(settings.allow_user_view_total_remaining);
      setSettingsLoading(false);
      if (!settings.enabled) {
        setUsers([]);
        setSelectedUser(null);
        setKeys([]);
        setConfiguredKeys([]);
        setSelectedConfiguredKey('');
        return;
      }
      const res = await userAdminApi.listUsers();
      setUsers(res.users);
      // Load pricing rules whenever user management is enabled
      try {
        const prRes = await userAdminApi.listPricingRules();
        setPricingRules(prRes.pricing_rules ?? []);
      } catch {
        setPricingRules([]);
      }
    } catch (err) {
      setSettingsLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const toggleUserManagement = async (enabled: boolean) => {
    const previous = userManagementEnabled;
    setUserManagementEnabled(enabled);
    setSettingsSaving(true);
    setError('');
    try {
      const settings = await userAdminApi.updateUserManagementSettings({ enabled });
      setUserManagementEnabled(settings.enabled);
      setAllowUserViewTotalRemaining(settings.allow_user_view_total_remaining);
      if (!settings.enabled) {
        setUsers([]);
        setSelectedUser(null);
        setKeys([]);
        setConfiguredKeys([]);
        setSelectedConfiguredKey('');
        return;
      }
      await load();
    } catch (err) {
      setUserManagementEnabled(previous);
      setError(err instanceof Error ? err.message : 'Failed to update user management');
    } finally {
      setSettingsSaving(false);
    }
  };

  const toggleAllowUserViewTotalRemaining = async (allow: boolean) => {
    const previous = allowUserViewTotalRemaining;
    setAllowUserViewTotalRemaining(allow);
    setSettingsSaving(true);
    setError('');
    try {
      const settings = await userAdminApi.updateUserManagementSettings({
        allow_user_view_total_remaining: allow,
      });
      setAllowUserViewTotalRemaining(settings.allow_user_view_total_remaining);
    } catch (err) {
      setAllowUserViewTotalRemaining(previous);
      setError(err instanceof Error ? err.message : 'Failed to update quota visibility');
    } finally {
      setSettingsSaving(false);
    }
  };

  const loadUserDetail = async (user: UserPrincipal) => {
    setSelectedUser(user);
    try {
      const [keyRes, configuredRes, modelPolicyRes, quotaPolicyRes] = await Promise.allSettled([
        userAdminApi.listUserKeys(user.id),
        userAdminApi.listConfiguredKeys(),
        userAdminApi.getUserModelPolicy(user.id),
        userAdminApi.getUserQuotaPolicy(user.id),
      ]);
      if (keyRes.status === 'fulfilled') {
        setKeys(keyRes.value.api_keys);
      }
      if (configuredRes.status === 'fulfilled') {
        setConfiguredKeys(configuredRes.value.api_keys);
        const nextAvailable = configuredRes.value.api_keys.find((key) => !key.assigned);
        setSelectedConfiguredKey(nextAvailable?.fingerprint ?? '');
      }
      if (modelPolicyRes.status === 'fulfilled') {
        const mp = modelPolicyRes.value.model_policy as ModelPolicy;
        setModels(mp.allow_all ? '' : (mp.models ?? []).join(','));
      } else {
        setModels('');
      }
      if (quotaPolicyRes.status === 'fulfilled') {
        const qp = quotaPolicyRes.value.quota_policy as QuotaPolicy;
        setQuota(String(qp.limit_credits));
      } else {
        setQuota('0');
      }
      // Load quota summary (used / remaining) and recent usage
      const [quotaSummaryRes, usageRes] = await Promise.allSettled([
        userAdminApi.getUserQuotaSummary(user.id),
        userAdminApi.getUserUsage(user.id, 20),
      ]);
      setQuotaSummary(quotaSummaryRes.status === 'fulfilled' ? quotaSummaryRes.value.quota : null);
      setRecentUsage(usageRes.status === 'fulfilled' ? (usageRes.value.usage?.recent_usage ?? []) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user detail');
    }
  };

  const refreshSelectedUserKeys = async () => {
    if (!selectedUser) return;
    const [keyRes, configuredRes] = await Promise.all([
      userAdminApi.listUserKeys(selectedUser.id),
      userAdminApi.listConfiguredKeys(),
    ]);
    setKeys(keyRes.api_keys);
    setConfiguredKeys(configuredRes.api_keys);
    const nextAvailable = configuredRes.api_keys.find((key) => !key.assigned);
    setSelectedConfiguredKey((current) =>
      current && configuredRes.api_keys.some((key) => key.fingerprint === current && !key.assigned)
        ? current
        : (nextAvailable?.fingerprint ?? '')
    );
  };

  const bindKey = async () => {
    if (!selectedUser || !selectedConfiguredKey) return;
    await userAdminApi.bindUserKey(
      selectedUser.id,
      selectedConfiguredKey,
      bindingName || 'default'
    );
    await refreshSelectedUserKeys();
  };

  const saveModels = async () => {
    if (!selectedUser) return;
    const list = models
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    // If no models specified, allow all; otherwise restrict to the listed models.
    const allowAll = list.length === 0;
    await userAdminApi.setUserModelPolicy(selectedUser.id, { allow_all: allowAll, models: allowAll ? [] : list });
  };

  const saveQuota = async () => {
    if (!selectedUser) return;
    await userAdminApi.setUserQuotaPolicy(selectedUser.id, {
      period: 'monthly',
      limit_credits: Number(quota) || 0,
    });
  };

  const savePricingRule = async () => {
    if (!prModel.trim()) return;
    await userAdminApi.setPricingRule({
      model: prModel.trim(),
      input_credits_per_million_tokens: Number(prInput) || 0,
      output_credits_per_million_tokens: Number(prOutput) || 0,
      cached_credits_per_million_tokens: Number(prCached) || 0,
      reasoning_credits_per_million_tokens: Number(prReasoning) || 0,
      image_credits: Number(prImage) || 0,
      request_credits: Number(prRequest) || 0,
    });
    setPrModel('');
    setPrInput('0');
    setPrOutput('0');
    setPrCached('0');
    setPrReasoning('0');
    setPrImage('0');
    setPrRequest('0');
    const prRes = await userAdminApi.listPricingRules();
    setPricingRules(prRes.pricing_rules ?? []);
  };

  const deletePricingRule = async (model: string) => {
    await userAdminApi.deletePricingRule(model);
    const prRes = await userAdminApi.listPricingRules();
    setPricingRules(prRes.pricing_rules ?? []);
  };

  const editPricingRule = (rule: PricingRule) => {
    setPrModel(rule.model);
    setPrInput(String(rule.input_credits_per_million_tokens));
    setPrOutput(String(rule.output_credits_per_million_tokens));
    setPrCached(String(rule.cached_credits_per_million_tokens));
    setPrReasoning(String(rule.reasoning_credits_per_million_tokens));
    setPrImage(String(rule.image_credits));
    setPrRequest(String(rule.request_credits));
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('userManagement.title')}</h1>
        <p className={styles.description}>{t('userManagement.description')}</p>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <section className={styles.panel}>
        <div className={styles.settingsRow}>
          <div>
            <div className={styles.label}>{t('userManagement.serviceLabel')}</div>
            <p className={styles.muted}>{t('userManagement.serviceDescription')}</p>
          </div>
          <ToggleSwitch
            checked={userManagementEnabled}
            disabled={settingsLoading || settingsSaving}
            onChange={(enabled) => void toggleUserManagement(enabled)}
            ariaLabel="Toggle user management"
            label={userManagementEnabled ? t('userManagement.enabled') : t('userManagement.disabled')}
            labelPosition="left"
          />
        </div>
        <div className={styles.settingsRow}>
          <div>
            <div className={styles.label}>{t('userManagement.quotaVisibilityLabel')}</div>
            <p className={styles.muted}>{t('userManagement.quotaVisibilityDescription')}</p>
          </div>
          <ToggleSwitch
            checked={allowUserViewTotalRemaining}
            disabled={settingsLoading || settingsSaving || !userManagementEnabled}
            onChange={(allow) => void toggleAllowUserViewTotalRemaining(allow)}
            ariaLabel={t('userManagement.quotaVisibilityLabel')}
            label={
              allowUserViewTotalRemaining
                ? t('userManagement.enabled')
                : t('userManagement.disabled')
            }
            labelPosition="left"
          />
        </div>
      </section>

      {!userManagementEnabled && !settingsLoading ? (
        <section className={styles.panel}>
          <div className={styles.label}>{t('userManagement.disabledNote')}</div>
          <div className={styles.muted}>{t('userManagement.disabledNoteDesc')}</div>
        </section>
      ) : null}

      {userManagementEnabled ? (
        <section className={styles.panel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('userManagement.colUser')}</th>
                <th>{t('userManagement.colEmail')}</th>
                <th>{t('userManagement.colStatus')}</th>
                <th>{t('userManagement.colRole')}</th>
                <th>{t('userManagement.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>{user.status}</td>
                  <td>{user.role}</td>
                  <td>
                    <button type="button" onClick={() => void loadUserDetail(user)}>
                      {t('userManagement.actionManage')}
                    </button>{' '}
                    {user.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void run(() => userAdminApi.approveUser(user.id))}
                        >
                          {t('userManagement.actionApprove')}
                        </button>{' '}
                        <button
                          type="button"
                          onClick={() => void run(() => userAdminApi.rejectUser(user.id))}
                        >
                          {t('userManagement.actionReject')}
                        </button>
                      </>
                    ) : null}
                    {user.status === 'approved' ? (
                      <button
                        type="button"
                        onClick={() => void run(() => userAdminApi.suspendUser(user.id))}
                      >
                        {t('userManagement.actionSuspend')}
                      </button>
                    ) : null}
                    {user.status === 'suspended' ? (
                      <button
                        type="button"
                        onClick={() => void run(() => userAdminApi.reactivateUser(user.id))}
                      >
                        {t('userManagement.actionReactivate')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {userManagementEnabled && selectedUser ? (
        <section className={styles.panel}>
          <div className={styles.label}>{t('userManagement.detailTitle')}</div>
          <div className={styles.value}>{selectedUser.username}</div>
          <div className={styles.muted}>{selectedUser.email}</div>

          <div className={styles.grid}>
            <div className={styles.panel}>
              <div className={styles.label}>{t('userManagement.bindKeyLabel')}</div>
              <select
                value={selectedConfiguredKey}
                onChange={(event) => setSelectedConfiguredKey(event.target.value)}
              >
                <option value="">{t('userManagement.bindKeySelect')}</option>
                {configuredKeys.map((key) => (
                  <option key={key.fingerprint} value={key.fingerprint} disabled={key.assigned}>
                    {key.prefix}
                    {key.assigned ? ` (${key.assigned_key_name || key.assigned_user_id})` : ''}
                  </option>
                ))}
              </select>
              <input value={bindingName} onChange={(event) => setBindingName(event.target.value)} />
              <button
                type="button"
                disabled={!selectedConfiguredKey}
                onClick={() => void run(bindKey)}
              >
                {t('userManagement.actionBindKey')}
              </button>
            </div>

            <div className={styles.panel}>
              <div className={styles.label}>{t('userManagement.allowedModels')}</div>
              <input
                value={models}
                onChange={(event) => setModels(event.target.value)}
                placeholder={t('userManagement.allowedModelsHint')}
              />
              <button type="button" onClick={() => void run(saveModels)}>
                {t('userManagement.actionSaveModels')}
              </button>
            </div>

            <div className={styles.panel}>
              <div className={styles.label}>{t('userManagement.monthlyCredits')}</div>
              <input value={quota} onChange={(event) => setQuota(event.target.value)} placeholder={t('userManagement.quotaUnlimitedHint')} />
              <button type="button" onClick={() => void run(saveQuota)}>
                {t('userManagement.actionSaveQuota')}
              </button>
            </div>
          </div>

          {quotaSummary ? (
            <div className={styles.panel}>
              <div className={styles.label}>{t('userManagement.quotaUsage')}</div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('userManagement.quotaLimit')}</th>
                    <th>{t('userManagement.quotaUsed')}</th>
                    <th>{t('userManagement.quotaRemaining')}</th>
                    <th>{t('userManagement.quotaPeriod')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{quotaSummary.limit_credits === 0 ? t('userManagement.quotaUnlimited') : quotaSummary.limit_credits}</td>
                    <td>{quotaSummary.used_credits}</td>
                    <td>{quotaSummary.limit_credits === 0 ? '∞' : quotaSummary.remaining_credits}</td>
                    <td>
                      {new Date(quotaSummary.period_start).toLocaleDateString()} –{' '}
                      {new Date(quotaSummary.period_end).toLocaleDateString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}

          {recentUsage.length > 0 ? (
            <div className={styles.panel}>
              <div className={styles.label}>{t('userManagement.recentRequests')}</div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('userManagement.colTime')}</th>
                    <th>{t('userManagement.colModel')}</th>
                    <th>{t('userManagement.colInput')}</th>
                    <th>{t('userManagement.colOutput')}</th>
                    <th>{t('userManagement.colPrefill')}</th>
                    <th>{t('userManagement.colReasoning')}</th>
                    <th>{t('userManagement.colCredits')}</th>
                    <th>{t('userManagement.colStatus')}</th>
                    <th>{t('userManagement.colLatency')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsage.map((row) => (
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
            </div>
          ) : null}

          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('userManagement.colName')}</th>
                <th>{t('userManagement.colPrefix')}</th>
                <th>{t('userManagement.colStatus')}</th>
                <th>{t('userManagement.colConfig')}</th>
                <th>{t('userManagement.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td>{key.prefix}</td>
                  <td>{key.status}</td>
                  <td>{key.configured_key_present ? t('userManagement.configPresent') : t('userManagement.configMissing')}</td>
                  <td>
                    {key.status === 'active' ? (
                      <button
                        type="button"
                        onClick={() =>
                          void run(async () => {
                            if (!selectedUser) return;
                            await userAdminApi.disableUserKey(selectedUser.id, key.id);
                            await refreshSelectedUserKeys();
                          })
                        }
                      >
                        {t('userManagement.actionDisable')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          void run(async () => {
                            if (!selectedUser) return;
                            await userAdminApi.enableUserKey(selectedUser.id, key.id);
                            await refreshSelectedUserKeys();
                          })
                        }
                      >
                        {t('userManagement.actionEnable')}
                      </button>
                    )}{' '}
                    <button
                      type="button"
                      onClick={() =>
                        void run(async () => {
                          if (!selectedUser) return;
                          await userAdminApi.unbindUserKey(selectedUser.id, key.id);
                          await refreshSelectedUserKeys();
                        })
                      }
                    >
                      {t('userManagement.actionUnbind')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {userManagementEnabled ? (
        <section className={styles.panel}>
          <div className={styles.label}>{t('userManagement.pricingRulesTitle')}</div>
          <p className={styles.muted}>{t('userManagement.pricingRulesDesc')}</p>

          {pricingRules.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('userManagement.colModel')}</th>
                  <th>{t('userManagement.pricingInput')}</th>
                  <th>{t('userManagement.pricingOutput')}</th>
                  <th>{t('userManagement.pricingCached')}</th>
                  <th>{t('userManagement.pricingReasoning')}</th>
                  <th>{t('userManagement.pricingImage')}</th>
                  <th>{t('userManagement.pricingRequest')}</th>
                  <th>{t('userManagement.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {pricingRules.map((rule) => (
                  <tr key={rule.model}>
                    <td>{rule.model}</td>
                    <td>{rule.input_credits_per_million_tokens}</td>
                    <td>{rule.output_credits_per_million_tokens}</td>
                    <td>{rule.cached_credits_per_million_tokens}</td>
                    <td>{rule.reasoning_credits_per_million_tokens}</td>
                    <td>{rule.image_credits}</td>
                    <td>{rule.request_credits}</td>
                    <td>
                      <button type="button" onClick={() => editPricingRule(rule)}>
                        {t('userManagement.actionEdit')}
                      </button>{' '}
                      <button type="button" onClick={() => void run(() => deletePricingRule(rule.model))}>
                        {t('userManagement.actionDelete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          <div className={styles.label} style={{ marginTop: '0.75rem' }}>{t('userManagement.pricingRuleForm')}</div>
          <div className={styles.grid}>
            <div className={styles.panel}>
              <div className={styles.muted}>{t('userManagement.pricingModelLabel')}</div>
              <input value={prModel} onChange={(e) => setPrModel(e.target.value)} placeholder={t('userManagement.pricingModelPlaceholder')} />
            </div>
            <div className={styles.panel}>
              <div className={styles.muted}>{t('userManagement.pricingInput')}</div>
              <input value={prInput} onChange={(e) => setPrInput(e.target.value)} />
            </div>
            <div className={styles.panel}>
              <div className={styles.muted}>{t('userManagement.pricingOutput')}</div>
              <input value={prOutput} onChange={(e) => setPrOutput(e.target.value)} />
            </div>
            <div className={styles.panel}>
              <div className={styles.muted}>{t('userManagement.pricingCached')}</div>
              <input value={prCached} onChange={(e) => setPrCached(e.target.value)} />
            </div>
            <div className={styles.panel}>
              <div className={styles.muted}>{t('userManagement.pricingReasoning')}</div>
              <input value={prReasoning} onChange={(e) => setPrReasoning(e.target.value)} />
            </div>
            <div className={styles.panel}>
              <div className={styles.muted}>{t('userManagement.pricingImage')}</div>
              <input value={prImage} onChange={(e) => setPrImage(e.target.value)} />
            </div>
            <div className={styles.panel}>
              <div className={styles.muted}>{t('userManagement.pricingRequest')}</div>
              <input value={prRequest} onChange={(e) => setPrRequest(e.target.value)} />
            </div>
          </div>
          <button type="button" disabled={!prModel.trim()} onClick={() => void run(savePricingRule)}>
            {t('userManagement.pricingSave')}
          </button>
        </section>
      ) : null}
    </div>
  );
}
