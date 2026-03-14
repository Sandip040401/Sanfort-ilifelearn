import {useEffect, useState} from 'react';
import {InteractionManager} from 'react-native';

/**
 * Defers heavy rendering until after navigation animation completes.
 * Use this on heavy screens (AR, Games, etc.) to keep transitions smooth.
 * Returns `true` once it's safe to render heavy content.
 */
export function useScreenReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setReady(true);
    });
    return () => task.cancel();
  }, []);

  return ready;
}
