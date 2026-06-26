package com.kingbattle.presentation.wallet

import android.content.Intent
import android.net.Uri
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import com.kingbattle.presentation.home.AccentOrange
import com.kingbattle.presentation.home.TextMuted
import com.kingbattle.presentation.home.TextWhite
import com.kingbattle.presentation.home.ThemeBorderColor
import com.kingbattle.presentation.home.ThemeCardBg
import com.kingbattle.presentation.home.ThemeDarkBg

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletDepositScreen(
    onNavigateBack: () -> Unit,
    viewModel: WalletViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val isRefreshingState = viewModel.isRefreshing.collectAsState()
    var amountText by remember { mutableStateOf("") }
    var activePaymentUrl by remember { mutableStateOf<String?>(null) }
    var activePaymentOrderId by remember { mutableStateOf<String?>(null) }
    var showCancelConfirmDialog by remember { mutableStateOf(false) }
    var isCheckingStatus by remember { mutableStateOf(false) }
    var isCreatingOrder by remember { mutableStateOf(false) }

    fun handleUrl(url: String): Boolean {
        if (url.startsWith("https://zapupi.com/payment?s=s")) {
            activePaymentUrl = null
            val orderId = activePaymentOrderId ?: ""
            activePaymentOrderId = null
            if (orderId.isNotEmpty()) {
                isCheckingStatus = true
                viewModel.checkZapUpiStatus(
                    orderId = orderId,
                    onSuccess = {
                        isCheckingStatus = false
                        Toast.makeText(context, "Payment verified successfully!", Toast.LENGTH_LONG).show()
                        onNavigateBack()
                    },
                    onError = { err ->
                        isCheckingStatus = false
                        Toast.makeText(context, "Verification pending: $err", Toast.LENGTH_LONG).show()
                    }
                )
            }
            return true
        }
        if (url.startsWith("https://zapupi.com/payment?s=f")) {
            activePaymentUrl = null
            activePaymentOrderId = null
            Toast.makeText(context, "Payment failed.", Toast.LENGTH_LONG).show()
            return true
        }
        if (url.startsWith("https://zapupi.com/payment?s=t")) {
            activePaymentUrl = null
            activePaymentOrderId = null
            Toast.makeText(context, "Payment timed out.", Toast.LENGTH_LONG).show()
            return true
        }
        if (url.startsWith("upi://") || url.startsWith("paytmmp://")
            || url.startsWith("phonepe://") || url.startsWith("gpay://")
            || url.startsWith("tez://") || url.startsWith("intent://")
        ) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                context.startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(context, "No compatible UPI app installed", Toast.LENGTH_SHORT).show()
            }
            return true
        }
        return false
    }

    Box(modifier = Modifier.fillMaxSize()) {
        if (activePaymentUrl != null) {
            BackHandler { showCancelConfirmDialog = true }
            Column(modifier = Modifier.fillMaxSize().background(ThemeDarkBg)) {
                TopAppBar(
                    title = {
                        Text("Secure Checkout", color = TextWhite, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    },
                    navigationIcon = {
                        IconButton(onClick = { showCancelConfirmDialog = true }) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = TextWhite)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = ThemeDarkBg)
                )
                AndroidView(
                    factory = { ctx ->
                        WebView(ctx).apply {
                            settings.apply {
                                javaScriptEnabled = true
                                domStorageEnabled = true
                                loadWithOverviewMode = true
                                useWideViewPort = true
                                textZoom = 90
                                builtInZoomControls = false
                                displayZoomControls = false
                                allowFileAccess = true
                                cacheMode = WebSettings.LOAD_DEFAULT
                            }
                            webViewClient = object : WebViewClient() {
                                override fun shouldOverrideUrlLoading(view: WebView?, url: String?) =
                                    url?.let { handleUrl(it) } ?: false

                                override fun shouldOverrideUrlLoading(
                                    view: WebView?,
                                    request: android.webkit.WebResourceRequest?
                                ) = request?.url?.toString()?.let { handleUrl(it) } ?: false
                            }
                            loadUrl(activePaymentUrl!!)
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )
            }
        } else {
            Scaffold(
                topBar = {
                    TopAppBar(
                        title = {
                            Text("Add Coins", color = TextWhite, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        },
                        navigationIcon = {
                            IconButton(onClick = onNavigateBack) {
                                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextWhite)
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(containerColor = ThemeDarkBg)
                    )
                },
                containerColor = ThemeDarkBg
            ) { padding ->
                PullToRefreshBox(
                    isRefreshing = isRefreshingState.value,
                    onRefresh = { viewModel.refreshData() },
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = ThemeCardBg)
                    ) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Text(
                                text = "Add Coins (Deposit)",
                                color = TextWhite,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Enter the amount of coins you want to deposit. 1 Coin = 1 INR.",
                                color = TextMuted,
                                fontSize = 13.sp
                            )
                            OutlinedTextField(
                                value = amountText,
                                onValueChange = { amountText = it.filter { c -> c.isDigit() } },
                                label = { Text("Amount (Coins)") },
                                placeholder = { Text("e.g. 200") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.fillMaxWidth(),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedTextColor = Color.White,
                                    unfocusedTextColor = Color.White,
                                    focusedBorderColor = AccentOrange,
                                    unfocusedBorderColor = ThemeBorderColor
                                )
                            )
                            Button(
                                onClick = {
                                    val amountVal = amountText.toIntOrNull()
                                    if (amountVal == null || amountVal <= 0) {
                                        Toast.makeText(context, "Enter a valid amount", Toast.LENGTH_SHORT).show()
                                        return@Button
                                    }
                                    isCreatingOrder = true
                                    viewModel.startZapUpiDeposit(
                                        amount = amountVal,
                                        onSuccess = { paymentUrl, orderId ->
                                            isCreatingOrder = false
                                            activePaymentUrl = paymentUrl
                                            activePaymentOrderId = orderId
                                        },
                                        onError = { err ->
                                            isCreatingOrder = false
                                            Toast.makeText(context, "Error creating order: $err", Toast.LENGTH_LONG).show()
                                        }
                                    )
                                },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = amountText.isNotBlank() && !isCreatingOrder,
                                colors = ButtonDefaults.buttonColors(containerColor = AccentOrange),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("Proceed to Pay", color = Color.White, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                }
            }
        }

        if (showCancelConfirmDialog) {
            AlertDialog(
                onDismissRequest = { showCancelConfirmDialog = false },
                title = { Text("Cancel Payment?", color = TextWhite, fontWeight = FontWeight.Bold) },
                text = { Text("Are you sure you want to cancel this payment?", color = TextMuted) },
                confirmButton = {
                    Button(
                        onClick = {
                            showCancelConfirmDialog = false
                            activePaymentUrl = null
                            activePaymentOrderId = null
                            Toast.makeText(context, "Payment cancelled", Toast.LENGTH_SHORT).show()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFB3261E))
                    ) { Text("Cancel", color = Color.White) }
                },
                dismissButton = {
                    TextButton(onClick = { showCancelConfirmDialog = false }) { Text("Wait", color = TextMuted) }
                },
                containerColor = ThemeCardBg
            )
        }

        if (isCreatingOrder || isCheckingStatus) {
            AlertDialog(
                onDismissRequest = {},
                text = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        modifier = Modifier.padding(16.dp)
                    ) {
                        CircularProgressIndicator(color = AccentOrange)
                        Text(
                            text = if (isCreatingOrder) "Creating order..." else "Verifying payment status...",
                            color = TextWhite,
                            fontSize = 16.sp
                        )
                    }
                },
                confirmButton = {},
                containerColor = ThemeCardBg
            )
        }
    }
}
