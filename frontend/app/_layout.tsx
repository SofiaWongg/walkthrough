import { Stack } from "expo-router";
import { WalkthroughProvider } from "../context/WalkthroughContext";

export default function RootLayout() {
  return (
    <WalkthroughProvider>
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
          name="index"
          options={{
            title: 'Walkthroughs',
          }}
        />
        <Stack.Screen
          name="walkthrough"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </WalkthroughProvider>
  );
}
