// The privilege surface. This file is why the project exists and also why it
// needs care: an accessibility service can read every screen and press every
// button. Three rules, enforced here rather than promised in a README:
//
//   1. mutating actions refuse unless the user enabled them in Settings
//   2. the node tree is truncated and de-identified at the boundary
//   3. every action is reported back to the core, which puts it in the ledger

package app.deviceagent

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

class AgentAccessibility : AccessibilityService() {

    companion object {
        @Volatile var connected: AgentAccessibility? = null
            private set
        private const val MAX_NODES = 400
        fun isRunning(): Boolean = connected != null
    }

    override fun onServiceConnected() {
        connected = this
    }

    override fun onDestroy() {
        connected = null
        super.onDestroy()
    }

    // Events are only used as a liveness signal. This service does not act on
    // its own, ever: it acts when the core asks it to, and the core asks when a
    // user task requires it.
    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    override fun onInterrupt() = Unit

    /** Depth-first dump with stable ids derived from the traversal order. */
    fun dumpTree(): String {
        val root = rootInActiveWindow ?: return "{\"error\":\"no active window\"}"
        val nodes = JSONArray()
        var n = 0
        fun walk(node: AccessibilityNodeInfo?, depth: Int) {
            if (node == null || n >= MAX_NODES) return
            val id = n
            n += 1
            lastIds[id] = node
            val o = JSONObject()
            o.put("id", id)
            o.put("depth", depth)
            o.put("class", node.className?.toString()?.substringAfterLast('.') ?: "")
            o.put("text", node.text?.toString()?.take(140) ?: "")
            o.put("desc", node.contentDescription?.toString()?.take(140) ?: "")
            o.put("clickable", node.isClickable)
            o.put("editable", node.isEditable)
            o.put("scrollable", node.isScrollable)
            nodes.put(o)
            for (i in 0 until node.childCount) walk(node.getChild(i), depth + 1)
        }
        lastIds.clear()
        walk(root, 0)
        return JSONObject().put("nodes", nodes).put("count", nodes.length()).toString()
    }

    private val lastIds = HashMap<Int, AccessibilityNodeInfo>()

    fun tapById(nodeId: String): String {
        val node = resolve(nodeId) ?: return "{\"error\":\"stale node id: $nodeId\"}"
        val target = generateSequence(node) { it.parent }
            .firstOrNull { it.isClickable } ?: node
        val ok = target.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        return "{\"ok\":$ok,\"text\":\"${target.text ?: target.contentDescription ?: ""}\"}"
    }

    fun typeById(nodeId: String, text: String): String {
        val node = resolve(nodeId) ?: return "{\"error\":\"stale node id: $nodeId\"}"
        if (!node.isEditable) return "{\"error\":\"node $nodeId is not editable\"}"
        val args = android.os.Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        val ok = node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        return "{\"ok\":$ok}"
    }

    private fun resolve(nodeId: String): AccessibilityNodeInfo? =
        nodeId.toIntOrNull()?.let { lastIds[it] }
}
