"""Swiss Ephemeris references for the Pro engine outside the 1985-2026 fixtures.

ALL CASES ARE PUBLIC/SYNTHETIC (dates at 12:00 UTC, Greenwich). Run with
PySwissEph 2.10.03, Moshier analytic backend (FLG_MOSEPH | FLG_SPEED), which
needs no ephemeris data files:

    python scripts/astrology/generate-swiss-range-and-stations.py \
      > lib/astrology/__tests__/fixtures/swissRangeAndStations.json

Writes:
  positions  geocentric apparent longitudes of the ten planets, the mean node
             and mean Lilith (mean lunar apogee) on two days a year every eight
             years, 1900-2100;
  stations   every station of Mercury to Pluto from 2018 to 2027, found where
             Swiss's longitude speed changes sign and refined by bisection.
These are numerical reference fixtures, not evidence about astrological
interpretation.
"""
import json
import swisseph as swe

FLAGS = swe.FLG_MOSEPH | swe.FLG_SPEED
BODIES = {
    'sun': swe.SUN, 'moon': swe.MOON, 'mercury': swe.MERCURY, 'venus': swe.VENUS,
    'mars': swe.MARS, 'jupiter': swe.JUPITER, 'saturn': swe.SATURN,
    'uranus': swe.URANUS, 'neptune': swe.NEPTUNE, 'pluto': swe.PLUTO,
    'meanNode': swe.MEAN_NODE, 'meanLilith': swe.MEAN_APOG,
}
STATION_BODIES = ('Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto')

positions = []
for year in range(1900, 2101, 8):
    for month in (2, 8):
        jd = swe.julday(year, month, 15, 12.0)
        row = {'utc': '%04d-%02d-15T12:00:00Z' % (year, month)}
        for name, body in BODIES.items():
            row[name] = round(swe.calc_ut(jd, body, FLAGS)[0][0], 5)
        positions.append(row)

stations = []
for name in STATION_BODIES:
    body = BODIES[name.lower()]
    speed = lambda jd: swe.calc_ut(jd, body, FLAGS)[0][3]
    jd, end, step = swe.julday(2018, 1, 1, 0.0), swe.julday(2027, 1, 1, 0.0), 0.5
    before = speed(jd)
    while jd < end:
        nxt = jd + step
        now = speed(nxt)
        if (now < 0) != (before < 0):
            lo, hi = jd, nxt
            for _ in range(40):
                mid = (lo + hi) / 2
                if (speed(mid) < 0) == (before < 0):
                    lo = mid
                else:
                    hi = mid
            ms = round(((lo + hi) / 2 - 2440587.5) * 86400000)
            stations.append({'body': name, 'utcMs': ms, 'turns': 'retrograde' if before > 0 else 'direct'})
        before, jd = now, nxt

print(json.dumps({'generator': 'PySwissEph 2.10.03 FLG_MOSEPH|FLG_SPEED', 'positions': positions, 'stations': stations}, indent=1))
