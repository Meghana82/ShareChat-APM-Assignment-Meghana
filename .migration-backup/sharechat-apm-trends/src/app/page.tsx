"use client";

import { useEffect, useMemo, useState } from "react";

type Trend = {
  rank: number;
  tag: string;
  title: string;
  displayLabel: string;
  description: string;
  category: string;
  heatScore: number;
  bharatRelevanceScore: number;
  sources: string[];
  sourceTypes?: string[];
  trendStage: string;
  whyTrending: string;
  sampleContent: { type: "summary"; text: string };
  safety?: { status: string; reasons: string[] };
  signalSummary?: {
    externalValidationScore: number;
    crossSourceCount: number;
    freshnessScore: number;
    reliabilityScore: number;
    regionalRelevanceScore: number;
  };
  isTopSurfaceCandidate?: boolean;
  surfaceSlot?: number | null;
  surfaceReason?: string | null;
};

type ApiResponse = {
  generatedAt: string;
  cache: { status: string; cacheWindowMinutes: number };
  meta: {
    returnedCount: number;
    rawSignalCount?: number;
    filteredSignalCount?: number;
    timeMode?: { mode: string; istHour: number; reason: string };
  };
  trends: Trend[];
};

type ViewMode = "feed" | "detail";
type DetailTab = "summary" | "posts";

const CATEGORY_LABELS: Record<string, string> = {
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

const CATEGORY_EMOJI: Record<string, string> = {
  sports: "🏏",
  news: "📰",
  entertainment: "🎬",
  finance: "⛽",
  weather: "🌦️",
  politics: "📢",
  devotional: "🙏",
  festival: "🪔",
  education: "📚",
  jobs: "💼",
  viral: "✨",
  public_safety: "🚨",
  government: "🏛️",
  technology: "📡",
  local: "📍",
  movies: "🎞️",
  music: "🎵",
};

const VISUAL_PALETTES: Record<string, [string, string, string]> = {
  sports: ["#0f766e", "#22c55e", "#facc15"],
  news: ["#1d4ed8", "#38bdf8", "#f97316"],
  entertainment: ["#be123c", "#f472b6", "#fde047"],
  finance: ["#047857", "#84cc16", "#f59e0b"],
  weather: ["#0284c7", "#7dd3fc", "#fb923c"],
  devotional: ["#c2410c", "#f59e0b", "#fef3c7"],
  festival: ["#a21caf", "#fb7185", "#facc15"],
  public_safety: ["#b91c1c", "#fb923c", "#fde68a"],
  government: ["#4338ca", "#60a5fa", "#f97316"],
  education: ["#6d28d9", "#a78bfa", "#fef08a"],
  viral: ["#db2777", "#fb7185", "#67e8f9"],
};

const TRENDS_API_BASE_URL = process.env.NEXT_PUBLIC_TRENDS_API_BASE_URL?.replace(/\/$/, "");

function trendsApiUrl(query: string): string {
  return TRENDS_API_BASE_URL ? `${TRENDS_API_BASE_URL}/api/trends${query}` : `/api/trends${query}`;
}

export default function HomePage() {
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("feed");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTrends(false);
  }, []);

  async function loadTrends(forceRefresh: boolean) {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      const query = forceRefresh ? "?limit=10&forceRefresh=1" : "?limit=10";
      const res = await fetch(trendsApiUrl(query), { cache: "no-store" });
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = (await res.json()) as ApiResponse;
      setResponse(data);
      setActiveTag((current) => (current && data.trends.some((trend) => trend.tag === current) ? current : data.trends[0]?.tag ?? null));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load trends");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const trends = response?.trends ?? [];
  const activeTrend = useMemo(() => trends.find((trend) => trend.tag === activeTag) ?? trends[0], [trends, activeTag]);

  return (
    <main className="bharat-shell">
      <section className="app-phone" aria-label="ShareChat trending tags prototype">
        {view === "detail" && activeTrend ? (
          <TrendDetail trend={activeTrend} response={response} onBack={() => setView("feed")} onSelectTrend={openTrend} />
        ) : (
          <FeedView
            response={response}
            trends={trends}
            loading={loading}
            refreshing={refreshing}
            error={error}
            onRefresh={() => loadTrends(true)}
            onSelectTrend={openTrend}
          />
        )}
      </section>
    </main>
  );

  function openTrend(trend: Trend) {
    setActiveTag(trend.tag);
    setView("detail");
  }
}

