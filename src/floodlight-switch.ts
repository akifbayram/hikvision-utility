import sdk, {
  ScryptedDeviceBase,
  OnOff,
  Settings,
  Readme,
  Setting,
  SettingValue,
  ScryptedNativeId,
  ScryptedInterface,
  ScryptedDeviceType,
  ScryptedDevice
} from '@scrypted/sdk';
import { StorageSettings } from '@scrypted/sdk/storage-settings';
import { setSupplementalLight, getSupplementalLightState } from './hikvision-api';

async function fetchCameraSetting(key: string, camId: string): Promise<string> {
  const cam = sdk.systemManager.getDeviceById<ScryptedDevice>(camId);
  if (cam && typeof (cam as any).getSettings === 'function') {
    try {
      const camSettings: Setting[] = await (cam as any).getSettings();
      const setting = camSettings.find((s: Setting) => s.key === key);
      if (setting && setting.value) {
        return setting.value as string;
      }
    } catch (e) {
      console.error(`[FloodlightSwitch] fetchCameraSetting: Error retrieving ${key}: ${e}`);
    }
  }
  return '';
}

export class FloodlightSwitch extends ScryptedDeviceBase implements OnOff, Settings, Readme {
  storageSettings = new StorageSettings(this, {
    camera: {
      title: 'Camera',
      description: 'Select the device to use for floodlight control.',
      type: 'device',
      deviceFilter: `(type === '${ScryptedDeviceType.Camera}' || type === '${ScryptedDeviceType.Doorbell}') && interfaces.includes('${ScryptedInterface.Camera}')`,
      onPut: async (_oldValue, newValue) => {
        if (newValue) {
          const camId = newValue as string;
          const ip = await fetchCameraSetting('ip', camId);
          const username = await fetchCameraSetting('username', camId);
          const password = await fetchCameraSetting('password', camId);
          if (ip) this.storage.setItem('ip', ip);
          if (username) this.storage.setItem('username', username);
          if (password) this.storage.setItem('password', password);
        }
        return { value: newValue };
      }
    },
    brightnessRegulateMode: {
      title: 'Brightness Mode',
      description: 'Choose "auto" for automatic brightness control or "manual" for custom brightness.',
      type: 'string',
      choices: ['auto', 'manual'],
      defaultValue: 'manual',
    },
    manualBrightness: {
      title: 'Manual Brightness',
      description: 'Set brightness when in manual mode (0 to 100).',
      type: 'number',
      defaultValue: 100,
      immediate: true,
      onGet: async () => {
        const mode = this.storageSettings.values.brightnessRegulateMode;
        if (mode === 'manual') {
          const stored = this.storage.getItem('manualBrightness');
          return { value: stored && stored !== '' ? stored : '100', range: [0, 100] };
        }
        return { value: '', hide: true };
      }
    },
  });

  on: boolean = false;

  constructor(nativeId?: ScryptedNativeId) {
    super(nativeId);
    this.checkInitialStatus();
  }

  private getCameraCredentials(): { ip: string | null; username: string | null; password: string | null } {
    return {
      ip: this.storage.getItem('ip'),
      username: this.storage.getItem('username'),
      password: this.storage.getItem('password'),
    };
  }

  async checkInitialStatus(): Promise<void> {
    try {
      const { ip, username, password } = this.getCameraCredentials();
      if (ip && username && password) {
        const status = await getSupplementalLightState(ip, username, password);
        this.on = status;
      }
    } catch (e) {
      console.error(`[FloodlightSwitch] Error checking initial status: ${e}`);
    }
  }

  async turnOn(): Promise<void> {
    await this.setFloodlight(true);
    this.on = true;
  }

  async turnOff(): Promise<void> {
    await this.setFloodlight(false);
    this.on = false;
  }

  async setFloodlight(enable: boolean): Promise<void> {
    const { ip, username, password } = this.getCameraCredentials();
    const brightnessRegulateMode = this.storageSettings.values.brightnessRegulateMode;
    const manualBrightness = this.storageSettings.values.manualBrightness ? parseInt(this.storageSettings.values.manualBrightness as string, 10) : undefined;

    if (!ip || !username || !password) {
      throw new Error('FloodlightSwitch: Missing IP, username, or password.');
    }

    await setSupplementalLight(ip, username, password, enable, brightnessRegulateMode, manualBrightness);
  }

  async getSettings(): Promise<Setting[]> {
    return await this.storageSettings.getSettings();
  }

  putSetting(key: string, value: SettingValue): Promise<void> {
    return this.storageSettings.putSetting(key, value);
  }

  async getReadmeMarkdown(): Promise<string> {
    return `
## Floodlight Switch

This switch controls the supplemental light on equipped Hikvision cameras. 

TIP: The supplemental light will not turn on if the camera is in day mode.
`;
  }
}
