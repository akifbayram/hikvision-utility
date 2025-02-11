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
  ScryptedDevice,
} from '@scrypted/sdk';
import { StorageSettings } from '@scrypted/sdk/storage-settings';
import { 
  getAudioAlarmCapabilities, 
  setAudioAlarmConfig, 
  triggerAlarmInput,
  setAlarmTriggerConfig  // new import
} from './hikvision-api';

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
      console.error(`[AlarmSwitch] fetchCameraSetting: Error retrieving ${key}: ${e}`);
    }
  }
  return '';
}

export class AlarmSwitch extends ScryptedDeviceBase implements OnOff, Settings, Readme {
  storageSettings = new StorageSettings(this, {
    camera: {
      title: 'Camera',
      description: 'Select the device to use for alarm control.',
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
          // NEW: Immediately call the alarm trigger API to enable linkage actions.
          try {
            await setAlarmTriggerConfig(ip, username, password);
          } catch (err) {
            console.error(`[AlarmSwitch] Error setting alarm trigger configuration: ${err}`);
          }
        }
        return { value: newValue };
      },
    },
    audioAlarmType: {
      title: 'Alarm Type',
      description: 'Select the audio alarm sound type.',
      type: 'string',
      choices: [],
      defaultValue: '',
    },
    audioAlarmVolume: {
      title: 'Alarm Volume (1-100)',
      description: 'Volume level for the audio alarm.',
      type: 'number',
      defaultValue: 20,
    },
  });

  on: boolean = false;

  constructor(nativeId?: ScryptedNativeId) {
    super(nativeId);
  }

  private getCameraCredentials(): { ip: string | null; username: string | null; password: string | null } {
    return {
      ip: this.storage.getItem('ip'),
      username: this.storage.getItem('username'),
      password: this.storage.getItem('password'),
    };
  }

  async turnOn(): Promise<void> {
    const { ip, username, password } = this.getCameraCredentials();
    if (!ip || !username || !password) {
      throw new Error('AlarmSwitch: Missing camera credentials.');
    }
    try {
      await triggerAlarmInput(ip, username, password, true);
      this.on = true;
    } catch (e) {
      console.error(`[AlarmSwitch] Error triggering alarm input: ${e}`);
      throw e;
    }
  }

  async turnOff(): Promise<void> {
    const { ip, username, password } = this.getCameraCredentials();
    if (!ip || !username || !password) {
      this.on = false;
      return;
    }
    try {
      await triggerAlarmInput(ip, username, password, false);
      this.on = false;
    } catch (e) {
      console.error(`[AlarmSwitch] Error resetting alarm input: ${e}`);
    }
  }

  async getSettings(): Promise<Setting[]> {
    const settings = await this.storageSettings.getSettings();
    const { ip, username, password } = this.getCameraCredentials();
    if (ip && username && password) {
      try {
        const capabilities = await getAudioAlarmCapabilities(ip, username, password);
        if (capabilities && capabilities.AudioAlarmCap && capabilities.AudioAlarmCap.audioTypeListCap) {
          const choices = capabilities.AudioAlarmCap.audioTypeListCap.map((item: any) => ({
            title: item.audioDescription,
            value: item.audioID.toString()
          }));
          const audioAlarmTypeSetting = settings.find(s => s.key === 'audioAlarmType');
          if (audioAlarmTypeSetting) {
            audioAlarmTypeSetting.choices = choices;
            if (!audioAlarmTypeSetting.value && choices.length > 0) {
              audioAlarmTypeSetting.value = choices[0].value;
            }
          }
        }
      } catch (e) {
        console.error(`[AlarmSwitch] Error fetching alarm capabilities: ${e}`);
      }
    }
    return settings;
  }

  async putSetting(key: string, value: SettingValue): Promise<void> {
    await this.storageSettings.putSetting(key, value);

    if (key === 'audioAlarmType' || key === 'audioAlarmVolume') {
      const { ip, username, password } = this.getCameraCredentials();
      if (!ip || !username || !password) {
        console.warn('[AlarmSwitch] Cannot update alarm configuration due to missing camera credentials.');
        return;
      }
      const audioAlarmType = this.storageSettings.values.audioAlarmType;
      const audioAlarmVolume = this.storageSettings.values.audioAlarmVolume;
      try {
        await setAudioAlarmConfig(ip, username, password, audioAlarmType, audioAlarmVolume.toString(), "1");
      } catch (e) {
        console.error(`[AlarmSwitch] Error updating alarm configuration: ${e}`);
      }
    }
  }

  async getReadmeMarkdown(): Promise<string> {
    return `
## Alarm Switch

This switch triggers the camera's alarm by triggering the alarm input.
When the switch is created the camera is configured to enable the
linkage actions for the audio alarm and white light (strobe or normally on).
    `;
  }
}
