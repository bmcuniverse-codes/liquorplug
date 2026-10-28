import { randomUUID } from 'node:crypto';
const recent = [];
export function recentErrors() { return recent.slice(-10).reverse(); }
export function describeError(error) {
  if (error.expose) return { status: error.status || 503, message: error.message, code: error.code };
  const code = String(error.code || error.name || 'SERVER_ERROR');
  if (['SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED'].includes(code))
    return { status:503, code, message:'The database TLS certificate could not be verified. Check DATABASE_CA_CERT and redeploy.' };
  if (['42P01','42703'].includes(code)) return { status:503, code, message:'The database schema needs updating. Run npm run db:setup with your production database settings.' };
  if (['42501','28P01','28000'].includes(code)) return { status:503, code, message:'The server cannot access the database. Check the database password and the connection role permissions.' };
  if (['ENOTFOUND','ECONNREFUSED','ETIMEDOUT','ECONNRESET','57P01','53300'].includes(code)) return { status:503, code, message:'A store service is temporarily unavailable. Please try again shortly.' };
  if (['NoSuchBucket','InvalidAccessKeyId','SignatureDoesNotMatch','AccessDenied','CredentialsProviderError'].includes(code))
    return { status:503, code, message:'Image storage is not ready. Check the bucket, region and S3 access keys in the server settings.' };
  if (code==='23505' || /UNIQUE constraint failed/.test(error.message||'')) return { status:409, code, message:'A record already uses that email, SKU or URL. Check the value and try again.' };
  if (['23503','23514','22P02'].includes(code)) return { status:400, code, message:'One of the supplied values is invalid or no longer available. Refresh and check the form.' };
  return { status:error.status || 500, code, message:error.status ? error.message : 'The request could not be completed. Please share the error reference with the store administrator.' };
}
export function recordError(error, request = {}) {
  const id = randomUUID().slice(0,12), info = describeError(error);
  const entry = { id, time: new Date().toISOString(), code: info.code, method: request.method || 'STARTUP', path: String(request.path || '/').split('?')[0], operation: error.dbOperation || undefined };
  recent.push(entry); if (recent.length>30) recent.shift();
  // No request bodies, SQL parameters, cookies, passwords, tokens or URLs.
  console.error('Store error', JSON.stringify(entry));
  return { ...info, id };
}
