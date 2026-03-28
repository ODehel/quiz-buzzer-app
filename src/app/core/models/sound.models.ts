export interface Sound {
  id: string;
  name: string;
  filename: string;
  url: string;
  created_at: string;
}

export const ALLOWED_SOUND_MIMES = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
export const MAX_SOUND_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
