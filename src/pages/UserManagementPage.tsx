import { useCallback, useEffect, useState } from 'react';
import { userAdminApi, type UserAPIKey } from '@/services/api';
import type { UserPrincipal } from '@/types';
import styles from './UserDashboardPage.module.scss';

export function UserManagementPage() {
  const [users, setUsers] = useState<UserPrincipal[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserPrincipal | null>(null);
  const [keys, setKeys] = useState<UserAPIKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('default');
  const [createdKey, setCreatedKey] = useState('');
  const [models, setModels] = useState('');
  const [quota, setQuota] = useState('100');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await userAdminApi.listUsers();
      setUsers(res.users);
    } catch (err) {
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

  const loadUserDetail = async (user: UserPrincipal) => {
    setSelectedUser(user);
    setCreatedKey('');
    try {
      const keyRes = await userAdminApi.listUserKeys(user.id);
      setKeys(keyRes.api_keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user detail');
    }
  };

  const createKey = async () => {
    if (!selectedUser) return;
    const res = await userAdminApi.createUserKey(selectedUser.id, newKeyName || 'default');
    setCreatedKey(res.api_key.plaintext || '');
    const keyRes = await userAdminApi.listUserKeys(selectedUser.id);
    setKeys(keyRes.api_keys);
  };

  const saveModels = async () => {
    if (!selectedUser) return;
    const list = models
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    await userAdminApi.setUserModelPolicy(selectedUser.id, { allow_all: false, models: list });
  };

  const saveQuota = async () => {
    if (!selectedUser) return;
    await userAdminApi.setUserQuotaPolicy(selectedUser.id, {
      period: 'monthly',
      limit_credits: Number(quota) || 0,
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>User management</h1>
        <p className={styles.description}>Review registrations and manage user access.</p>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <section className={styles.panel}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Status</th>
              <th>Role</th>
              <th>Actions</th>
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
                    Manage
                  </button>{' '}
                  {user.status === 'pending' ? (
                    <>
                      <button type="button" onClick={() => void run(() => userAdminApi.approveUser(user.id))}>
                        Approve
                      </button>{' '}
                      <button type="button" onClick={() => void run(() => userAdminApi.rejectUser(user.id))}>
                        Reject
                      </button>
                    </>
                  ) : null}
                  {user.status === 'approved' ? (
                    <button type="button" onClick={() => void run(() => userAdminApi.suspendUser(user.id))}>
                      Suspend
                    </button>
                  ) : null}
                  {user.status === 'suspended' ? (
                    <button type="button" onClick={() => void run(() => userAdminApi.reactivateUser(user.id))}>
                      Reactivate
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selectedUser ? (
        <section className={styles.panel}>
          <div className={styles.label}>User detail</div>
          <div className={styles.value}>{selectedUser.username}</div>
          <div className={styles.muted}>{selectedUser.email}</div>

          <div className={styles.grid}>
            <div className={styles.panel}>
              <div className={styles.label}>Create API key</div>
              <input value={newKeyName} onChange={(event) => setNewKeyName(event.target.value)} />
              <button type="button" onClick={() => void run(createKey)}>
                Create key
              </button>
              {createdKey ? <code>{createdKey}</code> : null}
            </div>

            <div className={styles.panel}>
              <div className={styles.label}>Allowed models</div>
              <input
                value={models}
                onChange={(event) => setModels(event.target.value)}
                placeholder="gpt-5,codex-mini"
              />
              <button type="button" onClick={() => void run(saveModels)}>
                Save models
              </button>
            </div>

            <div className={styles.panel}>
              <div className={styles.label}>Monthly credits</div>
              <input value={quota} onChange={(event) => setQuota(event.target.value)} />
              <button type="button" onClick={() => void run(saveQuota)}>
                Save quota
              </button>
            </div>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td>{key.prefix}</td>
                  <td>{key.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
