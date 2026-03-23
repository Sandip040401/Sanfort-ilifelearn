import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {AlertTriangle} from 'lucide-react-native';
import {useTheme, Typography, Spacing, BorderRadius} from '@/theme';

interface Props {
  children: React.ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
}

function ErrorFallback({onRetry}: {onRetry?: () => void}) {
  const {colors} = useTheme();

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={[styles.iconCircle, {backgroundColor: colors.errorSurface}]}>
        <AlertTriangle
          size={moderateScale(32)}
          color={colors.error}
          strokeWidth={2}
        />
      </View>

      <Text style={[Typography.h4, styles.title, {color: colors.text}]}>
        Something went wrong
      </Text>

      <Text style={[Typography.caption, styles.subtitle, {color: colors.textSecondary}]}>
        An unexpected error occurred.{'\n'}Please try again.
      </Text>

      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={({pressed}) => [
            styles.retryButton,
            {backgroundColor: colors.primary},
            pressed && {backgroundColor: colors.primaryDark},
          ]}
          accessibilityRole="button"
          accessibilityLabel="Retry">
          <Text style={[Typography.button, {color: colors.textOnPrimary}]}>
            Try Again
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default class ScreenErrorBoundary extends React.PureComponent<Props, State> {
  state: State = {hasError: false};

  static getDerivedStateFromError(): State {
    return {hasError: true};
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[ScreenError]', error, info);
  }

  private handleRetry = () => {
    this.setState({hasError: false});
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children as React.ReactElement;
  }
}

const styles = StyleSheet.create({
  container: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        Spacing.xl,
  },
  iconCircle: {
    width:          moderateScale(72),
    height:         moderateScale(72),
    borderRadius:   BorderRadius.full,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   verticalScale(Spacing.base),
  },
  title: {
    textAlign:    'center',
    marginBottom: verticalScale(Spacing.sm),
  },
  subtitle: {
    textAlign:    'center',
    marginBottom: verticalScale(Spacing.xl),
    lineHeight:   20,
  },
  retryButton: {
    height:            verticalScale(48),
    paddingHorizontal: Spacing.xxl,
    borderRadius:      BorderRadius.xl,
    alignItems:        'center',
    justifyContent:    'center',
  },
});
