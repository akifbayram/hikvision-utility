import sdk, { DeviceCreatorSettings, ScryptedDeviceType, ScryptedInterface, ScryptedDevice, Settings } from '@scrypted/sdk';
import { FloodlightSwitch } from './floodlight-switch';
import crypto from 'crypto';

class FloodlightProvider {
  async getCreateDeviceSettings(): Promise<any[]> {
    return [
      {
        key: 'deviceType',
        title: 'Device Type',
        description: 'Choose the type of device to add.',
        type: 'string',
        choices: ['Floodlight', 'Audio Alarm'],
        defaultValue: 'Floodlight',
      },
      {
        key: 'camera',
        title: 'Camera',
        description: 'Select a camera or doorbell that supports supplemental floodlight control.',
        type: 'device',
        deviceFilter: `(type === '${ScryptedDeviceType.Camera}' || type === '${ScryptedDeviceType.Doorbell}') && interfaces.includes('${ScryptedInterface.Camera}')`,
      },
    ];
  }
  async createDevice(settings: DeviceCreatorSettings): Promise<string> {
    const deviceType = settings.deviceType;
    const cameraId = settings.camera;
    if (!deviceType || !cameraId) {
      throw new Error('Missing device type or camera selection.');
    }
    const nativeId = deviceType === 'Floodlight'
      ? 'floodlight-switch-' + crypto.randomBytes(4).toString('hex')
      : 'audio-alarm-' + crypto.randomBytes(4).toString('hex');
    const camera = sdk.systemManager.getDeviceById(String(cameraId));
    const nameBase = camera ? camera.name : (deviceType === 'Floodlight' ? 'Floodlight' : 'Audio Alarm');
    const name = deviceType === 'Floodlight'
      ? `${nameBase} Floodlight Switch`
      : `${nameBase} Audio Alarm Switch`;
    const type = deviceType === 'Floodlight' ? ScryptedDeviceType.Light : ScryptedDeviceType.Notifier;
    const interfaces = deviceType === 'Floodlight'
      ? [ScryptedInterface.OnOff, ScryptedInterface.Settings, ScryptedInterface.Readme]
      : [ScryptedInterface.Notifier, ScryptedInterface.Settings, ScryptedInterface.Readme];
    const id = await sdk.deviceManager.onDeviceDiscovered({
      nativeId,
      name,
      type,
      interfaces,
    });
    const device = sdk.systemManager.getDeviceById<ScryptedDevice & Settings>(id);
    await device.putSetting('camera', cameraId);
    return id;
  }
  async getDevice(nativeId: string): Promise<FloodlightSwitch> {
    return new FloodlightSwitch(nativeId);
  }
}

export default new FloodlightProvider();
