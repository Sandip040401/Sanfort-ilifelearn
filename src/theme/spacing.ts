export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  xxl:  32,
  xxxl: 48,
} as const;

export const BorderRadius = {
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  xxl:  24,
  full: 9999,
} as const;

export const Shadow = {
  sm: {
    shadowColor:   '#000',
    shadowOffset:  {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius:  4,
    elevation:     2,
  },
  md: {
    shadowColor:   '#000',
    shadowOffset:  {width: 0, height: 4},
    shadowOpacity: 0.10,
    shadowRadius:  8,
    elevation:     4,
  },
  lg: {
    shadowColor:   '#000',
    shadowOffset:  {width: 0, height: 8},
    shadowOpacity: 0.15,
    shadowRadius:  16,
    elevation:     8,
  },
} as const;
