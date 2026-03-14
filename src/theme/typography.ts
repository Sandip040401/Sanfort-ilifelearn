import {Platform} from 'react-native';

const fontFamily = Platform.select({
  ios:     'System',
  android: 'Roboto',
})!;

export const Typography = {
  sizes: {
    xs:   12,
    sm:   14,
    md:   16,
    lg:   18,
    xl:   20,
    xxl:  24,
    xxxl: 28,
  },
  h1:           {fontSize: 28, fontWeight: '700' as const, fontFamily, lineHeight: 36},
  h2:           {fontSize: 24, fontWeight: '700' as const, fontFamily, lineHeight: 32},
  h3:           {fontSize: 20, fontWeight: '600' as const, fontFamily, lineHeight: 28},
  h4:           {fontSize: 18, fontWeight: '600' as const, fontFamily, lineHeight: 24},
  body:         {fontSize: 16, fontWeight: '400' as const, fontFamily, lineHeight: 24},
  bodyBold:     {fontSize: 16, fontWeight: '600' as const, fontFamily, lineHeight: 24},
  caption:      {fontSize: 14, fontWeight: '400' as const, fontFamily, lineHeight: 20},
  captionBold:  {fontSize: 14, fontWeight: '600' as const, fontFamily, lineHeight: 20},
  small:        {fontSize: 12, fontWeight: '400' as const, fontFamily, lineHeight: 16},
  smallBold:    {fontSize: 12, fontWeight: '600' as const, fontFamily, lineHeight: 16},
  button:       {fontSize: 16, fontWeight: '600' as const, fontFamily, lineHeight: 24, letterSpacing: 0.5},
} as const;
