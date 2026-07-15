import { supabase } from '../lib/supabase';
import type {
  Credential,
  CredentialInsert,
  CredentialUpdate,
  CredentialFilters,
  CredentialSort,
  EncryptedPayload,
} from '../types/domain';
import type { Tag } from '../types/domain';

// ============================================================
// Client-side encryption using Web Crypto API
// ============================================================

const ENC_KEY_STORAGE = 'vault_enc_key';
const SALT_STORAGE = 'vault_salt';
const VERIFIER_STORAGE = 'vault_verifier';

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function initializeVault(password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  const exportedKey = await crypto.subtle.exportKey('raw', key);
  const keyB64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
  const saltB64 = btoa(String.fromCharCode(...salt));
  // Create a verifier — encrypt a known plaintext that we can decrypt to verify the password
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const verifierCiphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode('vault-verifier')
  );
  const verifier = JSON.stringify({
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(verifierCiphertext))),
  });
  localStorage.setItem(ENC_KEY_STORAGE, keyB64);
  localStorage.setItem(SALT_STORAGE, saltB64);
  localStorage.setItem(VERIFIER_STORAGE, verifier);
}

export async function unlockVault(password: string): Promise<boolean> {
  const saltB64 = localStorage.getItem(SALT_STORAGE);
  const verifierJson = localStorage.getItem(VERIFIER_STORAGE);
  if (!saltB64 || !verifierJson) return false;
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const key = await deriveKey(password, salt);
  // Verify the password by decrypting the verifier
  try {
    const verifier = JSON.parse(verifierJson);
    const iv = Uint8Array.from(atob(verifier.iv), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(verifier.ciphertext), (c) => c.charCodeAt(0));
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );
    // Password is correct — store the key
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    const keyB64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
    localStorage.setItem(ENC_KEY_STORAGE, keyB64);
    return true;
  } catch {
    // Decryption failed — wrong password
    return false;
  }
}

export function isVaultInitialized(): boolean {
  return !!localStorage.getItem(SALT_STORAGE) && !!localStorage.getItem(VERIFIER_STORAGE);
}

export function isVaultUnlocked(): boolean {
  return !!localStorage.getItem(ENC_KEY_STORAGE);
}

export function lockVault(): void {
  localStorage.removeItem(ENC_KEY_STORAGE);
}

export async function changeVaultPassword(oldPassword: string, newPassword: string): Promise<boolean> {
  if (!isVaultUnlocked()) return false;
  // Verify old password by trying to unlock
  const saltB64 = localStorage.getItem(SALT_STORAGE);
  const verifierJson = localStorage.getItem(VERIFIER_STORAGE);
  if (!saltB64 || !verifierJson) return false;
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const oldKey = await deriveKey(oldPassword, salt);
  try {
    const verifier = JSON.parse(verifierJson);
    const iv = Uint8Array.from(atob(verifier.iv), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(verifier.ciphertext), (c) => c.charCodeAt(0));
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, oldKey, ciphertext as BufferSource);
  } catch {
    return false; // Old password is wrong
  }
  // Generate new salt and key
  const newSalt = crypto.getRandomValues(new Uint8Array(16));
  const newKey = await deriveKey(newPassword, newSalt);
  const exportedKey = await crypto.subtle.exportKey('raw', newKey);
  const keyB64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
  const newSaltB64 = btoa(String.fromCharCode(...newSalt));
  // Create new verifier
  const newIv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const newVerifierCiphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: newIv as BufferSource },
    newKey,
    enc.encode('vault-verifier')
  );
  const newVerifier = JSON.stringify({
    iv: btoa(String.fromCharCode(...newIv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(newVerifierCiphertext))),
  });
  localStorage.setItem(ENC_KEY_STORAGE, keyB64);
  localStorage.setItem(SALT_STORAGE, newSaltB64);
  localStorage.setItem(VERIFIER_STORAGE, newVerifier);
  return true;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyB64 = localStorage.getItem(ENC_KEY_STORAGE);
  if (!keyB64) throw new Error('Vault is locked');
  const keyBytes = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptData(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(plaintext));
  const payload: EncryptedPayload = {
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    salt: localStorage.getItem(SALT_STORAGE) ?? '',
  };
  return JSON.stringify(payload);
}

