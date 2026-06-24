package com.kingbattle

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.Toast
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
import com.kingbattle.util.NotificationHelper
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
        ActivityResultContracts.RequestPermission(),
    ) { isGranted: Boolean ->
        if (isGranted) {
            Log.d(TAG, "Notification permission granted")
            NotificationHelper.createNotificationChannel(this)
            NotificationHelper.showNotification(
                this,
                "Notifications enabled",
                "You will receive King Battle alerts here.",
            )
            fetchAndSyncFcmToken()
        } else {
            Log.w(TAG, "Notification permission denied")
            Toast.makeText(
                this,
                "Enable notifications in Settings to receive alerts",
                Toast.LENGTH_LONG,
            ).show()
            fetchAndSyncFcmToken()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        NotificationHelper.createNotificationChannel(this)
        NotificationHelper.logNotificationState(this, "onCreate")
        askNotificationPermission()
        fetchAndSyncFcmToken()

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
        NotificationHelper.logNotificationState(this, "onResume")
        if (tokenManager.isLoggedIn()) {
            fetchAndSyncFcmToken()
        }
    }

    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            when {
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
                    PackageManager.PERMISSION_GRANTED -> {
                    Log.d(TAG, "Notification permission already granted")
                }
                shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) -> {
                    requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
                else -> {
                    requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        }
    }

    private fun fetchAndSyncFcmToken() {
        try {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    Log.w(TAG, "Fetching FCM registration token failed", task.exception)
                    return@addOnCompleteListener
                }

                val token = task.result
                Log.d(TAG, "FCM token suffix: …${token.takeLast(8)}")
                tokenManager.saveFcmToken(token)

                if (tokenManager.isLoggedIn()) {
                    lifecycleScope.launch(Dispatchers.IO) {
                        try {
                            val response = api.updateFcmToken(UpdateFcmTokenRequest(token))
                            if (response.isSuccessful) {
                                val userId = response.body()?.userId
                                Log.d(TAG, "Synced FCM token for user=$userId suffix=…${token.takeLast(8)}")
                            } else {
                                Log.w(TAG, "FCM token sync failed: HTTP ${response.code()}")
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "FCM token sync error", e)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing Firebase Messaging token fetch", e)
        }
    }

    companion object {
        private const val TAG = "MainActivity"
    }
}
