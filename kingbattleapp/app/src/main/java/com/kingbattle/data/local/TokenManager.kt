package com.kingbattle.data.local

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import java.security.KeyStore
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val sharedPreferences: SharedPreferences = try {
        createEncryptedSharedPreferences(context)
    } catch (e: Throwable) {
        Log.e("TokenManager", "Failed to initialize EncryptedSharedPreferences, trying recovery", e)
        try {
            clearEncryptedPrefsAndKeystore(context)
            createEncryptedSharedPreferences(context)
        } catch (e2: Throwable) {
            Log.e("TokenManager", "Failed recovery, falling back to standard SharedPreferences", e2)
            context.getSharedPreferences("king_battle_prefs_fallback", Context.MODE_PRIVATE)
        }
    }

    private fun createEncryptedSharedPreferences(ctx: Context): SharedPreferences {
        val masterKey = MasterKey.Builder(ctx)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        return EncryptedSharedPreferences.create(
            ctx,
            "king_battle_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private fun clearEncryptedPrefsAndKeystore(ctx: Context) {
        try {
            // Delete the shared preferences file
            ctx.deleteSharedPreferences("king_battle_prefs")
            
            // Delete the master key from Keystore
            val keyStore = KeyStore.getInstance("AndroidKeyStore")
            keyStore.load(null)
            keyStore.deleteEntry(MasterKey.DEFAULT_MASTER_KEY_ALIAS)
        } catch (e: Throwable) {
            Log.e("TokenManager", "Failed to clear encrypted prefs and keystore", e)
        }
    }

    fun saveToken(token: String) {
        sharedPreferences.edit().putString("auth_token", token).apply()
    }

    fun getToken(): String? {
        return sharedPreferences.getString("auth_token", null)
    }

    fun clearToken() {
        sharedPreferences.edit().remove("auth_token").apply()
    }

    fun saveRefreshToken(token: String) {
        sharedPreferences.edit().putString("refresh_token", token).apply()
    }

    fun getRefreshToken(): String? {
        return sharedPreferences.getString("refresh_token", null)
    }

    fun saveUserId(userId: String) {
        sharedPreferences.edit().putString("user_id", userId).apply()
    }

    fun getUserId(): String? {
        return sharedPreferences.getString("user_id", null)
    }

    fun getJoinedMatches(): Set<String> {
        return sharedPreferences.getStringSet("joined_matches", emptySet()) ?: emptySet()
    }

    fun saveJoinedMatch(matchId: String) {
        val currentSet = getJoinedMatches().toMutableSet()
        currentSet.add(matchId)
        sharedPreferences.edit().putStringSet("joined_matches", currentSet).apply()
    }

    fun saveFcmToken(token: String) {
        sharedPreferences.edit().putString("fcm_token", token).apply()
    }

    fun getFcmToken(): String? {
        return sharedPreferences.getString("fcm_token", null)
    }

    fun clearFcmToken() {
        sharedPreferences.edit().remove("fcm_token").apply()
    }

    fun clearAllData() {
        // Retain FCM token across logouts so notifications still work or can be updated properly,
        // or clear it if it's strictly bound to a single user context. Usually FCM token survives logout,
        // but it is good to clear it from backend user mapping.
        sharedPreferences.edit()
            .remove("auth_token")
            .remove("refresh_token")
            .remove("user_id")
            .remove("joined_matches")
            .apply()
    }

    fun isLoggedIn(): Boolean {
        return getToken() != null
    }
}
