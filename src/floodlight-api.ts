import { Buffer } from 'buffer';

export function getCameraUrl(path: string, ip: string): string {
  return `http://${ip}${path}`;
}

export function getAuthHeader(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

export async function getSupplementalLightState(ip: string, username: string, password: string): Promise<boolean> {
  const url = getCameraUrl('/ISAPI/Image/channels/1/supplementLight', ip);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/xml',
      'Authorization': getAuthHeader(username, password),
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const responseText = await response.text();
  const brightnessMatch = responseText.match(/<whiteLightBrightness>(\d+)<\/whiteLightBrightness>/);
  const brightness = brightnessMatch ? parseInt(brightnessMatch[1], 10) : 0;
  const isOn = brightness > 0;
  return isOn;
}

export async function setSupplementalLight(
  ip: string,
  username: string,
  password: string,
  enabled: boolean,
  brightnessRegulateMode: string = 'auto',
  manualBrightness?: number
): Promise<void> {
  const brightness = enabled
    ? (brightnessRegulateMode === 'manual' && manualBrightness !== undefined ? manualBrightness.toString() : '100')
    : '0';
  const data = `<SupplementLight>
    <supplementLightMode>colorVuWhiteLight</supplementLightMode>
    <mixedLightBrightnessRegulatMode>${brightnessRegulateMode}</mixedLightBrightnessRegulatMode>
    <whiteLightBrightness>${brightness}</whiteLightBrightness>
</SupplementLight>`;
  const url = getCameraUrl('/ISAPI/Image/channels/1/supplementLight', ip);
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/xml',
      'Authorization': getAuthHeader(username, password),
    },
    body: data,
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}