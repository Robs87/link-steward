const trackingParams = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term"
]);

export function normalizeUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  for (const key of [...url.searchParams.keys()]) {
    if (trackingParams.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }

  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return {
    normalizedUrl: url.toString(),
    domain: url.hostname
  };
}
