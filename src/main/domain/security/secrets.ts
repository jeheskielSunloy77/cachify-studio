import { app } from 'electron';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  profileSecretPayloadSchema,
  type ProfileSecretsDeleteRequest,
  type ProfileSecretsLoadRequest,
  type ProfileSecretsSaveRequest,
} from '../../../shared/ipc/ipc.contract';
import { decryptSecret, encryptSecret, getSafeStorageCapability } from './safe-storage';

type SecretErrorCode =
  | 'CREDENTIAL_SAVE_DISABLED'
  | 'SECURE_BACKEND_UNAVAILABLE'
  | 'CREDENTIAL_NOT_FOUND'
  | 'CREDENTIAL_DECRYPT_FAILED'
  | 'CREDENTIAL_INVALID';

type SecretResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: { code: SecretErrorCode; message: string } };

const secretsDir = () => join(app.getPath('userData'), 'secure-profile-secrets');
const secretPath = (profileId: string, type: string) => join(secretsDir(), `${profileId}-${type}.enc`);

const saveSecret = (
  input: ProfileSecretsSaveRequest,
): SecretResult<{ profileId: string; type: ProfileSecretsSaveRequest['type'] }> => {
  const capability = getSafeStorageCapability();
  if (!capability.canPersistCredentials) {
    return {
      ok: false,
      error: {
        code: capability.reasonCode ?? 'SECURE_BACKEND_UNAVAILABLE',
        message: capability.guidance ?? 'Credential persistence is unavailable.',
      },
    };
  }

  try {
    mkdirSync(secretsDir(), { recursive: true });
    const encrypted = encryptSecret(JSON.stringify(input.secret));
    writeFileSync(secretPath(input.profileId, input.type), encrypted.toString('base64'), {
      encoding: 'utf8',
      mode: 0o600,
    });
    return {
      ok: true,
      data: {
        profileId: input.profileId,
        type: input.type,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: 'SECURE_BACKEND_UNAVAILABLE',
        message: 'Credential persistence is unavailable.',
      },
    };
  }
};

const loadSecret = (
  input: ProfileSecretsLoadRequest,
): SecretResult<{
  profileId: string;
  type: ProfileSecretsLoadRequest['type'];
  secret: ProfileSecretsSaveRequest['secret'];
}> => {
  try {
    const encoded = readFileSync(secretPath(input.profileId, input.type), 'utf8');
    const decrypted = decryptSecret(Buffer.from(encoded, 'base64'));
    const parsed = profileSecretPayloadSchema.safeParse(JSON.parse(decrypted));
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'CREDENTIAL_INVALID',
          message: 'Stored credentials are invalid.',
        },
      };
    }
    return {
      ok: true,
      data: {
        profileId: input.profileId,
        type: input.type,
        secret: parsed.data,
      },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        ok: false,
        error: {
          code: 'CREDENTIAL_NOT_FOUND',
          message: 'No stored credentials found for this profile.',
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'CREDENTIAL_DECRYPT_FAILED',
        message: 'Stored credentials could not be decrypted.',
      },
    };
  }
};

const deleteSecret = (
  input: ProfileSecretsDeleteRequest,
): SecretResult<{ profileId: string; type: ProfileSecretsDeleteRequest['type'] }> => {
  try {
    rmSync(secretPath(input.profileId, input.type), { force: false });
    return {
      ok: true,
      data: {
        profileId: input.profileId,
        type: input.type,
      },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        ok: false,
        error: {
          code: 'CREDENTIAL_NOT_FOUND',
          message: 'No stored credentials found for this profile.',
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'SECURE_BACKEND_UNAVAILABLE',
        message: 'Credential deletion failed.',
      },
    };
  }
};

export const profileSecrets = {
  getStorageStatus: getSafeStorageCapability,
  save: saveSecret,
  load: loadSecret,
  delete: deleteSecret,
};
