package com.asefusis.planner;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Защищённое хранилище для секрета vault (TOTP).
 *
 * Секрет больше не лежит открытым в localStorage WebView: он шифруется
 * ключом AES-256/GCM, который живёт в Android Keystore и НЕ покидает
 * устройство (на аппаратных платформах — вообще не покидает TEE/StrongBox).
 * В SharedPreferences попадает только шифротекст с IV.
 *
 * Биометрия сознательно НЕ привязана к самому ключу
 * (setUserAuthenticationRequired(false)): подтверждение личности в приложении
 * уже отдельным шагом (biometricAuthenticate), а привязка к ключу означала бы
 * окно аутентификации в N секунд и потерю ключа при смене биометрии на
 * устройстве — то есть потерю доступа к зашифрованным картам и циклу.
 */
@CapacitorPlugin(name = "SecureStore")
public class SecureStorePlugin extends Plugin {

    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "planner_vault_key";
    private static final String PREFS = "planner_secure";
    private static final String TRANSFORM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_BYTES = 12;

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Ключ из Keystore; создаётся при первом обращении. */
    private SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance(KEYSTORE);
        ks.load(null);
        KeyStore.Entry entry = ks.getEntry(KEY_ALIAS, null);
        if (entry instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        }
        KeyGenerator gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        gen.init(
            new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setUserAuthenticationRequired(false)
                .build()
        );
        return gen.generateKey();
    }

    @PluginMethod
    public void get(PluginCall call) {
        String name = call.getString("key");
        if (name == null) {
            call.reject("no key");
            return;
        }
        JSObject ret = new JSObject();
        String stored = prefs().getString(name, null);
        if (stored == null) {
            ret.put("value", (String) null);
            call.resolve(ret);
            return;
        }
        try {
            int sep = stored.indexOf(':');
            if (sep <= 0) throw new IllegalStateException("bad payload");
            byte[] iv = Base64.decode(stored.substring(0, sep), Base64.NO_WRAP);
            byte[] ct = Base64.decode(stored.substring(sep + 1), Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance(TRANSFORM);
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            ret.put("value", new String(cipher.doFinal(ct), StandardCharsets.UTF_8));
            call.resolve(ret);
        } catch (Exception e) {
            // ключ Keystore пропал (сброс, восстановление на другом устройстве)
            // или запись повреждена: молча отдаём null — вызывающий предложит
            // ввести секрет заново, это лучше, чем падение
            ret.put("value", (String) null);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void set(PluginCall call) {
        String name = call.getString("key");
        String value = call.getString("value");
        if (name == null || value == null) {
            call.reject("no key/value");
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORM);
            cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] iv = cipher.getIV();
            if (iv == null || iv.length != IV_BYTES) throw new IllegalStateException("bad iv");
            byte[] ct = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            String payload =
                Base64.encodeToString(iv, Base64.NO_WRAP)
                    + ":"
                    + Base64.encodeToString(ct, Base64.NO_WRAP);
            prefs().edit().putString(name, payload).commit(); // commit: секрет важнее скорости
            JSObject ret = new JSObject();
            ret.put("value", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("secure store write failed", e);
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String name = call.getString("key");
        if (name == null) {
            call.reject("no key");
            return;
        }
        prefs().edit().remove(name).commit();
        JSObject ret = new JSObject();
        ret.put("value", true);
        call.resolve(ret);
    }
}
