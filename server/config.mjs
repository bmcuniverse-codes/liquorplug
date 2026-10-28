import { X509Certificate } from 'node:crypto';

export function configurationError(code, message) {
  return Object.assign(new Error(message), { code, status: 503, expose: true });
}

export function postgresOptions(connectionString, env = process.env) {
  let parsed;
  try { parsed = new URL(connectionString); }
  catch { throw configurationError('DATABASE_URL_INVALID', 'DATABASE_URL must be a PostgreSQL connection string, not the Supabase project URL.'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol))
    throw configurationError('DATABASE_URL_INVALID', 'DATABASE_URL must start with postgresql://.');
  const supabase = parsed.hostname.endsWith('.supabase.com') || parsed.hostname.endsWith('.supabase.co');
  let certificate = env.DATABASE_CA_CERT?.trim().replace(/\\n/g, '\n');
  if (certificate) {
    if (!certificate.startsWith('-----BEGIN CERTIFICATE-----') && /^[a-zA-Z0-9+/=\s]+$/.test(certificate))
      certificate = '-----BEGIN CERTIFICATE-----\n' + certificate + '\n-----END CERTIFICATE-----';
    try { new X509Certificate(certificate); }
    catch { throw configurationError('DATABASE_CA_INVALID', 'The database certificate is incomplete. Set DATABASE_CA_CERT to the full certificate from Supabase Database Settings, including BEGIN and END CERTIFICATE.'); }
  }
  const ssl = env.DATABASE_SSL === 'true' || !!certificate || supabase;
  if (supabase && !certificate)
    throw configurationError('DATABASE_CA_REQUIRED', 'Set DATABASE_CA_CERT to the complete Supabase database certificate, then redeploy.');
  // pg connection-string SSL parameters otherwise overwrite the explicit CA.
  if (ssl) for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) parsed.searchParams.delete(key);
  return {
    connectionString: parsed.href, max: 3, connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 15000,
    ssl: ssl ? { rejectUnauthorized: true, ...(certificate ? { ca: certificate } : {}) } : undefined,
  };
}

export function publicOrigin(env = process.env) {
  const value = env.PUBLIC_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + env.VERCEL_PROJECT_PRODUCTION_URL : 'http://localhost:3000');
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error();
    return url.origin;
  } catch { throw configurationError('PUBLIC_URL_INVALID', 'Set PUBLIC_URL to the website address, including https://, without a page path.'); }
}

export function storageOptions(env = process.env) {
  if (!['S3_BUCKET', 'S3_PUBLIC_URL', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].every(key => !!env[key]))
    throw configurationError('STORAGE_INCOMPLETE', 'Image uploads need S3_BUCKET, S3_PUBLIC_URL, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in the server environment.');
  return {
    region: env.S3_REGION || 'auto', endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: !!env.S3_ENDPOINT,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  };
}
