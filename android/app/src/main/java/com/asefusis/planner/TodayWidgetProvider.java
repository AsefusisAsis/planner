package com.asefusis.planner;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
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

    /** Имя файла настроек и ключ снимка — общие с WidgetBridgePlugin. */
    static final String PREFS = "planner_widget";
    static final String KEY_DATA = "snapshot";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    /** Собрать представление виджета из последнего снимка. */
    static RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_DATA, null);

        String title = context.getString(R.string.app_name);
        String count = "";
        String footer = "";
        String[] lines = new String[] { null, null, null };

        if (raw == null) {
            // приложение ещё ни разу не присылало снимок
            lines[0] = context.getString(R.string.widget_today_placeholder);
        } else {
            try {
                JSONObject o = new JSONObject(raw);
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
            } catch (Exception e) {
                // битый снимок не должен ломать виджет — показываем подсказку
                lines[0] = context.getString(R.string.widget_today_placeholder);
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

        // тап по виджету открывает приложение
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE; // требование Android 12+
        }
        views.setOnClickPendingIntent(
            R.id.widget_root,
            PendingIntent.getActivity(context, 0, open, flags)
        );

        return views;
    }

    /** Перерисовать все размещённые экземпляры виджета. */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(
            new android.content.ComponentName(context, TodayWidgetProvider.class)
        );
        if (ids == null || ids.length == 0) return;
        RemoteViews views = buildViews(context);
        for (int id : ids) {
            manager.updateAppWidget(id, views);
        }
    }
}
