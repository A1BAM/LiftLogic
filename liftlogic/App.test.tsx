import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders LiftLogic Locked login screen initially', () => {
    render(<App />);
    expect(screen.getByText('LiftLogic Locked')).toBeTruthy();
  });
});
