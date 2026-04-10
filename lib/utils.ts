export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Custom fetch function to remove 'stream_options' from the request body
 * to avoid Kimi API's "Unrecognized stream_options" 400 error when using Vercel AI SDK.
 */
export const kimiCustomFetch = async (url: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
  if (init && init.body && typeof init.body === 'string') {
    try {
      const bodyObj = JSON.parse(init.body);
      if (bodyObj.stream_options) {
        delete bodyObj.stream_options;
      }
      init.body = JSON.stringify(bodyObj);
    } catch (e) {
      // Ignore JSON parse errors
    }
  }
  return fetch(url, init);
};
