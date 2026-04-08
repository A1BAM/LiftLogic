import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;
  let consoleDebugSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('should log info messages with [INFO] prefix', () => {
    logger.info('test info');
    expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] test info');
  });

  it('should log warn messages with [WARN] prefix', () => {
    logger.warn('test warn');
    expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] test warn');
  });

  it('should log error messages with [ERROR] prefix', () => {
    logger.error('test error');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] test error');
  });

  it('should log debug messages with [DEBUG] prefix', () => {
    logger.debug('test debug');
    expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG] test debug');
  });

  it('should pass additional arguments to console methods', () => {
    logger.info('test info', { key: 'value' });
    expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] test info', { key: 'value' });
  });
});
