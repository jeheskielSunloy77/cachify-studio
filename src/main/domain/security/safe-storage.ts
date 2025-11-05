import { safeStorage } from 'electron';

type StorageCapability = {
  backend: string;
  canPersistCredentials: boolean;
  reasonCode?: 'SECURE_BACKEND_UNAVAILABLE' | 'CREDENTIAL_SAVE_DISABLED';
  guidance?: string;
};

const BASIC_TEXT_BACKEND = 'basic_text';

const selectedBackend = () => {
  if (typeof safeStorage.getSelectedStorageBackend === 'function') {
    return safeStorage.getSelectedStorageBackend();
  }
  return safeStorage.isEncryptionAvailable() ? 'unknown-secure' : 'unknown';
};

export const getSafeStorageCapability = (): StorageCapability => {
  const backend = selectedBackend();

  if (!safeStorage.isEncryptionAvailable()) {
    return {
      backend,
      canPersistCredentials: false,
      reasonCode: 'SECURE_BACKEND_UNAVAILABLE',
      guidance: 'Credential persistence is unavailable on this machine.',
    };
  }

  if (backend === BASIC_TEXT_BACKEND) {
    return {
      backend,
      canPersistCredentials: false,
      reasonCode: 'CREDENTIAL_SAVE_DISABLED',
      guidance:
        'Secure keyring is not available (basic_text backend). Use prompt every session.',
    };
  }

  return {
    backend,
    canPersistCredentials: true,
  };
};

export const encryptSecret = (value: string) => safeStorage.encryptString(value);
export const decryptSecret = (value: Buffer) => safeStorage.decryptString(value);
