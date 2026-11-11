import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// The app remembers where you were across reloads. Between tests that is
// leakage: one test's open workout would be the next test's starting screen.
afterEach(() => localStorage.clear());
