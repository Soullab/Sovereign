import fs from 'node:fs';
import path from 'node:path';

const HOME = fs.readFileSync(path.resolve(process.cwd(), 'app/home/page.tsx'), 'utf8');
const HOUSE = fs.readFileSync(path.resolve(process.cwd(), 'app/house/page.tsx'), 'utf8');
const THRESHOLD = fs.readFileSync(path.resolve(process.cwd(), 'app/house/MaiaThresholdLink.tsx'), 'utf8');

describe('Soullab home route authority', () => {
  it('/home is the canonical Soullab entrance: threshold when signed out, House when signed in', () => {
    expect(HOME).toContain("import { HouseExperience } from '@/app/house/page';");
    expect(HOME).toContain("import { HomeThreshold } from './HomeThreshold';");
    expect(HOME).toContain('const memberId = await authenticatedMemberId();');
    expect(HOME).toContain('if (!memberId) return <HomeThreshold />;');
    expect(HOME).toContain('<HouseExperience current="home" />');
  });

  it('the Living Field v3 shell is opt-in only; signed-in members get the House by default', () => {
    // v3 is an owner-review candidate, not admitted: it may render only on an explicit ?field=v3.
    expect(HOME).toContain("if (p.field !== 'v3') return <HouseExperience current=\"home\" />;");
  });

  it('/house retains the same organism with House identity', () => {
    expect(HOUSE).toContain('<HouseExperience current="house" />');
  });

  it('Home opens the explicit MAIA encounter route, never bare /maia', () => {
    expect(THRESHOLD).toContain("router.push('/maia/encounter?from=home')");
    expect(THRESHOLD).not.toContain("router.push('/maia?from=house')");
  });
});
