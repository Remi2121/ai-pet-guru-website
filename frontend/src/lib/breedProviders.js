// Minimal “any pet” search providers.
// Dogs & cats use dedicated APIs; everything else falls back to Wikipedia.
// No keys needed, but these env vars raise limits:
// VITE_DOG_API_KEY, VITE_CAT_API_KEY

const DOG_API = "https://api.thedogapi.com/v1";
const CAT_API = "https://api.thecatapi.com/v1";
const DOG_KEY = "live_FtTDoY3nkVQxLbeP1kOMtXKoGe3hHBomA0fc7Sz8royC23xZQx8ywQlWemSVJjjm";
const CAT_KEY = "live_qox5w0tROlIUXF1FtA1Rk8Xugw28Dm43mpCk1Nqk2wBaOKDwhfxYp67CR1c8RisB";
/* -------------------- PET-ONLY FILTERS -------------------- */
const PET_TYPES = new Set([
  "Dog",
  "Cat",
  "Rabbit",
  "Guinea Pig",
  "Hamster",
  "Bird",
  "Reptile",
  "Fish",
  "Horse",
]);

// common non-animal topics to block from wiki results
const BAD_WORDS = [
  "band","rapper","album","song","single","record","label","studio",
  "company","corporation","energy","software","app","stadium","arena",
  "university","college","school","magazine","newspaper","tv","series",
  "film","movie","episode","vehicle","truck","car","ship","aircraft",
  "bridge","station","city","county","state","province","railway",
  "weapon","missile","tank","mine","vessel","building","bank","vmmd",
  "brand","tool","equipment","power","industrial"
];

function looksLikeNonPet(title = "", description = "") {
  const t = (title + " " + description).toLowerCase();
  return BAD_WORDS.some((w) => t.includes(w));
}

function inferTypeFromText(txt = "") {
  const d = txt.toLowerCase();
  if (d.includes("dog")) return "Dog";
  if (d.includes("cat")) return "Cat";
  if (d.includes("rabbit")) return "Rabbit";
  if (d.includes("hamster")) return "Hamster";
  if (d.includes("guinea")) return "Guinea Pig";
  if (d.includes("bird") || d.includes("parrot") || d.includes("budgerigar")) return "Bird";
  if (d.includes("reptile") || d.includes("gecko") || d.includes("tortoise") || d.includes("lizard") || d.includes("snake")) return "Reptile";
  if (d.includes("fish") || d.includes("goldfish") || d.includes("betta")) return "Fish";
  if (d.includes("horse") || d.includes("equine")) return "Horse";
  return "Pet";
}

/* ------------------------ UTILS --------------------------- */
async function j(url, headers) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

function guessSizeFromHeight(metricStr = "") {
  const nums = metricStr.match(/\d+(\.\d+)?/g)?.map(Number) || [];
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  if (avg >= 60) return "Large";
  if (avg >= 40) return "Medium";
  if (avg > 0) return "Small";
  return "Medium";
}

function asCard({
  id,
  name,
  type,
  origin = "Unknown",
  img,
  size = "Medium",
  lifespan = "—",
  temperament = "—",
  care = [],
}) {
  return { id, name, type, origin, img, size, lifespan, temperament, care };
}

function defaultCare(type, size = "Medium") {
  if (type === "Dog") {
    return [
      size === "Large" ? "High daily exercise (walks, play, mental work)." : "Daily exercise and play.",
      "Balanced diet with named meat first.",
      "Regular grooming & vet checks.",
    ];
  }
  if (type === "Cat") {
    return [
      "Daily interactive play (wand toys).",
      "High-quality protein diet; fresh water.",
      "Regular grooming & dental checks.",
    ];
  }
  // Generic pets
  return [
    "Provide species-appropriate diet and fresh water.",
    "Enrichment & safe habitat setup.",
    "Regular health checks with a vet.",
  ];
}

/* --------------------- DOGS / CATS ------------------------ */
export async function searchDogs(q) {
  if (!q.trim()) return [];
  const headers = DOG_KEY ? { "x-api-key": DOG_KEY } : undefined;
  const list = await j(`${DOG_API}/breeds/search?q=${encodeURIComponent(q)}`, headers);
  const withImg = await Promise.all(
    list.slice(0, 12).map(async (b) => {
      let img = "";
      try {
        const imgs = await j(`${DOG_API}/images/search?breed_ids=${b.id}&limit=1`, headers);
        img = imgs?.[0]?.url || "";
      } catch { /* empty */ }
      return asCard({
        id: `dog_${b.id}`,
        name: b.name,
        type: "Dog",
        origin: b.origin || "Unknown",
        img: img || "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=800&q=60",
        size: guessSizeFromHeight(b?.height?.metric),
        lifespan: b.life_span ? b.life_span.replace(" years", " years") : "—",
        temperament: b.temperament || "—",
        care: defaultCare("Dog"),
      });
    })
  );
  return withImg;
}

