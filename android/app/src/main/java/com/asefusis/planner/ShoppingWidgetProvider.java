package com.asefusis.planner;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Виджет «Покупки»: запланированные покупки, ближайшее по дате — выше.
 * Только для чтения; отмечать купленное — в приложении (тап открывает его).
 * Отметка «куплено» прямо из виджета потребовала бы кнопки на каждую строку
 * и адресации конкретного товара — это фаза следующая, если понадобится.
 */
public class ShoppingWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, buildViews(context));
    }

    static RemoteViews buildViews(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_shopping);
        JSONObject s = WidgetData.section(context, "shopping");

        String title = context.getString(R.string.widget_shopping_label);
        String count = "";
        String[] lines = new String[] { null, null, null };

        if (s == null) {
            lines[0] = context.getString(R.string.widget_today_placeholder);
        } else {
            title = s.optString("title", title);
            int n = s.optInt("count", 0);
            count = n > 0 ? String.valueOf(n) : "";
            JSONArray arr = s.optJSONArray("lines");
            if (arr != null && arr.length() > 0) {
                for (int i = 0; i < lines.length && i < arr.length(); i++) {
                    String line = arr.optString(i, "");
                    lines[i] = line.isEmpty() ? null : line;
                }
            } else {
                lines[0] = s.optString("empty", "");
            }
        }

        v.setTextViewText(R.id.shopping_title, title);
        v.setTextViewText(R.id.shopping_count, count);
        v.setViewVisibility(R.id.shopping_count, count.isEmpty() ? View.GONE : View.VISIBLE);

        int[] ids = new int[] { R.id.shopping_line1, R.id.shopping_line2, R.id.shopping_line3 };
        for (int i = 0; i < ids.length; i++) {
            v.setTextViewText(ids[i], lines[i] == null ? "" : lines[i]);
            v.setViewVisibility(ids[i], lines[i] == null ? View.GONE : View.VISIBLE);
        }

        v.setOnClickPendingIntent(R.id.shopping_root, WidgetData.openApp(context));
        return v;
    }
}
