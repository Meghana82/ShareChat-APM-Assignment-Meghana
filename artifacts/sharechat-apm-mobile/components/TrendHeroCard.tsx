import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { tagLabel, aiImageUrl } from "@/utils/trends";
import type { Trend } from "@/types/trends";

type Props = { trend: Trend; onPress: () => void };

export function TrendHeroCard({ trend, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      testID="trend-hero-card"
    >
      <Image
        source={{ uri: aiImageUrl(trend, 900, 224) }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.overlay} />
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#1 ट्रेंड</Text>
      </View>
      <View style={styles.hotBadge}>
        <Text style={styles.hotText}>🔥 हॉट ट्रेंड</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>{tagLabel(trend)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    height: 90,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#111",
    borderBottomWidth: 1,
    borderBottomColor: "#ececee",
  },
  image: { position: "absolute", width: "100%", height: "100%" },
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.01)",
    backgroundImage: undefined,
  },
  rankBadge: {
    position: "absolute",
    top: 10,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  rankText: {
    color: "#1f2937",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    lineHeight: 16,
  },
  hotBadge: {
    display: "none",
  },
  hotText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    lineHeight: 15,
  },
  title: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    lineHeight: 24,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
