package com.kingbattle.presentation.wallet

import android.widget.Toast
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.material.icons.filled.Close
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.kingbattle.domain.model.Transaction
import com.kingbattle.presentation.home.ThemeBorderColor
import com.kingbattle.presentation.home.ThemeDarkBg
import com.kingbattle.presentation.home.ThemeCardBg
import com.kingbattle.presentation.home.TextWhite
import com.kingbattle.presentation.home.TextMuted
import com.kingbattle.presentation.home.AccentOrange
import com.kingbattle.presentation.home.AccentGold

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletScreen(
    onNavigateBack: () -> Unit,
    viewModel: WalletViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val userState = viewModel.user.collectAsState()
    val transactionsState = viewModel.transactions.collectAsState()
    val withdrawalChargeState = viewModel.withdrawalCharge.collectAsState()
    val depositQrUrlState = viewModel.depositQrUrl.collectAsState()
    val isLoadingState = viewModel.isLoading.collectAsState()
    val errorMessageState = viewModel.errorMessage.collectAsState()

    var showAddCoinsDialog by remember { mutableStateOf(false) }
    var showWithdrawCoinsDialog by remember { mutableStateOf(false) }

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
                e.printStackTrace()
                Toast.makeText(context, "No compatible UPI app installed", Toast.LENGTH_SHORT).show()
            }
            return true
        }
        return false
    }

    // Filter for withdrawal transactions
    val withdrawals = remember(transactionsState.value) {
        transactionsState.value.filter {
            it.amount < 0 || it.type.contains("withdraw", ignoreCase = true)
        }
    }

    LaunchedEffect(Unit) {
        viewModel.loadData()
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = "My Wallet",
                            color = TextWhite,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onNavigateBack) {
                            Icon(
                                imageVector = Icons.Default.ArrowBack,
                                contentDescription = "Back",
                                tint = TextWhite
                            )
                        }
                    },
                    actions = {
                        IconButton(onClick = { viewModel.loadData() }) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Refresh",
                                tint = TextWhite
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = ThemeDarkBg
                    )
                )
            },
            containerColor = ThemeDarkBg
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                if (isLoadingState.value && userState.value == null) {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center),
                        color = AccentOrange
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Balance Section Card
                        item {
                            BalanceCard(
                                balance = userState.value?.coins?.toDouble() ?: 0.0,
                                onAddClick = { showAddCoinsDialog = true },
                                onWithdrawClick = { showWithdrawCoinsDialog = true }
                            )
                        }

                        // Withdrawal History Label
                        item {
                            Text(
                                text = "WITHDRAWAL HISTORY",
                                color = TextWhite,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                        }

                        // Withdrawal History List Items
                        if (withdrawals.isEmpty()) {
                            item {
                                EmptyWithdrawalHistory()
                            }
                        } else {
                            items(withdrawals) { tx ->
                                WithdrawalHistoryItem(tx)
                            }
                        }
                    }
                }
            }
        }

        // ==================== DIALOGS ====================

        // Add Coins Dialog
        if (showAddCoinsDialog) {
            AddCoinsDialog(
                onDismiss = { showAddCoinsDialog = false },
                onSubmit = { amount ->
                    showAddCoinsDialog = false
                    isCreatingOrder = true
                    viewModel.startZapUpiDeposit(
                        amount = amount,
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
                }
            )
        }

        // Withdraw Coins Dialog
        if (showWithdrawCoinsDialog) {
            val currentCoins = userState.value?.coins ?: 0
            WithdrawCoinsDialog(
                userCoins = currentCoins,
                chargePercent = withdrawalChargeState.value,
                onDismiss = { showWithdrawCoinsDialog = false },
                onSubmit = { amount, upiId ->
                    viewModel.createWithdrawal(
                        amount = amount,
                        upiId = upiId,
                        onSuccess = {
                            Toast.makeText(context, "Withdrawal request submitted successfully", Toast.LENGTH_LONG).show()
                            showWithdrawCoinsDialog = false
                        },
                        onError = { err ->
                            Toast.makeText(context, "Error: $err", Toast.LENGTH_LONG).show()
                        }
                    )
                }
            )
        }

        // Cancel Confirmation Dialog
        if (showCancelConfirmDialog) {
            AlertDialog(
                onDismissRequest = { showCancelConfirmDialog = false },
                title = {
                    Text(
                        text = "Cancel Payment?",
                        color = TextWhite,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                },
                text = {
                    Text(
                        text = "Are you sure you want to cancel this payment?",
                        color = TextMuted,
                        fontSize = 14.sp
                    )
                },
                confirmButton = {
                    Button(
                        onClick = {
                            showCancelConfirmDialog = false
                            activePaymentUrl = null
                            activePaymentOrderId = null
                            Toast.makeText(context, "Payment cancelled", Toast.LENGTH_SHORT).show()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFB3261E))
                    ) {
                        Text("Cancel", color = Color.White)
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = { showCancelConfirmDialog = false },
                        colors = ButtonDefaults.textButtonColors(contentColor = TextMuted)
                    ) {
                        Text("Wait")
                    }
                },
                containerColor = ThemeCardBg
            )
        }

        // Creating order overlay
        if (isCreatingOrder) {
            AlertDialog(
                onDismissRequest = {},
                title = null,
                text = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        modifier = Modifier.padding(16.dp)
                    ) {
                        CircularProgressIndicator(color = AccentOrange)
                        Text(
                            text = "Creating order...",
                            color = TextWhite,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                },
                confirmButton = {},
                containerColor = ThemeCardBg
            )
        }

        // Verifying status overlay
        if (isCheckingStatus) {
            AlertDialog(
                onDismissRequest = {},
                title = null,
                text = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        modifier = Modifier.padding(16.dp)
                    ) {
                        CircularProgressIndicator(color = AccentOrange)
                        Text(
                            text = "Verifying payment status...",
                            color = TextWhite,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                },
                confirmButton = {},
                containerColor = ThemeCardBg
            )
        }

        // WebView Overlay
        if (activePaymentUrl != null) {
            BackHandler {
                showCancelConfirmDialog = true
            }

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(ThemeDarkBg)
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    // Top Bar
                    TopAppBar(
                        title = {
                            Text(
                                text = "Secure Checkout",
                                color = TextWhite,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold
                            )
                        },
                        navigationIcon = {
                            IconButton(onClick = { showCancelConfirmDialog = true }) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Close",
                                    tint = TextWhite
                                )
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = ThemeDarkBg
                        )
                    )

                    // WebView Component
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
                                    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                                        return url?.let { handleUrl(it) } ?: false
                                    }

                                    override fun shouldOverrideUrlLoading(
                                        view: WebView?,
                                        request: android.webkit.WebResourceRequest?
                                    ): Boolean {
                                        val url = request?.url?.toString()
                                        return url?.let { handleUrl(it) } ?: false
                                    }
                                }
                                loadUrl(activePaymentUrl!!)
                            }
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
        }
    }
}

