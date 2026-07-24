package com.asefusis.planner;

import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // открытие сторонних приложений по пакету (кнопка на карте)
        registerPlugin(AppOpenerPlugin.class);
        super.onCreate(savedInstanceState);

        // Android 15+ принудительно рисует приложение под системными панелями
        // (edge-to-edge): контент сливался со шторкой и жестовой панелью.
        // Отступаем WebView от панелей. Клавиатуру (ime) сюда НЕ включаем:
        // Chromium внутри WebView сам сжимает страницу под клавиатуру,
        // двойной учёт давал огромную «дыру» над клавиатурой.
        if (Build.VERSION.SDK_INT >= 35) {
            View webView = getBridge().getWebView();
            ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
                Insets bars = insets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                        | WindowInsetsCompat.Type.displayCutout()
                );
                ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
                mlp.topMargin = bars.top;
                mlp.bottomMargin = bars.bottom;
                mlp.leftMargin = bars.left;
                mlp.rightMargin = bars.right;
                v.setLayoutParams(mlp);
                return WindowInsetsCompat.CONSUMED;
            });
        }

        // Иконки системных панелей по теме: тёмный фон → светлые иконки
        boolean night =
            (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(!night);
        controller.setAppearanceLightNavigationBars(!night);
    }
}
