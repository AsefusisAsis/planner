package com.asefusis.planner;

import android.graphics.Color;

import org.json.JSONObject;

/**
 * Цвета текущей темы приложения, пришедшие в снимке.
 *
 * Палитру (классическая/тёплая/спокойная) и режим пользователь выбирает в
 * приложении, поэтому виджеты не могут опираться на values/values-night: они
 * следовали бы системной теме и игнорировали выбор. Цвета приходят из тех же
 * CSS-переменных, что и в приложении, и применяются в рантайме.
 */
final class WidgetTheme {

    final int card, text, text2, text3, accent, onAccent, danger, warning, success, track;

    private WidgetTheme(JSONObject t) {
        card = parse(t, "card", 0xFF18181B);
        text = parse(t, "text", 0xFFFAFAFA);
        text2 = parse(t, "text2", 0xFFB4B4BD);
        text3 = parse(t, "text3", 0xFF8A8A93);
        accent = parse(t, "accent", 0xFF818CF8);
        onAccent = parse(t, "onAccent", 0xFFFFFFFF);
        danger = parse(t, "danger", 0xFFEF4444);
        warning = parse(t, "warning", 0xFFF59E0B);
        success = parse(t, "success", 0xFF22C55E);
        track = parse(t, "track", 0xFF27272A);
    }

    /** Тема из корня снимка; при её отсутствии — значения по умолчанию. */
    static WidgetTheme from(JSONObject root) {
        return new WidgetTheme(root == null ? null : root.optJSONObject("theme"));
    }

    /** Цвет по смысловому тону строки (см. WidgetTone в вебе). */
    int tone(String name) {
        if (name == null) return text;
        switch (name) {
            case "danger": return danger;
            case "warning": return warning;
            case "accent": return accent;
            case "muted": return text3;
            default: return text;
        }
    }

    private static int parse(JSONObject t, String key, int fallback) {
        if (t == null) return fallback;
        String v = t.optString(key, null);
        if (v == null || v.isEmpty()) return fallback;
        try {
            return Color.parseColor(v); // ожидаем «#rrggbb», веб иное не шлёт
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }
}
