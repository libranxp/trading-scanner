const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

export const fetchWithProxy = async (url) => {
  try {
    // Try direct request first
    const response = await fetch(url);
    if (response.ok) {
      return response;
    }
  } catch (error) {
    console.log('Direct request failed, trying with proxy...');
  }
  
  // Fallback to proxy
  return fetch(CORS_PROXY + url);
};
