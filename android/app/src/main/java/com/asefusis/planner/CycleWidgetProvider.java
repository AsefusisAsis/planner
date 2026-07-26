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
 * день цикла, фазу и прогноз — без симптомов и дневника. Кнопки «отметить
 * менструацию» здесь нет сознательно: случайный тап с рабочего стола испортил
 * бы историю и прогноз, а отменить его оттуда нельзя. Отмечать — в
 * приложении, тап открывает раздел.
 */
public class CycleWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, buildViews(context));
    }

    static RemoteViews buildViews(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_cycle);
        JSONObject root = WidgetData.root(context);
        WidgetTheme th = WidgetTheme.from(root);
        JSONObject s = root == null ? null : root.optJSONObject("cycle");

        v.setInt(R.id.cycle_bg, "setColorFilter", th.card);

        String title = context.getString(R.string.widget_cycle_label);
        String hint = context.getString(R.string.widget_today_placeholder);
        String dayNumber = "";
        String dayLabel = "";
        String phase = "";
        String next = "";

        if (s != null) {
            title = s.optString("title", title);
            hint = s.optString("hint", "");
            dayNumber = s.optString("dayNumber", "");
            dayLabel = s.optString("dayLabel", "");
            phase = s.optString("phase", "");
            next = s.optString("next", "");
        }

        v.setTextViewText(R.id.cycle_title, title.toUpperCase());
        v.setTextColor(R.id.cycle_title, th.text3);

        // либо данные, либо служебное сообщение — но не оба сразу: раньше
        // «трекер выключен» попадало в крупный слот дня и читалось как
        // главное содержимое карточки
        boolean hasData = !dayNumber.isEmpty();
        v.setViewVisibility(R.id.cycle_data, hasData ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.cycle_hint, hasData ? View.GONE : View.VISIBLE);

        if (hasData) {
            v.setTextViewText(R.id.cycle_day_number, dayNumber);
            v.setTextColor(R.id.cycle_day_number, th.accent);
            v.setTextViewText(R.id.cycle_day_label, dayLabel);
            v.setTextColor(R.id.cycle_day_label, th.text2);
            v.setTextViewText(R.id.cycle_phase, phase);
            v.setTextColor(R.id.cycle_phase, th.text);
            v.setViewVisibility(R.id.cycle_phase, phase.isEmpty() ? View.GONE : View.VISIBLE);
        } else {
            v.setTextViewText(R.id.cycle_hint, hint);
            v.setTextColor(R.id.cycle_hint, th.text3);
        }

        v.setTextViewText(R.id.cycle_next, next);
        v.setTextColor(R.id.cycle_next, th.text3);
        v.setViewVisibility(R.id.cycle_next, next.isEmpty() ? View.GONE : View.VISIBLE);

        v.setOnClickPendingIntent(R.id.cycle_root, WidgetData.openApp(context));
        return v;
    }
}
