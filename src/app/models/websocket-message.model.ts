export interface WebSocketMessage {
  type: string;
  timestamp: number;
  sender: 'ANGULAR' | 'SERVER' | string;
  payload: any;
}

export interface ConnectedPayload {
  sessionID: string;
  serverTime: number;
  config: {
    maxBuzzers: number;
    version: string;
  };
}

export interface BuzzerConnectedPayload {
  buzzer: {
    id: string;
    name: string;
    connectedAt: number;
  };
  totalBuzzers: number;
}