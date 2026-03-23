import {ENVIRONMENT_ORDER} from '@/config';

/**
 * Normalize raw environment/folder name from API to canonical display name.
 * Single source of truth — used in AR, WebVR, ARSheets screens.
 */
export const normalizeEnvName = (raw: string): string => {
  const s = (raw ?? '').trim().toLowerCase();
  if (s.includes('phonics'))                            {return 'Phonics Fun';}
  if (s.includes('number'))                             {return 'Numbers';}
  if (s.includes('stor'))                               {return 'Stories';}
  if (s.includes('body'))                               {return 'My Body';}
  if (s.includes('underwater'))                         {return 'Underwater World';}
  if (s.includes('wild'))                               {return 'Wild Animals';}
  if (s.includes('farm'))                               {return 'Farm Animals';}
  if (s.includes('fruit') || s.includes('vegetable'))  {return 'Fruits & Vegetables';}
  if (s.includes('amphibian'))                          {return 'Amphibians';}
  if (s.includes('transport'))                          {return 'Transportation';}
  if (s.includes('space'))                              {return 'Space Adventure';}
  if (s.includes('extinct'))                            {return 'Extinct Animals';}
  return raw;
};

export const sortByEnvOrder = <T extends {name: string}>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const ra = ENVIRONMENT_ORDER.indexOf(a.name as typeof ENVIRONMENT_ORDER[number]);
    const rb = ENVIRONMENT_ORDER.indexOf(b.name as typeof ENVIRONMENT_ORDER[number]);
    return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
  });
