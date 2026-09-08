import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Current soft-keyboard height in px (0 when hidden). Android 15 edge-to-edge
 * no longer resizes the window for the keyboard, so screens with inputs pad
 * their scroll content by this much and scroll the focused field into view.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
