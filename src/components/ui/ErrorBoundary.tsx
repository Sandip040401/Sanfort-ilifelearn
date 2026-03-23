import React from 'react';
import {Pressable, StatusBar, StyleSheet, Text, View} from 'react-native';

type Props = {children: React.ReactNode};
type State = {hasError: boolean};

export default class ErrorBoundary extends React.PureComponent<Props, State> {
  state: State = {hasError: false};

  static getDerivedStateFromError(): State {
    return {hasError: true};
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[AppError]', error, info);
  }

  private reset = () => this.setState({hasError: false});

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            Please try again. We've captured the error.
          </Text>
          <Pressable
            onPress={this.reset}
            style={({pressed}) => [styles.button, pressed && styles.buttonPressed]}>
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#0B0F14',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         24,
  },
  title: {
    color:        '#FFFFFF',
    fontSize:     18,
    fontWeight:   '700',
    marginBottom: 8,
  },
  subtitle: {
    color:        '#94A3B8',
    fontSize:     14,
    textAlign:    'center',
    marginBottom: 24,
  },
  button: {
    paddingVertical:   12,
    paddingHorizontal: 24,
    borderRadius:      12,
    backgroundColor:   '#6C4CFF',
  },
  buttonPressed: {
    backgroundColor: '#5438CC',
  },
  buttonText: {
    color:      '#FFFFFF',
    fontWeight: '700',
    fontSize:   15,
  },
});
