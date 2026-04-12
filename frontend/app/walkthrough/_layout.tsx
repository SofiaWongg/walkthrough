import { Stack } from "expo-router";

export default function WalkthroughLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1a1a2e',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: '#16213e',
        },
      }}
    >
      <Stack.Screen
        name="live"
        options={{
          title: 'Live Walkthrough',
          headerBackTitle: 'Cancel',
        }}
      />
      <Stack.Screen
        name="results"
        options={{
          title: 'Walkthrough Results',
          headerBackVisible: false,
        }}
      />
    </Stack>
  );
}
