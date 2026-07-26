package com.asefusis.planner;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Общее хранилище виджетов: снимок дня от веб-слоя и очередь действий,
 * сделанных прямо с рабочего стола.
 *
 * Почему очередь. Источник правды по данным — веб-слой в WebView, натив в
 * его localStorage писать не может. Поэтому кнопка в виджете не меняет
 * данные напрямую: она кладёт действие в очередь и сразу подрисовывает
 * результат «оптимистично» (счётчик воды). Когда приложение в следующий раз
 * открывается, оно забирает очередь, применяет действия по-настоящему и
 * присылает свежий снимок. Расхождение ограничено и само схлопывается.
 */
final class WidgetData {

    static final String PREFS = "planner_widget";
    static final String KEY_DATA = "snapshot";
    private static final String KEY_ACTIONS = "actions";
    private static final String KEY_WATER_PENDING = "water_pending";

    /** Действие из виджета: добавить воды (мл). */
    static final String ACTION_WATER = "com.asefusis.planner.WIDGET_WATER";
    static final String EXTRA_ML = "ml";

    private WidgetData() {}

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Весь снимок целиком (секции + тема) или null. */
    static JSONObject root(Context ctx) {
        String raw = prefs(ctx).getString(KEY_DATA, null);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (Exception e) {
            return null; // битый снимок не должен ронять виджет
        }
    }

    /** Секция снимка по имени (today/water/cycle/shopping) или null. */
    static JSONObject section(Context ctx, String name) {
        JSONObject r = root(ctx);
        return r == null ? null : r.optJSONObject(name);
    }

    /** Незасчитанная приложением вода, добавленная с рабочего стола (мл). */
    static int pendingWater(Context ctx) {
        return prefs(ctx).getInt(KEY_WATER_PENDING, 0);
    }

    /** Поставить действие в очередь и учесть его в оптимистичном счётчике. */
    static void queueWater(Context ctx, int ml) {
        SharedPreferences p = prefs(ctx);
        JSONArray arr;
        try {
            String raw = p.getString(KEY_ACTIONS, "[]");
            arr = new JSONArray(raw);
        } catch (Exception e) {
            arr = new JSONArray();
        }
        try {
            JSONObject a = new JSONObject();
            a.put("type", "water");
            a.put("ml", ml);
            arr.put(a);
        } catch (Exception e) {
            return; // не смогли собрать действие — молча выходим, не портим очередь
        }
        p.edit()
            .putString(KEY_ACTIONS, arr.toString())
            .putInt(KEY_WATER_PENDING, p.getInt(KEY_WATER_PENDING, 0) + ml)
            .apply();
    }

    /**
     * Забрать очередь действий и очистить её вместе с оптимистичным
     * счётчиком: применять их будет веб-слой, дальше он пришлёт свежий снимок.
     */
    static String takeActions(Context ctx) {
        SharedPreferences p = prefs(ctx);
        String raw = p.getString(KEY_ACTIONS, "[]");
        p.edit().remove(KEY_ACTIONS).remove(KEY_WATER_PENDING).apply();
        return raw;
    }

    /** PendingIntent, открывающий приложение. */
    static PendingIntent openApp(Context ctx) {
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, 0, open, flags());
    }

    /** PendingIntent-широковещание на добавление воды из виджета. */
    static PendingIntent addWater(Context ctx, int ml) {
        Intent i = new Intent(ctx, WaterWidgetProvider.class);
        i.setAction(ACTION_WATER);
        i.putExtra(EXTRA_ML, ml);
        // requestCode = ml: у разных кнопок должны быть РАЗНЫЕ PendingIntent,
        // иначе система переиспользует один и обе кнопки дадут одинаковый объём
        return PendingIntent.getBroadcast(ctx, ml, i, flags());
    }

    private static int flags() {
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            f |= PendingIntent.FLAG_IMMUTABLE; // требование Android 12+
        }
        return f;
    }

    /** Перерисовать все размещённые экземпляры одного провайдера. */
    static void refresh(Context ctx, Class<?> provider, ViewBuilder builder) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        int[] ids = m.getAppWidgetIds(new ComponentName(ctx, provider));
        if (ids == null || ids.length == 0) return;
        RemoteViews v = builder.build(ctx);
        for (int id : ids) m.updateAppWidget(id, v);
    }

    interface ViewBuilder {
        RemoteViews build(Context ctx);
    }

    /** Перерисовать все виджеты приложения (после нового снимка). */
    static void refreshAll(Context ctx) {
        refresh(ctx, TodayWidgetProvider.class, TodayWidgetProvider::buildViews);
        refresh(ctx, WaterWidgetProvider.class, WaterWidgetProvider::buildViews);
        refresh(ctx, CycleWidgetProvider.class, CycleWidgetProvider::buildViews);
        refresh(ctx, ShoppingWidgetProvider.class, ShoppingWidgetProvider::buildViews);
    }
}
