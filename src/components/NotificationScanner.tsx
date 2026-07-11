import { useEffect, useState } from "react";
import {
  canUseNotificationAccess,
  getNotificationAccessEnabled,
} from "../plugins/WidgetBridge";

export function NotificationScanner() {
  const [enabled, setEnabled] = useState(false);
  const native = canUseNotificationAccess();

  useEffect(() => {
    if (!native) return;

    let cancelled = false;

    async function refresh() {
      const next = await getNotificationAccessEnabled();
      if (!cancelled) setEnabled(next);
    }

    void refresh();
    const id = window.setInterval(() => void refresh(), 2000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [native]);

  return (
    <div className={enabled ? "scanner scanner--enabled" : "scanner"}>
      <div>
        <p className="scanner__label">Notification scanner</p>
        <p className="scanner__status">
          {native
            ? enabled
              ? "Listening for Wallet card alerts"
              : "Needs Android notification access"
            : "Available in the Android app"}
        </p>
      </div>
    </div>
  );
}
