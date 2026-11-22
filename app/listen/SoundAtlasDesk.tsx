'use client';
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { usePersistentListening } from '@/components/listening/PersistentListeningProvider';
import { ATLAS_COLLECTIONS, ATLAS_INTENTS, ATLAS_WORKS, atlasMinutes, atlasWork, ATLAS_PROVENANCE } from '@/lib/listening/soundAtlasCatalog';
import type { AtlasCollectionId, AtlasIntent, AtlasWork } from '@/lib/listening/soundAtlasCatalog';
import { atlasProceduralStudy, atlasScore } from '@/lib/listening/soundAtlasStudy';
import styles from './listen.module.css';

// LISTEN-01 Living Library. Exact existing /listen route and one PersistentListeningProvider.
// The seven categories are editorial; all playback here is generated in the browser by original code.
// No recorded, third-party, culturally attributed or therapeutic media is served by this review surface.
function atlasShape(kind:AtlasCollectionId) {
 // Pure visual metaphor, not a cymatics recording or numerical analysis of the audio.
 const harmonics:Record<AtlasCollectionId,[number,number,number,number]>={
  celestial:[72,31,5,0],geometry:[75,25,8,13],elements:[75,23,4,2],
  earth:[75,13,3,9],voice:[75,21,5,17],liquid:[75,24,7,11],becoming:[72,29,5,2],
 };
 const [base,amplitude,arms,second]=harmonics[kind];
 const dots:string[]=[];
 for(let i=0;i<=620;i++){
   const a=i/620*2*Math.PI;
   const r=base+amplitude*Math.cos(arms*a)+(second?8*Math.sin(second*a):0);
   const x=130+r*Math.cos(a),y=130+r*Math.sin(a);
   dots.push((i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2));
 }
 return dots.join(' ')+' Z';
}
const ENTRANCES=[
 {id:'explore',title:'Explore a world',detail:'Sound, nature, geometry, and the patterns behind a piece.'},
 {id:'intent',title:"Begin with what's alive",detail:'Choose what you want space for, and discover a sound.'},
] as const;
type Entrance = typeof ENTRANCES[number]['id'];
const saveJson = (filename:string, data:unknown) => {
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
 const href=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=href;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(href),1000);
};
function AtlasVisual({work,alive}:{work:AtlasWork;alive:boolean}) {
 const world=ATLAS_COLLECTIONS.find(c=>c.id===work.collection);
 const caption=work.collection==='celestial'?'8 : 13 · fivefold orbital inspiration':
   work.collection==='geometry'?'Harmonic proportion · illustration':
   work.collection==='elements'?'Elemental metaphor · illustration':
   work.collection==='earth'?'Ecological imagination · synthetic':
   work.collection==='voice'?'Vowel-like resonance · synthetic':
   work.collection==='liquid'?'Emergent geometry · illustration':
   'Five movements · composed journey';
 return <div className={styles.atlasRoseStage}>
  <svg viewBox="0 0 260 260" role="img" aria-label={'Original abstract visual motif for '+world?.title+'; not a measured cymatic image'} className={styles.atlasRoseSvg}>
   <defs>
    <radialGradient id="atlas-light"><stop offset="0" stopColor={world?.accent||'#d8b781'} stopOpacity=".23"/><stop offset="1" stopColor={world?.accent||'#d8b781'} stopOpacity="0"/></radialGradient>
    <linearGradient id="atlas-stroke" x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="#f0d9aa"/><stop offset=".52" stopColor={world?.accent||'#c19b77'}/><stop offset="1" stopColor="#719dab"/></linearGradient>
   </defs>
   <circle cx="130" cy="130" r="115" fill="url(#atlas-light)"/>
   <circle cx="130" cy="130" r="90" fill="none" stroke="#9b8e83" strokeWidth=".4" opacity=".4"/>
   <path d={atlasShape(work.collection)} fill="none" stroke="url(#atlas-stroke)" strokeWidth="1.5" opacity=".85" className={alive?styles.atlasRoseAlive:undefined}/>
   <circle cx="130" cy="130" r="5" fill={world?.accent||'#c7a777'}/>
  </svg>
  <span className={styles.atlasRoseCaption}>{caption}</span>
 </div>;
}
export default function SoundAtlasDesk() {
 const transport=usePersistentListening();
 const [entrance,setEntrance]=useState<Entrance>('explore');
 const [collection,setCollection]=useState<AtlasCollectionId|'all'>('celestial');
 const [intent,setIntent]=useState<AtlasIntent|'all'>('all');
 const [query,setQuery]=useState('');
 const [selected,setSelected]=useState('venus-pure');
 const [message,setMessage]=useState('Choose a study. Nothing starts until you press Listen.');
 const picked=atlasWork(selected) ?? ATLAS_WORKS[0];
 const active=transport?.snapshot.kind==='sketch'&&transport.snapshot.title===picked.title
   &&transport.snapshot.playback==='playing';
 const currentlyPlaying=transport?.snapshot.kind==='sketch'&&transport.snapshot.playback==='playing';
 const visible=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase();
  return ATLAS_WORKS.filter(w=>(collection==='all'||w.collection===collection)
     &&(intent==='all'||w.intents.includes(intent))
     &&(!q||[w.title,w.subtitle,w.description,w.collection,...w.intents].join(' ').toLocaleLowerCase().includes(q)));
 },[collection,intent,query]);
 const choose=(w:AtlasWork)=>{setSelected(w.id);setMessage('Selected '+w.title+'. Press Listen to begin.');};
 const begin=async()=>{
  if(!transport){setMessage('The shared listening player is unavailable.');return;}
  const ok=await transport.playStudy(atlasProceduralStudy(picked));
  setMessage(ok?'Playing '+picked.title+'. Pause and Stop use the existing Sound Studio player.':'Playback could not start. Check the current audio session or MAIA speech.');
 };
 const exportRecipe=()=>{
  saveJson('soullab-atlas-'+picked.id+'-recipe.json',{
   format:'soullab.sound-atlas.recipe/1',catalogStatus:'original-procedural-private-review',
   sourceOwner:'LISTEN-01',workId:picked.id,work:picked,
   score:(picked.special==='pure639'||picked.special==='orbital813')?null:atlasScore(picked),
   recordingMaster:null,thirdPartyRecording:false,
   note:'Original procedural sound recipe. Not an audio recording or admitted release.',
  });
  setMessage('Exported a recipe to your device. No audio or member data was uploaded.');
 };
 return <section className={styles.atlas} data-sound-atlas="true" aria-labelledby="atlas-title">
  <header className={styles.atlasHead}>
   <span className={styles.smallcaps}>THE LIVING LIBRARY · PRIVATE STUDIO REVIEW</span>
   <h1 id="atlas-title">Listen to the patterns of the world.</h1>
   <p className={styles.atlasLead}>Seven worlds of sound, geometry, and becoming. Original listening studies, composed inside the existing Soullab instrument.</p>
   <p className={styles.atlasNotice}>Procedural synthesis only · No outside recordings · No claimed effect · No autoplay</p>
  </header>
  <div className={styles.atlasDoors} role="group" aria-label="Ways to browse Sound Studio">
   {ENTRANCES.map(e=><button type="button" key={e.id} className={styles.atlasDoor} data-active={entrance===e.id}
     aria-pressed={entrance===e.id} onClick={()=>{setEntrance(e.id);setCollection('all');setIntent('all');}}>
     <strong>{e.title}</strong><span>{e.detail}</span></button>)}
  </div>
  <div className={styles.atlasExplore}>
   <div className={styles.atlasToolbar}>
    <label htmlFor="atlas-search">Search the library
     <input id="atlas-search" type="search" value={query} onChange={e=>setQuery(e.target.value)}
       placeholder="A feeling, a phenomenon, a sound…" autoComplete="off"/></label>
    {entrance==='intent'&&<label htmlFor="atlas-intent">I want to…
     <select id="atlas-intent" value={intent} onChange={e=>setIntent(e.target.value as AtlasIntent|'all')}>
      <option value="all">Discover everything</option>
      {ATLAS_INTENTS.map(i=><option key={i} value={i}>{i}</option>)}
     </select></label>}
   </div>
   <div className={styles.atlasCollections} role="group" aria-label="Seven sound collections">
    <button type="button" className={styles.atlasCollection} data-active={collection==='all'}
      onClick={()=>setCollection('all')} aria-pressed={collection==='all'}>
     <span className={styles.atlasSymbol}>⊕</span><strong>All worlds</strong><small>{ATLAS_WORKS.length} original studies</small>
    </button>
    {ATLAS_COLLECTIONS.map(c=><button type="button" key={c.id} className={styles.atlasCollection}
      data-active={collection===c.id} aria-pressed={collection===c.id}
      style={{'--atlas-accent':c.accent} as CSSProperties} onClick={()=>setCollection(c.id)}>
      <span className={styles.atlasSymbol}>{c.symbol}</span><small>{c.eyebrow}</small>
      <strong>{c.title}</strong><span>{c.description}</span>
      <small>{ATLAS_WORKS.filter(w=>w.collection===c.id).length} original studies</small>
    </button>)}
   </div>
   <div className={styles.atlasCollectionContext}>
    {collection!=='all'?<p>{ATLAS_COLLECTIONS.find(c=>c.id===collection)?.context}</p>
    :<p>Explore across all seven worlds. Each study is made by code, with no imported recordings. Recorded nature and tradition-based collections require separate rights and source verification before admission.</p>}
   </div>
  </div>
  <div className={styles.atlasSplit}>
   <div className={styles.atlasTrackList}>
    <div className={styles.atlasSectionTitle}>
     <div><span className={styles.smallcaps}>LISTENING STUDIES</span><h2>{visible.length} sounds to explore</h2></div>
     {collection!=='all'&&<button type="button" className={styles.ghost} onClick={()=>setCollection('all')}>All worlds</button>}
    </div>
    {visible.length===0&&<p className={styles.atlasEmpty}>No matches for these choices. Try another world, feeling, or search.</p>}
    {visible.map(w=><button type="button" key={w.id} onClick={()=>choose(w)}
      className={styles.atlasTrack} data-active={picked.id===w.id} aria-pressed={picked.id===w.id}>
      <span className={styles.atlasTrackMark} aria-hidden="true">{ATLAS_COLLECTIONS.find(c=>c.id===w.collection)?.symbol}</span>
      <span className={styles.atlasTrackText}><strong>{w.title}</strong><small>{w.subtitle}</small><span>{w.description}</span></span>
      <span className={styles.atlasTrackLength}>{atlasMinutes(w.duration)}</span>
     </button>)}
   </div>
   <aside className={styles.atlasDetail} aria-label="Selected sound study">
    <AtlasVisual work={picked} alive={Boolean(active)}/>
    <span className={styles.smallcaps}>NOW SELECTED · ORIGINAL SYNTHESIS</span>
    <h2>{picked.title}</h2><p className={styles.atlasDetailSub}>{picked.subtitle}</p>
    <p>{picked.description}</p>
    <div className={styles.atlasInfo}><span>{atlasMinutes(picked.duration)}</span><span>{picked.special==='pure639'?'639 Hz tone':picked.special==='orbital813'?'8:13 rhythmic interpretation':'Five-phase procedural score'}</span></div>
    <div className={styles.atlasActions}>
     <button type="button" className={styles.play} disabled={!transport} onClick={()=>void begin()}>
      {active?'Playing in Sound Studio':'▶  Listen to study'}</button>
     <button type="button" className={styles.secondary} disabled={!transport||!currentlyPlaying} onClick={()=>{transport?.pause();setMessage('Sound paused.');}}>Pause</button>
     <button type="button" className={styles.secondary} disabled={!transport} onClick={()=>{transport?.stopMusic();setMessage('Sound stopped.');}}>Stop</button>
    </div>
    <p role="status" aria-live="polite" className={styles.atlasMessage}>{message}</p>
    <button type="button" className={styles.atlasExport} onClick={exportRecipe}>Export original recipe (.json)</button>
    <div className={styles.atlasInterpretation}><strong>About this pattern</strong>
      <p>{picked.id==='venus-pure'?'The 639 Hz tone is precisely an oscillator in this study, not a sound emitted by Venus.':
      picked.id==='venus-orbit'?'The approximate orbital ratio is real; mapping 8 and 13 to two repeating musical pulses is an artistic decision.':
      picked.id.startsWith('venus-')?'The fivefold rose illustrates a planetary relationship. It is not a cymatic measurement.':
      ATLAS_COLLECTIONS.find(c=>c.id===picked.collection)?.context}</p>
     <p>Sound is offered as exploration, not a promise of a state, experience, or outcome.</p>
    </div>
   </aside>
  </div>
  <footer className={styles.atlasFoot}>
   <h2>Sound deserves provenance.</h2>
   <p>All {ATLAS_WORKS.length} playable studies on this review surface are generated in your browser. None uses the Instagram audio, licensed recordings, human voices, animal calls or HUSO programs. These are not mastered library releases.</p>
   <p>Reference: <a href={ATLAS_PROVENANCE.reference} target="_blank" rel="noopener noreferrer">Resonara Venus Rose reel (discovery only)</a>. Using its recording in Soullab would require separate permission and admission through the existing Sound Studio rights process.</p>
   <p>For the life you live. For the world we make.</p>
  </footer>
 </section>;
}
