// Business-type tag for a lead (Hotel, Clinic, Salon, ...).
// Auto-guessed from the lead's name (then the subtitle) with keyword rules;
// a manual choice saved in leads.category always wins.
// Every tag is short English, max 12 characters.

export const CATEGORY_MAX = 12;
export const OTHER_CATEGORY = "Other";

type Rule = [tag: string, pattern: RegExp];

// ORDER MATTERS: the first matching rule wins, so specific rules come before
// general ones (e.g. Coaching before School, Hotel before Food & Cafe).
const RULES: Rule[] = [
  ["Hostel & PG", /\bhostels?\b|\bpg\b|paying guest|dormitor/],
  ["Hotel", /hotel|resort|\blodge|lodging|guest ?house|home ?stay|\binn\b|motel|residency|\bstays?\b/],
  ["Daycare", /day ?care|cr[eè]che|play ?group|play ?school|pre ?school|nursery school|montessori|kidzee|euro ?kids|kindergarten|\bkg\b/],
  ["IT Training", /computer (institute|education|centre|center|training|classes)|it training|\btally\b|typing (institute|centre|center|classes)|skill (centre|center|development)|\bdca\b|\bccc\b/],
  ["Hobby Class", /dance|\bmusic|singing|guitar|vocal|tabla|drawing|hobby|karate|taekwondo|martial|skating|abacus|handwriting|vedic maths|art class|instrument/],
  ["Sports", /sports?\b|cricket|badminton|football|\bturf\b|swimming|stadium|archery|play ?zone/],
  ["Coaching", /coaching|classes|\bclass\b|academy|institute|institution|tutorial|tuition|launcher|\bcoach\b|study circle|\bneet\b|\bjee\b|\biit\b|upsc|bpsc|competition|\bcrash course/],
  ["School", /school|vidyalaya|vidyapeeth|vidya ?mandir|vidya\b|convent|college|universit|mahavidyalaya|polytechnic|\biti\b|gurukul|shishu|sishu|educat|\bdav\b|\bdps\b|kendriya/],
  ["CA Firm", /\bca\b.*(firm|associates|& co|and co|consult)|chartered accountant|\btax(ation)?\b|\baudit|accounting|accountant|bookkeep|\bgst\b|ledger/],
  ["Law Firm", /\blaw\b|legal|advocate|attorney|lawyer|vakil|notary|solicitor|\bcourt\b/],
  ["Insurance", /insurance|\blic\b|assurance|\bbima\b|mediclaim/],
  ["Finance", /financ|\bloans?\b|\bbank\b|nbfc|credit|\bcapital\b|invest|mutual fund|\bshares?\b|stock|broking|broker|microfinance|co-?operative|forex/],
  ["Hospital", /hospital|nursing home|medical college|medicare|trauma|\bicu\b|multi ?speciality|multi ?specialty|health ?care/],
  ["Dental", /dental|dentist|orthodont|\bteeth\b/],
  ["Eye Care", /\beye\b|optical|optician|netralaya|lasik|chashma|spectacle|\bvision\b/],
  ["Pathology", /patholog|diagnostic|\blabs?\b|laborator|\bscan\b|x-?ray|imaging|blood test/],
  ["Pharmacy", /pharma|medical (store|hall|shop)|\bmedicos?\b|chemist|\bdrugs?\b|\bdawai|\bmedicals?\b|medicines?\b/],
  ["Clinic", /clinic|doctor|\bdr\.? |physio|dermat|\bent\b|\bskin\b|\bortho|cardio|child care|polyclinic|homeo|ayurved|sexolog|pediatric|gynae|gynec|\bivf\b|hair transplant|care (centre|center)/],
  ["Gym", /\bgyms?\b|fitness|crossfit|workout|health club|bodybuilding|\bzumba\b/],
  ["Yoga", /\byoga|meditation|pilates/],
  ["Spa", /\bspa\b|massage|wellness/],
  ["Salon", /salon|parlou?r|make-?up|beauty|barber|\bhair\b|unisex|mehndi|\bnails?\b/],
  ["Pet Care", /\bpets?\b|veterinar|\bvet\b|\bdogs?\b|kennel/],
  ["Printing", /xerox|photo ?copy|photostat|\bprint(ing|ers?)?\b|\bflex\b|banner|offset|laminat|\bpress\b/],
  ["Interior", /interior|modular kitchen|false ceiling|wallpaper|curtain|architect/],
  ["Studio", /studio|photograph|\bphoto|video|\bfilms?\b|cinema|\bshoot|\balbum/],
  ["Event Venue", /marriage|banquet|\blawn\b|vatika|party hall|function hall|community hall|wedding hall|\bpalace\b|convention|\bhall\b|kalyan|mandap|vivah|dharamshala|farm ?house|\bgarden\b/],
  ["Wedding Plan", /wedding|\bevents?\b|planner|\bdecor|\bdj\b/],
  ["Tent House", /\btent\b|tent house|shamiyana|shamiana|pandal/],
  ["Catering", /cater|tiffin|\bmess\b|bhojnalay|canteen|food court|cloud kitchen/],
  ["Sweets", /sweet|mishthan|misthan|mithai|halwai|namkeen|rasgulla/],
  ["Bakery", /bakery|\bbake|\bcakes?\b|pastr|confection|\bbread\b|patisserie/],
  ["Food & Cafe", /caf[eé]\b|coffee|restaurant|restro|\bresto\b|dhaba|pizza|burger|biryani|kitchen|\bfoods?\b|eatery|bistro|juice|\bchai\b|\btea\b|ice ?cream|snacks?\b|fast food|momo|chinese|tandoor|\bgrill|\bbar\b|lounge|thali|sandwich|dosa|kulfi|shake|diner|kebab|rasoi|zayka|bhojan|\bbrew/],
  ["Boutique", /boutique|tailor|stitch|silai|designer|lehenga|lehnga|fashion|couture|\bdress|kurti|alteration|embroider|darzi/],
  ["Garments", /garment|cloth|kapda|kapde|vastralaya|\bvastra|saree|\bsari\b|chudi|churi|textile|fabric|ready ?made|menswear|men'?s wear|kids ?wear|\bwear\b|jeans|denim|suiting|shirting|handloom|bhandar|dupatta|hosiery/],
  ["Footwear", /footwear|\bshoes?\b|chappal|sandal|\bboots?\b|jutti|slipper|sneaker|leather/],
  ["Jewellery", /jewel|\bgold\b|\bsilver\b|diamond|ornament|\bsona\b|chandi|\bgems?\b|pearl|swarn|abhushan|aabhushan|sarafa|sarraf|kangan|payal/],
  ["Showroom", /showroom|dealership|\bdealers?\b|maruti|\bhonda\b|\bhero\b|bajaj|\btvs\b|yamaha|suzuki|hyundai|mahindra|toyota|enfield|\bkia\b|\bnexa\b|tata motors|ashok leyland|piaggio|\bola\b|\bather\b|e-?rickshaw|e-?bike/],
  ["Mobile Shop", /\bmobiles?\b|telecom|cellular|smartphone|handset|recharge|\bphones?\b/],
  ["Electronics", /electronic|\bac\b|refrigerat|appliance|\btv\b|television|laptop|computer|cctv|camera|inverter|batter(y|ies)|washing machine|water purifier|electricals?\b/],
  ["Auto Service", /garage|motors?\b|automobile|\bautos?\b|\btyre|\btire|car care|car ?wash|workshop|denting|puncture|mechanic|service (centre|center)|spare parts|two wheeler|2 wheeler|detailing|alloy wheel/],
  ["Furniture", /furniture|mattress|\bsofa|carpenter|\bwood|\bbeds?\b|almirah/],
  ["Hardware", /hardware|sanitary|\bpaints?\b|plywood|\bply\b|cement|\bsteel\b|\btiles?\b|marble|granite|\bpipes?\b|\btools?\b|\bbricks?\b|timber|\bglass\b|alumin|fabricat|welding|\bcables?\b|lighting|\bled\b|laminate/],
  ["Solar", /solar|renewable|green energy|photovoltaic/],
  ["Builder", /builder|construction|contractor|\bcivil\b|engineers?\b|engineering|buildcon|buildtech|infratech/],
  ["Real Estate", /real ?estate|realty|realtor|propert(y|ies)|developers?\b|housing|\bplots?\b|\bland\b|township|colony|apartments?|\bflats?\b|\bestate\b|\binfra\b|infrastructure|\bhomes?\b|nirman|\bavas\b/],
  ["Travel", /travel|\btours?\b|tourism|holiday|\btrips?\b|yatra|umrah|\bhajj?\b|\bvisa\b|ticket|\bcabs?\b|taxi|bus service|airways|flight|safari|pilgrim|darshan/],
  ["Courier", /courier|logistic|cargo|transport|packers|movers|parcel|freight|\bdtdc\b|speed post|shipping|\btempo\b|\btrucks?\b/],
  ["Stationery", /stationer|book ?(store|depot|stall|centre|center|house|shop)|\bbooks\b|bookshop|pustak|kitab|school supplies/],
  ["Gift & Toys", /\bgifts?\b|\btoys?\b|florist|flower|novelty|souvenir|balloon|party supplies|\bcraft/],
  ["Agriculture", /agri|agro|kisan|krishi|\bseeds?\b|fertili[sz]er|pesticide|\bfarms?\b|farmer|nursery|poultry|fisher|tractor|irrigation|horticulture|mushroom|goshala|gaushala|hatchery|cattle/],
  ["Grocery", /kirana|grocery|general store|super ?market|super ?mart|\bmart\b|departmental|provision|\bdairy\b|\bmilk\b|fruits?\b|vegetable|sabji|sabzi|ration/],
  ["Cleaning", /laundry|dry ?clean|dhobi|cleaning|pest control|housekeeping|facility/],
  ["Home Service", /plumb|electrician|\bpainters?\b|handyman|ac service|home service|repair/],
  ["Staffing", /recruit|placement|manpower|staffing|consultanc|\bhr\b/],
  ["IT & Digital", /\bagency\b|digital|marketing|advertis|\bmedia\b|branding|software|\bweb\b|\bapps?\b|\btech\b|technolog|solutions|infotech|\bseo\b|creative|promotion|publicity/],
  ["Security", /security|\bguards?\b|detective|surveillance/],
  ["Trust & NGO", /\bngo\b|\btrust\b|foundation|charit|samiti|sanstha|\bmandir\b|temple|church|mosque|masjid|gurudwara/],
];

export const ALL_CATEGORIES: string[] = [...RULES.map((r) => r[0]), OTHER_CATEGORY];

function guessFrom(text: string): string | null {
  const t = text.toLowerCase().replace(/[_]+/g, " ");
  if (!t.trim()) return null;
  for (const [tag, re] of RULES) {
    if (re.test(t)) return tag;
  }
  return null;
}

/** Auto guess: name first, then the subtitle (business_name), else "Other". */
export function guessCategory(
  name: string | null | undefined,
  subtitle: string | null | undefined
): string {
  return guessFrom(name ?? "") ?? guessFrom(subtitle ?? "") ?? OTHER_CATEGORY;
}

/** Clean a user-typed category: trim, collapse spaces, max 12 chars. */
export function normalizeCategory(raw: string | null | undefined): string | null {
  const v = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, CATEGORY_MAX).trim();
  if (!v) return null;
  const known = ALL_CATEGORIES.find((c) => c.toLowerCase() === v.toLowerCase());
  if (known) return known;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** The tag to show: manual choice if saved, else the guess. */
export function getLeadCategory(lead: {
  name: string;
  business_name: string | null;
  category?: string | null;
}): string {
  return normalizeCategory(lead.category) ?? guessCategory(lead.name, lead.business_name);
}

export function categoryKey(tag: string): string {
  return tag.toLowerCase();
}
