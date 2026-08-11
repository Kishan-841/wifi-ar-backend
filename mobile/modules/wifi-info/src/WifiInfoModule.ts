import { requireNativeModule } from 'expo-modules-core';

import type { WifiReading } from './WifiInfo.types';

type WifiInfoModuleType = {
  getWifiInfo(): Promise<WifiReading>;
};

export default requireNativeModule<WifiInfoModuleType>('WifiInfo');
