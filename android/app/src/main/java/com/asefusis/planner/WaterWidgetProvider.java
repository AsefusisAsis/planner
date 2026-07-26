package com.asefusis.planner;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Виджет «Вода» — единственный интерактивный: кнопки +250 и +500 добавляют
 * воду прямо с рабочего стола, не открывая приложение.
 *
 * Данные в WebView натив писать не может, поэтому нажатие кладётся в очередь
 * (WidgetData) и тут же отражается в счётчике «оптимистично». Настоящую
 * запись сделает приложение при следующем открытии, забрав очередь.
 */
public class WaterWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, buildViews(context));
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (WidgetData.ACTION_WATER.equals(intent.getAction())) {
            int ml = intent.getIntExtra(WidgetData.EXTRA_ML, 0);
            if (ml != 0) {
                WidgetData.queueWater(context, ml);
                // сразу перерисовываем: и сам виджет воды, и «Сегодня»
                // (там вода в подвале) — иначе тап выглядел бы бесполезным
                WidgetData.refresh(context, WaterWidgetProvider.class, WaterWidgetProvider::buildViews);
                WidgetData.refresh(context, TodayWidgetProvider.class, TodayWidgetProvider::buildViews);
            }
        }
    }

    static RemoteViews buildViews(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_water);
        JSONObject s = WidgetData.section(context, "water");

        String title = context.getString(R.string.widget_water_label);
        String text = context.getString(R.string.widget_today_placeholder);
        int pct = 0;

        if (s != null) {
            title = s.optString("title", title);
            int pending = WidgetData.pendingWater(context);
            int drunk = s.optInt("drunk", 0) + pending;
            int goal = s.optInt("goal", 0);
            // строку пересобираем сами: в снимке она без ещё не учтённых
            // нажатий с рабочего стола
            String unit = context.getString(R.string.widget_water_unit);
            text = goal > 0 ? drunk + " / " + goal + " " + unit : drunk + " " + unit;
            pct = goal > 0 ? Math.min(100, Math.round(drunk * 100f / goal)) : 0;
            if (goal > 0 && drunk >= goal) title = s.optString("done", title);
        }

        v.setTextViewText(R.id.water_title, title);
        v.setTextViewText(R.id.water_text, text);
        v.setProgressBar(R.id.water_bar, 100, pct, false);
        v.setViewVisibility(R.id.water_bar, pct > 0 ? View.VISIBLE : View.GONE);

        v.setOnClickPendingIntent(R.id.water_add250, WidgetData.addWater(context, 250));
        v.setOnClickPendingIntent(R.id.water_add500, WidgetData.addWater(context, 500));
        v.setOnClickPendingIntent(R.id.water_title, WidgetData.openApp(context));

        return v;
    }
}
