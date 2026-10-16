package com.lilywardrobe.quest;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(HykbAntiAddictionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