@Composable
fun BalanceCard(
    balance: Double,
    onAddClick: () -> Unit,
    onWithdrawClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, ThemeBorderColor, RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = ThemeCardBg)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            ThemeCardBg,
                            Color(0xFF000000)
                        )
                    )
                )
                .padding(20.dp)
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "AVAILABLE BALANCE",
                    color = TextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "💵",
                        fontSize = 28.sp
                    )
                    Text(
                        text = String.format("%.2f", balance),
                        color = Color.White,
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Black
                    )
                }
                Spacer(modifier = Modifier.height(20.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Add Coins Button
                    Button(
                        onClick = onAddClick,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AccentOrange
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = "Add Coins",
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    // Withdraw Button
                    OutlinedButton(
                        onClick = onWithdrawClick,
                        modifier = Modifier.weight(1f),
                        border = BorderStroke(1.dp, AccentOrange),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = AccentOrange
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = "Withdraw",
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun WithdrawalHistoryItem(tx: Transaction) {
    val amountAbs = kotlin.math.abs(tx.amount)
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, ThemeBorderColor.copy(alpha = 0.5f), RoundedCornerShape(12.dp)),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = ThemeCardBg.copy(alpha = 0.6f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Icon
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(Color(0xFFFFEAEE)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "💸",
                    fontSize = 18.sp
                )
            }

            // Info
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = tx.description ?: "Withdrawal via UPI",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val statusText = when (tx.status) {
                        "pending" -> "Pending"
                        "successful", "accepted" -> "Successful"
                        "failed", "rejected" -> "Rejected"
                        "refunded" -> "Refunded"
                        else -> tx.status ?: "Pending"
                    }
                    val statusColor = when (tx.status) {
                        "pending" -> AccentGold
                        "successful", "accepted" -> Color(0xFF10B981)
                        "failed", "rejected" -> Color(0xFFEF4444)
                        "refunded" -> Color(0xFF8B5CF6)
                        else -> AccentGold
                    }
                    Text(
                        text = statusText,
                        color = statusColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "•",
                        color = TextMuted,
                        fontSize = 12.sp
                    )
                    Text(
                        text = formatTxDate(tx.created_at),
                        color = TextMuted,
                        fontSize = 11.sp
                    )
                }
            }

            // Amount
            Column(
                horizontalAlignment = Alignment.End
            ) {
                Text(
                    text = "-$amountAbs",
                    color = Color(0xFFEF4444),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "coins",
                    color = TextMuted,
                    fontSize = 10.sp
                )
            }
        }
    }
}

