import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test behavior based on the node environment.
// We will mock process.env
const originalEnv = process.env;

describe('logger', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;
  let consoleDebugSpy: any;

  beforeEach(() => {
    vi.resetModules(); // clears cache so we can re-import logger with different process.env
    process.env = { ...originalEnv };
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should log info messages with [INFO] prefix when not in production', async () => {
    process.env.NODE_ENV = 'development';
    const { logger } = await import('./logger');
    logger.info('test info');
    expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] test info');
  });

  it('should log warn messages with [WARN] prefix when not in production', async () => {
    process.env.NODE_ENV = 'development';
    const { logger } = await import('./logger');
    logger.warn('test warn');
    expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] test warn');
  });

  it('should log error messages with [ERROR] prefix when not in production', async () => {
    process.env.NODE_ENV = 'development';
    const { logger } = await import('./logger');
    logger.error('test error');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] test error');
  });

  it('should log debug messages with [DEBUG] prefix when not in production', async () => {
    process.env.NODE_ENV = 'development';
    const { logger } = await import('./logger');
    logger.debug('test debug');
    expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG] test debug');
  });

  it('should pass additional arguments to console methods when not in production', async () => {
    process.env.NODE_ENV = 'development';
    const { logger } = await import('./logger');
    logger.info('test info', { key: 'value' });
    expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] test info', { key: 'value' });
  });

  it('should not log info messages when in production', async () => {
    process.env.NODE_ENV = 'production';
    const { logger } = await import('./logger');
    logger.info('test info');
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should not log warn messages when in production', async () => {
    process.env.NODE_ENV = 'production';
    const { logger } = await import('./logger');
    logger.warn('test warn');
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should not log error messages when in production', async () => {
    process.env.NODE_ENV = 'production';
    const { logger } = await import('./logger');
    logger.error('test error');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
