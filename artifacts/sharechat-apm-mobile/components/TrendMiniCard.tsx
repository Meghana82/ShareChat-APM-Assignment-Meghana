import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { CATEGORY_LABELS, contextEmoji } from "@/utils/trends";
import type { Trend } from "@/types/trends";

type Props = { trend: Trend; onPress: () => void };

export function TrendMiniCard({ trend, onPress }: Props) {
  const catLabel = CATEGORY_LABELS[trend.category] ?? trend.category;
  const emoji = contextEmoji(trend);
  const rawLabel = (trend.displayLabel?.trim() || trend.title).trim();
  const label = rawLabel.startsWith(emoji)
    ? rawLabel.slice(emoji.length).trimStart()
    : rawLabel;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: "#f7f7f8" }]}
      testID={`trend-mini-card-${trend.rank}`}
    >
      <Text style={styles.rank}>#{trend.rank}</Text>
      <Text style={styles.cat}>{catLabel}</Text>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "31%",
    minHeight: 64,
    padding: 4,
    paddingBottom: 5,
    borderWidth: 1,
    borderColor: "#ececee",
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  rank: {
    position: "absolute",
    top: 5,
    left: 6,
    fontSize: 9.5,
    fontFamily: "Inter_700Bold",
    color: "#6d28d9",
    lineHeight: 12,
  },
  cat: {
    position: "absolute",
    top: 5,
    right: 6,
    fontSize: 8.5,
    fontFamily: "Inter_500Medium",
    color: "#9ca3af",
    lineHeight: 12,
  },
  emoji: { fontSize: 26, lineHeight: 34, marginTop: 14 },
  label: {
    marginTop: 4,
    fontSize: 10.5,
    fontFamily: "Inter_700Bold",
    lineHeight: 13,
    color: "#34323b",
    textAlign: "center",
  },
});
