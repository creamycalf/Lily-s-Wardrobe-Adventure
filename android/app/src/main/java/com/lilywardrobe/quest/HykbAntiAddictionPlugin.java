package com.lilywardrobe.quest;

import android.app.Activity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.m3839.sdk.single.UnionFcmParam;
import com.m3839.sdk.single.UnionFcmSDK;
import com.m3839.sdk.single.UnionFcmUser;
import com.m3839.sdk.single.UnionV2FcmListener;

@CapacitorPlugin(name = "HykbAntiAddiction")
public class HykbAntiAddictionPlugin extends Plugin {
    private static final int SCREEN_PORTRAIT = 1;
    private static final int SCREEN_LANDSCAPE = 2;

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("sdkAvailable", true);
        result.put("gameIdConfigured", !call.getString("gameId", getGameId()).isBlank());
        call.resolve(result);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        String gameId = call.getString("gameId", getGameId());
        int orientation = "landscape".equals(call.getString("orientation", "portrait"))
            ? SCREEN_LANDSCAPE : SCREEN_PORTRAIT;

        if (gameId == null || gameId.isBlank()) {
            resolve(call, false, 1101, "尚未配置好游快爆游戏 ID。");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                UnionFcmParam param = new UnionFcmParam.Builder()
                    .setGameId(gameId)
                    .setOrientation(orientation)
                    .build();

                UnionFcmSDK.setDebug(false);
                UnionFcmSDK.init(getActivity(), param, new UnionV2FcmListener() {
                    @Override
                    public void onSucceed(UnionFcmUser user) {
                        resolve(call, true, 100, "实名认证及防沉迷校验通过。");
                    }

                    @Override
                    public void onFailed(int code, String message) {
                        String detail = message == null || message.isBlank()
                            ? "防沉迷校验未通过。" : message;
                        resolve(call, false, code, detail);
                    }
                });
            } catch (Throwable error) {
                resolve(call, false, -5, "防沉迷 SDK 初始化失败：" + error.getClass().getSimpleName());
            }
        });
    }

    @PluginMethod
    public void release(PluginCall call) {
        try {
            UnionFcmSDK.releaseSDK();
        } catch (Throwable ignored) {
            // Releasing an SDK that was never initialized is safe to ignore.
        }
        call.resolve();
    }

    @PluginMethod
    public void exitGame(PluginCall call) {
        Activity activity = getActivity();
        activity.runOnUiThread(activity::finishAndRemoveTask);
        call.resolve();
    }

    private String getGameId() {
        return getContext().getString(R.string.hykb_game_id);
    }

    private void resolve(PluginCall call, boolean allowed, int code, String message) {
        JSObject result = new JSObject();
        result.put("allowed", allowed);
        result.put("code", code);
        result.put("message", message);
        result.put("sdkAvailable", true);
        call.resolve(result);
    }
}
