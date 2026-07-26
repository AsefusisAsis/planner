package com.asefusis.planner;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Виджет рабочего стола «Сегодня»: просроченное, события по времени и задачи
 * на сегодня, внизу — вода.
 *
 * Данные виджет НЕ считает сам: веб-слой кладёт готовый снимок (уже
 * локализованный, с тоном каждой строки и цветами темы) через
 * {@link WidgetBridgePlugin}, провайдер только рисует. Так логика и i18n
 * остаются в одном месте, а виджет следует палитре, выбранной в приложении.
 */
public class TodayWidgetProvider extends AppWidgetProvider {

    private static final ListWidgetRenderer.Ids IDS = new ListWidgetRenderer.Ids(
        R.layout.widget_today,
        R.id.today_root,
        R.id.today_bg,
        R.id.today_title,
        R.id.today_count,
        R.id.today_empty,
        R.id.today_footer,
        new int[] { R.id.today_row1, R.id.today_row2, R.id.today_row3 },
        new int[] { R.id.today_text1, R.id.today_text2, R.id.today_text3 },
        new int[] { R.id.today_meta1, R.id.today_meta2, R.id.today_meta3 }
    );

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) manager.updateAppWidget(id, buildViews(context));
    }

    static RemoteViews buildViews(Context context) {
        RemoteViews v = ListWidgetRenderer.render(
            context, IDS, "today", context.getString(R.string.app_name)
        );
        // вода, добавленная кнопками виджета и ещё не учтённая приложением
        int pending = WidgetData.pendingWater(context);
        if (pending != 0) {
            JSONObject w = WidgetData.section(context, "water");
            if (w != null) {
                int drunk = w.optInt("drunk", 0) + pending;
                int goal = w.optInt("goal", 0);
                String unit = context.getString(R.string.widget_water_unit);
                String label = w.optString("title", "");
                v.setTextViewText(
                    R.id.today_footer,
                    goal > 0
                        ? label + " " + drunk + " / " + goal + " " + unit
                        : label + " " + drunk + " " + unit
                );
                v.setViewVisibility(R.id.today_footer, android.view.View.VISIBLE);
            }
        }
        return v;
    }
}
