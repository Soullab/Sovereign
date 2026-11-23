'use client';

/**
 * Mayan calendar room.
 *
 * The traditional Chol Q'ij (K'iche' Maya 260-day count, GMT correlation)
 * comes first: the birth day and today's day. The modern Dreamspell
 * (Argüelles, 1987) follows beneath as a separate, optional lens, never as a
 * translation of or substitute for the traditional day (founder ruling
 * 2026-11-23).
 *
 * Dune/Blade Runner aesthetic: Desert mysticism meets ancient future
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Sparkles, Sun as SunIcon, Moon as MoonIcon } from 'lucide-react';
import ZodiacToggle, { type ZodiacSystem } from '@/components/astrology/ZodiacToggle';
import { useVerifiedFreeAstrologyBirthProfile } from '@/lib/hooks/useVerifiedFreeAstrologyBirthProfile';
import { motion } from 'framer-motion';
import { MayanSignCard, MayanPathOfLife } from '@/components/astrology/MayanRoomViews';
import { CholQijDayCard } from '@/components/astrology/CholQijDayCard';
import { apiFetch } from '@/lib/http/apiBase';
import {
  traditionalMaya,
  localCivilDate,
  DREAMSPELL_DISTINCTION,
  type TraditionalMaya,
} from '@/lib/astrology/proTraditionalMaya';
import {
  calculateMayanBirthSign,
  getTodaysMayanSign,
  calculateCompleteMayanProfile,
  type MayanBirthSign,
  type CompleteMayanProfile,
  type PathOfLife,
} from '@/lib/astrology/mayanAstrology';

export default function MayanAstrologyPage() {
  const router = useRouter();

  const handleSystemChange = useCallback((mode: ZodiacSystem) => {
    if (mode === 'tropical') { router.push('/astrology'); }
    if (mode === 'sidereal') { router.push('/astrology/vedic'); }
    if (mode === 'chinese') { router.push('/astrology/chinese'); }
  }, [router]);

  const verifiedBirth = useVerifiedFreeAstrologyBirthProfile();
  const [birthDate, setBirthDate] = useState('');
  const [birthSign, setBirthSign] = useState<MayanBirthSign | null>(null);
  const [todaySign, setTodaySign] = useState<MayanBirthSign | null>(null);
  const [showToday, setShowToday] = useState(false);
  const [completeProfile, setCompleteProfile] = useState<CompleteMayanProfile | null>(null);
  const [activeView, setActiveView] = useState<'signature' | 'pillars' | 'today'>('pillars');
  const [traditionalBirth, setTraditionalBirth] = useState<TraditionalMaya | null>(null);
  const [traditionalToday, setTraditionalToday] = useState<TraditionalMaya | null>(null);
  // Members with Pro may take a path card into Pro's Mayan Ask MAIA. Pro asks
  // about their own chart, so the link shows only for their own verified date.
  const [hasPro, setHasPro] = useState(false);
  const ownDate = verifiedBirth.status === 'verified' ? verifiedBirth.birthData?.date ?? null : null;
  useEffect(() => {
    if (!ownDate) { setHasPro(false); return; }
    let live = true;
    apiFetch('/api/astrology/pro/access', { cache: 'no-store' })
      .then((r) => { if (live) setHasPro(r.ok); })
      .catch(() => { if (live) setHasPro(false); });
    return () => { live = false; };
  }, [ownDate, verifiedBirth.memberId]);
  const askHref = hasPro && ownDate && birthDate === ownDate ? '/astrology/pro-preview?open=mayan' : undefined;

  // Today's day in both counts never needs natal data. The traditional day is
  // the visitor's local civil date.
  useEffect(() => {
    setTraditionalToday(traditionalMaya(localCivilDate()));
    setTodaySign(getTodaysMayanSign());
  }, []);

  // A saved personal date may only arrive from the verified member profile.
  // Historic local birthDate and beta_user caches are left untouched and
  // cannot automatically become a different person's calendar reading.
  useEffect(() => {
    setBirthDate('');
    setBirthSign(null);
    setCompleteProfile(null);
    setTraditionalBirth(null);
    const day=verifiedBirth.status==='verified'?verifiedBirth.birthData?.date:null;
    if(!day)return;
    setBirthDate(day);
    calculateSign(day);
  },[verifiedBirth.status,verifiedBirth.memberId,verifiedBirth.birthData?.date]);

  const calculateSign = (day: string) => {
    setTraditionalBirth(traditionalMaya(day));
    const date = new Date(day + 'T12:00:00.000Z');
    const sign = calculateMayanBirthSign(date);
    setBirthSign(sign);
    const profile = calculateCompleteMayanProfile(date);
    setCompleteProfile(profile);
  };

  const handleDateChange = (dateString: string) => {
    setBirthDate(dateString);
    if (dateString) {
      calculateSign(dateString);
    } else {
      setBirthSign(null);
      setCompleteProfile(null);
      setTraditionalBirth(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-amber-950/20 to-black">
      {/* Ambient background */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-600 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* System selector */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/astrology"
            className="inline-flex items-center text-amber-500/40 hover:text-amber-400 transition-colors"
            aria-label="Back to Astrology"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <ZodiacToggle value="mayan" onChange={handleSystemChange} compact />
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 text-amber-500 mb-4">
            <Calendar className="w-6 h-6" />
            <span className="text-sm uppercase tracking-wider font-light">Chol Q’ij · K’iche’ Maya tradition</span>
          </div>
          <h1 className="text-5xl font-bold text-amber-100 mb-4">
            The Maya Calendar
          </h1>
          <p className="text-amber-300/80 text-lg max-w-3xl mx-auto leading-relaxed">
            The Chol Q’ij (Tzolk’in in Yucatec) is the 260-day count of thirteen
            numbers and twenty nawales, still kept by K’iche’ and other Maya
            daykeepers. It is a living cosmovision, not another zodiac. Your
            birth day and today’s day in that count come first. The modern
            Dreamspell follows below as a separate, optional lens.
          </p>
        </motion.div>

        {/* Date Input — always visible so user can edit and try other birthdays */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md mx-auto mb-12"
        >
          <div className="bg-gradient-to-br from-stone-900/80 via-amber-950/40 to-stone-900/80 backdrop-blur-xl border border-amber-900/30 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-amber-100 mb-2">
              {birthSign ? 'Birth Date' : 'Find Your Chol Q’ij Birth Day'}
            </h3>
            <p className="text-amber-400/70 text-xs mb-4">
              {birthSign
                ? 'Change the date to read another day.'
                : 'Enter your birth date to find your day in the traditional count.'}
            </p>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-amber-800/50 rounded-lg text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
              min="1900-01-01"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </motion.div>

        {/* The traditional day count, first */}
        <div className="max-w-3xl mx-auto grid gap-6 mb-16">
          {traditionalBirth && <CholQijDayCard day={traditionalBirth} title="Your Chol Q’ij birth day" />}
          {traditionalToday && (
            <CholQijDayCard day={traditionalToday} title="Today in the Chol Q’ij" showMethod={!traditionalBirth} />
          )}
        </div>

        {/* The Dreamspell, beneath, as a separate modern system */}
        <section aria-label="Modern Dreamspell" className="max-w-3xl mx-auto mb-8 text-center">
          <h2 className="text-2xl font-bold text-amber-100/80 mb-2">Modern Dreamspell</h2>
          <p className="text-amber-400/60 text-sm leading-relaxed">{DREAMSPELL_DISTINCTION}</p>
        </section>

        {/* View Toggle */}
        {birthSign && todaySign && completeProfile && (
          <>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <button
              onClick={() => setActiveView('signature')}
              className={`px-5 py-3 rounded-lg font-semibold transition-all ${
                activeView === 'signature'
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg'
                  : 'bg-stone-900/60 text-amber-500/60 hover:text-amber-400 border border-amber-900/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <SunIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Dreamspell</span> Signature
              </div>
            </button>
            <button
              onClick={() => setActiveView('pillars')}
              className={`px-5 py-3 rounded-lg font-semibold transition-all ${
                activeView === 'pillars'
                  ? 'bg-gradient-to-r from-purple-600 to-teal-600 text-white shadow-lg'
                  : 'bg-stone-900/60 text-amber-500/60 hover:text-amber-400 border border-amber-900/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Path of Life
              </div>
            </button>
            <button
              onClick={() => setActiveView('today')}
              className={`px-5 py-3 rounded-lg font-semibold transition-all ${
                activeView === 'today'
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg'
                  : 'bg-stone-900/60 text-amber-500/60 hover:text-amber-400 border border-amber-900/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <MoonIcon className="w-5 h-5" />
                Today's Energy
              </div>
            </button>
          </div>
          <p className="text-xs text-amber-400/50 text-center mt-2">
            All three views are the Dreamspell count, not the traditional day above.
          </p>
          </>
        )}

        {/* Sign Display */}
        <div className="max-w-5xl mx-auto">
          {birthSign && activeView === 'signature' && (
            <div className="max-w-3xl mx-auto">
              <MayanSignCard sign={birthSign} title="Your Dreamspell Galactic Signature" />
            </div>
          )}
          {completeProfile && activeView === 'pillars' && <MayanPathOfLife profile={completeProfile} askHref={askHref} />}
          {todaySign && activeView === 'today' && (
            <div className="max-w-3xl mx-auto">
              <MayanSignCard sign={todaySign} title="Today in the Dreamspell" isToday />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
