// The Android shell: a WebView that loads the same client the browser does,
// plus a JS bridge for the tools that only exist on a phone.
//
// No business logic lives here on purpose. The core stays portable so the same
// code runs in a terminal, in CI, and on the device.

package app.deviceagent

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {

    private lateinit var web: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // The client talks to a core on loopback (DEVICE_AGENT_TOKEN in .env).
        // Cleartext is permitted for localhost only — see res/xml/network_security_config.xml.
        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.webViewClient = WebViewClient()
        web.addJavascriptInterface(DeviceTools(this), "deviceAgent")
        web.loadUrl("file:///android_asset/index.html")
        setContentView(web)
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }
}

/**
 * The device tool namespace. Every method returns a JSON string so the JS core
 * can feed it straight back to the model as a tool result.
 *
 * Read-only by default: this build ships with `canMutate = false`, which means
 * `tap`, `type` and `openApp` refuse and say so. Turning it on is a decision the
 * user makes in Settings, and the reason is visible in the ledger.
 */
class DeviceTools(private val activity: MainActivity) {

    /** Mutating actions stay off until the user enables them explicitly. */
    private val canMutate: Boolean
        get() = activity.getSharedPreferences("device-agent", 0)
            .getBoolean("allow_actions", false)

    @JavascriptInterface
    fun capabilities(): String = buildString {
        append("{")
        append("\"accessibility\":").append(AgentAccessibility.isRunning())
        append(",\"canMutate\":").append(canMutate)
        append(",\"sdk\":").append(android.os.Build.VERSION.SDK_INT)
        append("}")
    }

    @JavascriptInterface
    fun dumpScreen(): String = AgentAccessibility.connected?.dumpTree() ?: "{\"error\":\"accessibility service not enabled\"}"

    @JavascriptInterface
    fun tap(nodeId: String): String {
        if (!canMutate) return denied("tap")
        return AgentAccessibility.connected?.tapById(nodeId) ?: notConnected()
    }

    @JavascriptInterface
    fun type(nodeId: String, text: String): String {
        if (!canMutate) return denied("type")
        return AgentAccessibility.connected?.typeById(nodeId, text) ?: notConnected()
    }

    @JavascriptInterface
    fun openApp(pkg: String): String {
        if (!canMutate) return denied("openApp")
        return try {
            val i = activity.packageManager.getLaunchIntentForPackage(pkg)
                ?: return "{\"error\":\"no launchable activity for $pkg\"}"
            i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(i)
            "{\"ok\":true,\"package\":\"$pkg\"}"
        } catch (e: Exception) {
            "{\"error\":\"${e.message}\"}"
        }
    }

    private fun denied(what: String) =
        "{\"error\":\"$what requires the user to enable actions in Settings\",\"denied\":true}"

    private fun notConnected() =
        "{\"error\":\"accessibility service not enabled\",\"hint\":\"Settings > Accessibility > device-agent\"}"
}
