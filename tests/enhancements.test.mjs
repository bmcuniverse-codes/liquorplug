import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {postgresOptions,publicOrigin,storageOptions} from '../server/config.mjs';
import {describeError} from '../server/errors.mjs';
import {activeSlides,mergeProducts} from '../shared/storefront.mjs';
import {upgradeSettings,normalizeSettings} from '../server/content.mjs';
import {safeLink} from '../server/security.mjs';

test('content links reject executable schemes, protocol-relative URLs and backslash redirects',()=>{
 for(const link of ['javascript:alert(1)','//evil.example','/\\evil.example','https://','https://user:password@example.test','/\n/evil.example'])assert.equal(safeLink(link),false,link);
 for(const link of ['/shop?q=gin','/media/banners/oriki.png','https://www.tiktok.com/@example'])assert.equal(safeLink(link),true,link);
});

test('Supabase TLS stays verified and missing or malformed certificates give actionable errors',()=>{
 const url='postgresql://postgres.example:dummy-password@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';
 assert.throws(()=>postgresOptions(url,{}),{code:'DATABASE_CA_REQUIRED'});
 assert.throws(()=>postgresOptions(url,{DATABASE_CA_CERT:'not a certificate'}),{code:'DATABASE_CA_INVALID'});
 const config=postgresOptions('postgresql://user:dummy@localhost/db?sslmode=no-verify',{DATABASE_SSL:'true'});
 assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(new URL(config.connectionString).searchParams.has('sslmode'),false);
});
test('Supabase S3 uses path-style at client level and clear missing-config errors',()=>{
 const options=storageOptions({S3_ENDPOINT:'https://example.storage.supabase.co/storage/v1/s3',S3_BUCKET:'products',S3_REGION:'eu-west-1',S3_PUBLIC_URL:'https://example.test/products',S3_ACCESS_KEY_ID:'test-id',S3_SECRET_ACCESS_KEY:'test-secret'});
 assert.equal(options.forcePathStyle,true);assert.equal(options.credentials.forcePathStyle,undefined);assert.equal(options.requestChecksumCalculation,'WHEN_REQUIRED');
 assert.throws(()=>storageOptions({}),{code:'STORAGE_INCOMPLETE'});
});
test('public origin normalizes a configured website and rejects invalid addresses',()=>{
 assert.equal(publicOrigin({PUBLIC_URL:'https://liquor.example/'}),'https://liquor.example');
 assert.equal(publicOrigin({VERCEL_PROJECT_PRODUCTION_URL:'liquor.example'}),'https://liquor.example');
 assert.throws(()=>publicOrigin({PUBLIC_URL:'config'}),{code:'PUBLIC_URL_INVALID'});
});
test('database errors are helpful and never expose SQL or connection secrets',()=>{
 for(const code of ['SELF_SIGNED_CERT_IN_CHAIN','42P01','42501','ECONNREFUSED']){
  const safe=describeError({code,message:'secret-database-URL-and-SQL'});assert.equal(safe.status,503);assert.ok(!safe.message.includes('secret-database'));
 }
 assert.equal(describeError({code:'23505'}).status,409);
});
test('slide visibility and scheduling work and pagination merges without duplicates',()=>{
 assert.deepEqual(activeSlides([{id:1},{id:2,visible:false},{id:3,startsAt:200},{id:4,endsAt:50},{id:5,startsAt:80,endsAt:110}],100).map(s=>s.id),[1,5]);
 assert.deepEqual(mergeProducts([{id:1}],[{id:1},{id:2},{id:2},{id:3}]).map(p=>p.id),[1,2,3]);
});
test('store upgrade preserves merchant content and adds supplied banners and editable footer defaults',()=>{
 const old={tagline:'My own store',socials:{instagram:'https://instagram.com/example'},banners:{home:[{title:'Custom slide',image:'/own.jpg',href:'/brands'}]},sections:[{type:'featured',title:'My picks',visible:true}]};
 const updated=upgradeSettings(old);assert.equal(updated.tagline,old.tagline);assert.equal(updated.banners.home.length,5);assert.equal(updated.banners.home.at(-1).image,'/own.jpg');assert.equal(updated.sections[0].title,'My picks');assert.ok(updated.recipes.length);assert.ok(updated.footerBanners.portrait.visible);assert.ok(updated.footerBanners.landscape.visible);
 const normalized=normalizeSettings({...updated,footerBanners:{portrait:{visible:false}}});assert.equal(normalized.footerBanners.portrait.visible,false);assert.ok(normalized.footerBanners.landscape.image);
});
test('manifest has installable icons and service worker bypasses sensitive requests',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
 assert.equal(manifest.display,'standalone');assert.ok(manifest.icons.some(i=>i.sizes==='192x192'));assert.ok(manifest.icons.some(i=>i.sizes==='512x512'));
 for(const icon of manifest.icons){const bytes=await readFile(new URL('../public'+icon.src,import.meta.url));assert.equal(bytes.subarray(1,4).toString(),'PNG');}
 const listeners={};let fetches=0;const self={location:{origin:'https://example.test'},addEventListener:(name,fn)=>listeners[name]=fn};
 vm.runInNewContext(await readFile(new URL('../public/service-worker.js',import.meta.url),'utf8'),{self,URL,caches:{},fetch:()=>{fetches++;}});
 for(const path of ['/api/bootstrap','/api/auth/login','/api/orders','/admin','/account','/cart','/checkout','/track']){
  let intercepted=false;listeners.fetch({request:{method:'GET',url:'https://example.test'+path,mode:'navigate'},respondWith:()=>intercepted=true});assert.equal(intercepted,false,path);
 }
 assert.equal(fetches,0);
});
