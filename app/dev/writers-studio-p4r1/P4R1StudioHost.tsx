'use client';

import { useSearchParams } from 'next/navigation';
import P4R1HomeController from '../writers-studio-pc3-live/P4R1HomeController';
import P4R1WriteEditController from '../writers-studio-pc3-live/P4R1WriteEditController';
import P4R1DevelopController from '../writers-studio-pc3-live/P4R1DevelopController';
import P4R1ReviewController from '../writers-studio-pc3-live/P4R1ReviewController';
import P4R1PublishRoom from '../writers-studio-pc3-live/P4R1PublishRoom';
import ListenPilot from '../writers-studio-pc3-live/ListenPilot';
import P4R1ThemeMenu from './P4R1ThemeMenu';
import P4R1BetaFeedback from './P4R1BetaFeedback';
import P4R1BetaJourney from './P4R1BetaJourney';
import { ConstellationArrival } from '../../writers-studio/ConstellationArrival';
import { unifiedModeFrom, type UnifiedStudioMode } from './studioMode';
import StudioWorkAgeGate from '../writers-studio-pc3-live/StudioWorkAgeGate';
import { ShareExchangeProvider } from '@/lib/writersStudio/ShareExchangeContext';
import { JourneyRecordingsProvider } from '@/lib/writersStudio/JourneyRecordingsContext';

export default function P4R1StudioHost({
  defaultMode = 'write',
  shareEnabled = false,
  recordingsEnabled = false,
}: {
  defaultMode?: UnifiedStudioMode;
  /** Studio Academy slice 6: read from WS_SHARE_EXCHANGE_ENABLED by the server page. Presentation only; dark by default. */
  shareEnabled?: boolean;
  /** Studio Academy slice 5: read from WS_JOURNEY_RECORDINGS_ENABLED by the server page. Presentation only; dark by default. */
  recordingsEnabled?: boolean;
}) {
  const params = useSearchParams();
  const mode = unifiedModeFrom(params?.get('mode'), defaultMode);

  const room = mode === 'home' ? <P4R1HomeController />
    : mode === 'develop' ? <P4R1DevelopController />
      : mode === 'review' ? <P4R1ReviewController />
        : mode === 'publish' ? <P4R1PublishRoom />
          : mode === 'listen' ? <ListenPilot />
            : <P4R1WriteEditController />;

  return (
    <ShareExchangeProvider value={shareEnabled}>
    <JourneyRecordingsProvider value={recordingsEnabled}>
      <P4R1ThemeMenu />
      <P4R1BetaFeedback mode={mode} />
      <P4R1BetaJourney />
      {mode === 'home' && <ConstellationArrival />}
      {/* Founder ruling 2026-11-16 (#1900): a Work whose recorded program requires it asks the age question before any room opens. */}
      {mode === 'home' ? room : <StudioWorkAgeGate key={params?.get('work') ?? ''} workId={params?.get('work') ?? null}>{room}</StudioWorkAgeGate>}
    </JourneyRecordingsProvider>
    </ShareExchangeProvider>
  );
}
