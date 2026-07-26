package com.asefusis.planner;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Отрисовка виджетов-списков («Сегодня», «Покупки»): у них одинаковая
 * структура — шапка со счётчиком, до трёх строк «текст + приписка», пустое
 * состояние и подвал. Разница только в id и имени секции снимка.
 */
final class ListWidgetRenderer {

    /** id одинаковых по структуре, но разных по имени вьюх конкретного виджета. */
    static final class Ids {
        final int layout, root, bg, title, count, empty, footer;
        final int[] rows, texts, metas;

        Ids(int layout, int root, int bg, int title, int count, int empty, int footer,
            int[] rows, int[] texts, int[] metas) {
            this.layout = layout;
            this.root = root;
            this.bg = bg;
            this.title = title;
            this.count = count;
            this.empty = empty;
            this.footer = footer;
            this.rows = rows;
            this.texts = texts;
            this.metas = metas;
        }
    }

    private ListWidgetRenderer() {}

    static RemoteViews render(Context ctx, Ids ids, String sectionName, String fallbackTitle) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), ids.layout);
        JSONObject root = WidgetData.root(ctx);
        WidgetTheme th = WidgetTheme.from(root);
        JSONObject s = root == null ? null : root.optJSONObject(sectionName);

        // фон карточки — цветом темы приложения (белая форма + тонировка)
        v.setInt(ids.bg, "setColorFilter", th.card);

        String title = fallbackTitle;
        String countText = "";
        String emptyText = null;
        String footer = "";
        JSONArray lines = null;

        if (s == null) {
            emptyText = ctx.getString(R.string.widget_today_placeholder);
        } else {
            title = s.optString("title", title);
            int n = s.optInt("count", 0);
            countText = n > 0 ? String.valueOf(n) : "";
            footer = s.optString("footer", "");
            lines = s.optJSONArray("lines");
            if (lines == null || lines.length() == 0) emptyText = s.optString("empty", "");
        }

        v.setTextViewText(ids.title, title.toUpperCase());
        v.setTextColor(ids.title, th.text3);
        v.setTextViewText(ids.count, countText);
        v.setTextColor(ids.count, th.accent);
        v.setViewVisibility(ids.count, countText.isEmpty() ? View.GONE : View.VISIBLE);

        for (int i = 0; i < ids.rows.length; i++) {
            JSONObject line = lines == null ? null : lines.optJSONObject(i);
            if (line == null) {
                v.setViewVisibility(ids.rows[i], View.GONE);
                continue;
            }
            v.setViewVisibility(ids.rows[i], View.VISIBLE);
            v.setTextViewText(ids.texts[i], line.optString("text", ""));
            v.setTextColor(ids.texts[i], th.text);

            String meta = line.optString("meta", "");
            v.setTextViewText(ids.metas[i], meta);
            v.setTextColor(ids.metas[i], th.tone(line.optString("tone", "normal")));
            v.setViewVisibility(ids.metas[i], meta.isEmpty() ? View.GONE : View.VISIBLE);
        }

        boolean isEmpty = emptyText != null && !emptyText.isEmpty();
        v.setViewVisibility(ids.empty, isEmpty ? View.VISIBLE : View.GONE);
        if (isEmpty) {
            v.setTextViewText(ids.empty, emptyText);
            v.setTextColor(ids.empty, th.text3);
        }

        v.setViewVisibility(ids.footer, footer.isEmpty() ? View.GONE : View.VISIBLE);
        if (!footer.isEmpty()) {
            v.setTextViewText(ids.footer, footer);
            v.setTextColor(ids.footer, th.text3);
        }

        v.setOnClickPendingIntent(ids.root, WidgetData.openApp(ctx));
        return v;
    }
}
