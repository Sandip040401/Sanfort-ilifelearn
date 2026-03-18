import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import {Linking} from 'react-native';
import ARWarningModal from '@/components/ARWarningModal';
import ParentGateModal from '@/components/ParentGateModal';
import {useAuth} from './auth-context';

interface ModalContextValue {
  showARWarning: () => void;
  checkParentGate: (callback: () => void) => void;
  openExternalUrl: (url: string) => void;
}

const ModalContext = createContext<ModalContextValue>({
  showARWarning: () => {},
  checkParentGate: () => {},
  openExternalUrl: () => {},
});

export function useModals() {
  return useContext(ModalContext);
}

export function ModalProvider({children}: {children: React.ReactNode}) {
  const {isAuthenticated} = useAuth();
  
  // AR Warning State
  const [arWarningVisible, setArWarningVisible] = useState(false);
  const [lastShownAt, setLastShownAt] = useState(0);

  // Parent Gate State
  const [parentGateVisible, setParentGateVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // 1. "Whenever we open app" (handled by checking lastShownAt === 0)
  useEffect(() => {
    if (lastShownAt === 0) {
      setArWarningVisible(true);
      setLastShownAt(Date.now());
    }
  }, [lastShownAt]);

  // 2. "Whenever we login"
  const [hasShownLoginLock, setHasShownLoginLock] = useState(false);
  useEffect(() => {
    if (isAuthenticated && !hasShownLoginLock) {
      setArWarningVisible(true);
      setHasShownLoginLock(true);
      setLastShownAt(Date.now());
    } else if (!isAuthenticated) {
      setHasShownLoginLock(false);
    }
  }, [isAuthenticated, hasShownLoginLock]);

  const showARWarning = () => {
    const now = Date.now();
    if (now - lastShownAt > 60000) {
      setArWarningVisible(true);
      setLastShownAt(now);
    }
  };

  const handleARConfirm = () => {
    setArWarningVisible(false);
    setLastShownAt(Date.now());
  };

  /**
   * Parent Gate Mechanics
   */
  const checkParentGate = useCallback((callback: () => void) => {
    setPendingAction(() => callback);
    setParentGateVisible(true);
  }, []);

  const openExternalUrl = useCallback((url: string) => {
    checkParentGate(() => {
      Linking.canOpenURL(url).then(supported => {
        if (supported) {
          Linking.openURL(url);
        }
      });
    });
  }, [checkParentGate]);

  const handleGateSuccess = () => {
    setParentGateVisible(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleGateCancel = () => {
    setParentGateVisible(false);
    setPendingAction(null);
  };

  return (
    <ModalContext.Provider value={{showARWarning, checkParentGate, openExternalUrl}}>
      {children}
      
      {/* Global AR Warning */}
      <ARWarningModal 
        visible={arWarningVisible} 
        onConfirm={handleARConfirm} 
      />

      {/* Global Parent Gate */}
      <ParentGateModal
        visible={parentGateVisible}
        onSuccess={handleGateSuccess}
        onCancel={handleGateCancel}
      />
    </ModalContext.Provider>
  );
}