export async function searchCats(q) {
  if (!q.trim()) return [];
  const headers = CAT_KEY ? { "x-api-key": CAT_KEY } : undefined;
  const list = await j(`${CAT_API}/breeds/search?q=${encodeURIComponent(q)}`, headers);
  const withImg = await Promise.all(
    list.slice(0, 12).map(async (b) => {
      let img = "";
      try {
        const imgs = await j(`${CAT_API}/images/search?breed_ids=${b.id}&limit=1`, headers);
        img = imgs?.[0]?.url || "";
      } catch { /* empty */ }
      return asCard({
        id: `cat_${b.id}`,
        name: b.name,
        type: "Cat",
        origin: b.origin || "Unknown",
        img: img || "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800&q=60",
        size: "Medium",
        lifespan: b.life_span ? `${b.life_span} years` : "—",
        temperament: b.temperament || "—",
        care: defaultCare("Cat"),
      });
    })
  );
  return withImg;
}

/* -------------------- WIKIPEDIA (other pets) --------------- */
async function wikiSearchTitles(q) {
  const url = `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=12`;
  const data = await j(url);
  return (data?.pages || []).map((p) => ({
    title: p.title,
    description: p.description || "",
    key: p.key,
    isDisambiguation: p?.description?.toLowerCase()?.includes("disambiguation"),
  }));
}

async function wikiPageSummary(titleOrKey) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titleOrKey)}`;
  return j(url);
}

export async function searchGenericPets(q) {
  if (!q.trim()) return [];
  const qLower = q.trim().toLowerCase();

  const titles = await wikiSearchTitles(q);
  const out = [];

  for (const t of titles) {
    // Block obvious non-pet & disambiguation pages
    if (t.isDisambiguation) continue;
    if (looksLikeNonPet(t.title, t.description)) continue;

    // Require query token in title to avoid brands like "Husky Energy"
    if (!t.title.toLowerCase().includes(qLower)) continue;

    try {
      const s = await wikiPageSummary(t.key);
      if (!s?.title) continue;

      const desc = s?.description || "";
      if (looksLikeNonPet(s.title, desc)) continue;

      const type = inferTypeFromText(`${s.title} ${desc}`);
      if (!PET_TYPES.has(type)) continue;

      const hasImage = Boolean(s?.thumbnail?.source);
      const animalWord = /(dog|cat|rabbit|hamster|guinea|parrot|bird|gecko|tortoise|lizard|snake|fish|horse)/i.test(
        s.title + " " + desc
      );
      if (!hasImage && !animalWord) continue;

      out.push(
        asCard({
          id: `wiki_${t.key}`,
          name: s.title,
          type,
          origin: "—",
          img: s?.thumbnail?.source || "https://images.unsplash.com/photo-1555685812-4b943f1cb0eb?w=800&q=60",
          size: "—",
          lifespan: "—",
          temperament: desc || "—",
          care: defaultCare(type),
        })
      );
    } catch {
      /* ignore one-off wiki failures */
    }
  }

  // De-dupe by name
  const seen = new Set();
  const uniq = [];
  for (const x of out) {
    const k = x.name.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      uniq.push(x);
    }
  }
  return uniq.slice(0, 24);
}

/* --------------------- UNIFIED SEARCH ---------------------- */
export async function searchAnyPet(query) {
  const [dogs, cats, others] = await Promise.allSettled([
    searchDogs(query),
    searchCats(query),
    searchGenericPets(query),
  ]);

  let list = [
    ...(dogs.status === "fulfilled" ? dogs.value : []),
    ...(cats.status === "fulfilled" ? cats.value : []),
    ...(others.status === "fulfilled" ? others.value : []),
  ];

  // Final safety: only allow known pet types
  list = list.filter((x) => PET_TYPES.has(x.type));

  // Final de-dupe by name
  const seen = new Set();
  list = list.filter((x) => {
    const k = (x.name || "").toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return list;
}