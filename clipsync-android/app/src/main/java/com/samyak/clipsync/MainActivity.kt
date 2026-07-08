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
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
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

        // Check if already signed in
        val user = auth.currentUser
        if (user != null) {
            currentUid = user.uid
            showMainScreen(user.email ?: "")
            startFirestoreListener(user.uid)
        } else {
            showAuthScreen()
        }

        setupAuthButtons()
        setupMainButtons()
    }

    override fun onResume() {
        super.onResume()
        if (auth.currentUser != null) {
            refreshStatus()
        }
    }

    // ===== AUTH SCREEN =====
    private fun showAuthScreen() {
        findViewById<LinearLayout>(R.id.authLayout).visibility = View.VISIBLE
        findViewById<LinearLayout>(R.id.mainLayout).visibility = View.GONE
    }

    private fun showMainScreen(email: String) {
        findViewById<LinearLayout>(R.id.authLayout).visibility = View.GONE
        findViewById<LinearLayout>(R.id.mainLayout).visibility = View.VISIBLE
        findViewById<TextView>(R.id.userEmailText).text = email
        refreshStatus()
    }

    private var isSignUpMode = false

    private fun setupAuthButtons() {
        val emailInput = findViewById<EditText>(R.id.emailInput)
        val passwordInput = findViewById<EditText>(R.id.passwordInput)
        val authBtn = findViewById<Button>(R.id.authButton)
        val toggleLink = findViewById<TextView>(R.id.authToggle)
        val errorText = findViewById<TextView>(R.id.authErrorText)

        authBtn.setOnClickListener {
            val email = emailInput.text.toString().trim()
            val password = passwordInput.text.toString()

            if (email.isEmpty() || password.isEmpty()) {
                errorText.text = "Please enter email and password."
                errorText.visibility = View.VISIBLE
                return@setOnClickListener
            }
            if (password.length < 6) {
                errorText.text = "Password must be at least 6 characters."
                errorText.visibility = View.VISIBLE
                return@setOnClickListener
            }

            errorText.visibility = View.GONE
            authBtn.isEnabled = false
            authBtn.text = if (isSignUpMode) "Creating account…" else "Signing in…"

            val task = if (isSignUpMode) {
                auth.createUserWithEmailAndPassword(email, password)
            } else {
                auth.signInWithEmailAndPassword(email, password)
            }

            task.addOnSuccessListener { result ->
                    currentUid = result.user?.uid
                    showMainScreen(result.user?.email ?: email)
                    currentUid?.let { startFirestoreListener(it) }
                    Toast.makeText(this, "Signed in ✓", Toast.LENGTH_SHORT).show()
                }
                .addOnFailureListener { e ->
                    val msg = when {
                        e.message?.contains("user-not-found") == true -> "No account found. Try creating one."
                        e.message?.contains("wrong-password") == true || e.message?.contains("invalid-credential") == true -> "Incorrect password."
                        e.message?.contains("email-already-in-use") == true -> "Email already registered. Try signing in."
                        e.message?.contains("invalid-email") == true -> "Please enter a valid email."
                        else -> e.message ?: "Sign-in failed"
                    }
                    errorText.text = msg
                    errorText.visibility = View.VISIBLE
                    authBtn.isEnabled = true
                    authBtn.text = if (isSignUpMode) "Create Account" else "Sign In"
                }
        }

        toggleLink.setOnClickListener {
            isSignUpMode = !isSignUpMode
            errorText.visibility = View.GONE
            if (isSignUpMode) {
                authBtn.text = "Create Account"
                toggleLink.text = "Already have an account? Sign in"
            } else {
                authBtn.text = "Sign In"
                toggleLink.text = "Don't have an account? Create one"
            }
        }
    }

    // ===== MAIN SCREEN =====
    private fun setupMainButtons() {
        findViewById<Button>(R.id.enableButton).setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        findViewById<Button>(R.id.sendButton).setOnClickListener {
            sendClipboard()
        }

        findViewById<Button>(R.id.signOutButton).setOnClickListener {
            auth.signOut()
            currentUid = null
            firestoreListener?.remove()
            firestoreListener = null
            showAuthScreen()
            Toast.makeText(this, "Signed out", Toast.LENGTH_SHORT).show()
        }
    }

    // ===== FIREBASE LISTENER =====
    private fun startFirestoreListener(uid: String) {
        firestoreListener?.remove()
        firestoreListener = db.collection("clipboard").document(uid)
            .addSnapshotListener { snapshot, error ->
                if (error != null) return@addSnapshotListener
                if (snapshot == null || !snapshot.exists()) return@addSnapshotListener

                val text = snapshot.getString("text") ?: return@addSnapshotListener
                val source = snapshot.getString("sourceDevice") ?: return@addSnapshotListener

                runOnUiThread {
                    val lastClipView = findViewById<TextView>(R.id.lastClipText)
                    val preview = if (text.length > 100) text.take(100) + "…" else text
                    lastClipView.text = "\"$preview\"\n— from $source"
                }
            }
    }

    // ===== MANUAL SEND =====
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
            Toast.makeText(this, "Not signed in", Toast.LENGTH_SHORT).show()
            return
        }

        val sendBtn = findViewById<Button>(R.id.sendButton)
        sendBtn.isEnabled = false
        sendBtn.text = "Sending…"

        val data = hashMapOf(
            "text" to text,
            "sourceDevice" to "android",
            "updatedAt" to FieldValue.serverTimestamp()
        )
        db.collection("clipboard").document(uid).set(data)
            .addOnSuccessListener {
                sendBtn.text = "Sent ✓"
                Toast.makeText(this, "Clipboard sent to your PC!", Toast.LENGTH_SHORT).show()
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
            statusText.text = "⚠️ Accessibility service is disabled.\nBackground auto-sync won't work, but you can still use the Send button."
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
