import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import App from './App';

describe('App', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders LiftLogic Locked login screen initially', () => {
    render(<App />);
    expect(screen.getByText('LiftLogic Locked')).toBeTruthy();
  });

  it('toggles password visibility when the show/hide password button is clicked', () => {
    render(<App />);

    // Find password input and verify it is initially of type 'password'
    const passwordInput = screen.getByPlaceholderText('Enter password to unlock') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    // Find the toggle button by its aria-label 'Show password'
    const toggleButton = screen.getByLabelText('Show password');
    expect(toggleButton).toBeTruthy();

    // Click the button to show the password
    fireEvent.click(toggleButton);

    // Verify input type is now 'text'
    expect(passwordInput.type).toBe('text');
    expect(screen.getByLabelText('Hide password')).toBeTruthy();

    // Click again to hide the password
    fireEvent.click(toggleButton);

    // Verify input type goes back to 'password'
    expect(passwordInput.type).toBe('password');
    expect(screen.getByLabelText('Show password')).toBeTruthy();
  });
});
