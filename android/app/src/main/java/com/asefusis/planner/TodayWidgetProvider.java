package com.asefusis.planner;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Виджет рабочего стола «Сегодня».
 *
 * Данные виджет НЕ считает сам: веб-слой кладёт готовый снимок (уже
 * локализованный и отформатированный) в SharedPreferences через
 * {@link WidgetBridgePlugin}, а провайдер только рисует строки. Так вся
 * логика и i18n остаются в одном месте, а натив не дублирует бизнес-правила.
 */
public class TodayWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    /** Собрать представление виджета из последнего снимка. */
    static RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);

        JSONObject o = WidgetData.section(context, "today");

        String title = context.getString(R.string.app_name);
        String count = "";
        String footer = "";
        String[] lines = new String[] { null, null, null };

        if (o == null) {
            // приложение ещё ни разу не присылало снимок
            lines[0] = context.getString(R.string.widget_today_placeholder);
        } else {
            title = o.optString("title", title);
            footer = o.optString("footer", "");
            int n = o.optInt("count", 0);
            count = n > 0 ? String.valueOf(n) : "";

            JSONArray arr = o.optJSONArray("lines");
            if (arr != null && arr.length() > 0) {
                for (int i = 0; i < lines.length && i < arr.length(); i++) {
                    String s = arr.optString(i, "");
                    lines[i] = s.isEmpty() ? null : s;
                }
            } else {
                lines[0] = o.optString("empty", "");
            }

            // вода, добавленная кнопками виджета и ещё не учтённая приложением
            int pending = WidgetData.pendingWater(context);
            if (pending != 0 && !footer.isEmpty()) {
                JSONObject w = WidgetData.section(context, "water");
                if (w != null) {
                    int drunk = w.optInt("drunk", 0) + pending;
                    int goal = w.optInt("goal", 0);
                    String unit = context.getString(R.string.widget_water_unit);
                    String label = w.optString("title", "");
                    footer = goal > 0
                        ? label + " " + drunk + " / " + goal + " " + unit
                        : label + " " + drunk + " " + unit;
                }
            }
        }

        views.setTextViewText(R.id.widget_title, title);
        views.setTextViewText(R.id.widget_count, count);
        views.setViewVisibility(R.id.widget_count, count.isEmpty() ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.widget_footer, footer);
        views.setViewVisibility(R.id.widget_footer, footer.isEmpty() ? View.GONE : View.VISIBLE);

        int[] ids = new int[] { R.id.widget_line1, R.id.widget_line2, R.id.widget_line3 };
        for (int i = 0; i < ids.length; i++) {
            views.setTextViewText(ids[i], lines[i] == null ? "" : lines[i]);
            views.setViewVisibility(ids[i], lines[i] == null ? View.GONE : View.VISIBLE);
        }

        views.setOnClickPendingIntent(R.id.widget_root, WidgetData.openApp(context));

        return views;
    }
}
