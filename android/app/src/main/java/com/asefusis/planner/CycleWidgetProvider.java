package com.asefusis.planner;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Виджет «Цикл» — намеренно скупой и только для чтения.
 *
 * Виджет виден каждому, кто глянет на телефон, поэтому показываем минимум:
 * день цикла, фазу и прогноз — без симптомов, дневника и прочих деталей.
 * Кнопки «отметить менструацию» здесь нет сознательно: случайный тап по
 * такой кнопке с рабочего стола испортил бы историю и прогноз, а отменить
 * его с виджета нельзя. Отмечать — в приложении, тап открывает раздел.
 */
public class CycleWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, buildViews(context));
    }

    static RemoteViews buildViews(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_cycle);
        JSONObject s = WidgetData.section(context, "cycle");

        String title = context.getString(R.string.widget_cycle_label);
        String day = context.getString(R.string.widget_today_placeholder);
        String phase = "";
        String next = "";

        if (s != null) {
            title = s.optString("title", title);
            if (!s.optBoolean("enabled", false)) {
                // трекер выключен в настройках — не делаем вид, что данные есть
                day = context.getString(R.string.widget_cycle_off);
            } else {
                day = s.optString("day", day);
                phase = s.optString("phase", "");
                next = s.optString("next", "");
            }
        }

        v.setTextViewText(R.id.cycle_title, title);
        v.setTextViewText(R.id.cycle_day, day);
        v.setTextViewText(R.id.cycle_phase, phase);
        v.setViewVisibility(R.id.cycle_phase, phase.isEmpty() ? View.GONE : View.VISIBLE);
        v.setTextViewText(R.id.cycle_next, next);
        v.setViewVisibility(R.id.cycle_next, next.isEmpty() ? View.GONE : View.VISIBLE);
        v.setOnClickPendingIntent(R.id.cycle_root, WidgetData.openApp(context));

        return v;
    }
}
