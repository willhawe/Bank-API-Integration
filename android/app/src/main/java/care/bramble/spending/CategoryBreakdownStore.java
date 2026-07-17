package care.bramble.spending;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public final class CategoryBreakdownStore {
    private static final String PREFS = "SpendingWidget";
    private static final String KEY_CATEGORY_BREAKDOWN = "category_breakdown_json";

    private CategoryBreakdownStore() {}

    public static final class Entry {
        public final String category;
        public final int amountCents;

        public Entry(String category, int amountCents) {
            this.category = category;
            this.amountCents = amountCents;
        }
    }

    public static void save(Context context, JSONArray categories) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_CATEGORY_BREAKDOWN, categories.toString())
                .apply();
    }

    public static List<Entry> load(Context context) {
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_CATEGORY_BREAKDOWN, "[]");
        List<Entry> entries = new ArrayList<>();
        try {
            JSONArray array = new JSONArray(raw);
            for (int i = 0; i < array.length(); i += 1) {
                JSONObject item = array.getJSONObject(i);
                String category = item.optString("category", "Other");
                int amountCents = item.optInt("amountCents", 0);
                if (amountCents > 0) {
                    entries.add(new Entry(category, amountCents));
                }
            }
        } catch (JSONException ignored) {
            // Fall back to an empty breakdown if the stored JSON is unexpectedly malformed.
        }
        return entries;
    }
}
