package com.asefusis.planner

import android.content.Intent
import android.os.Build
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Мост к Health Connect — ТОЛЬКО ЧТЕНИЕ ВЕСА.
 *
 * Осознанно узкая область. Приложение ничего в общее хранилище не пишет, а
 * данные цикла сюда не попадают вовсе: решение «цикл не покидает устройство»
 * никуда не делось, а Health Connect — общее хранилище ОС, откуда читают
 * другие одобренные приложения.
 *
 * Клиент Health Connect написан на Kotlin и состоит из suspend-функций,
 * поэтому и плагин на Kotlin: из Java пришлось бы звать их через runBlocking,
 * блокируя поток.
 *
 * Требование клиента — Android 8 (API 26), а minSdk приложения 24. Поэтому в
 * манифесте стоит overrideLibrary, а каждый вход закрыт проверкой версии:
 * на старых телефонах плагин честно отвечает «не поддерживается», а не падает.
 */
@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val permissions = setOf(HealthPermission.getReadPermission(WeightRecord::class))

    /** Минимальная версия, на которой существует клиент Health Connect. */
    private val supportedOs: Boolean
        get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O

    private fun statusObject(state: String, reason: String? = null): JSObject {
        val o = JSObject()
        o.put("state", state)
        if (reason != null) o.put("reason", reason)
        return o
    }

    /**
     * Состояние интеграции. Возвращаем РАЗЛИЧИМЫЕ причины, а не общий «нет»:
     * «не тот Android», «Health Connect не установлен» и «нет разрешения» —
     * это три разных действия пользователя, и предлагать их надо по-разному.
     */
    @PluginMethod
    fun status(call: PluginCall) {
        if (!supportedOs) {
            call.resolve(statusObject("unsupported", "os"))
            return
        }
        when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_UNAVAILABLE -> {
                call.resolve(statusObject("notInstalled"))
                return
            }
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> {
                call.resolve(statusObject("needsUpdate"))
                return
            }
        }
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()
                call.resolve(
                    if (granted.containsAll(permissions)) statusObject("ready")
                    else statusObject("noPermission"),
                )
            } catch (e: Exception) {
                // Не проглатываем: без текста ошибки пользователь видит
                // «просто не работает», а мы не знаем, что чинить.
                call.resolve(statusObject("error", e.message ?: e.javaClass.simpleName))
            }
        }
    }

    /** Открыть Health Connect (установка/обновление/настройка разрешений). */
    @PluginMethod
    fun openHealthConnect(call: PluginCall) {
        try {
            val intent =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
                } else {
                    // до Android 14 Health Connect — отдельное приложение из Play
                    Intent(Intent.ACTION_VIEW).apply {
                        data = android.net.Uri.parse(
                            "market://details?id=com.google.android.apps.healthdata",
                        )
                    }
                }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject(e.message ?: "cannot open Health Connect")
        }
    }

    /** Запросить разрешение на чтение веса — системным экраном Health Connect. */
    @PluginMethod
    fun requestPermission(call: PluginCall) {
        if (!supportedOs) {
            call.resolve(JSObject().put("granted", false))
            return
        }
        try {
            val contract = PermissionController.createRequestPermissionResultContract()
            val intent = contract.createIntent(context, permissions)
            startActivityForResult(call, intent, "permissionResult")
        } catch (e: Exception) {
            call.reject(e.message ?: "cannot request permission")
        }
    }

    @ActivityCallback
    fun permissionResult(call: PluginCall?, result: ActivityResult?) {
        if (call == null) return
        // Результат контракта читаем не из Intent, а перепроверкой у клиента:
        // пользователь мог выдать разрешение частично или вернуться «назад»,
        // и доверять коду результата здесь ненадёжно.
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()
                call.resolve(JSObject().put("granted", granted.containsAll(permissions)))
            } catch (e: Exception) {
                call.resolve(JSObject().put("granted", false))
            }
        }
    }

    /**
     * Замеры веса начиная с указанного момента.
     * Отдаём ISO-время в локальной зоне и килограммы — разбор и дедупликацию
     * делает общая (и покрытая тестами) логика на стороне веба.
     */
    @PluginMethod
    fun readWeights(call: PluginCall) {
        if (!supportedOs) {
            call.reject("unsupported")
            return
        }
        val startISO = call.getString("startISO")
        val start =
            try {
                if (startISO.isNullOrBlank()) Instant.now().minusSeconds(365L * 24 * 3600)
                else Instant.parse(startISO)
            } catch (e: Exception) {
                Instant.now().minusSeconds(365L * 24 * 3600)
            }

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val response = client.readRecords(
                    ReadRecordsRequest(
                        recordType = WeightRecord::class,
                        timeRangeFilter = TimeRangeFilter.after(start),
                    ),
                )
                val fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss")
                val zone = ZoneId.systemDefault()
                val arr = JSArray()
                for (r in response.records) {
                    val o = JSObject()
                    o.put("time", fmt.format(r.time.atZone(zone)))
                    o.put("kg", r.weight.inKilograms)
                    arr.put(o)
                }
                call.resolve(JSObject().put("samples", arr))
            } catch (e: Exception) {
                call.reject(e.message ?: "read failed")
            }
        }
    }
}
