
export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
  };

  // 'include' sends cookies even for cross-origin requests
  const res = await fetch(url, { ...options, headers, credentials: 'include' });
  return res;
};
