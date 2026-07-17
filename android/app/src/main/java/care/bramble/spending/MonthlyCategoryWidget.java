package care.bramble.spending;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Bundle;
import android.text.TextPaint;
import android.widget.RemoteViews;

import java.text.NumberFormat;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class MonthlyCategoryWidget extends AppWidgetProvider {

    private static final int MAX_CATEGORIES = 6;
    private static final Map<String, Integer> CATEGORY_COLORS = new HashMap<>();

    static {
        CATEGORY_COLORS.put("transport", Color.parseColor("#3D9EFF"));
        CATEGORY_COLORS.put("groceries", Color.parseColor("#52B788"));
        CATEGORY_COLORS.put("food", Color.parseColor("#F59E0B"));
        CATEGORY_COLORS.put("shopping", Color.parseColor("#C084FC"));
        CATEGORY_COLORS.put("entertainment", Color.parseColor("#F472B6"));
        CATEGORY_COLORS.put("bills", Color.parseColor("#EF4444"));
        CATEGORY_COLORS.put("travel", Color.parseColor("#22D3EE"));
    }

    private static final int DEFAULT_COLOR = Color.parseColor("#8B9CB3");
    private static final int TRACK_COLOR = Color.parseColor("#232B3A");
    private static final int LABEL_COLOR = Color.parseColor("#8B9CB3");
    private static final int AMOUNT_COLOR = Color.parseColor("#E8EDF4");

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(
            Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
        updateWidget(context, appWidgetManager, appWidgetId);
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, MonthlyCategoryWidget.class));
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        List<CategoryBreakdownStore.Entry> entries = CategoryBreakdownStore.load(context);

        Bundle options = manager.getAppWidgetOptions(widgetId);
        int widthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
        int heightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 180);

        Bitmap chart = renderChart(context, entries, widthDp, heightDp);

        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_IMMUTABLE);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_monthly_category);
        views.setImageViewBitmap(R.id.widget_chart_image, chart);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        manager.updateAppWidget(widgetId, views);
    }

    private static Bitmap renderChart(
            Context context, List<CategoryBreakdownStore.Entry> entries, int widthDp, int heightDp) {
        float density = context.getResources().getDisplayMetrics().density;
        int widthPx = Math.max(1, (int) (widthDp * density));
        int heightPx = Math.max(1, (int) (heightDp * density));

        Bitmap bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(Color.TRANSPARENT);

        int rowCount = Math.min(entries.size(), MAX_CATEGORIES);
        if (rowCount == 0) {
            drawEmptyState(canvas, widthPx, heightPx, density);
            return bitmap;
        }

        int maxAmount = 0;
        for (int i = 0; i < rowCount; i += 1) {
            maxAmount = Math.max(maxAmount, entries.get(i).amountCents);
        }

        float rowHeight = (float) heightPx / rowCount;
        float labelWidth = 78 * density;
        float amountWidth = 62 * density;
        float barLeft = labelWidth;
        float barRight = widthPx - amountWidth;
        float barMaxWidth = Math.max(0, barRight - barLeft);

        TextPaint labelPaint = new TextPaint();
        labelPaint.setColor(LABEL_COLOR);
        labelPaint.setTextSize(11 * density);
        labelPaint.setAntiAlias(true);

        TextPaint amountPaint = new TextPaint();
        amountPaint.setColor(AMOUNT_COLOR);
        amountPaint.setTextSize(11 * density);
        amountPaint.setAntiAlias(true);
        amountPaint.setTextAlign(Paint.Align.RIGHT);

        Paint trackPaint = new Paint();
        trackPaint.setAntiAlias(true);
        trackPaint.setColor(TRACK_COLOR);

        Paint barPaint = new Paint();
        barPaint.setAntiAlias(true);

        for (int i = 0; i < rowCount; i += 1) {
            CategoryBreakdownStore.Entry entry = entries.get(i);
            float top = i * rowHeight;
            float centerY = top + rowHeight / 2f;
            float barHeight = Math.min(14 * density, rowHeight * 0.4f);
            float barTop = centerY - barHeight / 2f;

            canvas.drawText(
                    truncate(entry.category, labelPaint, labelWidth - 6 * density),
                    4 * density,
                    centerY + labelPaint.getTextSize() / 3f,
                    labelPaint);

            RectF track = new RectF(barLeft, barTop, barRight, barTop + barHeight);
            canvas.drawRoundRect(track, barHeight / 2f, barHeight / 2f, trackPaint);

            float fraction = maxAmount > 0 ? (float) entry.amountCents / maxAmount : 0f;
            float barWidth = Math.max(barHeight, barMaxWidth * fraction);
            barPaint.setColor(colorFor(entry.category));
            RectF fill = new RectF(barLeft, barTop, barLeft + barWidth, barTop + barHeight);
            canvas.drawRoundRect(fill, barHeight / 2f, barHeight / 2f, barPaint);

            canvas.drawText(
                    formatGbp(entry.amountCents),
                    widthPx - 4 * density,
                    centerY + amountPaint.getTextSize() / 3f,
                    amountPaint);
        }

        return bitmap;
    }

    private static int colorFor(String category) {
        Integer color = CATEGORY_COLORS.get(category.toLowerCase(Locale.UK));
        return color == null ? DEFAULT_COLOR : color;
    }

    private static void drawEmptyState(Canvas canvas, int widthPx, int heightPx, float density) {
        TextPaint paint = new TextPaint();
        paint.setColor(LABEL_COLOR);
        paint.setTextSize(12 * density);
        paint.setAntiAlias(true);
        paint.setTextAlign(Paint.Align.CENTER);
        canvas.drawText("No spending this month", widthPx / 2f, heightPx / 2f, paint);
    }

    private static String truncate(String text, TextPaint paint, float maxWidth) {
        if (paint.measureText(text) <= maxWidth) return text;
        String ellipsis = "…";
        StringBuilder builder = new StringBuilder(text);
        while (builder.length() > 0 && paint.measureText(builder.toString() + ellipsis) > maxWidth) {
            builder.deleteCharAt(builder.length() - 1);
        }
        return builder + ellipsis;
    }

    private static String formatGbp(int cents) {
        NumberFormat format = NumberFormat.getCurrencyInstance(Locale.UK);
        return format.format(cents / 100.0);
    }
}
