package com.asefusis.planner;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Приём текста, отправленного в приложение через системное «Поделиться»
 * (ACTION_SEND, text/plain). Оттуда он уходит в разбор банковского
 * уведомления (lib/notificationParse).
 *
 * Это НЕ доступ к уведомлениям. Приложение не читает чужие уведомления и не
 * просит на это разрешение: текст передаёт сам пользователь, явным действием.
 * Системный слушатель уведомлений — отдельная история, упирающаяся в политику
 * Google Play, и он здесь намеренно не реализован.
 *
 * Два пути доставки, потому что Activity объявлена singleTask:
 *   1) приложение было закрыто — интент лежит в getIntent() на момент load();
 *   2) приложение уже работало — интент приходит в handleOnNewIntent().
 * В первом случае веб-слой ещё не подписан на события, поэтому текст ждёт в
 * pending и забирается методом consume(). Во втором — шлём событие сразу.
 */
@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {

    /** Текст, пришедший до того, как веб-слой успел подписаться. */
    private String pending;

    @Override
    public void load() {
        take(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (take(intent)) emit();
    }

    /**
     * Достаёт текст из интента и ГАСИТ его в самом интенте.
     *
     * Гасить обязательно: getIntent() возвращает тот же объект после поворота
     * экрана и возврата из фона, и без очистки один и тот же чек предлагался
     * бы к добавлению снова и снова.
     */
    private boolean take(Intent intent) {
        if (intent == null) return false;
        if (!Intent.ACTION_SEND.equals(intent.getAction())) return false;
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (text == null || text.toString().trim().isEmpty()) return false;
        pending = text.toString();
        intent.removeExtra(Intent.EXTRA_TEXT);
        intent.setAction(Intent.ACTION_MAIN);
        return true;
    }

    private void emit() {
        if (pending == null) return;
        JSObject data = new JSObject();
        data.put("value", pending);
        pending = null;
        notifyListeners("sharedText", data);
    }

    /** Забрать отложенный текст (и очистить). Пустая строка — ничего нет. */
    @PluginMethod
    public void consume(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", pending == null ? "" : pending);
        pending = null;
        call.resolve(ret);
    }
}
