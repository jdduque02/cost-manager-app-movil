import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { OfflineBanner } from "@/components/OfflineBanner";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface TabConfig {
  name: string;
  title: string;
  icon: IconName;
  iconActive: IconName;
}

const tabs: TabConfig[] = [
  { name: "index", title: "Inicio", icon: "home-outline", iconActive: "home" },
  {
    name: "transactions",
    title: "Transacciones",
    icon: "swap-horizontal-outline",
    iconActive: "swap-horizontal",
  },
  {
    name: "banking",
    title: "Cuentas",
    icon: "card-outline",
    iconActive: "card",
  },
  {
    name: "objectives",
    title: "Objetivos",
    icon: "flag-outline",
    iconActive: "flag",
  },
  {
    name: "profile",
    title: "Perfil",
    icon: "person-outline",
    iconActive: "person",
  },
];

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#1B4332",
          tabBarInactiveTintColor: "#95A5A6",
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopWidth: 1,
            borderTopColor: "#D1FAE5",
            paddingBottom: 4,
            height: 60,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
          headerStyle: { backgroundColor: "#1B4332" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        {tabs.map(({ name, title, icon, iconActive }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title,
              tabBarIcon: ({ focused, color, size }) => (
                <Ionicons
                  name={focused ? iconActive : icon}
                  size={size}
                  color={color}
                />
              ),
            }}
          />
        ))}
      </Tabs>
    </View>
  );
}

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface TabConfig {
  name: string;
  title: string;
  icon: IconName;
  iconActive: IconName;
}

const tabs: TabConfig[] = [
  { name: "index", title: "Inicio", icon: "home-outline", iconActive: "home" },
  {
    name: "transactions",
    title: "Transacciones",
    icon: "swap-horizontal-outline",
    iconActive: "swap-horizontal",
  },
  {
    name: "banking",
    title: "Cuentas",
    icon: "card-outline",
    iconActive: "card",
  },
  {
    name: "objectives",
    title: "Objetivos",
    icon: "flag-outline",
    iconActive: "flag",
  },
  {
    name: "profile",
    title: "Perfil",
    icon: "person-outline",
    iconActive: "person",
  },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#1B4332",
        tabBarInactiveTintColor: "#95A5A6",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#D1FAE5",
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerStyle: { backgroundColor: "#1B4332" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      {tabs.map(({ name, title, icon, iconActive }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? iconActive : icon}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
