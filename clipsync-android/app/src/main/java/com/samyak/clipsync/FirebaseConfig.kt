package com.samyak.clipsync

/**
 * Same shared account used by the Chrome extension and (eventually) the
 * iOS app. Firebase project connection itself comes from google-services.json
 * (Project settings -> General -> Android app -> download this file and
 * place it at app/google-services.json).
 */
object FirebaseConfig {
    const val SHARED_EMAIL = "me.samyak06@gmail.com"
    const val SHARED_PASSWORD = "123123Sam"
}