function FeedView({
  response,
  trends,
  loading,
  refreshing,
  error,
  onRefresh,
  onSelectTrend,
}: {
  response: ApiResponse | null;
  trends: Trend[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectTrend: (trend: Trend) => void;
}) {
  return (
    <div className="app-view">
      <TopBar response={response} refreshing={refreshing} onRefresh={onRefresh} />
      <TabBar />

      <div className="feed-scroll">
        {loading ? <LoadingSurface /> : null}
        {error ? <div className="error-panel">{error}</div> : null}

        <TrendingTagsPanel trends={trends} onSelectTrend={onSelectTrend} />

        <section className="feed-section-heading">TRENDING POSTS</section>
        {trends.slice(0, 5).map((trend, index) => (
          <GeneratedPost key={trend.tag} trend={trend} compact={index > 0} onOpen={() => onSelectTrend(trend)} />
        ))}
      </div>
      <BottomNav />
    </div>
  );
}

function TrendingTagsPanel({ trends, onSelectTrend }: { trends: Trend[]; onSelectTrend: (trend: Trend) => void }) {
  if (!trends.length) return null;
  const topTrend = trends[0];
  const rest = trends.slice(1, 10);

  return (
    <section className="trend-list-panel" aria-label="Trending tags">
      <div className="feed-section-heading">आज की हलचल</div>
      <div className="trend-list">
        <button className="trend-primary-photo" onClick={() => onSelectTrend(topTrend)} aria-label={tagLabelFor(topTrend)}>
          <img src={trendImageSrc(topTrend, "spotlight")} alt="" />
          <span className="primary-rank">#1</span>
          <strong>{tagLabelFor(topTrend)}</strong>
        </button>
        <div className="trend-mini-grid">
          {rest.map((trend) => (
            <button key={trend.tag} className="trend-mini-card" onClick={() => onSelectTrend(trend)}>
              <span className="trend-mini-emoji">{contextEmojiFor(trend)}</span>
              <strong>#{trend.rank} {tagLabelFor(trend)}</strong>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrendDetail({
  trend,
  response,
  onBack,
  onSelectTrend,
}: {
  trend: Trend;
  response: ApiResponse | null;
  onBack: () => void;
  onSelectTrend: (trend: Trend) => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("summary");
  const allRelated = response?.trends.filter((item) => item.tag !== trend.tag) ?? [];
  const summary = aiSummaryFor(trend);

  return (
    <div className="app-view">
      <header className="detail-top">
        <button className="round-icon" onClick={onBack} aria-label="Back to feed">←</button>
        <div>
          <strong>{trend.title}</strong>
          <span>{trend.tag}</span>
        </div>
      </header>

      <div className="detail-scroll">
        <section className="detail-hero">
          <img src={trendImageSrc(trend, "hero")} alt={`AI visual for ${trend.title}`} />
          <div className="hero-badges">
            <span>#{trend.rank}</span>
            <span>{CATEGORY_LABELS[trend.category] ?? trend.category}</span>
            <span>हॉट ट्रेंड</span>
            <ShareButton trend={trend} label="शेयर" />
          </div>
        </section>

        <section className="detail-title">
          <h1>{tagLabelFor(trend)}</h1>
          <p>{trend.description}</p>
        </section>

        <section className="detail-tabs" aria-label="Trend detail tabs">
          <button className={activeTab === "summary" ? "active" : ""} onClick={() => setActiveTab("summary")}>
            खास अपडेट
          </button>
          <button className={activeTab === "posts" ? "active" : ""} onClick={() => setActiveTab("posts")}>
            सभी पोस्ट
          </button>
        </section>

        {activeTab === "summary" ? (
          <>
            <section className="ai-summary-card">
              <div className="summary-head">
                <span className="spark">✦</span>
                <strong>AI सारांश</strong>
                <button className="audio-button" onClick={() => speakHindi(summary)} aria-label="Play Hindi summary">▶</button>
              </div>
              <p>{summary}</p>
            </section>

            <RelatedPostCards trend={trend} />
            <GeneratedPost trend={trend} />
          </>
        ) : (
          <AllPostsTab trend={trend} posts={allRelated.slice(0, 4)} onSelectTrend={onSelectTrend} />
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function RelatedPostCards({
  trend,
}: {
  trend: Trend;
}) {
  const posts = relatedPostVariantsFor(trend);

  return (
    <section className="related-posts">
      <div className="section-title">
        <p className="eyebrow">इससे जुड़े पोस्ट</p>
      </div>
      <div className="related-post-list">
        {posts.map((item) => (
          <article key={item.id} className="related-post-feed-card">
            <div className="post-author">
              <div className="avatar">{avatarInitial(trend.title)}</div>
              <div>
                <strong>{creatorNameFor(trend)}</strong>
                <span>{item.meta}</span>
              </div>
              <button aria-label="More">⋯</button>
            </div>
            <p>
              {item.text} <strong>{tagLabelFor(trend)}</strong>
            </p>
            <img src={trendImageSrc(trend, item.imageVariant)} alt="" />
            <div className="post-actions">
              <span>♡ {likeCountFor(trend)}</span>
              <span>💬 {commentCountFor(trend)}</span>
              <span>↗ शेयर</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AllPostsTab({
  trend,
  posts,
  onSelectTrend,
}: {
  trend: Trend;
  posts: Trend[];
  onSelectTrend: (trend: Trend) => void;
}) {
  const list = [trend, ...posts];

  return (
    <section className="all-posts-tab">
      <p className="eyebrow">इस टैग पर सभी पोस्ट</p>
      {list.map((item, index) => (
        <GeneratedPost
          key={`${item.tag}-${index}`}
          trend={item}
          compact={index > 0}
          onOpen={index > 0 ? () => onSelectTrend(item) : undefined}
        />
      ))}
    </section>
  );
}

function relatedPostVariantsFor(trend: Trend): Array<{
  id: string;
  imageVariant: "post" | "postCompact";
  meta: string;
  text: string;
}> {
  const base = postCaptionFor(trend);

  return [
    {
      id: "quick-update",
      imageVariant: "post",
      meta: `${viewCountFor(trend)} व्यूज़ · अभी`,
      text: truncate(base, 92),
    },
    {
      id: "public-reaction",
      imageVariant: "postCompact",
      meta: `${likeCountFor(trend)} लाइक · चर्चा में`,
      text: truncate(`${trend.sampleContent.text} ${trend.whyTrending}`, 96),
    },
  ];
}

function TopBar({ response, refreshing, onRefresh }: { response: ApiResponse | null; refreshing: boolean; onRefresh: () => void }) {
  return (
    <header className="top-bar">
      <div className="brand-row">
        <div className="brand-mark">S</div>
        <div>
          <strong>ShareChat</strong>
          <span>Pulse of Bharat</span>
        </div>
        <button className="refresh-button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "..." : "↻"}
        </button>
      </div>
      <div className="search-pill">
        <span>⌕</span>
        <p>{response?.meta.timeMode?.mode.replace(/_/g, " ") ?? "live trends"}</p>
      </div>
    </header>
  );
}

function TabBar() {
  return (
    <nav className="tab-bar" aria-label="ShareChat sections">
      {["🔥 ट्रेंडिंग", "▶ वीडियो", "🎭 सीरीज़", "👥 फ़ॉलोइंग"].map((tab, index) => (
        <button key={tab} className={index === 0 ? "active" : ""}>{tab}</button>
      ))}
    </nav>
  );
}

function Spotlight({ trend, onClick }: { trend: Trend; onClick: () => void }) {
  return (
    <button className="spotlight" onClick={onClick}>
      <img src={trendImageSrc(trend, "spotlight")} alt="" />
      <div className="spotlight-copy">
        <span>#{trend.rank} अभी ट्रेंडिंग</span>
        <h2>{trend.displayLabel}</h2>
      </div>
    </button>
  );
}

function GeneratedPost({ trend, compact = false, onOpen }: { trend: Trend; compact?: boolean; onOpen?: () => void }) {
  return (
    <article className={`generated-post ${compact ? "compact" : ""}`} onClick={onOpen}>
      <div className="post-author">
        <div className="avatar">{avatarInitial(trend.title)}</div>
        <div>
          <strong>{creatorNameFor(trend)}</strong>
          <span>{viewCountFor(trend)} व्यूज़ · अभी</span>
        </div>
        <button aria-label="More">⋯</button>
      </div>
      <p>
        {postCaptionFor(trend)} <strong>{tagLabelFor(trend)}</strong>
      </p>
      <img src={trendImageSrc(trend, compact ? "postCompact" : "post")} alt={`Generated visual for ${trend.title}`} />
      <div className="post-actions">
        <span>♡ {likeCountFor(trend)}</span>
        <span>💬 {commentCountFor(trend)}</span>
        <span>↗ शेयर</span>
      </div>
    </article>
  );
}

function ShareButton({ trend, label }: { trend: Trend; label?: string }) {
  const text = encodeURIComponent(`${tagLabelFor(trend)}\n${aiSummaryFor(trend)}\n${trend.tag}`);
  return (
    <a className={`share-chip ${label ? "with-label" : ""}`} href={`https://wa.me/?text=${text}`} target="_blank" rel="noreferrer" aria-label="Share trend">
      <span>↗</span>
      {label ? <strong>{label}</strong> : null}
    </a>
  );
}

function BottomNav() {
  return (
    <footer className="bottom-nav" aria-label="Bottom navigation">
      <span className="active">⌂</span>
      <span>⌕</span>
      <span>＋</span>
      <span>♡</span>
      <span>●</span>
    </footer>
  );
}

function LoadingSurface() {
  return (
    <section className="loading-surface">
      <div />
      <div />
      <div />
    </section>
  );
}

function aiSummaryFor(trend: Trend): string {
  const source = trend.sources.slice(0, 2).join(" और ") || "लाइव स्रोतों";
  const safety = trend.safety?.status === "limited" ? " इसे सीमित और तथ्यात्मक संदर्भ में दिखाया जा रहा है।" : "";
  return `${trend.title} पर अभी ${source} में संकेत दिख रहे हैं। ${trend.whyTrending} ${trend.sampleContent.text}${safety}`;
}

function postCaptionFor(trend: Trend): string {
  if (trend.category === "public_safety") return `${trend.title} से जुड़े ताज़ा अपडेट लोग देख रहे हैं। सुरक्षित रहें और भरोसेमंद जानकारी ही शेयर करें।`;
  if (trend.category === "finance") return `${trend.title} को लेकर शहरों के रेट और घरेलू खर्च पर चर्चा तेज़ है।`;
  if (trend.category === "sports") return `${trend.title} पर फैंस मैच मोमेंट्स, स्कोर और खिलाड़ियों की बात कर रहे हैं।`;
  if (trend.category === "devotional" || trend.category === "festival") return `${trend.title} से जुड़े भक्ति, शुभकामना और स्टेटस पोस्ट शेयर हो रहे हैं।`;
  return trend.sampleContent.text;
}

function creatorNameFor(trend: Trend): string {
  const label = CATEGORY_LABELS[trend.category] ?? "भारत";
  return `${label}_पल्स`;
}

function avatarInitial(title: string): string {
  return title.trim().slice(0, 1) || "भ";
}

function viewCountFor(trend: Trend): string {
  return `${Math.max(1, Math.round((trend.heatScore + trend.bharatRelevanceScore) / 12))}.${trend.rank} लाख`;
}

function likeCountFor(trend: Trend): string {
  return `${Math.max(1, Math.round(trend.heatScore / 9))}.${trend.rank}K`;
}

function commentCountFor(trend: Trend): string {
  return String(Math.max(28, trend.heatScore * 3 + trend.rank));
}

function tagLabelFor(trend: Trend): string {
  const label = stripBoundaryEmoji(trend.displayLabel?.trim() || trend.title);
  return `${contextEmojiFor(trend)} ${label} ${endEmojiFor(trend)}`;
}

function contextEmojiFor(trend: Trend): string {
  const text = trendTextFor(trend);
  if (/(इबोला|कोविड|वायरस|virus|covid|flu|outbreak|बुखार|बीमारी|disease)/i.test(text)) return "🦠";
  if (/(सड़क|हादसा|दुर्घटना|टक्कर|accident|crash)/i.test(text)) return "🚨";
  if (/(राजधानी|एक्सप्रेस|रेल|ट्रेन|train|express)/i.test(text)) return "🚆";
  if (/(आग|fire|ब्लास्ट|धुआं)/i.test(text)) return "🔥";
  if (/(सब्जी|मंडी|vegetable|tomato|onion|आलू|प्याज|टमाटर)/i.test(text)) return "🥬";
  if (/(सोना|चांदी|gold|silver)/i.test(text)) return "💰";
  if (/(cng|petrol|diesel|lpg|पेट्रोल|डीजल|गैस|fuel|ईंधन)/i.test(text)) return "⛽";
  if (/(कीमत|रेट|भाव|महंगा|price)/i.test(text)) return "💸";
  if (/(t20|ipl|क्रिकेट|मैच|बनाम|vs|rcb|pbks|kkr|gt|delhi|rajasthan|दिल्ली|राजस्थान)/i.test(text)) return "🏏";
  if (/(कमल|हासन|बॉलीवुड|फिल्म|actor|actress|movie|cinema)/i.test(text)) return "🎬";
  if (/(राहुल|cm|pm|मंत्री|सरकार|चुनाव|इस्तीफा|party|minister|विजय)/i.test(text)) return "📢";
  if (/(माँ|देवी|भक्ति|पूजा|शनिदेव|अमावस्या|आरती|जय)/i.test(text)) return "🙏";
  if (/(गर्मी|धूप|लू|बारिश|मौसम|weather|rain|storm|heat)/i.test(text)) return "🌦️";
  if (/(स्कूल|परीक्षा|neet|cbse|शिक्षा|exam|result)/i.test(text)) return "📚";
  return CATEGORY_EMOJI[trend.category] ?? "🔥";
}

function endEmojiFor(trend: Trend): string {
  const text = trendTextFor(trend);
  if (/(मौत|death|मर|हादसा|दुर्घटना|accident|crash)/i.test(text)) return "😨";
  if (/(आग|fire|ब्लास्ट)/i.test(text)) return "🔥";
  if (/(सब्जी|मंडी|vegetable|आलू|प्याज|टमाटर)/i.test(text)) return "🛒";
  if (/(सोना|चांदी|gold|silver)/i.test(text)) return "📈";
  if (/(कीमत|रेट|भाव|महंगा|price|cng|petrol|diesel|lpg|पेट्रोल|डीजल|गैस)/i.test(text)) return "😲";
  if (/(मिले|मुलाकात|meeting|कमल|हासन|cm|विजय)/i.test(text)) return "🤝";
  if (/(क्रिकेट|मैच|बनाम|vs|t20|ipl)/i.test(text)) return "👊";
  if (/(गर्मी|धूप|लू|weather|heat)/i.test(text)) return "🌞";
  if (/(भक्ति|पूजा|देवी|माँ|जय)/i.test(text)) return "🙏";

  const byCategory: Record<string, string> = {
    sports: "👊",
    news: "😮",
    entertainment: "✨",
    finance: "😲",
    weather: "🌞",
    politics: "🤝",
    devotional: "🙏",
    festival: "🌸",
    education: "📚",
    jobs: "💼",
    viral: "🔥",
    public_safety: "😨",
    government: "📢",
    technology: "😊",
    local: "📍",
    movies: "🎬",
    music: "🎵",
  };

  return byCategory[trend.category] ?? "🔥";
}

function trendTextFor(trend: Trend): string {
  return `${trend.tag} ${trend.title} ${trend.displayLabel} ${trend.description} ${trend.category}`.toLowerCase();
}

function stripBoundaryEmoji(value: string): string {
  return value
    .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\s]+/u, "")
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\s]+$/u, "")
    .trim();
}

function categorySceneFor(trend: Trend): string {
  const scenes: Record<string, string> = {
    sports: "मैदान, स्कोरबोर्ड और फैंस",
    news: "ब्रेकिंग न्यूज़ स्टूडियो",
    entertainment: "रेड कार्पेट और कैमरा फ्लैश",
    finance: "बाज़ार भाव और खर्च अपडेट",
    weather: "आसमान, धूप और मौसम अलर्ट",
    politics: "सभा, माइक और जनता",
    devotional: "दीया, फूल और भक्ति",
    festival: "त्योहार, रंग और शुभकामना",
    education: "किताब, परीक्षा और अपडेट",
    jobs: "ऑफिस, फॉर्म और नौकरी अपडेट",
    viral: "सोशल पोस्ट और रिएक्शन",
    public_safety: "अलर्ट, सड़क और सुरक्षा अपडेट",
    government: "सरकारी भवन और घोषणा",
    technology: "नेटवर्क और डिजिटल सिग्नल",
    local: "शहर, गली और लोकल चर्चा",
    movies: "सिनेमा स्क्रीन और पोस्टर",
    music: "स्टेज, माइक और गाना",
  };

  return scenes[trend.category] ?? "भारत की लाइव चर्चा";
}

function trendImageSrc(trend: Trend, variant: "tile" | "thumb" | "spotlight" | "hero" | "post" | "postCompact"): string {
  const [a, b, c] = VISUAL_PALETTES[trend.category] ?? ["#f97316", "#22c55e", "#2563eb"];
  const emoji = contextEmojiFor(trend);
  const isPost = variant === "post" || variant === "postCompact";
  const width = variant === "tile" || variant === "thumb" ? 260 : isPost ? 360 : 900;
  const height = variant === "hero" ? 460 : variant === "post" ? 180 : variant === "postCompact" ? 144 : variant === "spotlight" ? 360 : 260;
  const emojiSize = isPost ? 118 : variant === "tile" || variant === "thumb" ? 104 : variant === "hero" ? 190 : 150;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${a}"/>
          <stop offset="0.55" stop-color="${b}"/>
          <stop offset="1" stop-color="${c}"/>
        </linearGradient>
        <radialGradient id="light" cx="30%" cy="20%" r="70%">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
          <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <rect width="100%" height="100%" fill="url(#light)"/>
      <circle cx="${width * 0.84}" cy="${height * 0.18}" r="${height * 0.22}" fill="#ffffff" opacity="0.18"/>
      <circle cx="${width * 0.12}" cy="${height * 0.86}" r="${height * 0.28}" fill="#000000" opacity="0.12"/>
      <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-size="${emojiSize}" font-family="Apple Color Emoji, Segoe UI Emoji">${emoji}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function speakHindi(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "hi-IN";
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
