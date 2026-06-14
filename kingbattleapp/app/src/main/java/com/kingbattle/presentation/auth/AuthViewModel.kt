package com.kingbattle.presentation.auth

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kingbattle.data.api.AuthRequest
import com.kingbattle.data.api.KingBattleApi
import com.kingbattle.data.api.SignUpRequest
import com.kingbattle.data.local.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val api: KingBattleApi,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _isLoggedIn = MutableStateFlow(tokenManager.isLoggedIn())
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    fun signIn(email: String, password: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            try {
                val response = api.signIn(AuthRequest(email, password))
                if (response.isSuccessful && response.body() != null) {
                    val authResponse = response.body()!!
                    tokenManager.saveToken(authResponse.session.access_token)
                    authResponse.session.refresh_token?.let { tokenManager.saveRefreshToken(it) }
                    tokenManager.saveUserId(authResponse.user.id)
                    _isLoggedIn.value = true
                    _errorMessage.value = null
                    syncFcmToken(authResponse.user.id)
                } else {
                    _errorMessage.value = "Sign in failed: ${response.errorBody()?.string() ?: "Unknown error"}"
                }
            } catch (e: Exception) {
                _errorMessage.value = "Network error: ${e.localizedMessage}"
                e.printStackTrace()
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun signUp(email: String, password: String, displayName: String, referredBy: String? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            try {
                val response = api.signUp(SignUpRequest(email, password, displayName, referred_by = referredBy))
                if (response.isSuccessful && response.body() != null) {
                    val authResponse = response.body()!!
                    tokenManager.saveToken(authResponse.session.access_token)
                    authResponse.session.refresh_token?.let { tokenManager.saveRefreshToken(it) }
                    tokenManager.saveUserId(authResponse.user.id)
                    _isLoggedIn.value = true
                    _errorMessage.value = null
                    syncFcmToken(authResponse.user.id)
                } else {
                    _errorMessage.value = "Sign up failed: ${response.errorBody()?.string() ?: "Unknown error"}"
                }
            } catch (e: Exception) {
                _errorMessage.value = "Network error: ${e.localizedMessage}"
                e.printStackTrace()
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun signInWithGoogle(idToken: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            try {
                val response = api.googleSignIn(com.kingbattle.data.api.GoogleAuthRequest(idToken))
                if (response.isSuccessful && response.body() != null) {
                    val authResponse = response.body()!!
                    tokenManager.saveToken(authResponse.session.access_token)
                    authResponse.session.refresh_token?.let { tokenManager.saveRefreshToken(it) }
                    tokenManager.saveUserId(authResponse.user.id)
                    _isLoggedIn.value = true
                    _errorMessage.value = null
                    syncFcmToken(authResponse.user.id)
                    onSuccess()
                } else {
                    val errorMsg = "Google sign in failed: ${response.errorBody()?.string() ?: "Unknown error"}"
                    _errorMessage.value = errorMsg
                    onError(errorMsg)
                }
            } catch (e: Exception) {
                val errorMsg = "Network error: ${e.localizedMessage}"
                _errorMessage.value = errorMsg
                onError(errorMsg)
                e.printStackTrace()
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            try {
                api.logout()
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                tokenManager.clearAllData()
                _isLoggedIn.value = false
            }
        }
    }

    fun clearError() {
        _errorMessage.value = null
    }

    private fun syncFcmToken(userId: String) {
        val fcmToken = tokenManager.getFcmToken()
        if (!fcmToken.isNullOrEmpty()) {
            viewModelScope.launch {
                try {
                    val response = api.updateFcmToken(com.kingbattle.data.api.UpdateFcmTokenRequest(fcmToken))
                    if (response.isSuccessful) {
                        Log.d("AuthViewModel", "Successfully synced FCM token for user $userId")
                    } else {
                        Log.e("AuthViewModel", "Failed to sync FCM token for user $userId: ${response.code()}")
                    }
                } catch (e: Exception) {
                    Log.e("AuthViewModel", "Error syncing FCM token for user $userId", e)
                }
            }
        }
    }
}
