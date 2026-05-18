import type { Trend } from "@/types/trends";

export const CATEGORY_LABELS: Record<string, string> = {
  sports: "खेल",
  news: "खबर",
  entertainment: "मनोरंजन",
  finance: "कीमत",
  weather: "मौसम",
  politics: "राजनीति",
  devotional: "भक्ति",
  festival: "त्योहार",
  education: "परीक्षा",
  jobs: "नौकरी",
  viral: "वायरल",
  public_safety: "सुरक्षा",
  government: "सरकार",
  technology: "टेक",
  local: "लोकल",
  movies: "फिल्म",
  music: "म्यूजिक",
};

export const CATEGORY_PALETTES: Record<string, [string, string]> = {
  sports: ["#0f766e", "#22c55e"],
  news: ["#1d4ed8", "#38bdf8"],
  entertainment: ["#be123c", "#f472b6"],
  finance: ["#047857", "#84cc16"],
  weather: ["#0284c7", "#7dd3fc"],
  devotional: ["#c2410c", "#f59e0b"],
  festival: ["#a21caf", "#fb7185"],
  public_safety: ["#b91c1c", "#fb923c"],
  government: ["#4338ca", "#60a5fa"],
  education: ["#6d28d9", "#a78bfa"],
  viral: ["#db2777", "#fb7185"],
};

function trendText(t: Trend) {
  return `${t.tag} ${t.title} ${t.description}`.toLowerCase();
}

export function contextEmoji(t: Trend): string {
  const tx = trendText(t);
  if (/(इबोला|कोविड|वायरस|virus|covid|flu|outbreak|महामारी)/i.test(tx)) return "🦠";
  if (/(राजधानी|ट्रेन|रेल|train)/i.test(tx) && /(आग|fire|blast)/i.test(tx)) return "🔥";
  if (/(सड़क|road|highway)/i.test(tx) && /(हादसा|accident|crash)/i.test(tx)) return "🚗";
  if (/(आग|fire|ब्लास्ट|विस्फोट)/i.test(tx) && !/(ट्रेन|train|सड़क)/i.test(tx)) return "🔥";
  if (/(राजधानी|शताब्दी|ट्रेन|रेल|train)/i.test(tx)) return "🚆";
  if (/(हादसा|दुर्घटना|accident|crash)/i.test(tx)) return "⚠️";
  if (/(सब्जी|टमाटर|प्याज|आलू|vegetable|onion|tomato)/i.test(tx)) return "🥦";
  if (/(सोना|gold)/i.test(tx) && /(चांदी|silver)/i.test(tx)) return "💰";
  if (/(सोना|gold)/i.test(tx)) return "🥇";
  if (/(चांदी|silver)/i.test(tx)) return "🪙";
  if (/(पेट्रोल|petrol|डीजल|diesel)/i.test(tx)) return "🛢️";
  if (/(cng|lpg|सीएनजी)/i.test(tx)) return "⛽";
  if (/(कीमत|रेट|भाव|महंगाई|price)/i.test(tx)) return "💸";
  if (/(चुनाव|election|मतदान|vote)/i.test(tx)) return "🗳️";
  if (/(t20|ipl|क्रिकेट|मैच|rcb|csk|srh|kkr)/i.test(tx)) return "🏏";
  if (/(बॉलीवुड|फिल्म|movie|cinema|ott)/i.test(tx)) return "🎬";
  if (/(शिव|महादेव|भोलेनाथ|शिवरात्रि)/i.test(tx)) return "🕉️";
  if (/(हनुमान|राम|दुर्गा|देवी|मंदिर)/i.test(tx)) return "🙏";
  if (/(मौसम|बारिश|बाढ़|तूफान|weather|flood)/i.test(tx)) return "🌧️";
  if (/(गर्मी|heat|धूप|heatwave)/i.test(tx)) return "☀️";
  if (/(नौकरी|job|vacancy|भर्ती|recruitment)/i.test(tx)) return "💼";
  if (/(सुप्रभात|morning|good morning)/i.test(tx)) return "🌅";
  if (/(शुभ रात्रि|good night|रात)/i.test(tx)) return "🌙";
  return CATEGORY_PALETTES[t.category] ? "✨" : "📌";
}

export function tagLabel(t: Trend): string {
  const raw = (t.displayLabel?.trim() || t.title).trim();
  const emoji = contextEmoji(t);
  if (raw.startsWith(emoji)) return raw;
  return `${emoji} ${raw}`;
}

export function aiImageUrl(t: Trend, w = 900, h = 460): string {
  const tx = trendText(t);
  const parts: string[] = [];
  if (/(शिव|महादेव|भोलेनाथ)/i.test(tx)) parts.push("Shiva temple India spiritual worship golden hour");
  else if (/(हनुमान)/i.test(tx)) parts.push("Hanuman statue temple India devotion");
  else if (/(क्रिकेट|ipl)/i.test(tx)) parts.push("cricket IPL stadium India crowd");
  else if (/(पेट्रोल|डीजल|petrol|diesel)/i.test(tx)) parts.push("petrol diesel fuel pump India price");
  else if (/(सोना|gold)/i.test(tx)) parts.push("gold bars coins bullion India market");
  else if (/(ट्रेन|रेल|train)/i.test(tx)) parts.push("Indian railway train station");
  else if (/(बाढ़|flood)/i.test(tx)) parts.push("flood disaster India dramatic");
  else if (/(मौसम|rain)/i.test(tx)) parts.push("monsoon rain India dramatic sky");
  else parts.push(t.title);
  const style = {
    devotional: "Indian temple spiritual photography golden hour",
    sports: "sports action photography India",
    news: "India news photojournalism realistic",
    finance: "financial economy India market",
    weather: "dramatic sky weather India atmospheric",
  }[t.category] ?? "India realistic cinematic photograph";
  const prompt = `${parts.join(", ")}, ${style}, high quality`;
  const seed = Math.abs(t.tag.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 9999;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&seed=${seed}`;
}

export function viewCount(t: Trend): string {
  return `${Math.max(1, Math.round((t.heatScore + t.bharatRelevanceScore) / 12))}.${t.rank} लाख`;
}

export function postCount(t: Trend): string {
  return `${Math.max(12, (t.heatScore * 4 + t.rank * 7) % 900 + 50)}`;
}

export function likeCount(t: Trend): string {
  return `${Math.max(1, Math.round(t.heatScore / 9))}.${t.rank}K`;
}

export function aiSummary(t: Trend): string {
  const source = t.sources.slice(0, 2).join(" और ") || "लाइव स्रोतों";
  return `${t.title} पर अभी ${source} में संकेत दिख रहे हैं। ${t.whyTrending} ${t.sampleContent.text}`;
}

export function whatsAppText(t: Trend): string {
  return encodeURIComponent(`${tagLabel(t)}\n${aiSummary(t)}\n${t.tag}`);
}
