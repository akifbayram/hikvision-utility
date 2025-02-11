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

export async function getAudioAlarmCapabilities(ip: string, username: string, password: string): Promise<any> {
  const url = getCameraUrl('/ISAPI/Event/triggers/notifications/AudioAlarm/capabilities?format=json', ip);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getAuthHeader(username, password),
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP error fetching audio alarm capabilities! status: ${response.status}`);
  }
  const data = await response.json();
  return data;
}

export async function setAudioAlarmConfig(
  ip: string,
  username: string,
  password: string,
  audioID: string,
  audioVolume: string,
  alarmTimes: string
): Promise<void> {
  const url = getCameraUrl('/ISAPI/Event/triggers/notifications/AudioAlarm?format=json', ip);

  const timeRangeList = [];
  for (let week = 1; week <= 7; week++) {
    timeRangeList.push({
      week: week,
      TimeRange: [{
        id: 1,
        beginTime: "00:00",
        endTime: "24:00",
      }]
    });
  }
  const payload = {
    AudioAlarm: {
      audioID: parseInt(audioID, 10),
      audioVolume: parseInt(audioVolume, 10),
      alarmTimes: parseInt(alarmTimes, 10),
      TimeRangeList: timeRangeList,
      audioClass: "alertAudio",
      alertAudioID: parseInt(audioID, 10),
      customAudioID: 1,
    }
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getAuthHeader(username, password),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`HTTP error setting audio alarm config! status: ${response.status}`);
  }
}

export async function setAlarmTriggerConfig(
  ip: string,
  username: string,
  password: string
): Promise<void> {
  const url = getCameraUrl('/ISAPI/Event/triggers/IO-1', ip);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<EventTrigger version="2.0" xmlns="http://www.std-cgi.com/ver20/XMLSchema">
  <id>IO-1</id>
  <eventType>IO</eventType>
  <eventDescription>IO Event trigger Information</eventDescription>
  <inputIOPortID>1</inputIOPortID>
  <videoInputChannelID>1</videoInputChannelID>
  <dynVideoInputChannelID>1</dynVideoInputChannelID>
  <EventTriggerNotificationList>
    <EventTriggerNotification>
        <id>beep</id>
        <notificationMethod>beep</notificationMethod>
        <notificationRecurrence>beginning</notificationRecurrence>
    </EventTriggerNotification>
    <EventTriggerNotification>
        <id>center</id>
        <notificationMethod>center</notificationMethod>
        <notificationRecurrence>beginning</notificationRecurrence>
    </EventTriggerNotification>
    <EventTriggerNotification>
        <id>whiteLight</id>
        <notificationMethod>whiteLight</notificationMethod>
        <notificationRecurrence>beginning</notificationRecurrence>
        <WhiteLightAction>
            <whiteLightDurationTime>0</whiteLightDurationTime>
        </WhiteLightAction>
    </EventTriggerNotification>  
  </EventTriggerNotificationList>
</EventTrigger>`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/xml',
      'Authorization': getAuthHeader(username, password),
    },
    body: xml,
  });
  if (!response.ok) {
    throw new Error(`HTTP error setting alarm trigger config! status: ${response.status}`);
  }
}



export async function triggerAlarmInput(
  ip: string,
  username: string,
  password: string,
  isOn: boolean
): Promise<void> {
  const url = getCameraUrl('/ISAPI/System/IO/inputs/1', ip);
  const data = `<IOPortData>
    <enabled>${isOn ? 'true' : 'false'}</enabled>
    <triggering>${isOn ? 'low' : 'high'}</triggering>
</IOPortData>`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/xml',
      'Authorization': getAuthHeader(username, password),
    },
    body: data,
  });
  if (!response.ok) {
    throw new Error(`HTTP error triggering alarm input! status: ${response.status}`);
  }
}
