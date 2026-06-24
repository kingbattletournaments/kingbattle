package com.kingbattle.presentation.wallet

import android.util.Patterns
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.kingbattle.presentation.home.AccentOrange
import com.kingbattle.presentation.home.TextMuted
import com.kingbattle.presentation.home.TextWhite
import com.kingbattle.presentation.home.ThemeBorderColor
import com.kingbattle.presentation.home.ThemeCardBg
import com.kingbattle.presentation.home.ThemeDarkBg

private enum class WithdrawPayoutMethod {
    UPI,
    GOOGLE_PLAY
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletWithdrawScreen(
    onNavigateBack: () -> Unit,
    viewModel: WalletViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val userState = viewModel.user.collectAsState()
    val withdrawalChargeState = viewModel.withdrawalCharge.collectAsState()
    var isSubmitting by remember { mutableStateOf(false) }

    var amountText by remember { mutableStateOf("") }
    var payoutDetail by remember { mutableStateOf("") }
    var payoutMethod by remember { mutableStateOf(WithdrawPayoutMethod.UPI) }

    val withdrawableCoins = userState.value?.won_coins ?: 0
    val chargePercent = withdrawalChargeState.value
    val MIN_WITHDRAW = 100
    val amtVal = amountText.toIntOrNull() ?: 0
    val isValidAmount = amtVal >= MIN_WITHDRAW && amtVal <= withdrawableCoins
    val fee = if (isValidAmount && chargePercent > 0) {
        kotlin.math.round(amtVal * (chargePercent.toDouble() / 100)).toInt()
    } else 0
    val payout = if (isValidAmount) amtVal - fee else 0

    LaunchedEffect(Unit) {
        viewModel.loadData()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("Withdraw Coins", color = TextWhite, fontSize = 18.sp, fontWeight = FontWeight.Bold)
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
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
                        text = "Request Payout",
                        color = TextWhite,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Choose how you want to receive your winnings. Minimum withdrawal is $MIN_WITHDRAW coins.",
                        color = TextMuted,
                        fontSize = 13.sp
                    )

                    Text(
                        text = "Payout method",
                        color = TextWhite,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        PayoutMethodChip(
                            label = "UPI",
                            selected = payoutMethod == WithdrawPayoutMethod.UPI,
                            onClick = {
                                payoutMethod = WithdrawPayoutMethod.UPI
                                payoutDetail = ""
                            },
                            modifier = Modifier.weight(1f)
                        )
                        PayoutMethodChip(
                            label = "Google Play",
                            selected = payoutMethod == WithdrawPayoutMethod.GOOGLE_PLAY,
                            onClick = {
                                payoutMethod = WithdrawPayoutMethod.GOOGLE_PLAY
                                payoutDetail = ""
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }

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
                                Text("Withdrawable Balance:", color = TextMuted, fontSize = 12.sp)
                                Text("$withdrawableCoins coins", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
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

                    OutlinedTextField(
                        value = amountText,
                        onValueChange = { amountText = it.filter { c -> c.isDigit() } },
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

                    OutlinedTextField(
                        value = payoutDetail,
                        onValueChange = { payoutDetail = it.trimStart() },
                        label = {
                            Text(
                                if (payoutMethod == WithdrawPayoutMethod.UPI) "UPI ID" else "Email address"
                            )
                        },
                        placeholder = {
                            Text(
                                if (payoutMethod == WithdrawPayoutMethod.UPI) "username@upi" else "you@gmail.com"
                            )
                        },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = if (payoutMethod == WithdrawPayoutMethod.GOOGLE_PLAY) {
                                KeyboardType.Email
                            } else {
                                KeyboardType.Text
                            }
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = AccentOrange,
                            unfocusedBorderColor = ThemeBorderColor
                        )
                    )

                    if (payoutMethod == WithdrawPayoutMethod.GOOGLE_PLAY) {
                        Text(
                            text = "We will buy a Google Play redeem code and send it to this email after admin approval.",
                            color = TextMuted,
                            fontSize = 12.sp
                        )
                    }

                    if (isValidAmount) {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(1.dp, AccentOrange.copy(alpha = 0.4f), RoundedCornerShape(8.dp)),
                            colors = CardDefaults.cardColors(containerColor = AccentOrange.copy(alpha = 0.08f))
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(
                                    text = "Payout Calculation",
                                    color = AccentOrange,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold
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
                                HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp), color = ThemeBorderColor)
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("You Will Receive:", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    Text("$payout coins", color = Color.Green, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    } else if (amountText.isNotBlank() && amtVal > withdrawableCoins) {
                        Text(
                            text = "Insufficient balance!",
                            color = Color.Red,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Button(
                        onClick = {
                            if (!isValidAmount) {
                                Toast.makeText(context, "Enter a valid amount", Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            val detail = payoutDetail.trim()
                            if (detail.isBlank()) {
                                val msg = if (payoutMethod == WithdrawPayoutMethod.UPI) {
                                    "UPI ID is required"
                                } else {
                                    "Email address is required"
                                }
                                Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            if (payoutMethod == WithdrawPayoutMethod.UPI && !detail.contains("@")) {
                                Toast.makeText(context, "Enter a valid UPI ID", Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            if (payoutMethod == WithdrawPayoutMethod.GOOGLE_PLAY && !Patterns.EMAIL_ADDRESS.matcher(detail).matches()) {
                                Toast.makeText(context, "Enter a valid email address", Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            isSubmitting = true
                            viewModel.createWithdrawal(
                                amount = amtVal,
                                upiId = detail,
                                onSuccess = {
                                    isSubmitting = false
                                    Toast.makeText(context, "Withdrawal request submitted successfully", Toast.LENGTH_LONG).show()
                                    onNavigateBack()
                                },
                                onError = { err ->
                                    isSubmitting = false
                                    Toast.makeText(context, "Error: $err", Toast.LENGTH_LONG).show()
                                }
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = isValidAmount && payoutDetail.trim().isNotBlank() && !isSubmitting,
                        colors = ButtonDefaults.buttonColors(containerColor = AccentOrange),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            if (isSubmitting) "Submitting..." else "Request Payout",
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PayoutMethodChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        border = BorderStroke(
            1.dp,
            if (selected) AccentOrange else ThemeBorderColor
        ),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = if (selected) AccentOrange.copy(alpha = 0.15f) else Color.Transparent,
            contentColor = if (selected) AccentOrange else TextMuted
        ),
        shape = RoundedCornerShape(8.dp)
    ) {
        Text(label, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal)
    }
}
