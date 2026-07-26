package com.asefusis.planner;

import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Мост «веб → виджет рабочего стола».
 *
 * Веб-слой присылает готовый снимок дня (JSON-строку), плагин кладёт его в
 * SharedPreferences и сразу перерисовывает размещённые виджеты. Отдельного
 * фонового сервиса не нужно: виджет читает тот же файл настроек.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("no data");
            return;
        }
        SharedPreferences prefs = getContext()
            .getSharedPreferences(TodayWidgetProvider.PREFS, android.content.Context.MODE_PRIVATE);
        prefs.edit().putString(TodayWidgetProvider.KEY_DATA, data).apply();

        TodayWidgetProvider.refreshAll(getContext());

        JSObject ret = new JSObject();
        ret.put("value", true);
        call.resolve(ret);
    }
}
