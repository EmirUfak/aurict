interface AzureArtifactWindowsSignConfig {
  hashes: ['sha256'];
  signToolPath: string;
  signWithParams: string;
  timestampServer: string;
}

interface SelfSignedWindowsSignConfig {
  certificateFile: string;
  certificatePassword: string;
  hashes: ['sha256'];
  timestampServer: string;
}

type WindowsSignConfig = AzureArtifactWindowsSignConfig | SelfSignedWindowsSignConfig;

const AZURE_ARTIFACT_MODE = 'azure-artifact';
const SELF_SIGNED_MODE = 'self-signed';

function requiredValue(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Windows signing requires ${name}.`);
  if (/\s/.test(value)) throw new Error(`Windows signing requires a whitespace-free ${name} path.`);
  return value;
}

export function windowsSign(): WindowsSignConfig | undefined {
  const mode = process.env.AURICT_WINDOWS_SIGNING;
  if (!mode) return undefined;
  if (mode === SELF_SIGNED_MODE) {
    return {
      certificateFile: requiredValue('WINDOWS_CERTIFICATE_FILE'),
      certificatePassword: requiredValue('WINDOWS_CERTIFICATE_PASSWORD'),
      hashes: ['sha256'],
      timestampServer: 'http://timestamp.acs.microsoft.com',
    };
  }

  if (mode !== AZURE_ARTIFACT_MODE) {
    throw new Error(`Unsupported AURICT_WINDOWS_SIGNING mode: ${mode}.`);
  }

  const dlib = requiredValue('AZURE_CODE_SIGNING_DLIB');
  const metadata = requiredValue('AZURE_METADATA_JSON');

  return {
    hashes: ['sha256'],
    signToolPath: requiredValue('SIGNTOOL_PATH'),
    signWithParams: `/v /debug /dlib ${dlib} /dmdf ${metadata}`,
    timestampServer: 'http://timestamp.acs.microsoft.com',
  };
}
