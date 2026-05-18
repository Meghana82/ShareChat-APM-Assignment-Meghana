import React, { useState } from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useTrends } from "@/hooks/useTrends";
import {
  tagLabel,
  aiImageUrl,
  aiSummary,
  viewCount,
  postCount,
  likeCount,
  whatsAppText,
  CATEGORY_LABELS,
  CATEGORY_PALETTES,
} from "@/utils/trends";
import type { Trend } from "@/types/trends";

type DetailTab = "summary" | "posts";

export default function TrendDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const { data } = useTrends();
  const [tab, setTab] = useState<DetailTab>("summary");

  const trends = data?.trends ?? [];
  const trend = trends.find((t) => t.tag === tag) ?? trends[0];

  if (!trend) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
          ट्रेंड नहीं मिला
        </Text>
      </View>
    );
  }

  const palette = CATEGORY_PALETTES[trend.category];
  const accentColor = palette ? palette[0] : colors.primary;
  const catLabel = CATEGORY_LABELS[trend.category] ?? trend.category;
  const summary = aiSummary(trend);
  const related = trends.filter((t) => t.tag !== trend.tag && t.category === trend.category).slice(0, 2);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  async function shareToWhatsApp() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const url = `https://wa.me/?text=${whatsAppText(trend)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      await Share.share({ message: decodeURIComponent(whatsAppText(trend)) });
    }
  }

  function speakSummary() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, borderBottomColor: colors.border, backgroundColor: "rgba(255,250,244,0.96)" }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Text style={[styles.backArrow, { color: colors.foreground }]}>←</Text>
        </Pressable>
        <View style={styles.headerMid}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>{trend.title}</Text>
          <Text style={[styles.headerTag, { color: colors.mutedForeground }]} numberOfLines={1}>{trend.tag}</Text>
        </View>
        <Pressable onPress={shareToWhatsApp} style={[styles.shareBtn, { backgroundColor: "#25d366" }]} testID="share-btn">
          <Text style={styles.shareBtnText}>↗ शेयर</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: botPad + 24 }}>
        <Image
          source={{ uri: aiImageUrl(trend, 900, 460) }}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <View style={[styles.heroBadgeRow, { backgroundColor: "rgba(0,0,0,0.0)" }]}>
          <View style={[styles.heroBadge, { backgroundColor: accentColor }]}>
            <Text style={styles.heroBadgeText}>#{trend.rank}</Text>
          </View>
          <View style={[styles.heroBadge, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
            <Text style={styles.heroBadgeText}>{catLabel}</Text>
          </View>
          <View style={[styles.heroBadge, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
            <Text style={styles.heroBadgeText}>🔥 {viewCount(trend)} व्यूज़ · {postCount(trend)} पोस्ट</Text>
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={[styles.titleText, { color: colors.foreground }]}>{tagLabel(trend)}</Text>
          <Text style={[styles.descText, { color: colors.mutedForeground }]}>{trend.description}</Text>
        </View>

        <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
          {(["summary", "posts"] as DetailTab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tabBtn, tab === t && { borderBottomColor: accentColor, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabLabel, { color: tab === t ? accentColor : colors.mutedForeground }]}>
                {t === "summary" ? "खास अपडेट" : "सभी पोस्ट"}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "summary" ? (
          <View style={styles.summaryBlock}>
            <View style={[styles.aiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.aiCardHead}>
                <Text style={[styles.sparkIcon, { color: accentColor }]}>✦</Text>
                <Text style={[styles.aiCardTitle, { color: colors.foreground }]}>AI सारांश</Text>
                <Pressable onPress={speakSummary} style={[styles.playBtn, { backgroundColor: accentColor }]} testID="play-btn">
                  <Text style={styles.playBtnText}>▶</Text>
                </Pressable>
              </View>
              <Text style={[styles.summaryText, { color: colors.foreground }]}>{summary}</Text>
              {related.length > 0 && (
                <View style={styles.relatedChips}>
                  {related.map((r) => (
                    <View key={r.tag} style={[styles.chip, { backgroundColor: colors.accent }]}>
                      <Text style={[styles.chipText, { color: colors.accentForeground }]}>{r.tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.trendingPostsSection}>
              <Text style={[styles.trendingPostsTitle, { color: colors.foreground }]}>ट्रेंडिंग पोस्ट</Text>
              {[trend, ...trends.filter((t) => t.tag !== trend.tag).slice(0, 2)].map((item, i) => (
                <PostCard key={`${item.tag}-${i}`} trend={item} />
              ))}
            </View>

          </View>
        ) : (
          <View style={styles.postsBlock}>
            {[trend, ...trends.filter((t) => t.tag !== trend.tag).slice(0, 3)].map((item, i) => (
              <PostCard key={`${item.tag}-${i}`} trend={item} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function PostCard({ trend }: { trend: Trend }) {
  const colors = useColors();
  const initial = trend.title.trim().slice(0, 1) || "भ";
  const catLabel = CATEGORY_LABELS[trend.category] ?? "";

  return (
    <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.postAuthor}>
        <View style={[styles.avatar, { backgroundColor: CATEGORY_PALETTES[trend.category]?.[0] ?? colors.secondary }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.authorName, { color: colors.foreground }]}>{catLabel}_पल्स</Text>
          <Text style={[styles.authorMeta, { color: colors.mutedForeground }]}>{viewCount(trend)} व्यूज़ · अभी</Text>
        </View>
      </View>
      <Text style={[styles.postCaption, { color: colors.foreground }]} numberOfLines={3}>
        {trend.sampleContent.text}{" "}
        <Text style={{ color: CATEGORY_PALETTES[trend.category]?.[0] ?? colors.primary }}>{trend.tag}</Text>
      </Text>
      <Image
        source={{ uri: aiImageUrl(trend, 700, 320) }}
        style={styles.postImage}
        resizeMode="cover"
      />
      <View style={styles.postActions}>
        <Text style={[styles.actionText, { color: colors.mutedForeground }]}>♡ {likeCount(trend)}</Text>
        <Text style={[styles.actionText, { color: colors.mutedForeground }]}>💬 {String(Math.max(28, trend.heatScore * 3 + trend.rank))}</Text>
        <Text style={[styles.actionText, { color: colors.mutedForeground }]}>↗ शेयर</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: { padding: 6 },
  backArrow: { fontSize: 22 },
  headerMid: { flex: 1 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 15 },
  headerTag: { fontFamily: "Inter_400Regular", fontSize: 11 },
  shareBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  shareBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  heroImage: { width: "100%", height: 220 },
  heroBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: -40,
  },
  heroBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  heroBadgeText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 11 },
  titleBlock: { paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  titleText: { fontFamily: "Inter_700Bold", fontSize: 22, lineHeight: 28 },
  descText: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, marginHorizontal: 16 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  summaryBlock: { padding: 16, gap: 14 },
  aiCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  aiCardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sparkIcon: { fontSize: 16 },
  aiCardTitle: { fontFamily: "Inter_700Bold", fontSize: 14, flex: 1 },
  playBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  playBtnText: { color: "#fff", fontSize: 10 },
  summaryText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  relatedChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  chipText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  trendingPostsSection: { gap: 10 },
  trendingPostsTitle: { fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 2 },
  statsRow: { flexDirection: "row", gap: 10 },
  statBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 15 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11 },
  sourcesBlock: { gap: 8 },
  sourcesTitle: { fontFamily: "Inter_500Medium", fontSize: 12 },
  sourceChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  bigShare: { borderRadius: 16, padding: 14, alignItems: "center" },
  bigShareText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  postsBlock: { padding: 16, gap: 14 },
  postCard: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  postAuthor: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  authorName: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  authorMeta: { fontFamily: "Inter_400Regular", fontSize: 11 },
  postCaption: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  postImage: { width: "100%", height: 160, borderRadius: 12 },
  postActions: { flexDirection: "row", gap: 18 },
  actionText: { fontFamily: "Inter_500Medium", fontSize: 13 },
});
