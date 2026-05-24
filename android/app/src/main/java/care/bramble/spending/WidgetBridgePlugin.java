package care.bramble.spending;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void setSpentToday(PluginCall call) {
        String amount = call.getString("amount", "£0.00");
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences("SpendingWidget", Context.MODE_PRIVATE);
        prefs.edit().putString("spent_today", amount).apply();
        SpentTodayWidget.updateAll(ctx);
        call.resolve();
    }
}
