package com.asefusis.planner;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Открытие стороннего приложения по имени пакета (Android Intent).
 * Диплинк к конкретной карте извне обычно недоступен — открываем само
 * приложение банка/платежей. Видимость пакетов обеспечена <queries> в
 * манифесте (MAIN/LAUNCHER), без QUERY_ALL_PACKAGES.
 */
@CapacitorPlugin(name = "AppOpener")
public class AppOpenerPlugin extends Plugin {

    @PluginMethod
    public void canOpen(PluginCall call) {
        String pkg = call.getString("package");
        boolean ok = false;
        if (pkg != null && !pkg.isEmpty()) {
            ok = getContext().getPackageManager().getLaunchIntentForPackage(pkg) != null;
        }
        JSObject ret = new JSObject();
        ret.put("value", ok);
        call.resolve(ret);
    }

    @PluginMethod
    public void open(PluginCall call) {
        String pkg = call.getString("package");
        if (pkg == null || pkg.isEmpty()) {
            call.reject("no package");
            return;
        }
        Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(pkg);
        if (intent == null) {
            call.reject("not installed");
            return;
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        JSObject ret = new JSObject();
        ret.put("value", true);
        call.resolve(ret);
    }
}
