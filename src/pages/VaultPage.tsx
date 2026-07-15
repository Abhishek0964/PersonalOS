import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Search, Lock, Eye, EyeOff, Copy, Trash2, Edit3, Star, AlertCircle,
  RefreshCw, Inbox, Key, FileText, Terminal, Shield, Zap, Loader2, X,
  Check, Calendar, Folder, Link2, Tag as TagIcon, RefreshCcw,
} from 'lucide-react';
import { useCredentials, useCreateCredential, useUpdateCredential, useDeleteCredential, useCredentialTags, useAssignCredentialTag, useRemoveCredentialTag } from '../hooks/useCredentials';
import { useTags } from '../hooks/useTags';
import { useFolders } from '../hooks/useFolders';
import { useEntities } from '../hooks/useEntities';
import { useWorkspaces } from '../hooks/useWorkspace';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useToastStore } from '../stores/toastStore';
import {
  isVaultUnlocked, isVaultInitialized, unlockVault, initializeVault, lockVault, changeVaultPassword,
  encryptData, decryptData, generatePassword, calculatePasswordStrength,
  findDuplicateCredentials,
} from '../services/credentialService';
import type { Credential, CredentialFilters, CredentialSort, CredentialInsert, CredentialUpdate } from '../../types/domain';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const CREDENTIAL_TYPES = [
  { value: 'password', label: 'Password', icon: Key },
  { value: 'api_key', label: 'API Key', icon: Terminal },
  { value: 'env_var', label: 'Environment Variable', icon: Terminal },
  { value: 'token', label: 'Token', icon: Zap },
  { value: 'secure_note', label: 'Secure Note', icon: FileText },
  { value: 'other', label: 'Other', icon: Shield },
];

const CATEGORIES = ['other', 'web', 'server', 'database', 'email', 'social', 'finance', 'development'];

const SORT_OPTIONS: { value: CredentialSort['field']; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'updated_at', label: 'Last Updated' },
  { value: 'created_at', label: 'Date Created' },
  { value: 'expiry_date', label: 'Expiry Date' },
];

const credSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  credential_type: z.enum(['password', 'api_key', 'env_var', 'token', 'secure_note', 'other']).default('password'),
  secret_value: z.string().min(1, 'Secret value is required'),
  username: z.string().optional().default(''),
  url: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  category: z.string().default('other'),
  folder_id: z.string().optional().nullable(),
  entity_id: z.string().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
});

type CredFormData = z.infer<typeof credSchema>;

