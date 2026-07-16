type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: string;
  metadata?: Record<string, unknown>;
}

export class Logger {
  public constructor(private readonly context: string) {}

  public info(message: string, metadata?: Record<string, unknown>): void {
    this.write('info', message, metadata);
  }

  public warn(message: string, metadata?: Record<string, unknown>): void {
    this.write('warn', message, metadata);
  }

  public error(message: string, metadata?: Record<string, unknown>): void {
    this.write('error', message, metadata);
  }

  public debug(message: string, metadata?: Record<string, unknown>): void {
    this.write('debug', message, metadata);
  }

  private write(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      metadata,
    };

    console.log(JSON.stringify(entry));
  }
}

export const createLogger = (context: string): Logger => new Logger(context);
