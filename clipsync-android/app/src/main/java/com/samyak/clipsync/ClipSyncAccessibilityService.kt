package com.samyak.clipsync

import android.accessibilityservice.AccessibilityService
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration

private const val TAG = "ClipSync"
private const val NOTIF_CHANNEL_ID = "clipsync_incoming"

class ClipSyncAccessibilityService : AccessibilityService() {

    private lateinit var clipboardManager: ClipboardManager
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private var firestoreListener: ListenerRegistration? = null

    // Guards against the echo loop: when we write a remote update into the
    // clipboard ourselves, that write also fires the OnPrimaryClipChanged
    // listener. We need to recognize "that was us" and not re-push it.
    private var lastRemoteText: String? = null
    private var currentUid: String? = null

    private val clipListener = ClipboardManager.OnPrimaryClipChangedListener {
        Log.d(TAG, "Clipboard changed detected")
        try {
            val clip = clipboardManager.primaryClip
            if (clip == null) {
                Log.w(TAG, "primaryClip is null — Android 10+ may block background clipboard access")
                return@OnPrimaryClipChangedListener
            }
            val text = clip.getItemAt(0)?.coerceToText(this)?.toString()
            if (text.isNullOrBlank()) {
                Log.d(TAG, "Clipboard text is empty/blank, skipping")
                return@OnPrimaryClipChangedListener
            }
            if (text == lastRemoteText) {
                Log.d(TAG, "Clipboard text matches last remote text, skipping echo")
                return@OnPrimaryClipChangedListener
            }
            Log.d(TAG, "Pushing clipboard to Firestore: ${text.take(50)}...")
            pushToFirestore(text)
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException reading clipboard — likely Android 10+ restriction", e)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        clipboardManager = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboardManager.addPrimaryClipChangedListener(clipListener)
        signInAndListen()
    }

    private fun signInAndListen() {
        val user = auth.currentUser
        if (user != null) {
            currentUid = user.uid
            startFirestoreListener(user.uid)
            return
        }
        auth.signInWithEmailAndPassword(FirebaseConfig.SHARED_EMAIL, FirebaseConfig.SHARED_PASSWORD)
            .addOnSuccessListener { result ->
                currentUid = result.user?.uid
                currentUid?.let { startFirestoreListener(it) }
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Sign-in failed", e)
            }
    }

    private fun startFirestoreListener(uid: String) {
        firestoreListener?.remove()
        firestoreListener = db.collection("clipboard").document(uid)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Firestore listen failed", error)
                    return@addSnapshotListener
                }
                if (snapshot == null || !snapshot.exists()) return@addSnapshotListener

                val source = snapshot.getString("sourceDevice")
                val text = snapshot.getString("text") ?: return@addSnapshotListener
                if (source == "android") return@addSnapshotListener // our own write, ignore

                lastRemoteText = text
                clipboardManager.setPrimaryClip(ClipData.newPlainText("clipsync", text))
                notifyIncoming(source ?: "unknown", text)
            }
    }

    private fun pushToFirestore(text: String) {
        val uid = currentUid ?: return
        val data = hashMapOf(
            "text" to text,
            "sourceDevice" to "android",
            "updatedAt" to FieldValue.serverTimestamp()
        )
        db.collection("clipboard").document(uid).set(data)
            .addOnFailureListener { e -> Log.e(TAG, "Push failed", e) }

        // Also write to the history subcollection so it appears in browser history
        val historyData = hashMapOf(
            "text" to text,
            "sourceDevice" to "android",
            "createdAt" to FieldValue.serverTimestamp()
        )
        db.collection("clipboard").document(uid)
            .collection("history").add(historyData)
            .addOnFailureListener { e -> Log.e(TAG, "History write failed", e) }
    }

    private fun notifyIncoming(source: String, text: String) {
        val preview = if (text.length > 80) text.take(80) + "…" else text
        val notification = NotificationCompat.Builder(this, NOTIF_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_edit)
            .setContentTitle("Clipboard from $source")
            .setContentText(preview)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()
        try {
            NotificationManagerCompat.from(this).notify(1001, notification)
        } catch (e: SecurityException) {
            // POST_NOTIFICATIONS not granted on Android 13+ — clipboard is
            // still synced, the user just won't see a notification.
            Log.w(TAG, "Notification permission not granted", e)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We don't need window/event content — only the clipboard listener.
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        super.onDestroy()
        clipboardManager.removePrimaryClipChangedListener(clipListener)
        firestoreListener?.remove()
    }
}
