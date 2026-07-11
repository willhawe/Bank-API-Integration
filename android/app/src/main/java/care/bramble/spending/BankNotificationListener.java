package care.bramble.spending;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public class BankNotificationListener extends NotificationListenerService {

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        BankNotificationStore.recordNotification(this, sbn);
    }
}
