import React, { useCallback } from "react";
import {
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { useTrends, useRefreshTrends } from "@/hooks/useTrends";
import { TrendHeroCard } from "@/components/TrendHeroCard";
import { TrendMiniCard } from "@/components/TrendMiniCard";
import { TrendShimmer } from "@/components/TrendShimmer";
import { contextEmoji, aiImageUrl, CATEGORY_LABELS, tagLabel } from "@/utils/trends";
import type { Trend } from "@/types/trends";

const SC_TABS = ["Trending", "Video", "Series", "Follow"];

const CREATOR_NAMES = [
  "भक्ति_पल्स", "ShivaFan108", "न्यूज़_अड्डा", "देसी_क्रिएटर",
  "TrendKing_IN", "वायरल_स्टेटस", "भारत_वॉयस", "DailyUpdate_HI",
];

const CREATOR_INITIALS = ["भ", "S", "न्", "द", "T", "वा", "भा", "D"];

const AVATAR_COLORS = [
  ["#ff6b00", "#3b5bdb"],
  ["#c2410c", "#a21caf"],
  ["#047857", "#0284c7"],
  ["#be123c", "#c2410c"],
];

function PostCard({ trend, idx }: { trend: Trend; idx: number }) {
  const creator = CREATOR_NAMES[idx % CREATOR_NAMES.length];
  const initials = CREATOR_INITIALS[idx % CREATOR_INITIALS.length];
  const [c1, c2] = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  const views = `${Math.max(1, Math.round((trend.heatScore + trend.bharatRelevanceScore) / 12))}.${trend.rank} लाख`;
  const likes = `${Math.max(1, Math.round(trend.heatScore / 9))}.${trend.rank}K`;
  const comments = `${Math.max(4, (trend.rank * 17) % 180 + 8)}`;
  const emoji = contextEmoji(trend);

  return (
    <View style={styles.postCard}>
      <View style={styles.postAuthorRow}>
        <View style={[styles.avatar, { backgroundColor: c1 }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.postAuthorInfo}>
          <Text style={styles.postCreator}>{creator}</Text>
          <Text style={styles.postViews}>{views} views</Text>
        </View>
        <View style={styles.moreBtn}>
          <Text style={styles.moreBtnText}>⋯</Text>
        </View>
      </View>

      <Text style={styles.postCaption}>
        यह ट्रेंड अभी पूरे भारत में वायरल है —{" "}
        <Text style={styles.postTag}>{trend.tag}</Text>
        {" "}से जुड़ी जानकारी शेयर करें 🙏
      </Text>

      <Image
        source={{ uri: aiImageUrl(trend, 600, 300) }}
        style={styles.postImage}
        resizeMode="cover"
      />

      <View style={styles.postActions}>
        <Text style={styles.postAction}>❤️ {likes}</Text>
        <Text style={styles.postAction}>💬 {comments}</Text>
        <View style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>📤 WhatsApp</Text>
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, error, isFetching } = useTrends();
  const refresh = useRefreshTrends();
  const [refreshing, setRefreshing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(0);

  const trends = data?.trends ?? [];
  const heroTrend = trends[0] ?? null;
  const miniTrends = trends.slice(1, 10);
  const postTrends = trends.slice(0, 4);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  }, [refresh]);

  function openTrend(trend: Trend) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/trend/[tag]", params: { tag: trend.tag, title: trend.title } });
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View style={styles.searchPill}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchHint}>"गुलाब" खोजें</Text>
        </View>
        <View style={styles.headerIcons}>
          <View style={styles.notifBtn}>
            <Text style={styles.iconEmoji}>🔔</Text>
            <View style={styles.notifBadge}><Text style={styles.notifBadgeText}>68</Text></View>
          </View>
          <Text style={styles.iconEmoji}>💬</Text>
          <Text style={styles.iconEmoji}>⋯</Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {SC_TABS.map((tab, i) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(i)}
            style={[styles.tabItem, i === activeTab && styles.tabItemActive]}
          >
            <Text style={[styles.tabText, i === activeTab && styles.tabTextActive]}>
              🔥 {tab}
            </Text>
            {i === activeTab && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <TrendShimmer />
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error?.message ?? "Trends unavailable"}</Text>
          <Pressable onPress={onRefresh} style={styles.retryBtn}>
            <Text style={styles.retryText}>फिर कोशिश करें</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || isFetching}
              onRefresh={onRefresh}
              tintColor="#ff6b00"
              colors={["#ff6b00"]}
            />
          }
        >
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionHeadingText}>आज की हलचल</Text>
          </View>

          <View style={styles.trendListPanel}>
            {heroTrend && (
              <TrendHeroCard trend={heroTrend} onPress={() => openTrend(heroTrend)} />
            )}
            <View style={styles.miniGrid}>
              {miniTrends.map((t) => (
                <TrendMiniCard key={t.tag} trend={t} onPress={() => openTrend(t)} />
              ))}
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionHeadingText}>TRENDING POSTS</Text>
          </View>

          {postTrends.map((t, idx) => (
            <PostCard key={t.tag} trend={t} idx={idx} />
          ))}

          {trends.length === 0 && (
            <View style={styles.center}>
              <Text style={styles.emptyText}>अभी कोई ट्रेंड नहीं</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "#fff",
    gap: 8,
  },
  searchPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#f2eee8",
  },
  searchIcon: { fontSize: 13, color: "#9b9591" },
  searchHint: { fontFamily: "Inter_400Regular", fontSize: 14, color: "#9b9591" },
  headerIcons: { flexDirection: "row", alignItems: "center", gap: 6 },
  notifBtn: { position: "relative" },
  iconEmoji: { fontSize: 22, padding: 2 },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 999,
    minWidth: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  notifBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },

  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e8e8ea",
    backgroundColor: "#fff",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    position: "relative",
  },
  tabItemActive: {},
  tabText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#605a52",
  },
  tabTextActive: { color: "#ff6b00" },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: 12,
    right: 12,
    height: 3,
    borderRadius: 3,
    backgroundColor: "#ff6b00",
  },

  scrollContent: { paddingBottom: 60 },

  sectionHeading: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: "#f0f0f1",
  },
  sectionHeadingText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#39332d",
    letterSpacing: 0,
  },

  trendListPanel: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e8e8ea",
  },
  miniGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    padding: 6,
    paddingTop: 6,
    paddingBottom: 8,
  },

  postCard: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#ebe3d8",
  },
  postAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  postAuthorInfo: { flex: 1 },
  postCreator: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#1a1614" },
  postViews: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#9b9591", marginTop: 1 },
  moreBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f5f1eb",
    alignItems: "center",
    justifyContent: "center",
  },
  moreBtnText: { fontSize: 18, color: "#756d63" },
  postCaption: {
    marginTop: 12,
    marginBottom: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: "#39332d",
  },
  postTag: { color: "#ff6b00", fontFamily: "Inter_600SemiBold" },
  postImage: {
    width: "100%",
    height: 150,
    borderRadius: 16,
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginTop: 12,
  },
  postAction: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#9b9591",
  },
  shareBtn: {
    marginLeft: "auto" as any,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#e9f8ef",
  },
  shareBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#16a34a",
  },

  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 12 },
  errorText: { fontFamily: "Inter_500Medium", fontSize: 14, textAlign: "center", color: "#ef4444" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: "#ff6b00" },
  retryText: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, color: "#9b9591" },
});
