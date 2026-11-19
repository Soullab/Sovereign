/**
 * Public Studio guides (founder direction 2026-11-19). Opened on a phone from the QR code in "What do I do next?", or in any
 * browser. Static: it reads no member data, calls no API, and records nothing. The step is taken from the URL hash, which never
 * reaches the server.
 */
import type { Metadata } from 'next';
import GuideClient from './GuideClient';

export const metadata: Metadata = {
  title: 'Writer’s Studio guides',
  description: 'Step-by-step guides to Writer’s Studio: starting a new Work, and bringing in a Work you’ve already written.',
  robots: { index: false, follow: false },
};

export default function StudioGuidePage() {
  return <GuideClient />;
}
