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

const VITE_TRENDS_API_BASE_URL = (import.meta.env.VITE_TRENDS_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

function trendsApiUrl(query: string): string {
  return VITE_TRENDS_API_BASE_URL ? `${VITE_TRENDS_API_BASE_URL}/api/trends${query}` : `/api/trends${query}`;
}

function buildAiImagePrompt(trend: Trend): string {
  const text = `${trend.tag} ${trend.title} ${trend.description}`.toLowerCase();
  const parts: string[] = [];

  if (/(राजधानी|शताब्दी|दुरंतो)/i.test(text)) parts.push("Rajdhani Express Indian train");
  else if (/(ट्रेन|रेल|train|railway)/i.test(text)) parts.push("Indian railway train");

  if (/(आग|fire|जला|ब्लास्ट|blast)/i.test(text)) parts.push("fire flames smoke dramatic");
  if (/(बाढ़|flood)/i.test(text)) parts.push("flood disaster India");
  if (/(सड़क|road|highway)/i.test(text) && /(हादसा|accident)/i.test(text)) parts.push("road accident India emergency");
  if (/(सोना|gold)/i.test(text) && /(चांदी|silver)/i.test(text)) parts.push("gold silver bullion market India");
  else if (/(सोना|gold)/i.test(text)) parts.push("gold bars coins bullion India");
  if (/(पेट्रोल|petrol|डीजल|diesel)/i.test(text)) parts.push("petrol diesel fuel pump India price");
  if (/(cng|सीएनजी)/i.test(text)) parts.push("CNG gas station vehicle India");
  if (/(सब्जी|मंडी|vegetable)/i.test(text)) parts.push("Indian vegetable bazaar market colorful");
  if (/(गर्मी|heat|धूप|summer)/i.test(text)) parts.push("scorching summer heat India sun heatwave");
  if (/(चुनाव|election|निकाय)/i.test(text)) parts.push("Indian election voting democracy ballot");
  if (/(हिमाचल)/i.test(text)) parts.push("Himachal Pradesh mountain India landscape");
  if (/(वैष्णो|vaishno|देवी|दुर्गा)/i.test(text)) parts.push("Vaishno Devi Hindu shrine pilgrimage mountains");
  if (/(पंजाब|punjab)/i.test(text)) parts.push("Punjab India golden wheat fields");
  if (/(किलर|killer|साइलेंट)/i.test(text)) parts.push("air pollution smog health hazard India");
  if (/(क्रिकेट|cricket|ipl)/i.test(text)) parts.push("cricket IPL stadium India crowd cheering");
  if (/(शिव|महादेव|भोलेनाथ)/i.test(text)) parts.push("Shiva temple India spiritual worship");
  if (/(हनुमान)/i.test(text)) parts.push("Hanuman statue temple India devotion");

  if (parts.length === 0) parts.push(trend.title);

  const styleMap: Record<string, string> = {
    public_safety: "dramatic photojournalism India breaking news cinematic",
    news: "India news event photojournalism realistic",
    sports: "cricket IPL sports action photography India",
    finance: "financial market economy India",
    devotional: "Indian temple spiritual photography golden hour",
    weather: "dramatic sky weather India atmospheric",
    entertainment: "Bollywood India cinema vibrant",
    politics: "Indian government election rally",
    government: "Indian government official building flag",
  };
  const style = styleMap[trend.category] ?? "India news realistic photograph cinematic";
  return `${parts.join(", ")}, ${style}, high quality, 16:9`;
}

function aiSpotlightImageSrc(trend: Trend): string {
  const prompt = buildAiImagePrompt(trend);
  const seed = Math.abs(trend.tag.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % 9999;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=900&height=360&nologo=true&seed=${seed}`;
}

function aiPostImageSrc(trend: Trend, variant: "post" | "postCompact" | "hero"): string {
  const prompt = buildAiImagePrompt(trend);
  const base = Math.abs(trend.tag.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % 9999;
  const seedOffset = variant === "hero" ? 600 : variant === "post" ? 200 : 400;
  const w = variant === "hero" ? 900 : 360;
  const h = variant === "hero" ? 460 : variant === "post" ? 180 : 144;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&seed=${base + seedOffset}`;
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
          <GeneratedPost key={`feed-${trend.tag}-${index}`} trend={trend} compact={index > 0} onOpen={() => onSelectTrend(trend)} />
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
          <img
            src={aiSpotlightImageSrc(topTrend)}
            alt=""
            onError={(e) => { (e.target as HTMLImageElement).src = trendImageSrc(topTrend, "spotlight"); }}
          />
          <span className="primary-rank">#1</span>
          <span className="hero-hot-badge">🔥 हॉट ट्रेंड</span>
          <strong>{tagLabelFor(topTrend)}</strong>
        </button>
        <div className="trend-mini-grid">
          {rest.map((trend) => (
            <button key={trend.tag} className="trend-mini-card" onClick={() => onSelectTrend(trend)}>
              <span className="mini-rank-badge">#{trend.rank}</span>
              <span className="mini-category-badge">{CATEGORY_LABELS[trend.category] ?? trend.category}</span>
              <span className="trend-mini-emoji">{contextEmojiFor(trend)}</span>
              <strong>{(() => {
                const ce = contextEmojiFor(trend);
                const full = tagLabelFor(trend);
                return full.startsWith(ce) ? full.slice(ce.length).trimStart() : full;
              })()}</strong>
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
  const relatedTags = relatedHashtagsFor(trend, allRelated);

  return (
    <div className="app-view">
      <header className="detail-top">
        <button className="round-icon" onClick={onBack} aria-label="Back to feed">←</button>
        <div>
          <strong>{trend.title}</strong>
          <span className="detail-views">{trend.tag}</span>
        </div>
        <div className="detail-top-actions">
          <ShareButton trend={trend} />
        </div>
      </header>

      <div className="detail-scroll">
        <section className="detail-hero">
          <img
            src={aiPostImageSrc(trend, "hero")}
            alt={`AI visual for ${trend.title}`}
            onError={(e) => { (e.target as HTMLImageElement).src = trendImageSrc(trend, "hero"); }}
          />
          <div className="hero-badges">
            <span>#{trend.rank}</span>
            <span>{CATEGORY_LABELS[trend.category] ?? trend.category}</span>
            <span>🔥 हॉट ट्रेंड · {viewCountFor(trend)} व्यूज़ · {postCountFor(trend)} पोस्ट</span>
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
              {relatedTags.length > 0 && (
                <div className="related-hashtag-chips">
                  {relatedTags.map((tag) => (
                    <span key={tag} className="related-hashtag-chip">{tag}</span>
                  ))}
                </div>
              )}
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

function RelatedPostCards({ trend }: { trend: Trend }) {
  const posts = relatedPostVariantsFor(trend);

  return (
    <section className="related-posts">
      <div className="section-title">
        <p className="eyebrow">ट्रेंडिंग पोस्ट</p>
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
            <img
              src={aiPostImageSrc(trend, item.imageVariant)}
              alt=""
              onError={(e) => { (e.target as HTMLImageElement).src = trendImageSrc(trend, item.imageVariant); }}
            />
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
  const hint = response?.meta.timeMode?.mode
    ? `"${response.meta.timeMode.mode.replace(/_/g, " ")}" खोजें`
    : `"ट्रेंडिंग टॉपिक" खोजें`;
  return (
    <header className="top-bar sc-top-bar">
      <div className="sc-search-row">
        <div className="sc-search-pill">
          <span className="sc-search-icon">🔍</span>
          <span className="sc-search-hint">{hint}</span>
        </div>
        <div className="sc-top-icons">
          <button className="sc-icon-btn sc-notif-btn" onClick={onRefresh} disabled={refreshing} aria-label="Refresh / Notifications">
            <span>🔔</span>
            <span className="sc-notif-badge">{refreshing ? "…" : "49"}</span>
          </button>
          <button className="sc-icon-btn" aria-label="Messages">💬</button>
          <button className="sc-icon-btn" aria-label="More">⋯</button>
        </div>
      </div>
    </header>
  );
}

function ScFlameIcon({ active }: { active?: boolean }) {
  const color = active ? "#3d4fb5" : "#b0b4c8";
  return (
    <svg className="sc-tab-icon" width="12" height="18" viewBox="0 0 12 18" fill="none" aria-hidden="true">
      {/* Flame shape: wide at base, curves to a point at top, slight right-lean like real ShareChat */}
      <path
        d="M6 0C6 0 9.5 3.5 10.5 6.5C11.5 9 11 11 10 12.5C9.5 13.5 9 14 8.5 14.5C10 13 10 11 9 9.5C8 8 6.5 7.5 6.5 7.5C6.5 7.5 6.5 10 5 11.5C4.2 12.3 3.5 12.5 3 13C2 14 1.5 15.5 2 17C1 16 0 14.5 0 12.5C0 9 2 5.5 6 0Z"
        fill={color}
      />
      <ellipse cx="6" cy="15" rx="3.5" ry="3" fill={color} />
    </svg>
  );
}

function TabBar() {
  const tabs = ["Trending", "Video", "Series", "Follow"];
  return (
    <nav className="tab-bar sc-tab-bar" aria-label="ShareChat sections">
      {tabs.map((tab, index) => (
        <button key={tab} className={index === 0 ? "active" : ""}>
          <ScFlameIcon active={index === 0} />{tab}
        </button>
      ))}
    </nav>
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
      <img
        src={aiPostImageSrc(trend, compact ? "postCompact" : "post")}
        alt={`Generated visual for ${trend.title}`}
        onError={(e) => { (e.target as HTMLImageElement).src = trendImageSrc(trend, compact ? "postCompact" : "post"); }}
      />
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

function postCountFor(trend: Trend): string {
  return `${Math.max(12, (trend.heatScore * 4 + trend.rank * 7) % 900 + 50)}`;
}

function relatedHashtagsFor(trend: Trend, allRelated: Trend[]): string[] {
  const sameCat = allRelated.filter((t) => t.category === trend.category);
  const pool = sameCat.length >= 2 ? sameCat : allRelated;
  return pool.slice(0, 2).map((t) => t.tag);
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

  // Disease / epidemic
  if (/(इबोला|कोविड|वायरस|virus|covid|flu|outbreak|बुखार|बीमारी|disease|infection|महामारी)/i.test(text)) return "🦠";

  // Train + fire = fire story (not a train story)
  if (/(राजधानी|एक्सप्रेस|शताब्दी|ट्रेन|रेल|train|railway)/i.test(text) && /(आग|fire|blast|जला)/i.test(text)) return "🔥";

  // Road accident (car, not siren)
  if ((/(सड़क|road|highway|हाइवे)/i.test(text) && /(हादसा|दुर्घटना|टक्कर|accident|crash|पलटी)/i.test(text))) return "🚗";

  // General fire / blast (not transport related)
  if (/(आग|fire|ब्लास्ट|विस्फोट)/i.test(text) && !/(ट्रेन|train|राजधानी|सड़क)/i.test(text)) return "🔥";

  // Train / rail (no fire)
  if (/(राजधानी|एक्सप्रेस|शताब्दी|ट्रेन|रेल|train|railway)/i.test(text)) return "🚆";

  // General accident without specific vehicle
  if (/(हादसा|दुर्घटना|accident|crash)/i.test(text)) return "⚠️";

  // Vegetables / food market
  if (/(सब्जी|मंडी|टमाटर|प्याज|आलू|दाल|vegetable|onion|tomato|potato)/i.test(text)) return "🥦";

  // Gold + silver together
  if (/(सोना|सोने|gold)/i.test(text) && /(चांदी|silver)/i.test(text)) return "💰";
  // Gold only
  if (/(सोना|सोने|gold|bullion)/i.test(text)) return "🥇";
  // Silver only
  if (/(चांदी|silver)/i.test(text)) return "🪙";

  // Petrol / diesel (oil/fuel barrel)
  if (/(पेट्रोल|petrol|डीजल|diesel)/i.test(text)) return "🛢️";
  // CNG / LPG (gas pump)
  if (/(cng|lpg|सीएनजी|एलपीजी)/i.test(text)) return "⛽";
  // General price / inflation
  if (/(कीमत|रेट|भाव|महंगा|महंगाई|price|inflation)/i.test(text)) return "💸";

  // Elections
  if (/(चुनाव|election|मतदान|vote|निकाय|ballot)/i.test(text)) return "🗳️";

  // Cricket / IPL
  if (/(t20|ipl|क्रिकेट|मैच|बनाम|vs|rcb|pbks|kkr|csk|srh|mi\b|gt\b)/i.test(text)) return "🏏";

  // Movies / entertainment
  if (/(बॉलीवुड|फिल्म|actor|actress|movie|cinema|ओटीटी|ott)/i.test(text)) return "🎬";

  // Politics / government minister
  if (/(cm\b|pm\b|पीएम|सीएम|मुख्यमंत्री|मंत्री|इस्तीफा|minister)/i.test(text)) return "📢";

  // Devotional — deity specific
  if (/(हनुमान|बजरंग|पवनपुत्र)/i.test(text)) return "🐵";
  if (/(शिव|महादेव|भोलेनाथ|शंकर)/i.test(text)) return "🕉️";
  if (/(वैष्णो|दुर्गा|लक्ष्मी|सरस्वती|माँ|देवी)/i.test(text)) return "🛕";
  if (/(राम|कृष्ण|विष्णु|गणेश)/i.test(text)) return "🙏";
  if (/(भक्ति|पूजा|अमावस्या|आरती|नवरात्रि)/i.test(text)) return "🪔";
  if (/(दिवाली|होली|ईद|दशहरा|festival|त्योहार)/i.test(text)) return "🪔";

  // Weather — heat vs rain
  if (/(गर्मी|धूप|लू|heat|heatwave|गर्म)/i.test(text)) return "☀️";
  if (/(बारिश|rain|storm|बाढ़|flood|cyclone|तूफान)/i.test(text)) return "🌧️";
  if (/(मौसम|weather|ठंड|cold|fog)/i.test(text)) return "🌤️";

  // Health / pollution / silent killer
  if (/(किलर|killer|साइलेंट|silent)/i.test(text)) return "⚠️";
  if (/(प्रदूषण|pollution|smog|धुआं)/i.test(text)) return "💨";
  if (/(कैंसर|cancer|दिल|heart|अस्पताल|hospital|स्वास्थ्य|health)/i.test(text)) return "🏥";

  // Education / exams
  if (/(स्कूल|परीक्षा|neet|cbse|jee|शिक्षा|exam|result)/i.test(text)) return "📚";

  // Law / court
  if (/(कोर्ट|court|न्याय|justice|सुप्रीम|supreme|कानून|law)/i.test(text)) return "⚖️";

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
