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

  if (native && enabled) return null;

  return (
    <div className="scanner">
      <div>
        <p className="scanner__label">Notification scanner</p>
        <p className="scanner__status">
          {native ? "Needs Android notification access" : "Available in the Android app"}
        </p>
      </div>
    </div>
  );
}
