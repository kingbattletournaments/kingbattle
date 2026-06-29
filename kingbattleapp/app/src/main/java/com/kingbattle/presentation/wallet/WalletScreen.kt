package com.kingbattle.presentation.wallet

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kingbattle.presentation.components.CoinAmountRow
import com.kingbattle.presentation.components.CoinIcon
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.kingbattle.domain.model.Transaction
import com.kingbattle.presentation.components.WalletSkeleton
import com.kingbattle.presentation.home.AccentGold
import com.kingbattle.presentation.home.AccentOrange
import com.kingbattle.presentation.home.TextMuted
import com.kingbattle.presentation.home.TextWhite
import com.kingbattle.presentation.home.ThemeBorderColor
import com.kingbattle.presentation.home.ThemeCardBg
import com.kingbattle.presentation.home.ThemeDarkBg

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletScreen(
    onNavigateBack: () -> Unit,
    onNavigateToDeposit: () -> Unit,
    onNavigateToWithdraw: () -> Unit,
    viewModel: WalletViewModel = hiltViewModel()
) {
    val userState = viewModel.user.collectAsState()
    val transactionsState = viewModel.transactions.collectAsState()
    val isLoadingState = viewModel.isLoading.collectAsState()
    val isRefreshingState = viewModel.isRefreshing.collectAsState()

    val allTransactions = transactionsState.value

    LaunchedEffect(Unit) {
        viewModel.loadData()
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.loadData()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

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
                    IconButton(onClick = { viewModel.refreshData() }) {
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
        PullToRefreshBox(
            isRefreshing = isRefreshingState.value,
            onRefresh = { viewModel.refreshData() },
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
        ) {
        Box(
            modifier = Modifier.fillMaxSize()
        ) {
            if (isLoadingState.value && userState.value == null) {
                WalletSkeleton()
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    item {
                        BalanceCard(
                            balance = userState.value?.coins?.toDouble() ?: 0.0,
                            onAddClick = onNavigateToDeposit,
                            onWithdrawClick = onNavigateToWithdraw
                        )
                    }

                    item {
                        Text(
                            text = "TRANSACTION HISTORY",
                            color = TextWhite,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                    }

                    if (allTransactions.isEmpty()) {
                        item {
                            EmptyTransactionHistory()
                        }
                    } else {
                        items(allTransactions) { tx ->
                            TransactionHistoryItem(tx)
                        }
                    }
                }
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
                    CoinIcon(size = 28.dp)
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
fun TransactionHistoryItem(tx: Transaction) {
    val isCredit = tx.amount > 0
    val amountAbs = kotlin.math.abs(tx.amount)

    val iconBgColor = if (isCredit) Color(0xFF0099FF).copy(alpha = 0.15f) else Color(0xFFEF4444).copy(alpha = 0.15f)
    val iconTint = if (isCredit) Color(0xFF0099FF) else Color(0xFFEF4444)

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
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(iconBgColor),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isCredit)
                        Icons.Default.KeyboardArrowDown
                    else
                        Icons.Default.KeyboardArrowUp,
                    contentDescription = if (isCredit) "Credit" else "Debit",
                    tint = iconTint,
                    modifier = Modifier.size(24.dp)
                )
            }

            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = tx.description ?: tx.type,
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(3.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (tx.status != null) {
                        val statusText = when (tx.status) {
                            "pending" -> "Pending"
                            "successful", "accepted" -> "Successful"
                            "failed", "rejected" -> "Rejected"
                            "refunded" -> "Refunded"
                            else -> tx.status
                        }
                        val statusColor = when (tx.status) {
                            "pending" -> AccentGold
                            "successful", "accepted" -> Color(0xFF0099FF)
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
                    }
                    Text(
                        text = formatTxDate(tx.created_at),
                        color = TextMuted,
                        fontSize = 11.sp
                    )
                }
                Text(
                    text = "ID: ${tx.id.take(12)}${if (tx.id.length > 12) "..." else ""}",
                    color = TextMuted.copy(alpha = 0.6f),
                    fontSize = 9.sp,
                    maxLines = 1
                )
            }

            Column(
                horizontalAlignment = Alignment.End
            ) {
                CoinAmountRow(
                    amount = if (isCredit) "+$amountAbs" else "-$amountAbs",
                    coinSize = 14.dp,
                    fontSize = 16.sp,
                    color = if (isCredit) Color(0xFF0099FF) else Color(0xFFEF4444),
                    fontWeight = FontWeight.Bold,
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
fun EmptyTransactionHistory() {
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
                text = "No transactions yet",
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Your transaction history will be displayed here.",
                color = TextMuted,
                fontSize = 12.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}

fun formatTxDate(isoString: String): String {
    return try {
        val datePart = isoString.substringBefore("T")
        val timePart = isoString.substringAfter("T").substringBefore("Z").substringBefore(".")

        val dateSplit = datePart.split("-")
        val formattedDate = if (dateSplit.size == 3) {
            "${dateSplit[2]}-${dateSplit[1]}-${dateSplit[0]}"
        } else {
            datePart
        }

        val timeSplit = timePart.split(":")
        val formattedTime = if (timeSplit.size >= 2) {
            "${timeSplit[0]}:${timeSplit[1]}"
        } else {
            timePart
        }

        "$formattedDate $formattedTime"
    } catch (e: Exception) {
        isoString
    }
}
