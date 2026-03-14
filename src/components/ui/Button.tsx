import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {useTheme, Typography, Spacing, BorderRadius} from '@/theme';

interface ButtonProps {
  title:     string;
  onPress:   () => void;
  variant?:  'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  loading?:  boolean;
  disabled?: boolean;
  style?:    StyleProp<ViewStyle>;
  size?:     'default' | 'small';
}

export function Button({
  title,
  onPress,
  variant  = 'primary',
  loading  = false,
  disabled = false,
  style,
  size     = 'default',
}: ButtonProps) {
  const {colors} = useTheme();
  const isDisabled = disabled || loading;
  const isSmall    = size === 'small';

  const bgColor = {
    primary:   colors.primary,
    secondary: colors.secondary,
    outline:   'transparent',
    ghost:     'transparent',
    danger:    colors.error,
  }[variant];

  const textColor = {
    primary:   colors.textOnPrimary,
    secondary: colors.textOnPrimary,
    outline:   colors.primary,
    ghost:     colors.primary,
    danger:    '#FFFFFF',
  }[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        {
          height:           isSmall ? 40 : 52,
          borderRadius:     BorderRadius.xl,
          alignItems:       'center' as const,
          justifyContent:   'center' as const,
          paddingHorizontal: isSmall ? Spacing.base : Spacing.xl,
          backgroundColor:  bgColor,
          ...(variant === 'outline' && {
            borderWidth:  1.5,
            borderColor:  colors.primary,
          }),
          ...(isDisabled && {opacity: 0.5}),
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text
          style={[
            isSmall ? Typography.captionBold : Typography.button,
            {color: textColor},
          ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
