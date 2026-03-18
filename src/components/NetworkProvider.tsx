
import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import NetInfo, {type NetInfoStateType} from '@react-native-community/netinfo';
import NetworkModal from './NetworkModal';

interface NetworkContextValue {
  isOnline:    boolean;
  networkType: string;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline:    true,
  networkType: 'unknown',
});

export function useNetwork(): NetworkContextValue {
  return useContext(NetworkContext);
}

export function NetworkProvider({children}: {children: React.ReactNode}) {
  const [isOnline, setIsOnline]       = useState(true);
  const [networkType, setNetworkType] = useState<string>('unknown');
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      
      // Show modal if user goes from online to offline
      if (isOnline && !online) {
        setModalVisible(true);
      }
      
      setIsOnline(online);
      setNetworkType((state.type as NetInfoStateType) ?? 'unknown');
    });

    return unsubscribe;
  }, [isOnline]);

  const value = useMemo(
    () => ({isOnline, networkType}),
    [isOnline, networkType],
  );

  return (
    <NetworkContext.Provider value={value}>
      {children}
      <NetworkModal 
        visible={modalVisible} 
        onDismiss={() => setModalVisible(false)} 
      />
    </NetworkContext.Provider>
  );
}

