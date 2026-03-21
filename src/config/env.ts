/**
 * App environment constants.
 *
 * NOTE: For true secret isolation, migrate to `react-native-config`
 * so keys are injected at build time and not bundled in JS source.
 * https://github.com/luggit/react-native-config
 */
export const Env = {
  cryptoSecretKey:  'wNpFfE0TUQ0kJVs7L4D7czvAOcxq3tcy',
  recaptchaSiteKey: '6LfP-j0sAAAAAM94liuujZw1018b8KbXsDYx9liY',
  mobileApiKey:     'ilifelearn_mobile_2026_xK9#mP2$qR',
} as const;