@Composable
fun EmptyWithdrawalHistory() {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, ThemeBorderColor.copy(alpha = 0.3f), RoundedCornerShape(12.dp)),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = ThemeCardBg.copy(alpha = 0.3f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "📭",
                fontSize = 32.sp
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "No withdrawal requests yet",
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Your UPI withdrawal requests will be displayed here.",
                color = TextMuted,
                fontSize = 12.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}

// ==================== DIALOG IMPLEMENTATIONS ====================

@Composable
fun AddCoinsDialog(
    onDismiss: () -> Unit,
    onSubmit: (amount: Int) -> Unit
) {
    var amountText by remember { mutableStateOf("") }
    val context = LocalContext.current

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Add Coins (Deposit)",
                color = TextWhite,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Enter the amount of coins you want to deposit. 1 Coin = 1 INR.",
                    color = TextMuted,
                    fontSize = 12.sp
                )

                // Amount input
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it.filter { char -> char.isDigit() } },
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
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amountVal = amountText.toIntOrNull()
                    if (amountVal == null || amountVal <= 0) {
                        Toast.makeText(context, "Enter a valid amount", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    onSubmit(amountVal)
                },
                colors = ButtonDefaults.buttonColors(containerColor = AccentOrange),
                enabled = amountText.isNotBlank()
            ) {
                Text("Proceed to Pay", color = Color.White)
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                colors = ButtonDefaults.textButtonColors(contentColor = TextMuted)
            ) {
                Text("Cancel")
            }
        },
        containerColor = ThemeCardBg
    )
}

