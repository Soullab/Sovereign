/** @jest-environment jsdom */
/**
 * STUDIO-A-LA-CARTE-01 — a page on a Studio's own address calls its own origin.
 * Local walk 2026-11-21: on writer.<root> every apiFetch went cross-origin to the apex and was refused,
 * so the Studio opened empty and the welcome page showed a signed-in writer as signed out.
 */
import { apiBaseUrl, apiUrl } from '@/lib/http/apiBase';

const realLocation = window.location;
function at(url: string) {
  const u = new URL(url);
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { protocol: u.protocol, host: u.host, hostname: u.hostname, href: u.href, origin: u.origin },
  });
}

const savedEnv = { ...process.env };
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  process.env = { ...savedEnv };
});
beforeEach(() => {
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
  delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
});

describe('apiBaseUrl on Studio addresses', () => {
  it.each(['writer', 'sound', 'guide', 'astrology'])('⭐ %s.soullab.life calls its own origin', (sub) => {
    at(`https://${sub}.soullab.life/writers-studio`);
    expect(apiBaseUrl()).toBe('');
    expect(apiUrl('/api/members/me')).toBe('/api/members/me');
  });

  it('⭐ stays same-origin even when a build pins NEXT_PUBLIC_API_BASE_URL', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://soullab.life';
    at('https://writer.soullab.life/writers-studio/welcome');
    expect(apiBaseUrl()).toBe('');
  });

  it('follows NEXT_PUBLIC_ROOT_DOMAIN (local walk host)', () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost';
    at('http://writer.localhost:3217/writers-studio');
    expect(apiBaseUrl()).toBe('');
  });
});

describe('NEGATIVE: every other address behaves exactly as before', () => {
  it('the apex keeps the absolute fallback', () => {
    at('https://soullab.life/maia');
    expect(apiBaseUrl()).toBe('https://soullab.life');
  });

  it('a member Field subdomain is not a Studio doorway', () => {
    at('https://jondi.soullab.life/');
    expect(apiBaseUrl()).toBe('https://soullab.life');
  });

  it('a look-alike host is not a Studio doorway', () => {
    at('https://writer.soullab.life.evil.example/');
    expect(apiBaseUrl()).toBe('https://soullab.life');
    at('https://evilwriter.soullab.life/');
    expect(apiBaseUrl()).toBe('https://soullab.life');
  });

  it('a pinned NEXT_PUBLIC_API_BASE_URL still wins off a doorway', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test/';
    at('https://soullab.life/');
    expect(apiBaseUrl()).toBe('https://api.example.test');
  });

  it('plain localhost dev is unchanged', () => {
    at('http://localhost:3000/');
    expect(apiBaseUrl()).toBe('');
  });

  it('native shells never match, even on a doorway-shaped host', () => {
    at('capacitor://localhost/');
    expect(apiBaseUrl()).toBe('https://soullab.life');
    at('capacitor://writer.soullab.life/');
    expect(apiBaseUrl()).toBe('https://soullab.life');
  });
});
