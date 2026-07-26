package com.asefusis.planner;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

/**
 * Виджет «Покупки»: запланированные покупки, ближайшее по дате — выше,
 * срочность подсвечена цветом (просрочено/сегодня). Только чтение; отметка
 * «куплено» потребовала бы кнопки на каждую строку с адресацией товара —
 * это отдельный заход. Тап открывает приложение.
 */
public class ShoppingWidgetProvider extends AppWidgetProvider {

    private static final ListWidgetRenderer.Ids IDS = new ListWidgetRenderer.Ids(
        R.layout.widget_shopping,
        R.id.shopping_root,
        R.id.shopping_bg,
        R.id.shopping_title,
        R.id.shopping_count,
        R.id.shopping_empty,
        R.id.shopping_footer,
        new int[] { R.id.shopping_row1, R.id.shopping_row2, R.id.shopping_row3 },
        new int[] { R.id.shopping_text1, R.id.shopping_text2, R.id.shopping_text3 },
        new int[] { R.id.shopping_meta1, R.id.shopping_meta2, R.id.shopping_meta3 }
    );

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, buildViews(context));
    }

    static RemoteViews buildViews(Context context) {
        return ListWidgetRenderer.render(
            context, IDS, "shopping", context.getString(R.string.widget_shopping_label)
        );
    }
}
