package net.hurlune.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.HttpAuthHandler;
import android.webkit.JavascriptInterface;
import androidx.webkit.ProxyConfig;
import androidx.webkit.ProxyController;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewFeature;

/** Hurlune pour Android : le jeu tourne dans un WebView, toujours à l'horizontale. */
public class MainActivity extends Activity {
    private static final String HOME = "https://appassets.androidplatform.net/assets/index.html";
    private WebView web;
    private PermissionRequest pendingMic;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setTextZoom(100);
        web.setBackgroundColor(0xFF1B1C2A);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) { return loader.shouldInterceptRequest(r.getUrl()); }
            @Override public void onReceivedHttpAuthRequest(WebView v, HttpAuthHandler h, String host, String realm) {
                if (proxyUser != null && host != null && host.equals(proxyHost)) h.proceed(proxyUser, proxyPass); else h.cancel();
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) {}
                return true; // les liens externes s'ouvrent dans le navigateur
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(final PermissionRequest req) {
                runOnUiThread(() -> {
                    boolean mic = false; for (String r : req.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) mic = true;
                    if (!mic) { req.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) req.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    else { pendingMic = req; requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 7); }
                });
            }
        });
        web.addJavascriptInterface(new Bridge(), "HurluneNative");
        applyProxy(prefs().getString("proxy", ""));
        setContentView(web);
        hideBars();
        if (b != null) web.restoreState(b); else web.loadUrl(HOME);
    }
    /* ---- proxy (http://, https://, socks5://) pour tout le trafic du jeu ---- */
    private String proxyHost, proxyUser, proxyPass;
    private SharedPreferences prefs() { return getSharedPreferences("hurlune", Context.MODE_PRIVATE); }
    private boolean applyProxy(String url) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)) return url == null || url.isEmpty();
        proxyHost = null; proxyUser = null; proxyPass = null;
        if (url == null || url.trim().isEmpty()) {
            ProxyController.getInstance().clearProxyOverride(Runnable::run, () -> {});
            return true;
        }
        try {
            Uri u = Uri.parse(url.trim());
            String scheme = u.getScheme() == null ? "http" : u.getScheme().toLowerCase();
            String info = u.getUserInfo();
            if (info != null) { int i = info.indexOf(':'); proxyUser = Uri.decode(i < 0 ? info : info.substring(0, i)); proxyPass = i < 0 ? "" : Uri.decode(info.substring(i + 1)); }
            proxyHost = u.getHost();
            String rule = scheme + "://" + u.getHost() + (u.getPort() > 0 ? ":" + u.getPort() : "");
            ProxyConfig cfg = new ProxyConfig.Builder().addProxyRule(rule).addBypassRule("appassets.androidplatform.net").build();
            ProxyController.getInstance().setProxyOverride(cfg, Runnable::run, () -> {});
            return true;
        } catch (Exception e) { return false; }
    }
    private class Bridge {
        @JavascriptInterface public String platform() { return "android"; }
        @JavascriptInterface public boolean copy(String s) {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm == null) return false; cm.setPrimaryClip(ClipData.newPlainText("Hurlune", s)); return true;
        }
        @JavascriptInterface public String paste() {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm == null || !cm.hasPrimaryClip() || cm.getPrimaryClip().getItemCount() == 0) return "";
            CharSequence t = cm.getPrimaryClip().getItemAt(0).coerceToText(MainActivity.this);
            return t == null ? "" : t.toString();
        }
        @JavascriptInterface public void share(String s) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND); i.setType("text/plain"); i.putExtra(Intent.EXTRA_TEXT, s);
                try { startActivity(Intent.createChooser(i, "Hurlune")); } catch (Exception e) {}
            });
        }
        @JavascriptInterface public boolean setProxy(String url) {
            prefs().edit().putString("proxy", url == null ? "" : url).apply();
            runOnUiThread(() -> applyProxy(url));
            return true;
        }
    }
    @Override public void onRequestPermissionsResult(int code, String[] p, int[] res) {
        if (code == 7 && pendingMic != null) {
            if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) pendingMic.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE}); else pendingMic.deny();
            pendingMic = null;
        }
    }
    private void hideBars() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }
    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) hideBars(); }
    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
}
