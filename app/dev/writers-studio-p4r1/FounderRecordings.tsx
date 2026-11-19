'use client';
/** The founder's list of recorded journey answers (Studio Academy slice 5). Drawn only when on; the route checks the founder. */
import { useEffect, useState } from 'react';
import { useJourneyRecordingsEnabled } from '@/lib/writersStudio/JourneyRecordingsContext';
import { listAllRecordings, recordingUrl } from '@/lib/writersStudio/journeyRecordingsClient';
import type { FounderRecording } from '@/lib/writersStudio/journeyRecordingsServer';
import { JOURNEY_PROMPTS } from '@/lib/writersStudio/journey';

export default function FounderRecordings() {
  const enabled = useJourneyRecordingsEnabled();
  const [list, setList] = useState<FounderRecording[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void listAllRecordings().then((r) => { if (live) setList(r ?? []); });
    return () => { live = false; };
  }, [enabled]);
  useEffect(() => () => Object.values(urls).forEach((u) => URL.revokeObjectURL(u)), []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!enabled || list === null) return null;
  return (
    <section className="p4r1-journey-prompt" data-founder-recordings>
      <p className="p4r1-journey-question">Recorded answers</p>
      <small>{list.length} recorded · each is deleted when the writer withdraws it or it expires</small>
      {list.map((r) => (
        <div key={r.id} className="p4r1-journey-answer">
          <b>{r.memberName} · {new Date(r.createdAt).toLocaleDateString()}</b>
          <small>{JOURNEY_PROMPTS.find((p) => p.key === r.promptKey)?.text ?? r.promptKey}</small>
          {urls[r.id]
            ? (r.kind === 'video' ? <video controls src={urls[r.id]} style={{ maxWidth: '100%' }} /> : <audio controls src={urls[r.id]} />)
            : <button type="button" onClick={async () => { const u = await recordingUrl(r.id); if (u) setUrls((m) => ({ ...m, [r.id]: u })); }}>Play</button>}
          {r.transcript ? <p>{r.transcript}</p> : <small>No written copy.</small>}
        </div>
      ))}
    </section>
  );
}
