import {defaults} from './defaults.mjs';
import {suppliedBanners} from '../shared/storefront.mjs';

export function normalizeSettings(input = {}) {
  return {...structuredClone(defaults),...input,
    copy:{...defaults.copy,...input.copy},socials:{...defaults.socials,...input.socials},
    socialEnabled:{...defaults.socialEnabled,...input.socialEnabled},socialPlacement:{...defaults.socialPlacement,...input.socialPlacement},
    banners:{...structuredClone(defaults.banners),...input.banners},
    advertising:{...defaults.advertising,...input.advertising},
    footerBanners:{portrait:{...defaults.footerBanners.portrait,...input.footerBanners?.portrait},landscape:{...defaults.footerBanners.landscape,...input.footerBanners?.landscape}},
    carousel:{...defaults.carousel,...input.carousel},
  };
}
export function upgradeSettings(input) {
  const result=normalizeSettings(input);
  const existing=input.banners?.home||[];
  const suppliedPaths=new Set(suppliedBanners.map(s=>s.image));
  const custom=existing.filter(s=>!suppliedPaths.has(s.image)&&(s.image||s.title!=='Good taste.\nGreat company.'));
  result.banners.home=[...structuredClone(suppliedBanners),...custom];
  result.sections=[...(input.sections||defaults.sections)];
  for(const section of defaults.sections)if(!result.sections.some(s=>s.type===section.type))result.sections.push({...section});
  return result;
}
