package care.bramble.spending;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void setSpentToday(PluginCall call) {
        String amount = call.getString("amount", "£0.00");
        Context ctx = getContext();
        if (BankNotificationStore.isNotificationAccessEnabled(ctx)) {
            call.resolve();
            return;
        }
        SharedPreferences prefs = ctx.getSharedPreferences("SpendingWidget", Context.MODE_PRIVATE);
        prefs.edit().putString("spent_today", amount).apply();
        SpentTodayWidget.updateAll(ctx);
        call.resolve();
    }

    @PluginMethod
    public void openNotificationAccessSettings(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Android activity is not available");
            return;
        }

        ComponentName componentName = new ComponentName(activity, BankNotificationListener.class);
        Intent detailIntent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, componentName.flattenToString());
        Intent listIntent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);

        try {
            activity.startActivity(detailIntent);
            call.resolve();
        } catch (ActivityNotFoundException detailError) {
            try {
                activity.startActivity(listIntent);
                call.resolve();
            } catch (ActivityNotFoundException listError) {
                call.reject("Android notification access settings could not be opened");
            }
        }
    }

    @PluginMethod
    public void getNotificationAccessStatus(PluginCall call) {
        call.resolve(new com.getcapacitor.JSObject()
                .put("enabled", BankNotificationStore.isNotificationAccessEnabled(getContext())));
    }

    @PluginMethod
    public void getNotificationSummary(PluginCall call) {
        Context ctx = getContext();
        call.resolve(new com.getcapacitor.JSObject()
                .put("spentToday", BankNotificationStore.getSpentToday(ctx))
                .put("lastMerchant", BankNotificationStore.getLastMerchant(ctx))
                .put("lastAmount", BankNotificationStore.getLastAmount(ctx))
                .put("paymentsJson", BankNotificationStore.getScannedPayments(ctx)));
    }

    @PluginMethod
    public void clearNotificationData(PluginCall call) {
        BankNotificationStore.clearToday(getContext());
        call.resolve();
    }

    @PluginMethod
    public void addManualPayment(PluginCall call) {
        String merchant = call.getString("merchant", "");
        Integer amountCents = call.getInt("amountCents");
        if (amountCents == null || amountCents <= 0 || merchant.trim().isEmpty()) {
            call.reject("Merchant and amount are required");
            return;
        }

        BankNotificationStore.addManualPayment(getContext(), merchant, amountCents);
        call.resolve();
    }

    @PluginMethod
    public void deletePayment(PluginCall call) {
        String id = call.getString("id", "");
        if (id.trim().isEmpty()) {
            call.reject("Payment id is required");
            return;
        }

        BankNotificationStore.deletePayment(getContext(), id);
        call.resolve();
    }

    @PluginMethod
    public void setCategoryBreakdown(PluginCall call) {
        JSArray categories = call.getArray("categories");
        if (categories == null) {
            call.reject("categories is required");
            return;
        }

        try {
            org.json.JSONArray stored = new org.json.JSONArray();
            for (int i = 0; i < categories.length(); i += 1) {
                JSONObject item = categories.getJSONObject(i);
                JSONObject entry = new JSONObject();
                entry.put("category", item.optString("category", "Other"));
                entry.put("amountCents", item.optInt("amountCents", 0));
                stored.put(entry);
            }
            CategoryBreakdownStore.save(getContext(), stored);
            MonthlyCategoryWidget.updateAll(getContext());
            call.resolve();
        } catch (JSONException e) {
            call.reject("Invalid categories payload");
        }
    }

    @PluginMethod
    public void setPaymentCategory(PluginCall call) {
        String id = call.getString("id", "");
        String category = call.getString("category", "");
        if (id.trim().isEmpty()) {
            call.reject("Payment id is required");
            return;
        }

        BankNotificationStore.setCategory(getContext(), id, category);
        call.resolve();
    }
}
