import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

function ShimmerBox({ style }: { style?: object }) {
  const colors = useColors();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Animated.View
      style={[{ backgroundColor: colors.border, opacity }, style]}
    />
  );
}

export function TrendShimmer() {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ShimmerBox style={styles.hero} />
      <View style={styles.grid}>
        {Array.from({ length: 9 }).map((_, i) => (
          <ShimmerBox key={i} style={styles.mini} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 12 },
  hero: { height: 200, borderRadius: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mini: { width: "31%", aspectRatio: 1, borderRadius: 12 },
});
