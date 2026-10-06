// ---------------------------------------------------------------------------
// Step 12 FIX — Hostname / domain policy (single source of truth)
//
// Two kinds of tenant host exist, and they are trusted very differently:
//
//   PLATFORM_SUBDOMAIN  <slug>.<parent>   The platform controls the parent
//                       domain, so it can assert ownership itself. Auto-VRF.
//   CUSTOM_DOMAIN       crm.acme.com      The customer controls DNS. The
//                       platform can assert NOTHING about it. Always PENDING
//                       until an actual verification operation proves control.
//
// This module is the ONLY place a hostname is classified or trusted. Both
// server/tenantContext.ts (resolution) and server/provisioningService.ts
// (creation) import from here so the two can never disagree about what counts
// as a platform-owned host.
// ---------------------------------------------------------------------------

/** Subdomains the platform serves itself; never a tenant slug. */
const RESERVED_HOSTS = new Set([
  'www', 'api', 'admin', 'app', 'mail', 'support', 'status',
  'billing', 'cdn', 'static', 'assets', 'console', 'dashboard',
]);

/**
 * Parent domains the platform owns. Configured via TENANT_PARENT_DOMAINS.
 * The first entry is the canonical parent used to mint new subdomains.
 */
export const PARENT_DOMAINS: readonly string[] = (() => {
  const raw = (process.env.TENANT_PARENT_DOMAINS || 'mmba.example,localhost')
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);
  // De-duplicate while preserving order so entry 0 stays canonical.
  return Object.freeze([...new Set(raw)]);
})();

/** The parent domain new platform subdomains are minted under. */
export function primaryParentDomain(): string {
  return PARENT_DOMAINS[0] || 'mmba.example';
}

/** Normalize a hostname: lowercase, strip :port, strip trailing dot, strip www. */
export function normalizeHostname(raw: string | undefined | null): string {
  if (!raw) return '';
  let h = String(raw).trim().toLowerCase();
  // Strip the port. Guard IPv6 literals ("[::1]:3000") so we do not cut the host.
  if (h.startsWith('[')) {
    const close = h.indexOf(']');
    if (close > 0) h = h.slice(0, close + 1);
  } else {
    const colon = h.lastIndexOf(':');
    if (colon > 0) h = h.slice(0, colon);
  }
  h = h.replace(/\.$/, '');
  if (h.startsWith('www.')) h = h.slice(4);
  return h;
}

export type HostnameKind = 'PLATFORM_SUBDOMAIN' | 'CUSTOM_DOMAIN';

export interface HostnameClassification {
  hostname: string;
  kind: HostnameKind;
  /** Set only for PLATFORM_SUBDOMAIN: the tenant slug encoded in the host. */
  slug: string | null;
}

/**
 * Classify a hostname. A host is a PLATFORM_SUBDOMAIN only when it is exactly
 * one label below a parent domain the platform owns — `<slug>.<parent>`.
 *
 * Deliberately strict: `a.b.mmba.example` is NOT a platform subdomain (two
 * labels below the parent, so a customer could not have registered it under our
 * own parent, but the shape proves nothing); it is treated as a CUSTOM_DOMAIN
 * and must be verified before use.
 */
export function classifyHostname(raw: string | undefined | null): HostnameClassification {
  const hostname = normalizeHostname(raw);
  if (!hostname) return { hostname: '', kind: 'CUSTOM_DOMAIN', slug: null };

  for (const parent of PARENT_DOMAINS) {
    const suffix = '.' + parent;
    if (!hostname.endsWith(suffix)) continue;
    const label = hostname.slice(0, -(suffix.length));
    // Exactly one label, non-empty, not a reserved platform host.
    if (label && !label.includes('.') && !RESERVED_HOSTS.has(label)) {
      return { hostname, kind: 'PLATFORM_SUBDOMAIN', slug: label };
    }
  }
  return { hostname, kind: 'CUSTOM_DOMAIN', slug: null };
}

/** The platform subdomain a tenant is served on, e.g. `acme.mmba.example`. */
export function platformSubdomainForSlug(slug: string): string {
  return `${slug}.${primaryParentDomain()}`;
}

/**
 * Whether the platform may mark this hostname VERIFIED without an external
 * check. True ONLY for a platform subdomain under a parent we control.
 */
export function isAutoVerifiableHostname(raw: string | undefined | null): boolean {
  return classifyHostname(raw).kind === 'PLATFORM_SUBDOMAIN';
}

/** Hostnames that may act as an ACTIVE tenant host (routing eligibility). */
export const ACTIVE_HOST_STATUSES: readonly string[] = ['VERIFIED', 'ACTIVE'];

/** Whether a domain row's status allows it to resolve/route traffic. */
export function isRoutableDomainStatus(status: string | null | undefined): boolean {
  return ACTIVE_HOST_STATUSES.includes(String(status || '').toUpperCase());
}

export { RESERVED_HOSTS };
