import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

function HomeIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Feather name="home" size={20} color={focused ? "#1e3a8a" : "#6b7280"} />
    </View>
  );
}

function SearchIcon({ focused }: { focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Feather name="search" size={20} color={focused ? "#1e3a8a" : "#6b7280"} />
    </View>
  );
}

function CreateIcon({ focused }: { focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Feather name="plus-circle" size={22} color={focused ? "#1e3a8a" : "#6b7280"} />
    </View>
  );
}

function LiveIcon({ focused }: { focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Feather name="radio" size={20} color={focused ? "#1e3a8a" : "#6b7280"} />
      <View style={styles.liveBadge}>
        <Text style={styles.liveBadgeText}>LIVE</Text>
      </View>
    </View>
  );
}

function ProfileIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <View style={[styles.profileCircle, { backgroundColor: focused ? "#1e3a8a" : "#374151" }]}>
        <Feather name="user" size={14} color="#fff" />
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#1e3a8a",
        tabBarInactiveTintColor: "#6b7280",
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          height: isWeb ? 64 : 58,
          paddingBottom: isWeb ? 10 : 6,
          paddingTop: 6,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <HomeIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ focused }) => <SearchIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          tabBarIcon: ({ focused }) => <CreateIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "Live",
          tabBarIcon: ({ focused }) => <LiveIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <ProfileIcon focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 36,
    borderRadius: 12,
    position: "relative",
  },
  iconWrapActive: {
    backgroundColor: "#dbeafe",
  },
  liveBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#ef4444",
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  liveBadgeText: {
    color: "#fff",
    fontSize: 7,
    fontFamily: "Inter_700Bold",
    lineHeight: 9,
  },
  profileCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
