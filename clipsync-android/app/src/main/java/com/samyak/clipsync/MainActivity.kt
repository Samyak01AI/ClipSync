package com.samyak.clipsync

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import android.util.Log
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration

class MainActivity : AppCompatActivity() {

    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private var currentUid: String? = null
    private var firestoreListener: ListenerRegistration? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        createNotificationChannel()
        requestNotificationPermissionIfNeeded()

        findViewById<Button>(R.id.enableButton).setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        findViewById<Button>(R.id.sendButton).setOnClickListener {
            sendClipboard()
        }

        refreshStatus()
        signInAndListen()
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
    }

    // ===== FIREBASE SIGN-IN =====
    private fun signInAndListen() {
        val statusText = findViewById<TextView>(R.id.firebaseStatus)
        statusText.text = "Connecting to cloud…"

        val user = auth.currentUser
        if (user != null) {
            currentUid = user.uid
            statusText.text = "☁️ Connected to cloud"
            startFirestoreListener(user.uid)
            return
        }

        auth.signInWithEmailAndPassword(FirebaseConfig.SHARED_EMAIL, FirebaseConfig.SHARED_PASSWORD)
            .addOnSuccessListener { result ->
                currentUid = result.user?.uid
                statusText.text = "☁️ Connected to cloud"
                currentUid?.let { startFirestoreListener(it) }
            }
            .addOnFailureListener { e ->
                Log.e("ClipSync", "Sign-in failed", e)
                statusText.text = "❌ Cloud connection failed: ${e.message}"
            }
    }

    // ===== LISTEN FOR INCOMING CLIPS =====
    private fun startFirestoreListener(uid: String) {
        firestoreListener?.remove()
        firestoreListener = db.collection("clipboard").document(uid)
            .addSnapshotListener { snapshot, error ->
                if (error != null) return@addSnapshotListener
                if (snapshot == null || !snapshot.exists()) return@addSnapshotListener

                val text = snapshot.getString("text") ?: return@addSnapshotListener
                val source = snapshot.getString("sourceDevice") ?: return@addSnapshotListener

                // Show the last synced clip in the UI
                runOnUiThread {
                    val lastClipView = findViewById<TextView>(R.id.lastClipText)
                    val preview = if (text.length > 100) text.take(100) + "…" else text
                    lastClipView.text = "\"$preview\"\n— from $source"
                }
            }
    }

    // ===== MANUAL SEND FROM FOREGROUND =====
    private fun sendClipboard() {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = clipboard.primaryClip
        val text = clip?.getItemAt(0)?.coerceToText(this)?.toString()

        if (text.isNullOrBlank()) {
            Toast.makeText(this, "Clipboard is empty", Toast.LENGTH_SHORT).show()
            return
        }

        val uid = currentUid
        if (uid == null) {
            Toast.makeText(this, "Not connected to cloud yet", Toast.LENGTH_SHORT).show()
            return
        }

        val sendBtn = findViewById<Button>(R.id.sendButton)
        sendBtn.isEnabled = false
        sendBtn.text = "Sending…"

        // Write to main doc
        val data = hashMapOf(
            "text" to text,
            "sourceDevice" to "android",
            "updatedAt" to FieldValue.serverTimestamp()
        )
        db.collection("clipboard").document(uid).set(data)
            .addOnSuccessListener {
                sendBtn.text = "Sent ✓"
                Toast.makeText(this, "Clipboard sent to your PC!", Toast.LENGTH_SHORT).show()

                // Reset button after delay
                sendBtn.postDelayed({
                    sendBtn.isEnabled = true
                    sendBtn.text = "Send Clipboard to PC"
                }, 1500)
            }
            .addOnFailureListener { e ->
                sendBtn.text = "Failed ✕"
                Toast.makeText(this, "Failed: ${e.message}", Toast.LENGTH_SHORT).show()

                sendBtn.postDelayed({
                    sendBtn.isEnabled = true
                    sendBtn.text = "Send Clipboard to PC"
                }, 1500)
            }

        // Also write to history
        val historyData = hashMapOf(
            "text" to text,
            "sourceDevice" to "android",
            "createdAt" to FieldValue.serverTimestamp()
        )
        db.collection("clipboard").document(uid)
            .collection("history").add(historyData)
    }

    // ===== STATUS =====
    private fun refreshStatus() {
        val statusText = findViewById<TextView>(R.id.statusText)
        val enableBtn = findViewById<Button>(R.id.enableButton)

        if (isAccessibilityServiceEnabled()) {
            statusText.text = "✅ Accessibility service is enabled.\nBackground sync is active."
            enableBtn.text = "Accessibility: ON ✓"
        } else {
            statusText.text = "⚠️ Accessibility service is disabled.\nBackground auto-sync won't work, but you can still use the Send button below."
            enableBtn.text = "Enable Accessibility Service"
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val expected = "$packageName/${ClipSyncAccessibilityService::class.java.canonicalName}"
        val enabledServices = Settings.Secure.getString(
            contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        val splitter = TextUtils.SimpleStringSplitter(':')
        splitter.setString(enabledServices)
        while (splitter.hasNext()) {
            if (splitter.next().equals(expected, ignoreCase = true)) return true
        }
        return false
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "clipsync_incoming",
                "Incoming clipboard",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 100)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        firestoreListener?.remove()
    }
}
