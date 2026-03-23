
import React from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {enableScreens, enableFreeze} from 'react-native-screens';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';

import {ThemeProvider, useTheme} from '@/theme';
import {AuthProvider, ModalProvider} from '@/store';
import {ErrorBoundary} from '@/components/ui';
import {NetworkProvider} from '@/components/NetworkProvider';
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
            <NetworkProvider>
              <QueryClientProvider client={queryClient}>
                <AuthProvider>
                  <ModalProvider>
                    <BottomSheetModalProvider>
                      <RootNavigator />
                    </BottomSheetModalProvider>
                  </ModalProvider>
                </AuthProvider>
              </QueryClientProvider>
            </NetworkProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}



export default App;
