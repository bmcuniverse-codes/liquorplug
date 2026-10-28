import React, {useState,useEffect,useRef} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {ArrowUpRight,Download,X,CheckCircle2,Instagram,Facebook,Youtube,Linkedin} from 'lucide-react';
import {useStore} from './main';
import {activeSlides,socialNetworks} from '../shared/storefront.mjs';

const fallback=e=>{if(!e.currentTarget.src.endsWith('/placeholder.svg'))e.currentTarget.src='/placeholder.svg';};
const readyImages=new Map();
function prepareImage(src){
  if(!src)return Promise.resolve();
  if(!readyImages.has(src))readyImages.set(src,new Promise(resolve=>{const image=new Image();image.onload=()=>{(image.decode?.()||Promise.resolve()).catch(()=>{}).then(resolve);};image.onerror=()=>resolve();image.src=src;}));
  return readyImages.get(src);
}
export function StoreLink({href='/shop',children,...props}){
  const target=typeof href==='string'&&href?href:'/shop';
  return /^https:\/\//i.test(target)?<a href={target} {...props}>{children}</a>:<Link to={target} {...props}>{children}</Link>;
}
const socialIcons={instagram:Instagram,facebook:Facebook,youtube:Youtube,linkedin:Linkedin};
export function SocialLinks({placement}){
  const {settings}=useStore();
  const links=socialNetworks.filter(([key])=>settings.socialEnabled?.[key]!==false&&/^https:\/\//i.test(settings.socials?.[key]||''));
  if(settings.socialPlacement?.[placement]===false||!links.length)return null;
  return <nav className={'social-links social-'+placement} aria-label={'Social media '+placement}>
    {placement==='top'&&<span>Keep good company</span>}
    {links.map(([key,label])=>{const Icon=socialIcons[key];return <a key={key} href={settings.socials[key]} target="_blank" rel="noopener noreferrer" aria-label={label}>{Icon?<Icon size={15}/>:<span className="social-symbol" aria-hidden="true">{key==='tiktok'?'♪':key==='x'?'𝕏':key==='threads'?'@':label.slice(0,1)}</span>}<span>{label}</span></a>;})}
  </nav>;
}

export function Carousel({page='home',compact=false}){
  const {settings}=useStore();
  const loc=useLocation();
  const [index,setIndex]=useState(0),[previous,setPrevious]=useState(null),[paused,setPaused]=useState(false),[hover,setHover]=useState(false),[hidden,setHidden]=useState(document.hidden),[clock,setClock]=useState(Date.now()),[reduced,setReduced]=useState(false);
  const timer=useRef(null),touch=useRef(null),busy=useRef(false),current=useRef(0),sequence=useRef(0);
  const slides=activeSlides(settings.banners[page]||settings.banners.shop,clock);
  const signature=JSON.stringify(slides);
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');setReduced(media.matches);const listener=()=>setReduced(media.matches);media.addEventListener('change',listener);return()=>media.removeEventListener('change',listener);},[]);
  useEffect(()=>{const changed=()=>{setHidden(document.hidden);setClock(Date.now());};document.addEventListener('visibilitychange',changed);const tick=setInterval(()=>setClock(Date.now()),30000);return()=>{document.removeEventListener('visibilitychange',changed);clearInterval(tick);};},[]);
  useEffect(()=>{sequence.current++;setIndex(0);current.current=0;setPrevious(null);busy.current=false;clearTimeout(timer.current);},[loc.pathname,signature]);
  useEffect(()=>()=>{sequence.current++;clearTimeout(timer.current);},[]);
  useEffect(()=>{const next=slides[(index+1)%slides.length];if(next)prepareImage(matchMedia('(max-width:600px)').matches?(next.mobileImage||next.image):next.image);},[index,signature]);
  async function go(delta){
    if(busy.current||slides.length<2)return;
    busy.current=true;
    const version=sequence.current;
    const old=current.current;
    const next=(old+delta+slides.length)%slides.length;
    await prepareImage(matchMedia('(max-width:600px)').matches?(slides[next].mobileImage||slides[next].image):slides[next].image);
    if(sequence.current!==version)return;
    if(current.current!==old){busy.current=false;return;}
    current.current=next;
    if(!reduced){setPrevious(old);timer.current=setTimeout(()=>{setPrevious(null);busy.current=false;},650);}else busy.current=false;
    setIndex(current.current);
  }
  useEffect(()=>{
    if(paused||hover||hidden||reduced||settings.carousel?.autoplay===false||slides.length<2)return;
    const t=setInterval(()=>go(1),settings.carousel?.interval||6500);return()=>clearInterval(t);
  },[paused,hover,hidden,reduced,settings.carousel?.autoplay,settings.carousel?.interval,signature]);
  if(!slides.length)return null;
  const s=slides[index%slides.length];
  const artwork=s.layout==='artwork'&&s.image;
  const content=(slide,exiting=false)=>slide.layout==='artwork'&&slide.image?<><picture><source media="(max-width:600px)" srcSet={slide.mobileImage||slide.image}/><img src={slide.image} alt={exiting?'':slide.title} onError={fallback} fetchPriority={page==='home'?'high':'auto'}/></picture>{!exiting&&<StoreLink className="button carousel-artwork-cta" href={slide.href}>{slide.button||'Shop now'}<ArrowUpRight size={15}/></StoreLink>}</>:<div className="carousel-editorial" style={slide.image?{backgroundImage:`linear-gradient(90deg,rgba(20,0,0,.88),rgba(20,0,0,.35)),url(${JSON.stringify(slide.image)})`}:undefined}>
    {!slide.image&&<img className="carousel-bottle" src="/media/catalogue/hennessy-vs.png" alt=""/>}
    <div><p className="eyebrow">THE LIQUOR PLUG COLLECTION</p><h1>{slide.title}</h1><p>{slide.subtitle}</p><StoreLink className="button cream" href={slide.href}>{slide.button||'Shop now'}<ArrowUpRight size={17}/></StoreLink></div></div>;
  return <section className={'lp-carousel '+(artwork?'is-artwork':'is-editorial')+(compact?' compact':'')} aria-label="Featured collections" aria-roledescription="carousel" onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onFocusCapture={()=>setHover(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setHover(false);}} onTouchStart={e=>touch.current=e.touches[0].clientX} onTouchEnd={e=>{if(touch.current!==null){const delta=e.changedTouches[0].clientX-touch.current;if(Math.abs(delta)>50)go(delta>0?1:-1);}touch.current=null;}}>
    <div className="carousel-stage">
      {previous!==null&&slides[previous]&&<div className="carousel-panel slide-out" aria-hidden="true" inert>{content(slides[previous],true)}</div>}
      <div key={index} className={'carousel-panel '+(previous!==null?'slide-in':'')}>{content(s)}</div>
    </div>
  </section>;
}

export function PromoBanner({index=0}){
  const {settings}=useStore();
  const slides=activeSlides(settings.banners.promotions);
  if(!slides.length)return null;
  const s=slides[index%slides.length];
  return <aside className="promo-banner" aria-label={s.title}><StoreLink href={s.href}><picture><source media="(max-width:600px)" srcSet={s.mobileImage||s.image}/><img src={s.image||'/placeholder.svg'} alt={s.title} loading="lazy" onError={fallback}/></picture></StoreLink><div><span>{s.title}</span><StoreLink className="text-link" href={s.href}>{s.button||'Shop now'}<ArrowUpRight size={16}/></StoreLink></div></aside>;
}
export function EditorialSection({section,recipes=false}){
  const {settings}=useStore();
  const cards=settings[recipes?'recipes':'discoveryCards']||[];
  return <section className={'section editorial-section '+(recipes?'recipe-section':'')}><div className="section-title"><div><p className="eyebrow">{recipes?'THE MIXING NOTES':'FIND YOUR FLAVOUR'}</p><h2>{section.title}</h2><p>{section.subtitle}</p></div></div><div className="editorial-grid">{cards.map((card,i)=><article className="editorial-card" key={i}><StoreLink href={card.href} className="editorial-image"><img src={card.image} alt={card.title} loading="lazy" onError={fallback}/><span>{String(i+1).padStart(2,'0')}</span></StoreLink><div><p className="eyebrow">{card.tag}</p><h3>{card.title}</h3>{card.ingredients&&<p className="recipe-ingredients">{card.ingredients}</p>}<p>{card.text}</p><StoreLink href={card.href} className="text-link">{recipes?'Explore the ingredients':'Explore the collection'}<ArrowUpRight size={16}/></StoreLink></div></article>)}</div></section>;
}
export function Advertising({section}){
  const {settings}=useStore();const a=settings.advertising;
  if(!a?.enabled)return null;
  const href=a.href||`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent('Hello Liquor Plug NG, I would like to advertise my brand on your website.')}`;
  return <section className="advertise-section section"><div><p className="eyebrow">{section?.title||'ADVERTISE WITH US'}</p><h2>{a.title}</h2><p>{a.text}</p><StoreLink href={href} className="button cream">{a.button||'Advertise with us'}<ArrowUpRight size={17}/></StoreLink></div>{a.image&&<img src={a.image} alt="Brand promotion" loading="lazy" onError={fallback}/>}</section>;
}
export function FooterFeatures(){
  const {settings}=useStore();const loc=useLocation();
  if(/^\/(admin|checkout|cart|account|track)(\/|$)/.test(loc.pathname))return null;
  return <div className="footer-features container">
    {settings.whyBuyEnabled!==false&&<section className="section why-buy"><p className="eyebrow">THE LIQUOR PLUG WAY</p><h2>{settings.whyBuyTitle}</h2><div className="why-buy-grid">{(settings.whyBuyCards||[]).map((card,i)=><article key={i}><CheckCircle2 size={25}/><h3>{card.title}</h3><p>{card.text}</p></article>)}</div></section>}
    <section className="footer-promotions" aria-label="More to discover">{Object.entries(settings.footerBanners||{}).filter(([,b])=>b.visible).map(([key,b])=><article key={key} className={'footer-promo footer-promo-'+key}>
      <StoreLink href={b.href} className="footer-promo-image"><img src={b.image} alt={b.title} loading="lazy" onError={fallback}/></StoreLink><div><h3>{b.title}</h3>{b.text&&<p>{b.text}</p>}<StoreLink className="button" href={b.href}>{b.button||'Shop now'}<ArrowUpRight size={16}/></StoreLink></div>
    </article>)}</section>
  </div>;
}

export function InstallApp(){
  const [prompt,setPrompt]=useState(null),[instructions,setInstructions]=useState(false),[installed,setInstalled]=useState(()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone),[dismissed,setDismissed]=useState(false);
  const loc=useLocation();
  useEffect(()=>{const handler=e=>{e.preventDefault();setPrompt(e);};const done=()=>{setInstalled(true);setPrompt(null);};window.addEventListener('beforeinstallprompt',handler);window.addEventListener('appinstalled',done);return()=>{window.removeEventListener('beforeinstallprompt',handler);window.removeEventListener('appinstalled',done);};},[]);
  if(installed||dismissed||loc.pathname.startsWith('/admin'))return null;
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
  async function install(){if(prompt){await prompt.prompt();const result=await prompt.userChoice;if(result.outcome==='accepted')setInstalled(true);setPrompt(null);}else setInstructions(true);}
  return <><aside className="install-strip container"><Download size={24}/><div><strong>Liquor Plug, one tap away.</strong><p>Add our store to your home screen for an app-like shopping experience.</p></div><button className="button" onClick={install}>{prompt?'Install app':'Add to home screen'}</button><button className="icon" aria-label="Dismiss install suggestion" onClick={()=>setDismissed(true)}><X size={18}/></button></aside>
    {instructions&&<div className="modal-backdrop" onClick={()=>setInstructions(false)}><section className="modal install-instructions" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={e=>e.stopPropagation()}><button className="icon" aria-label="Close installation instructions" onClick={()=>setInstructions(false)} autoFocus><X/></button><h2 id="install-title">Install Liquor Plug</h2>{ios?<p>Open this website in Safari. Tap Share, then “Add to Home Screen”, and tap Add.</p>:<p>Open your browser menu and choose “Install Liquor Plug”, “Install app” or “Add to Home screen”. On desktop Chrome or Edge, you can also use the install icon in the address bar.</p>}<p className="help">Installation needs HTTPS and a supported browser. If the option is missing, you can bookmark the store instead. Shopping and checkout need an internet connection.</p><button className="button" onClick={()=>setInstructions(false)}>Got it</button></section></div>}
  </>;
}
