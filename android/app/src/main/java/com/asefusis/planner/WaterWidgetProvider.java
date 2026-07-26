package com.asefusis.planner;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
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

    /** Сегменты полосы прогресса — вместо ProgressBar: так её можно красить
     *  цветом темы на любом API, а не только на 31+. */
    private static final int[] SEGMENTS = {
        R.id.seg1, R.id.seg2, R.id.seg3, R.id.seg4, R.id.seg5,
        R.id.seg6, R.id.seg7, R.id.seg8, R.id.seg9, R.id.seg10,
    };

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
        JSONObject root = WidgetData.root(context);
        WidgetTheme th = WidgetTheme.from(root);
        JSONObject s = root == null ? null : root.optJSONObject("water");

        v.setInt(R.id.water_bg, "setColorFilter", th.card);

        String title = context.getString(R.string.widget_water_label);
        String hero = "—";
        String sub = context.getString(R.string.widget_today_placeholder);
        int pct = 0;
        boolean done = false;

        if (s != null) {
            title = s.optString("title", title);
            // счётчик пересобираем сами: в снимке он без нажатий, которые
            // приложение ещё не забрало из очереди
            int drunk = s.optInt("drunk", 0) + WidgetData.pendingWater(context);
            int goal = s.optInt("goal", 0);
            hero = String.valueOf(drunk);
            sub = s.optString("sub", "");
            pct = goal > 0 ? Math.min(100, Math.round(drunk * 100f / goal)) : 0;
            done = goal > 0 && drunk >= goal;
        }

        v.setTextViewText(R.id.water_title, title.toUpperCase());
        v.setTextColor(R.id.water_title, th.text3);
        v.setTextViewText(R.id.water_pct, pct > 0 ? pct + "%" : "");
        v.setTextColor(R.id.water_pct, done ? th.success : th.accent);
        v.setTextViewText(R.id.water_hero, hero);
        v.setTextColor(R.id.water_hero, done ? th.success : th.accent);
        v.setTextViewText(R.id.water_sub, sub);
        v.setTextColor(R.id.water_sub, th.text2);

        // сколько сегментов закрашено: округляем ВВЕРХ, чтобы первый же
        // глоток был заметен, но 0 остаётся нулём
        int filled = pct <= 0 ? 0 : Math.max(1, (int) Math.ceil(pct / 100f * SEGMENTS.length));
        for (int i = 0; i < SEGMENTS.length; i++) {
            v.setInt(SEGMENTS[i], "setColorFilter", i < filled ? (done ? th.success : th.accent) : th.track);
        }

        for (int bg : new int[] { R.id.water_add250_bg, R.id.water_add500_bg }) {
            v.setInt(bg, "setColorFilter", th.accent);
        }
        for (int label : new int[] { R.id.water_add250_label, R.id.water_add500_label }) {
            v.setTextColor(label, th.onAccent);
        }

        v.setOnClickPendingIntent(R.id.water_add250, WidgetData.addWater(context, 250));
        v.setOnClickPendingIntent(R.id.water_add500, WidgetData.addWater(context, 500));
        v.setOnClickPendingIntent(R.id.water_title, WidgetData.openApp(context));

        return v;
    }
}
