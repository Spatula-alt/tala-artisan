/* ══════════════════════════════════════════════════════════════
   TALA ARTISAN — words that cannot go on a trophy
   What a customer types to be printed (the designer's wording, its list of
   names) or shown on the site (a review) is checked here. The owner, 8 Nov:
   "ban the offensive words like racial/identity or anything that would be
   offensive": slurs against race, ethnicity, sexuality, gender or
   disability, and strong swearing in English, Tagalog and Bisaya. The Admin
   Deck is not checked ("still i can edit or create something like that in
   the admin deck"): the shop names its own trophies.

   Spellings that dodge a plain list are caught too: capitals, accents,
   numbers for letters (n1gg4), a letter held (niiigga), letters spread out
   (n i g g a, n.i.g.g.a). Whole words only, except the worst few, which are
   found inside other words as well, so names like "Tan, Gina", "Matsushita"
   or "Van Dyke" and words like "reputasyon", "pa-kyut" or "leche flan" pass.
   The lists are kept in rot13 so the site's source is not a list of slurs;
   figure-src has no copy: decode a word with rot13 to read it.
   ══════════════════════════════════════════════════════════════ */

const rot = s => s.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 84) % 26 + 97));
const loose = w => w.split('').map(c => c + '+').join('');     // a letter may be held: niiigga
const list = s => s.split(' ').map(rot);

// found inside other words too
const ANYWHERE = new RegExp(list('avttre avttn avtth snttbg shpx pbpxfhpxre').map(loose).join('|'));
// whole words, with a plural
const WORDS = new RegExp(`^(?:${list('fuvg fuvggl ohyyfuvg ovgpu ovgpul phag juber fyhg onfgneq nffubyr qvpxurnq ergneq ergneqrq snt genaal furznyr puvax tbbx fcvp xvxr jrgonpx ornare pbba wvtnobb enturnq gbjryurnq tbyyvjbt zbatbybvq xxx crqbcuvyr spx shx shd chgn chgnat chgnatvan chgnatvanzb gnatvan gnatvanzb tntb hyby hyhy gnenagnqb gnenagnqn cbxcbx xhcny xnagbg xnaghgna wnxby oheng ovyng chalrgn cnxfurg cnxlh uvaqbg uvanlhcnx obob gnatn').map(loose).join('|')})(?:e?s)?$`);
// two or more words
const PHRASES = new RegExp(`(?:^| )(?:${['chgnat van', 'gnat van', 'nanx at chgn', 'cnx lh', 'urvy uvgyre', 'fvrt urvy', 'juvgr cbjre', 'puvat pubat', 'cbepu zbaxrl']
  .map(p => rot(p).split(' ').map(loose).join(' ')).join('|')})(?: |$)`);

// numbers and signs that stand in for letters
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' };

/* The text as words: lower case, no accents, the stand-ins read as letters,
   and letters spread out ("n i g g a") joined back into one word. */
function wordsOf(text) {
  const t = String(text ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[0134578@$!|]/g, c => LEET[c]);
  const out = [];
  for (const w of t.split(/[^a-z]+/)) {
    if (!w) continue;
    if (w.length === 1 && out.length && out[out.length - 1].single) out[out.length - 1].w += w;
    else out.push({ w, single: w.length === 1 });
  }
  return out.map(x => x.w);
}

/* -> true when any of the texts has a word that cannot go on a trophy or the site */
export function hasBadWord(...texts) {
  for (const text of texts) {
    const ws = wordsOf(text);
    if (ws.some(w => ANYWHERE.test(w) || WORDS.test(w)) || PHRASES.test(ws.join(' '))) return true;
  }
  return false;
}
