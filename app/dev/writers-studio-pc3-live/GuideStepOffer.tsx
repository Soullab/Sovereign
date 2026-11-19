'use client';
/**
 * Inside the "What do I do next?" answer: the guide step that matches this screen, a place to talk with MAIA about it, and a
 * QR code that opens that same step on the writer's phone (founder direction 2026-11-19).
 * ⛔ The QR link carries only the guide and step (`/explore/writers-studio/guide#new-7`). No member id, Work or text, and the
 *    code is drawn here in the browser: nothing is fetched or recorded.
 * ⛔ "Talk with MAIA about this step" only PLACES the step's question in the conversation composer; the writer presses Send.
 */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { guideById, guideStepHref, type GuideStepRef } from '@/lib/writersStudio/studioGuides';

export const GUIDE_TALK_LABEL = 'Talk with MAIA about this step';
export const GUIDE_PHONE_LABEL = 'Open this step on my phone';

export default function GuideStepOffer(props: { step: GuideStepRef; onTalk: (question: string) => void }) {
  const guide = guideById(props.step.guide);
  const step = guide.steps[props.step.step - 1];
  const [phone, setPhone] = useState(false);
  const [svg, setSvg] = useState<string | null>(null);
  const [href, setHref] = useState('');

  useEffect(() => {
    if (!phone) return;
    const link = guideStepHref(props.step, window.location.origin);
    setHref(link);
    let cancelled = false;
    QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then((out) => { if (!cancelled) setSvg(out); })
      .catch(() => { if (!cancelled) setSvg(null); });
    return () => { cancelled = true; };
  }, [phone, props.step]);

  if (!step) return null;
  return (
    <div data-guide-step={`${props.step.guide}-${props.step.step}`} style={{ borderTop: '1px solid color-mix(in srgb, currentColor 18%, transparent)', paddingTop: 10, marginTop: 4, display: 'grid', gap: 8 }}>
      <p style={{ margin: 0 }}>In the guide, this is <b>step {props.step.step}: {step.title}</b>.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="p4r1-talk" data-guide-talk="true" onClick={() => props.onTalk(step.talk)}>{GUIDE_TALK_LABEL}</button>
        <button type="button" className="p4r1-talk" data-guide-phone="true" aria-expanded={phone} onClick={() => setPhone((p) => !p)}>{GUIDE_PHONE_LABEL}</button>
      </div>
      {phone ? (
        <div data-guide-qr="true" style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
          {svg ? (
            <div role="img" aria-label="QR code that opens this guide step on your phone"
              style={{ width: 168, height: 168, background: '#fff', padding: 6, borderRadius: 8 }}
              dangerouslySetInnerHTML={{ __html: svg }} />
          ) : <p style={{ margin: 0 }}>Preparing the code…</p>}
          <p style={{ margin: 0 }}>Point your phone’s camera at the code. Or type this address on your phone:</p>
          <code style={{ fontSize: 14, overflowWrap: 'anywhere' }}>{href}</code>
          <p style={{ margin: 0, fontSize: 14, opacity: .85 }}>The guide needs no sign-in, and the link holds nothing about you or your Work.</p>
        </div>
      ) : null}
    </div>
  );
}
