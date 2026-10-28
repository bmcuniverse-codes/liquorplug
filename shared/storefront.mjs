export const socialNetworks = [
  ['instagram','Instagram'],['facebook','Facebook'],['tiktok','TikTok'],['youtube','YouTube'],
  ['x','X / Twitter'],['threads','Threads'],['snapchat','Snapchat'],['linkedin','LinkedIn'],['pinterest','Pinterest'],['telegram','Telegram'],
];
export const suppliedBanners = [
  {id:'oriki',title:'Experience true African heritage',image:'/media/banners/oriki.png',href:'/product/oriki-11-premium-london-dry-gin'},
  {id:'lords',title:'Be the lord of the city',image:'/media/banners/lords.png',href:'/shop?q=Lord'},
  {id:'seamans',title:'The true spirit of our culture',image:'/media/banners/seamans.png',href:'/shop'},
  {id:'st-lauren',title:'Sparkling happiness',image:'/media/banners/st-lauren.png',href:'/shop'},
].map(slide=>({...slide,subtitle:'',mobileImage:'',button:'Shop now',layout:'artwork',visible:true,startsAt:0,endsAt:0}));

export const discoveryCards = [
  {title:'Vodka, your way',tag:'CLEAN & VERSATILE',text:'From a simple soda-and-lime to a classic cocktail, start with a vodka that suits your taste.',image:'/media/catalogue/absolut-original.jpeg',href:'/shop?q=vodka'},
  {title:'A little gin discovery',tag:'BOTANICAL & BRIGHT',text:'Explore juniper-led classics, citrus notes and fragrant botanicals. Pair with tonic, plenty of ice and a fresh garnish.',image:'/media/banners/oriki.png',href:'/shop?q=gin'},
  {title:'The whisky shelf',tag:'SIP & SAVOUR',text:'Discover approachable blends and richer, oak-led pours. Find a bottle for gifting, sharing or your own collection.',image:'/media/catalogue/johnnie-walker-black.webp',href:'/shop?q=whisky'},
  {title:'Make it sparkle',tag:'CELEBRATE THE MOMENT',text:'From sparkling wines to alcohol-free options, choose something for the toast and everyone around the table.',image:'/media/banners/st-lauren.png',href:'/shop?q=sparkling'},
];
export const recipeCards = [
  {title:'The citrus highball',tag:'VODKA COCKTAIL',text:'Build over ice. Give it one gentle stir and finish with a lime wedge.',ingredients:'45 ml vodka · 120 ml soda water · a squeeze of lime · plenty of ice',href:'/shop?q=vodka',image:'/media/catalogue/absolut-citron.jpg'},
  {title:'A proper G&T',tag:'GIN COCKTAIL',text:'Pour over fresh ice, add tonic slowly and garnish with lemon or your favourite botanical.',ingredients:'45 ml gin · 120–150 ml tonic water · lemon · fresh ice',href:'/shop?q=gin',image:'/media/banners/lords.png'},
  {title:'Ginger & citrus cooler',tag:'ALCOHOL-FREE MOCKTAIL',text:'Combine in a tall glass over ice and top with sparkling water. Fresh, bright and alcohol-free.',ingredients:'60 ml orange juice · 15 ml lime juice · 90 ml alcohol-free ginger ale · sparkling water',href:'/shop?q=juice',image:'/media/banners/st-lauren.png'},
];
export const whyBuyCards = [
  {title:'Your favourites, in one place',text:'Browse spirits, wines, mixers and alcohol-free choices by brand, category or bottle size.'},
  {title:'Order the way you like',text:'Pay online through Paystack or send your saved order to our team on WhatsApp.'},
  {title:'Know your delivery cost',text:'Check available Lagos delivery areas and the delivery fee before placing your order.'},
  {title:'A place for bigger orders',text:'Buying for an event or business? Apply for approved wholesale access and product pricing.'},
];
export const footerBanners = {
  portrait:{visible:true,title:'A better pour. A better occasion.',text:'Find a bottle for your next get-together.',image:'/media/catalogue/hennessy-vs.png',button:'Discover the collection',href:'/shop',layout:'portrait'},
  landscape:{visible:true,title:'Sparkling happiness',text:'',image:'/media/banners/st-lauren.png',button:'Shop now',href:'/shop',layout:'artwork'},
};
export function activeSlides(slides, now=Date.now()) {
  return (Array.isArray(slides)?slides:[]).filter(s=>s.visible!==false&&(!s.startsAt||now>=Number(s.startsAt))&&(!s.endsAt||now<=Number(s.endsAt)));
}
export function mergeProducts(existing,incoming) {
  const known=new Set(existing.map(p=>p.id));
  return [...existing,...incoming.filter(p=>!known.has(p.id)&&known.add(p.id))];
}