export async function decryptData(encrypted: string): Promise<string> {
  const key = await getEncryptionKey();
  const payload = JSON.parse(encrypted) as EncryptedPayload;
  const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(payload.ciphertext), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ciphertext as BufferSource);
  const dec = new TextDecoder();
  return dec.decode(decrypted);
}

// ============================================================
// Password generator
// ============================================================

export function generatePassword(length: number = 20, options: { uppercase?: boolean; lowercase?: boolean; numbers?: boolean; symbols?: boolean } = {}): string {
  const { uppercase = true, lowercase = true, numbers = true, symbols = true } = options;
  let charset = '';
  if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (numbers) charset += '0123456789';
  if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (!charset) charset = 'abcdefghijklmnopqrstuvwxyz';
  const array = crypto.getRandomValues(new Uint32Array(length));
  let result = '';
  for (let i = 0; i < length; i++) result += charset[array[i] % charset.length];
  return result;
}

export function calculatePasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 20) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  const clamped = Math.min(score, 5);
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = ['text-error-400', 'text-error-400', 'text-warning-400', 'text-accent-400', 'text-success-400', 'text-success-400'];
  return { score: clamped, label: labels[clamped], color: colors[clamped] };
}

// ============================================================
// Credential CRUD
// ============================================================

export async function fetchCredentials(
  workspaceId: string,
  options?: { filters?: CredentialFilters; sort?: CredentialSort }
): Promise<Credential[]> {
  const { filters = {}, sort = { field: 'updated_at', direction: 'desc' } } = options ?? {};
  let query = supabase
    .from('credentials')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null);

  if (filters.search && filters.search.trim()) {
    query = query.or(`name.ilike.%${filters.search}%,username.ilike.%${filters.search}%,url.ilike.%${filters.search}%`);
  }
  if (filters.credentialType && filters.credentialType !== 'all') {
    query = query.eq('credential_type', filters.credentialType);
  }
  if (filters.folderId && filters.folderId !== 'all') {
    if (filters.folderId === 'unassigned') query = query.is('folder_id', null);
    else query = query.eq('folder_id', filters.folderId);
  }
  if (filters.isFavorite !== undefined) query = query.eq('is_favorite', filters.isFavorite);
  if (filters.category && filters.category !== 'all') query = query.eq('category', filters.category);

  const ascending = sort.direction === 'asc';
  query = query.order(sort.field, { ascending });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Credential[];
}

export async function fetchCredentialById(id: string): Promise<Credential | null> {
  const { data, error } = await supabase
    .from('credentials')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as Credential | null;
}

export async function createCredential(input: CredentialInsert): Promise<Credential> {
  const { data, error } = await supabase
    .from('credentials')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Credential;
}

export async function updateCredential(id: string, updates: CredentialUpdate): Promise<Credential> {
  const { data, error } = await supabase
    .from('credentials')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Credential;
}

export async function softDeleteCredential(id: string): Promise<void> {
  const { error } = await supabase
    .from('credentials')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// Tag operations
export async function fetchTagsForCredential(credentialId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('credential_tags')
    .select('tag_id, tags(id, name, color)')
    .eq('credential_id', credentialId);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ tags: Tag }>).map((row) => row.tags);
}

export async function assignTagToCredential(credentialId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('credential_tags')
    .insert({ credential_id: credentialId, tag_id: tagId });
  if (error && error.code !== '23505') throw error;
}

export async function removeTagFromCredential(credentialId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('credential_tags')
    .delete()
    .eq('credential_id', credentialId)
    .eq('tag_id', tagId);
  if (error) throw error;
}

// Duplicate detection
export function findDuplicateCredentials(credentials: Credential[]): Map<string, Credential[]> {
  const duplicates = new Map<string, Credential[]>();
  const seen = new Map<string, Credential[]>();
  for (const cred of credentials) {
    const key = `${cred.name.toLowerCase()}|${(cred.username ?? '').toLowerCase()}`;
    const existing = seen.get(key) ?? [];
    existing.push(cred);
    seen.set(key, existing);
  }
  for (const [key, items] of seen) {
    if (items.length > 1) duplicates.set(key, items);
  }
  return duplicates;
}
