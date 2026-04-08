declare module '@xterm/xterm' {
  export class Terminal {
    constructor(options?: any);
    loadAddon(addon: any): void;
    open(element: HTMLElement): void;
    write(data: string | Uint8Array): void;
    clear(): void;
    onData(handler: (data: string) => void): { dispose(): void };
    onKey(handler: (event: { key: string; domEvent: KeyboardEvent }) => void): { dispose(): void };
    onResize(handler: (event: { cols: number; rows: number }) => void): { dispose(): void };
    dispose(): void;
  }
}

declare module '@xterm/addon-fit' {
  export class FitAddon {
    fit(): void;
  }
}

declare module 'node-pty' {
  export interface IPty {
    pid: number;
    cols: number;
    rows: number;
    onData(handler: (data: string) => void): void;
    onExit(handler: (event: { exitCode: number; signal?: number }) => void): void;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(signal?: string): void;
  }
  export function spawn(file: string, args: string[] | string, options?: any): IPty;
}
