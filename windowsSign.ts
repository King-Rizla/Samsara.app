/**
 * Windows Code Signing Configuration
 *
 * Uses Azure Trusted Signing (formerly Azure Artifact Signing).
 * Requires setup in Azure Portal and environment variables.
 *
 * Env vars needed:
 * - AZURE_CODE_SIGNING_DLIB: Path to Azure signing DLL
 * - AZURE_METADATA_JSON: Path to metadata.json with signing config
 * - SIGNTOOL_PATH: (Optional) Custom path to signtool.exe
 */
import type { SignOptions } from '@electron/windows-sign';

export const windowsSign: SignOptions | undefined =
  process.env.AZURE_CODE_SIGNING_DLIB ? {
    // Custom signtool path (optional)
    ...(process.env.SIGNTOOL_PATH
      ? { signToolPath: process.env.SIGNTOOL_PATH }
      : {}),
    // Azure Trusted Signing parameters
    signWithParams: `/v /debug /fd SHA256 /dlib "${process.env.AZURE_CODE_SIGNING_DLIB}" /dmdf "${process.env.AZURE_METADATA_JSON}"`,
    // RFC 3161 timestamp server
    timestampServer: 'http://timestamp.acs.microsoft.com',
  } : undefined;
