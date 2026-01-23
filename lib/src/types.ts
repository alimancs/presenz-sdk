export interface PresenzCallbacks {
  onSuccess: (result: { verified: boolean; sessionId: string; score: number }) => void;
  onError: (error: { message: string; code?: string }) => void;
  onClose?: () => void;
  onProgress?: (progress: { percent: number; message?: string }) => void;
}