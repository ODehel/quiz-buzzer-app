export interface Buzzer {
  id: string;
  name: string;
  battery?: number;
  wifiRSSI?: number;
  latency?: number;
  connected: boolean;
  connectedAt?: number;
}

export interface BuzzerStatus {
  buzzerID: string;
  battery: number;
  wifiRSSI: number;
  freeHeap: number;
}