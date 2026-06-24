package com.kingbattle

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.firebase.messaging.FirebaseMessaging
import com.kingbattle.data.api.KingBattleApi
import com.kingbattle.data.api.UpdateFcmTokenRequest
import com.kingbattle.data.local.TokenManager
import com.kingbattle.navigation.RootNavigation
import com.kingbattle.ui.theme.KingBattleTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var tokenManager: TokenManager

    @Inject
    lateinit var api: KingBattleApi

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            Log.d("MainActivity", "Notification permission granted")
        } else {
            Log.w("MainActivity", "Notification permission denied — token still registered for server-side push")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        com.kingbattle.util.NotificationHelper.createNotificationChannel(this)
        fetchAndSyncFcmToken()
        askNotificationPermission()

        setContent {
            KingBattleTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    RootNavigation()
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (tokenManager.isLoggedIn()) {
            fetchAndSyncFcmToken()
        }
    }

    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun fetchAndSyncFcmToken() {
        try {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    Log.w("MainActivity", "Fetching FCM registration token failed", task.exception)
                    return@addOnCompleteListener
                }

                val token = task.result
                Log.d("MainActivity", "FCM Token: $token")
                tokenManager.saveFcmToken(token)

                if (tokenManager.isLoggedIn()) {
                    lifecycleScope.launch(Dispatchers.IO) {
                        try {
                            val response = api.updateFcmToken(UpdateFcmTokenRequest(token))
                            if (response.isSuccessful) {
                                Log.d("MainActivity", "Synced FCM token on startup successfully")
                            } else {
                                Log.w("MainActivity", "FCM token sync failed on startup: ${response.code()}")
                            }
                        } catch (e: Exception) {
                            Log.e("MainActivity", "FCM token sync error on startup", e)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("MainActivity", "Error initializing Firebase Messaging token fetch", e)
        }
    }
}

