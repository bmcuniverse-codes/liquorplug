// Installability is production-only; development stays free of stale service workers.
if(import.meta.env.PROD&&'serviceWorker' in navigator&&window.isSecureContext){
  window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js',{scope:'/'}).catch(()=>{/* Shopping works without service worker support. */}));
}
