package com.kingbattle.presentation.wallet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kingbattle.data.api.CreateDepositRequest
import com.kingbattle.data.api.CreateWithdrawalRequest
import com.kingbattle.data.api.KingBattleApi
import com.kingbattle.domain.model.Transaction
import com.kingbattle.domain.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class WalletViewModel @Inject constructor(
    private val api: KingBattleApi
) : ViewModel() {

    private val _user = MutableStateFlow<User?>(null)
    val user: StateFlow<User?> = _user.asStateFlow()

    private val _transactions = MutableStateFlow<List<Transaction>>(emptyList())
    val transactions: StateFlow<List<Transaction>> = _transactions.asStateFlow()

    private val _withdrawalCharge = MutableStateFlow(0)
    val withdrawalCharge: StateFlow<Int> = _withdrawalCharge.asStateFlow()

    private val _depositQrUrl = MutableStateFlow("")
    val depositQrUrl: StateFlow<String> = _depositQrUrl.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var lastLoadedAtMs = 0L

    init {
        loadData()
    }

    fun refreshData() {
        loadData(force = true)
    }

    fun loadData(force: Boolean = false) {
        viewModelScope.launch {
            val now = System.currentTimeMillis()
            if (!force && lastLoadedAtMs > 0L && now - lastLoadedAtMs < REFRESH_COOLDOWN_MS) {
                return@launch
            }
            if (!force && _user.value == null) {
                _isLoading.value = true
            } else if (force) {
                _isRefreshing.value = true
            }
            _errorMessage.value = null
            try {
                // 1. Fetch current user to get latest coins
                try {
                    val userRes = api.getCurrentUser()
                    if (userRes.isSuccessful && userRes.body() != null) {
                        _user.value = userRes.body()!!
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                // 2. Fetch transactions
                val currentUser = _user.value
                if (currentUser != null) {
                    try {
                        val txRes = api.getUserTransactions(currentUser.id)
                        if (txRes.isSuccessful && txRes.body() != null) {
                            _transactions.value = txRes.body()!!
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                // 3. Fetch withdrawal charge
                try {
                    val chargeRes = api.getWithdrawalCharge()
                    if (chargeRes.isSuccessful && chargeRes.body() != null) {
                        val charge = chargeRes.body()!!["chargePercent"] ?: chargeRes.body()!!["percent"] ?: 0
                        _withdrawalCharge.value = charge
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                // 4. Fetch deposit QR URL
                try {
                    val qrRes = api.getDepositQrUrl()
                    if (qrRes.isSuccessful && qrRes.body() != null) {
                        val url = qrRes.body()!!["depositQrUrl"] ?: qrRes.body()!!["url"] ?: ""
                        _depositQrUrl.value = url
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

            } catch (e: Exception) {
                _errorMessage.value = "Failed to load wallet data: ${e.localizedMessage}"
                e.printStackTrace()
            } finally {
                _isLoading.value = false
                _isRefreshing.value = false
                lastLoadedAtMs = System.currentTimeMillis()
            }
        }
    }

    companion object {
        private const val REFRESH_COOLDOWN_MS = 30_000L
    }

    fun createWithdrawal(
        amount: Int,
        upiId: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            try {
                val response = api.createWithdrawalRequest(CreateWithdrawalRequest(amount, upiId))
                if (response.isSuccessful && response.body() != null) {
                    loadData()
                    onSuccess()
                } else {
                    val errorBody = response.errorBody()?.string()
                    onError(errorBody ?: "Failed to submit withdrawal request")
                }
            } catch (e: Exception) {
                onError(e.localizedMessage ?: "Network error")
            }
        }
    }

    fun createDeposit(
        amount: Int,
        utr: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            try {
                val response = api.createDepositRequest(CreateDepositRequest(amount, utr))
                if (response.isSuccessful && response.body() != null) {
                    loadData()
                    onSuccess()
                } else {
                    val errorBody = response.errorBody()?.string()
                    onError(errorBody ?: "Failed to submit deposit request")
                }
            } catch (e: Exception) {
                onError(e.localizedMessage ?: "Network error")
            }
        }
    }

    fun startZapUpiDeposit(
        amount: Int,
        onSuccess: (paymentUrl: String, orderId: String) -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            try {
                val response = api.createZapUpiOrder(com.kingbattle.data.api.CreateZapUpiOrderRequest(amount))
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    onSuccess(body.payment_url, body.order_id)
                } else {
                    val errorBody = response.errorBody()?.string()
                    onError(errorBody ?: "Failed to initiate payment order")
                }
            } catch (e: Exception) {
                onError(e.localizedMessage ?: "Network error")
            }
        }
    }

    fun checkZapUpiStatus(
        orderId: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            try {
                val response = api.checkZapUpiOrderStatus(orderId)
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    val status = body["status"] ?: ""
                    if (status.equals("Success", ignoreCase = true)) {
                        loadData()
                        onSuccess()
                    } else {
                        onError("Payment is still pending verification")
                    }
                } else {
                    onError("Failed to verify payment status")
                }
            } catch (e: Exception) {
                onError(e.localizedMessage ?: "Network error")
            }
        }
    }
}
