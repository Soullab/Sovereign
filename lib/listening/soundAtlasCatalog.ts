// LISTEN-01 · Living Library (review only). No recordings, rights grants, or member data.
// The seven collections are editorial; the pieces are original procedural sketches, not mastered works.
export type AtlasCollectionId = 'celestial'|'geometry'|'elements'|'earth'|'voice'|'liquid'|'becoming';
export type AtlasIntent = 'Settle'|'Focus'|'Create'|'Explore'|'Reflect'|'Restore';
export type AtlasCollection = { id:AtlasCollectionId; title:string; eyebrow:string; description:string; context:string; accent:string; symbol:string };
export type AtlasWork = {
 id:string; collection:AtlasCollectionId; title:string; subtitle:string; description:string;
 note:string; intents:readonly AtlasIntent[]; duration:number; root:number; pulse:number;
 body:number; overtone:number; glass:number; air:number; spiral:number; music:number;
 special?:'pure639'|'orbital813'|'fivefold';
};
export const ATLAS_INTENTS: readonly AtlasIntent[] = ['Settle','Focus','Create','Explore','Reflect','Restore'];
export const ATLAS_COLLECTIONS:readonly AtlasCollection[] = [
 {id:'celestial',title:'Celestial Harmonics',eyebrow:'01 / Celestial cycles',description:'Astronomy interpreted as sound.',context:'Planetary cycles, orbital resonances and geometric ratios are real patterns. The musical translation is original artistic interpretation, not a recording of outer space.',accent:'#c8aa78',symbol:'✦'},
 {id:'geometry',title:'Harmonic Geometry',eyebrow:'02 / Audible mathematics',description:'Overtones, beating, proportion and resonance.',context:'The study of tonal relationships and interference. Visual geometry is illustrative, not an image of measured cymatic results.',accent:'#b6c5ab',symbol:'◇'},
 {id:'elements',title:'Elemental Alchemy',eyebrow:'03 / Elemental fields',description:'Earth, Water, Fire, Air and Aether.',context:'The elements describe experiences and compositional qualities; none is claimed to have a universal physical frequency.',accent:'#d9a68c',symbol:'◐'},
 {id:'earth',title:'Voices of the Living Earth',eyebrow:'04 / Ecological imagination',description:'Original environments inspired by living places.',context:'These previews are explicitly synthetic nature-inspired music. Real bees, whales, rainfall and habitat recordings require verified field source and permissions.',accent:'#97b6a3',symbol:'◌'},
 {id:'voice',title:'Human Voice & Sacred Traditions',eyebrow:'05 / Voice and ritual',description:'Vowels, overtones, bells and human resonance.',context:'Preview sounds are synthesized vowel-like and bell-like studies, never misrepresented as human chants or authentic traditional performances. Cultural context and permission are required before including any such recording.',accent:'#c3a4b7',symbol:'◉'},
 {id:'liquid',title:'Liquid Harmonics & Emergent Worlds',eyebrow:'06 / Unfamiliar forms',description:'Spectral spirals and liquid-metal fields.',context:'Original generative timbres emerging from the existing Soullab Liquid Harmonics instrument. Alien Intelligence is a poetic title, not an entity or consciousness claim.',accent:'#8cc6cf',symbol:'∿'},
 {id:'becoming',title:'Journeys of Becoming',eyebrow:'07 / Composed passage',description:'Arrival, gathering, opening, returning.',context:'Long-form musical journeys shaped by a temporal score, with no promised emotional, spiritual, or medical outcome.',accent:'#b4a9ce',symbol:'∞'},
];
const D='Original procedural studio study. Not a mastered or licensed library recording.';
type Data = [AtlasCollectionId,string,string,string,string,readonly AtlasIntent[],number,number,number,number,number,number,number,number,number,AtlasWork['special']?];
const DATA:Data[]=[
 ['celestial','venus-pure','Pure Form','Venus Rose I · exact 639 Hz','A clear 639 Hz tone opening into a delicate resonant atmosphere.',['Settle','Reflect'],360,159.75,.6,.2,.15,.16,.08,0,0,'pure639'],
 ['celestial','venus-orbit','Orbital Dance','Venus Rose II · 8:13','An eight-against-thirteen rhythmic relationship around a five-petal imagined orbit.',['Explore','Create'],480,159.75,1.3,.4,.55,.32,.12,.25,.12,'orbital813'],
 ['celestial','venus-water','Venus in Water','Venus Rose III · flowing form','Crystalline partials above an original, water-like moving texture.',['Reflect','Restore'],600,159.75,.8,.4,.5,.7,.82,.33,.18],
 ['celestial','venus-living','The Living Rose','Venus Rose IV · five movements','Fifteen minutes of arrival, turning, opening, flowering and return.',['Explore','Reflect'],900,159.75,1.1,.5,.77,.7,.45,.7,.25,'fivefold'],
 ['geometry','geom-chladni','Chladni Lines','Resonance study 01','Tonal nodes and slow interference. An acoustic abstraction, not a measured Chladni plate.',['Focus','Explore'],420,146.83,.75,.4,.65,.3,.05,.1,0],
 ['geometry','geom-overtones','Harmonics in Bloom','Overtone study 02','A low note expands toward luminous higher partials.',['Create','Explore'],480,110,1.1,.45,.9,.75,.12,.3,.12],
 ['geometry','geom-beating','Between Two Tones','Interference study 03','Close pitches reveal slow changes in amplitude.',['Focus','Reflect'],360,180,2.1,.35,.4,.15,.05,.02,0],
 ['elements','earth-holding','Earth Holding','Earth · density','Long low tones, repetition and a patient musical foundation.',['Settle','Focus'],480,82.41,.65,.68,.2,.05,.03,.04,.05],
 ['elements','water-returning','Water Returning','Water · fluidity','Flowing movement around a slowly returning centre.',['Restore','Reflect'],540,130.81,1.1,.4,.5,.4,.75,.25,.12],
 ['elements','fire-becoming','Fire Becoming','Fire · emergence','Warm harmonics grow bright and active, then settle.',['Create','Explore'],450,164.81,2.8,.62,.75,.75,.12,.5,.15],
 ['elements','air-between','Air Between','Air · spaciousness','A softly breathing, spacious acoustic atmosphere.',['Settle','Reflect'],480,196,.55,.25,.35,.3,.9,.2,.1],
 ['elements','aether-spiral','Aether Spiral','Aether · integration','Partials diverge and reunite in a wider field.',['Explore','Reflect'],660,123.47,.95,.44,.85,.88,.55,.9,.2],
 ['earth','pollinator-patterns','Pollinator Patterns','Imagined habitat · synthetic','Small shimmering movements inspired by pollinators. No bee recording.',['Explore','Create'],420,220,2.2,.25,.6,.8,.65,.36,.1],
 ['earth','blue-water','Under Blue Water','Imagined ocean · synthetic','Deep invented calls and harmonic echoes. No whale or dolphin recordings.',['Settle','Explore'],540,73.42,.55,.5,.55,.16,.7,.2,.04],
 ['earth','rain-geometry','Rain Geometry','Imagined rainfall · synthetic','Filtered original noise and liquid resonances. No field recording.',['Focus','Restore'],480,146.83,1,.25,.25,.48,1,.15,.1],
 ['voice','five-vowels','Five Open Vowels','Formant-like synthesis','Five vowel-like tonal textures, without words or a performer.',['Explore','Reflect'],480,110,.72,.45,.96,.12,.18,.12,0],
 ['voice','harmonic-loom','Harmonic Loom','Original voice-like overtones','Whistling partials over a low, voice-like field; no sampled chanting.',['Explore','Settle'],540,123.47,.85,.5,1,.35,.25,.3,.08],
 ['voice','bell-breath','Bell and Breath','Invented resonant metal','Sparse synthetic bell tones and long gentle swells. No sacred instrument recording.',['Settle','Restore'],480,174.61,.6,.25,.4,.88,.84,.18,.1],
 ['liquid','liquid-mirror','Liquid Mirror','Spectral metamorphosis','An original liquid-metal harmonic environment.',['Explore','Create'],600,130.81,1.5,.53,.85,1,.24,.88,.12],
 ['liquid','alien-intelligence','Alien Intelligence 01','An unfamiliar sonic encounter','Gliding intervals and unexpected harmonic relations.',['Explore','Reflect'],720,87.31,1.7,.5,1,1,.35,1,.12],
 ['liquid','inverse-spiral','Inverse Spiral','Descent and return','The spectrum folds inward and opens again.',['Explore','Settle'],600,196,.8,.4,.8,.7,.32,.86,.08],
 ['becoming','arrival','Arrival','An entrance','An unhurried passage into listening.',['Settle','Restore'],360,98,.6,.3,.3,.24,.68,.1,.08],
 ['becoming','spiral-presence','Spiral of Presence','A shorter atlas study','An original evolving interpretation, not the separate 30-minute HUSO test master.',['Reflect','Explore'],720,98,1.1,.48,.8,.75,.5,.8,.2,'fivefold'],
 ['becoming','threshold','Across the Threshold','Intensification and silence','A composed rise into complexity and a returning field.',['Explore','Create'],600,110,1.2,.56,.8,.9,.35,.8,.15,'fivefold'],
 ['becoming','homeward','Homeward','Return and integration','Warm harmonics come to rest in a quiet ending.',['Restore','Reflect'],480,110,.7,.34,.4,.3,.72,.2,.08],
];
export const ATLAS_WORKS:readonly AtlasWork[] = DATA.map(a=>({
 collection:a[0],id:a[1],title:a[2],subtitle:a[3],description:a[4],note:D,
 intents:a[5],duration:a[6],root:a[7],pulse:a[8],body:a[9],overtone:a[10],
 glass:a[11],air:a[12],spiral:a[13],music:a[14],special:a[15],
}));
export const atlasWork = (id:string):AtlasWork|undefined => ATLAS_WORKS.find(w=>w.id===id);
export const worksInCollection = (id:AtlasCollectionId) => ATLAS_WORKS.filter(w=>w.collection===id);
export const worksForIntent = (i:AtlasIntent) => ATLAS_WORKS.filter(w=>w.intents.includes(i));
export const atlasMinutes = (sec:number)=>String(Math.round(sec/60))+' min';
export const ATLAS_PROVENANCE = Object.freeze({
 owner:'LISTEN-01 #1979',state:'PRIVATE REVIEW ONLY',source:'Original procedural synthesis',
 thirdPartyMedia:false,recordingMasters:'NOT CREATED OR ADMITTED',
 reference:'https://www.instagram.com/reel/DfemWa5CpsW/',referenceStatus:'DISCOVERY ONLY; NO AUDIO LICENSE',
});