@Composable
fun WithdrawCoinsDialog(
    userCoins: Int,
    chargePercent: Int,
    onDismiss: () -> Unit,
    onSubmit: (amount: Int, upiId: String) -> Unit
) {
    var amountText by remember { mutableStateOf("") }
    var upiText by remember { mutableStateOf("") }
    val context = LocalContext.current

    val MIN_WITHDRAW = 100
    val amtVal = amountText.toIntOrNull() ?: 0
    val isValidAmount = amtVal >= MIN_WITHDRAW && amtVal <= userCoins
    val fee = if (isValidAmount && chargePercent > 0) {
        kotlin.math.round(amtVal * (chargePercent.toDouble() / 100)).toInt()
    } else {
        0
    }
    val payout = if (isValidAmount) {
        amtVal - fee
    } else {
        0
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Withdraw Coins",
                color = TextWhite,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Request a payout directly to your UPI ID. Minimum withdrawal is $MIN_WITHDRAW coins.",
                    color = TextMuted,
                    fontSize = 12.sp
                )

                // Info card (fee structure)
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = ThemeDarkBg)
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Your Balance:", color = TextMuted, fontSize = 12.sp)
                            Text("$userCoins coins", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Withdrawal Fee:", color = TextMuted, fontSize = 12.sp)
                            Text("$chargePercent%", color = Color.White, fontSize = 12.sp)
                        }
                    }
                }

                // Amount input
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it.filter { char -> char.isDigit() } },
                    label = { Text("Amount (min $MIN_WITHDRAW)") },
                    placeholder = { Text("e.g. 250") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = AccentOrange,
                        unfocusedBorderColor = ThemeBorderColor
                    )
                )

                // UPI Input
                OutlinedTextField(
                    value = upiText,
                    onValueChange = { upiText = it },
                    label = { Text("UPI ID") },
                    placeholder = { Text("username@upi") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = AccentOrange,
                        unfocusedBorderColor = ThemeBorderColor
                    )
                )

                // Realtime payout info
                if (isValidAmount) {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, AccentOrange.copy(alpha = 0.4f), RoundedCornerShape(8.dp)),
                        colors = CardDefaults.cardColors(containerColor = AccentOrange.copy(alpha = 0.08f))
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp)
                        ) {
                            Text(
                                text = "Payout Calculation",
                                color = AccentOrange,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 0.5.sp
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Requested Amount:", color = TextMuted, fontSize = 11.sp)
                                Text("$amtVal coins", color = Color.White, fontSize = 11.sp)
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Fee Deducted ($chargePercent%):", color = TextMuted, fontSize = 11.sp)
                                Text("-$fee coins", color = Color.White, fontSize = 11.sp)
                            }
                            Divider(modifier = Modifier.padding(vertical = 6.dp), color = ThemeBorderColor)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("You Will Receive:", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                Text("$payout coins", color = Color.Green, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                } else if (amountText.isNotBlank() && amtVal > userCoins) {
                    Text(
                        text = "Insufficient balance!",
                        color = Color.Red,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (!isValidAmount) {
                        Toast.makeText(context, "Enter a valid amount", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    if (upiText.trim().isBlank()) {
                        Toast.makeText(context, "UPI ID is required", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    onSubmit(amtVal, upiText.trim())
                },
                colors = ButtonDefaults.buttonColors(containerColor = AccentOrange),
                enabled = isValidAmount && upiText.trim().isNotBlank()
            ) {
                Text("Request Payout", color = Color.White)
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                colors = ButtonDefaults.textButtonColors(contentColor = TextMuted)
            ) {
                Text("Cancel")
            }
        },
        containerColor = ThemeCardBg
    )
}

// Helpers
fun formatTxDate(isoString: String): String {
    return try {
        // Formats "2026-06-12T14:30:00Z" to "12-06-2026 14:30"
        val datePart = isoString.substringBefore("T") // "2026-06-12"
        val timePart = isoString.substringAfter("T").substringBefore("Z").substringBefore(".") // "14:30:00"
        
        val dateSplit = datePart.split("-")
        val formattedDate = if (dateSplit.size == 3) {
            "${dateSplit[2]}-${dateSplit[1]}-${dateSplit[0]}" // "12-06-2026"
        } else {
            datePart
        }
        
        val timeSplit = timePart.split(":")
        val formattedTime = if (timeSplit.size >= 2) {
            "${timeSplit[0]}:${timeSplit[1]}" // "14:30"
        } else {
            timePart
        }
        
        "$formattedDate $formattedTime"
    } catch (e: Exception) {
        isoString
    }
}
