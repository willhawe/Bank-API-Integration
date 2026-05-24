import { Capacitor, registerPlugin } from "@capacitor/core";

export interface WidgetBridgePlugin {
  setSpentToday(options: { amount: string }): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>("WidgetBridge");

export async function syncWidgetTotal(amount: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetBridge.setSpentToday({ amount });
  } catch {
    // widget sync is best-effort
  }
}
