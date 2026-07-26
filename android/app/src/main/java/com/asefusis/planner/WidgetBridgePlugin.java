package com.asefusis.planner;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Мост «веб ↔ виджеты рабочего стола».
 *
 * update() — веб присылает готовый снимок дня, плагин кладёт его в
 * SharedPreferences и перерисовывает виджеты.
 * takeActions() — веб забирает действия, сделанные кнопками виджета, пока
 * приложение было закрыто (натив не может писать в localStorage WebView,
 * поэтому они копятся в очереди и применяются при следующем открытии).
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
        getContext()
            .getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(WidgetData.KEY_DATA, data)
            .apply();

        WidgetData.refreshAll(getContext());

        JSObject ret = new JSObject();
        ret.put("value", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void takeActions(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", WidgetData.takeActions(getContext()));
        call.resolve(ret);
    }
}
