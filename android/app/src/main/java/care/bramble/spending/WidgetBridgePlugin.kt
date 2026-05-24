package care.bramble.spending

import android.content.Context
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin : Plugin() {

    @PluginMethod
    fun setSpentToday(call: PluginCall) {
        val amount = call.getString("amount") ?: "£0.00"
        val prefs = context.getSharedPreferences("SpendingWidget", Context.MODE_PRIVATE)
        prefs.edit().putString("spent_today", amount).apply()
        SpentTodayWidget.updateAll(context)
        call.resolve()
    }
}