export function VaultPage() {
  const { data: workspaces } = useWorkspaces();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const effectiveWsId = activeWorkspaceId ?? workspaces?.[0]?.id ?? null;
  const [unlocked, setUnlocked] = useState(isVaultUnlocked());
  const [filters, setFilters] = useState<CredentialFilters>({ search: '', credentialType: 'all' });
  const [sort, setSort] = useState<CredentialSort>({ field: 'updated_at', direction: 'desc' });
  const [showForm, setShowForm] = useState(false);
  const [editingCred, setEditingCred] = useState<Credential | null>(null);
  const [showGenModal, setShowGenModal] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const { data: credentials, isLoading, isError, error, refetch } = useCredentials(effectiveWsId, { filters, sort });

  const duplicates = useMemo(() => findDuplicateCredentials(credentials ?? []), [credentials]);

  if (!effectiveWsId) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6">
        <Inbox className="w-12 h-12 text-gray-600 mb-3" />
        <h2 className="text-lg font-semibold text-white">No Workspace</h2>
        <p className="text-sm text-gray-500 mt-1">Create a workspace to use the Vault.</p>
      </div>
    );
  }

  if (!unlocked) {
    return <VaultUnlockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-error-600/15 flex items-center justify-center">
            <Lock className="w-5 h-5 text-error-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Secure Vault</h1>
            <p className="text-xs text-gray-500">Encrypted credentials and secrets</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowGenModal(true)} className="btn-ghost py-2 px-3 text-xs">
            <Key className="w-4 h-4" /> <span className="hidden sm:inline">Generator</span>
          </button>
          <button onClick={() => setShowChangePassword(true)} className="btn-ghost py-2 px-3 text-xs">
            <Lock className="w-4 h-4" /> <span className="hidden sm:inline">Change Password</span>
          </button>
          <button onClick={() => { lockVault(); setUnlocked(false); }} className="btn-ghost py-2 px-3 text-xs">
            <Lock className="w-4 h-4" /> <span className="hidden sm:inline">Lock</span>
          </button>
          <button onClick={() => { setEditingCred(null); setShowForm(true); }} className="btn-primary">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">New Credential</span>
          </button>
        </div>
      </div>

      {duplicates.size > 0 && (
        <div className="mb-4 rounded-lg border border-warning-500/30 bg-warning-600/10 px-4 py-2 text-xs text-warning-300">
          {duplicates.size} duplicate credential{duplicates.size > 1 ? 's' : ''} detected — consider reviewing.
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input type="text" placeholder="Search credentials..." value={filters.search ?? ''} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="input-field pl-10 py-2" />
        </div>
        <select value={filters.credentialType ?? 'all'} onChange={(e) => setFilters({ ...filters, credentialType: e.target.value })} className="input-field py-2 w-auto min-w-[130px]">
          <option value="all">All Types</option>
          {CREDENTIAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={sort.field} onChange={(e) => setSort({ ...sort, field: e.target.value as CredentialSort['field'] })} className="input-field py-2 w-auto min-w-[120px]">
          {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <button onClick={() => setSort({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })} className="btn-ghost py-2 px-3">{sort.direction === 'asc' ? '↑' : '↓'}</button>
      </div>

      {/* Content */}
      {isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-10 h-10 text-error-400 mb-3" />
          <p className="text-sm text-gray-400 mb-1">Failed to load credentials</p>
          <button onClick={() => refetch()} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Retry</button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-400/30 bg-surface-100 p-4">
              <div className="flex items-start gap-3"><div className="skeleton w-10 h-10 rounded-lg" /><div className="flex-1"><div className="skeleton h-4 max-w-32 rounded mb-2" /><div className="skeleton h-3 w-20 rounded" /></div></div>
            </div>
          ))}
        </div>
      ) : (credentials ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-200/50 flex items-center justify-center mb-4"><Lock className="w-7 h-7 text-gray-600" /></div>
          <h3 className="text-base font-medium text-gray-300">{filters.search ? 'No results found' : 'No credentials yet'}</h3>
          <p className="text-sm text-gray-500 mt-1">{filters.search ? 'Try adjusting your search.' : 'Store your first encrypted credential.'}</p>
          <button onClick={() => { setEditingCred(null); setShowForm(true); }} className="btn-primary mt-4"><Plus className="w-4 h-4" /> New Credential</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(credentials ?? []).map((cred) => {
            const typeConfig = CREDENTIAL_TYPES.find((t) => t.value === cred.credential_type);
            const Icon = typeConfig?.icon ?? Shield;
            const isDup = Array.from(duplicates.values()).some((items) => items.some((c) => c.id === cred.id));
            return (
              <CredentialCard
                key={cred.id}
                credential={cred}
                icon={Icon}
                isDuplicate={isDup}
                onEdit={() => { setEditingCred(cred); setShowForm(true); }}
              />
            );
          })}
        </div>
      )}

      {showForm && (
        <CredentialFormModal
          workspaceId={effectiveWsId}
          credential={editingCred}
          onClose={() => { setShowForm(false); setEditingCred(null); }}
        />
      )}
      {showGenModal && <PasswordGeneratorModal onClose={() => setShowGenModal(false)} />}
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}

function VaultUnlockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'unlock' | 'setup'>('unlock');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => {
    setMode(isVaultInitialized() ? 'unlock' : 'setup');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'setup' && password !== confirmPassword) {
      showToast('error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'setup') {
        await initializeVault(password);
        showToast('success', 'Vault created');
        onUnlock();
      } else {
        const success = await unlockVault(password);
        if (!success) {
          showToast('error', 'Incorrect password');
          setLoading(false);
          return;
        }
        showToast('success', 'Vault unlocked');
        onUnlock();
      }
    } catch { showToast('error', 'An error occurred'); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-error-600/15 flex items-center justify-center mb-4">
        <Lock className="w-8 h-8 text-error-400" />
      </div>
      <h2 className="text-lg font-semibold text-white mb-1">{mode === 'setup' ? 'Create Vault' : 'Unlock Vault'}</h2>
      <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
        {mode === 'setup' ? 'Set a master password to encrypt your credentials. This password is never stored.' : 'Enter your master password to decrypt your credentials.'}
      </p>
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        <input type="password" autoFocus placeholder="Master password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" />
        {mode === 'setup' && <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-field" />}
        <button type="submit" disabled={loading || !password} className="btn-primary w-full">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {mode === 'setup' ? 'Creating...' : 'Unlocking...'}</> : mode === 'setup' ? 'Create Vault' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}

function CredentialCard({ credential, icon: Icon, isDuplicate, onEdit }: { credential: Credential; icon: React.ElementType; isDuplicate: boolean; onEdit: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const deleteCred = useDeleteCredential();
  const updateCred = useUpdateCredential();
  const showToast = useToastStore((s) => s.showToast);
  const { data: tags } = useCredentialTags(credential.id);

  const handleReveal = async () => {
    if (revealed) { setRevealed(false); return; }
    setDecrypting(true);
    try {
      const plain = await decryptData(credential.encrypted_data);
      setDecrypted(plain);
      setRevealed(true);
    } catch { showToast('error', 'Failed to decrypt'); }
    finally { setDecrypting(false); }
  };

  const handleCopy = async () => {
    try {
      const plain = decrypted ?? await decryptData(credential.encrypted_data);
      await navigator.clipboard.writeText(plain);
      showToast('success', 'Copied to clipboard');
    } catch { showToast('error', 'Failed to copy'); }
  };

  const handleDelete = async () => {
    try { await deleteCred.mutateAsync(credential.id); showToast('success', 'Credential deleted'); }
    catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed to delete'); }
  };

  const handleToggleFavorite = async () => {
    try { await updateCred.mutateAsync({ id: credential.id, updates: { is_favorite: !credential.is_favorite } }); }
    catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed to update'); }
  };

  const isExpired = credential.expiry_date && new Date(credential.expiry_date) < new Date();

  return (
    <div className={`group relative rounded-xl border bg-surface-100 p-4 transition-all ${isDuplicate ? 'border-warning-500/40' : 'border-surface-400/30 hover:border-surface-400/50'}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-error-600/15 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-error-400" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-gray-100 truncate">{credential.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{credential.credential_type.replace('_', ' ')}</p>
          {credential.username && <p className="text-xs text-gray-400 mt-1 truncate">{credential.username}</p>}
          {credential.url && <p className="text-xs text-gray-500 mt-0.5 truncate">{credential.url}</p>}
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button onClick={handleToggleFavorite} className={`p-1 transition-colors ${credential.is_favorite ? 'text-warning-400' : 'text-gray-600 hover:text-warning-400'}`}><Star className="w-3.5 h-3.5" /></button>
          <button onClick={onEdit} className="p-1 text-gray-500 hover:text-gray-300 transition-colors opacity-0 group-hover:opacity-100"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={handleDelete} className="p-1 text-gray-500 hover:text-error-400 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Secret value display */}
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-200/40 px-2 py-1.5">
        <span className="text-xs text-gray-500 font-mono flex-1 truncate">
          {decrypting ? <Loader2 className="w-3 h-3 animate-spin" /> : revealed ? (decrypted ?? '••••••••') : '••••••••'}
        </span>
        <button onClick={handleReveal} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">{revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
        <button onClick={handleCopy} className="p-1 text-gray-500 hover:text-gray-300 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {isExpired && <span className="badge bg-error-600/15 text-error-400 text-[10px]">Expired</span>}
        {credential.expiry_date && !isExpired && <span className="flex items-center gap-1 text-[10px] text-gray-600"><Calendar className="w-2.5 h-2.5" />{new Date(credential.expiry_date).toLocaleDateString()}</span>}
        {(tags ?? []).slice(0, 2).map((tag) => <span key={tag.id} className="badge text-[10px]" style={{ backgroundColor: (tag.color ?? '#6b7280') + '20', color: tag.color ?? '#6b7280' }}>{tag.name}</span>)}
      </div>
    </div>
  );
}

function CredentialFormModal({ workspaceId, credential, onClose }: { workspaceId: string; credential: Credential | null; onClose: () => void }) {
  const isEdit = !!credential;
  const createCred = useCreateCredential();
  const updateCred = useUpdateCredential();
  const showToast = useToastStore((s) => s.showToast);
  const { data: folders } = useFolders(workspaceId);
  const { data: entities } = useEntities(workspaceId);
  const { data: allTags } = useTags(workspaceId);
  const { data: credTags } = useCredentialTags(credential?.id ?? null);
  const assignTag = useAssignCredentialTag();
  const removeTag = useRemoveCredentialTag();
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [showGenerator, setShowGenerator] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [genLength, setGenLength] = useState(20);
  const [genOptions, setGenOptions] = useState({ uppercase: true, lowercase: true, numbers: true, symbols: true });

  useEffect(() => {
    if (credential && credTags) setSelectedTagIds(new Set(credTags.map((t) => t.id)));
  }, [credential, credTags]);

  const form = useForm<CredFormData>({
    resolver: zodResolver(credSchema),
    defaultValues: {
      name: credential?.name ?? '',
      credential_type: (credential?.credential_type as CredFormData['credential_type']) ?? 'password',
      secret_value: '',
      username: credential?.username ?? '',
      url: credential?.url ?? '',
      notes: credential?.notes ?? '',
      category: credential?.category ?? 'other',
      folder_id: credential?.folder_id ?? null,
      entity_id: credential?.entity_id ?? null,
      expiry_date: credential?.expiry_date ? new Date(credential.expiry_date).toISOString().slice(0, 10) : null,
    },
  });

  const handleGenerate = () => {
    const pwd = generatePassword(genLength, genOptions);
    setGeneratedPassword(pwd);
    form.setValue('secret_value', pwd);
  };

  const onSubmit = async (data: CredFormData) => {
    try {
      const encrypted = await encryptData(data.secret_value);
      const payload: CredentialInsert | CredentialUpdate = {
        name: data.name,
        credential_type: data.credential_type,
        encrypted_data: encrypted,
        username: data.username || null,
        url: data.url || null,
        notes: data.notes || null,
        category: data.category,
        folder_id: data.folder_id || null,
        entity_id: data.entity_id || null,
        expiry_date: data.expiry_date ? new Date(data.expiry_date).toISOString() : null,
      };
      if (isEdit && credential) {
        await updateCred.mutateAsync({ id: credential.id, updates: payload as CredentialUpdate });
        const oldTagIds = new Set((credTags ?? []).map((t) => t.id));
        Promise.all([
          ...Array.from(selectedTagIds).filter((id) => !oldTagIds.has(id)).map((tagId) => assignTag.mutateAsync({ credentialId: credential.id, tagId })),
          ...Array.from(oldTagIds).filter((id) => !selectedTagIds.has(id)).map((tagId) => removeTag.mutateAsync({ credentialId: credential.id, tagId })),
        ]).catch(() => {});
        showToast('success', 'Credential updated');
      } else {
        const created = await createCred.mutateAsync({ ...(payload as CredentialInsert), workspace_id: workspaceId });
        Promise.all(Array.from(selectedTagIds).map((tagId) => assignTag.mutateAsync({ credentialId: created.id, tagId }))).catch(() => {});
        showToast('success', 'Credential created');
      }
      form.reset();
      onClose();
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed to save'); }
  };

  const toggleTag = (tagId: string) => {
    const next = new Set(selectedTagIds);
    if (next.has(tagId)) next.delete(tagId); else next.add(tagId);
    setSelectedTagIds(next);
  };

  const isSubmitting = form.formState.isSubmitting;
  const credType = form.watch('credential_type');
  const secretValue = form.watch('secret_value');
  const strength = calculatePasswordStrength(secretValue ?? '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0/70 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-400/40 bg-surface-100 shadow-elevated animate-scale-in">
        <div className="flex items-center justify-between p-5 border-b border-surface-400/30 sticky top-0 bg-surface-100 z-10">
          <h2 className="text-lg font-semibold text-white">{isEdit ? 'Edit Credential' : 'New Credential'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Type</label>
            <div className="flex gap-2 flex-wrap">
              {CREDENTIAL_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.value} type="button" onClick={() => form.setValue('credential_type', t.value as CredFormData['credential_type'])}
                    className={`badge transition-all ${credType === t.value ? 'bg-primary-600/20 text-primary-300 ring-1 ring-primary-500/30' : 'bg-surface-200/50 text-gray-400 hover:bg-surface-300'}`}>
                    <Icon className="w-3 h-3" /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Name <span className="text-error-400">*</span></label>
            <input type="text" autoFocus className="input-field" {...form.register('name')} />
            {form.formState.errors.name && <p className="mt-1.5 text-xs text-error-400">{form.formState.errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Secret Value <span className="text-error-400">*</span></label>
            <div className="relative">
              <input type="password" placeholder="Enter secret value" className="input-field pr-24" {...form.register('secret_value')} />
              <button type="button" onClick={() => { setShowGenModal(true); }} className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost py-1 px-2 text-xs"><Key className="w-3 h-3" /> Gen</button>
            </div>
            {secretValue && credType === 'password' && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                  <div className={`h-full transition-all ${strength.score <= 1 ? 'bg-error-500' : strength.score <= 2 ? 'bg-warning-500' : strength.score <= 3 ? 'bg-accent-500' : 'bg-success-500'}`} style={{ width: `${(strength.score / 5) * 100}%` }} />
                </div>
                <span className={`text-xs ${strength.color}`}>{strength.label}</span>
              </div>
            )}
            {form.formState.errors.secret_value && <p className="mt-1.5 text-xs text-error-400">{form.formState.errors.secret_value.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Username</label>
              <input type="text" className="input-field" {...form.register('username')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">URL</label>
              <input type="text" className="input-field" {...form.register('url')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5"><Folder className="w-3.5 h-3.5" /> Folder</label>
              <select className="input-field" {...form.register('folder_id')}>
                <option value="">No folder</option>
                {(folders ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> Entity</label>
              <select className="input-field" {...form.register('entity_id')}>
                <option value="">No entity</option>
                {(entities ?? []).map((e) => <option key={e.id} value={e.id}>{e.name} ({e.entity_type})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Category</label>
              <select className="input-field" {...form.register('category')}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Expiry Date</label>
              <input type="date" className="input-field" {...form.register('expiry_date')} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Notes</label>
            <textarea rows={2} className="input-field resize-none" {...form.register('notes')} />
          </div>
          {(allTags ?? []).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5"><TagIcon className="w-3.5 h-3.5" /> Tags</label>
              <div className="flex flex-wrap gap-2">
                {(allTags ?? []).map((tag) => {
                  const isSelected = selectedTagIds.has(tag.id);
                  return (
                    <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                      className={`badge transition-all ${isSelected ? 'ring-1 ring-primary-500/30' : 'bg-surface-200/50 text-gray-400 hover:bg-surface-300'}`}
                      style={isSelected ? { backgroundColor: (tag.color ?? '#3b82f6') + '20', color: tag.color ?? '#3b82f6' } : undefined}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color ?? '#6b7280' }} />{tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2 sticky bottom-0 bg-surface-100 pb-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Save Changes' : 'Create Credential'}
            </button>
          </div>
        </form>
      </div>
      {showGenerator && (
        <PasswordGeneratorModal onClose={() => setShowGenModal(false)} onUse={(pwd) => { form.setValue('secret_value', pwd); setShowGenModal(false); }} />
      )}
    </div>
  );
}

function PasswordGeneratorModal({ onClose, onUse }: { onClose: () => void; onUse?: (pwd: string) => void }) {
  const [length, setLength] = useState(20);
  const [options, setOptions] = useState({ uppercase: true, lowercase: true, numbers: true, symbols: true });
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => { generate(); }, []);

  const generate = () => {
    setPassword(generatePassword(length, options));
    setCopied(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    showToast('success', 'Copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const strength = calculatePasswordStrength(password);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-0/80 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-sm rounded-2xl border border-surface-400/40 bg-surface-100 shadow-elevated animate-scale-in p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Password Generator</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="rounded-lg bg-surface-200/40 px-3 py-2.5 font-mono text-sm text-gray-200 break-all min-h-[44px] flex items-center">{password || '—'}</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div className={`h-full transition-all ${strength.score <= 1 ? 'bg-error-500' : strength.score <= 2 ? 'bg-warning-500' : strength.score <= 3 ? 'bg-accent-500' : 'bg-success-500'}`} style={{ width: `${(strength.score / 5) * 100}%` }} />
          </div>
          <span className={`text-xs ${strength.color}`}>{strength.label}</span>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Length: {length}</label>
          <input type="range" min={8} max={64} value={length} onChange={(e) => setLength(Number(e.target.value))} className="w-full accent-primary-500" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(options) as Array<keyof typeof options>).map((key) => (
            <label key={key} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input type="checkbox" checked={options[key]} onChange={(e) => setOptions({ ...options, [key]: e.target.checked })} className="w-3.5 h-3.5 rounded border-surface-400 bg-surface-200 text-primary-600" />
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={generate} className="btn-secondary flex-1"><RefreshCcw className="w-4 h-4" /> Regenerate</button>
          <button onClick={handleCopy} className="btn-ghost py-2 px-3">{copied ? <Check className="w-4 h-4 text-success-400" /> : <Copy className="w-4 h-4" />}</button>
          {onUse && <button onClick={() => onUse(password)} className="btn-primary flex-1">Use This</button>}
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const showToast = useToastStore((s) => s.showToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { showToast('error', 'New passwords do not match'); return; }
    if (newPassword.length < 8) { showToast('error', 'Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const success = await changeVaultPassword(oldPassword, newPassword);
      if (!success) { showToast('error', 'Current password is incorrect'); return; }
      showToast('success', 'Password changed');
      onClose();
    } catch { showToast('error', 'Failed to change password'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-0/80 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-sm rounded-2xl border border-surface-400/40 bg-surface-100 shadow-elevated animate-scale-in p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Change Master Password</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="password" placeholder="Current password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="input-field" />
          <input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-field" />
          <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-field" />
          <button type="submit" disabled={loading || !oldPassword || !newPassword} className="btn-primary w-full">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Changing...</> : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
