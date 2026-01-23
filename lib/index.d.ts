import React, { ReactNode } from 'react';

interface PresenzCallbacks {
    onSuccess: (result: {
        verified: boolean;
        sessionId: string;
        score: number;
    }) => void;
    onError: (error: {
        message: string;
        code?: string;
    }) => void;
    onClose?: () => void;
    onProgress?: (progress: {
        percent: number;
        message?: string;
    }) => void;
}

interface PresenzConfig {
    publicKey: string;
    userId?: string;
    email?: string;
    metadata?: Record<string, any>;
    redirectUrl?: string;
}
interface PresenzButtonProps {
    config: PresenzConfig;
    callbacks: PresenzCallbacks;
    container?: HTMLElement;
    children?: ReactNode;
    className?: string;
    disabled?: boolean;
    theme?: 'light' | 'dark' | 'brand';
}
declare const PresenzButton: React.FC<PresenzButtonProps>;

export { PresenzButton };
