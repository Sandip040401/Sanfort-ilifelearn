
import React from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {enableScreens, enableFreeze} from 'react-native-screens';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {ThemeProvider} from '@/theme';
import {AuthProvider} from '@/store';
import {ErrorBoundary} from '@/components/ui';
import RootNavigator from '@/navigation/RootNavigator';

// Performance: pre-register native screens + freeze inactive screens
enableScreens();
enableFreeze(true);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:     2,
      staleTime: 1000 * 60 * 5,  // 5 min — avoid unnecessary refetches
      gcTime:    1000 * 60 * 10, // 10 min — evict unused query data from memory
    },
  },
});

function App() {
  return (
    <SafeAreaProvider style={{flex: 1}}>
      <GestureHandlerRootView style={{flex: 1}}>
        <ErrorBoundary>
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <BottomSheetModalProvider>
                  <RootNavigator />
                </BottomSheetModalProvider>
              </AuthProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default App;
