package com.kingbattle.presentation.auth

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun SignUpScreen(
    onSignUpSuccess: () -> Unit,
    onNavigateBack: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel(),
) {
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var referralCode by remember { mutableStateOf("") }

    val context = LocalContext.current
    val isLoading = viewModel.isLoading.collectAsState()
    val errorMessage = viewModel.errorMessage.collectAsState()
    val isLoggedIn = viewModel.isLoggedIn.collectAsState()

    LaunchedEffect(isLoggedIn.value) {
        if (isLoggedIn.value) {
            onSignUpSuccess()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AuthSurface)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 28.dp, vertical = 40.dp),
    ) {
        AuthWelcomeHeading(
            subtitle = "Welcome to,",
            title = "Sign Up",
        )

        Spacer(modifier = Modifier.height(32.dp))

        AuthFormField(
            value = firstName,
            onValueChange = { firstName = it },
            placeholder = "First Name",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
        )

        Spacer(modifier = Modifier.height(14.dp))

        AuthFormField(
            value = lastName,
            onValueChange = { lastName = it },
            placeholder = "Last Name",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
        )

        Spacer(modifier = Modifier.height(14.dp))

        AuthFormField(
            value = username,
            onValueChange = { username = it },
            placeholder = "Username",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
        )

        Spacer(modifier = Modifier.height(14.dp))

        AuthFormField(
            value = email,
            onValueChange = { email = it },
            placeholder = "Email",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        )

        Spacer(modifier = Modifier.height(14.dp))

        AuthFormField(
            value = password,
            onValueChange = { password = it },
            placeholder = "Password",
            isPassword = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        )

        Spacer(modifier = Modifier.height(14.dp))

        AuthFormField(
            value = referralCode,
            onValueChange = { referralCode = it },
            placeholder = "Referral Code",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
        )

        Spacer(modifier = Modifier.height(20.dp))

        Text(
            text = "By Registering, I agree to the Terms and Conditions and Privacy Policy",
            color = AuthTextDark,
            fontSize = 12.sp,
            lineHeight = 18.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )

        if (errorMessage.value != null) {
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = errorMessage.value!!,
                color = AuthBlueDark,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Spacer(modifier = Modifier.height(20.dp))

        AuthPrimaryButton(
            text = "SIGN UP",
            onClick = {
                val trimmedFirst = firstName.trim()
                val trimmedLast = lastName.trim()
                val trimmedUsername = username.trim()
                val trimmedEmail = email.trim()

                when {
                    trimmedFirst.isEmpty() || trimmedLast.isEmpty() ||
                        trimmedUsername.isEmpty() || trimmedEmail.isEmpty() || password.isEmpty() -> {
                        Toast.makeText(context, "Fill in all required fields", Toast.LENGTH_SHORT).show()
                    }
                    else -> {
                        val displayName = "$trimmedFirst $trimmedLast".trim()
                        viewModel.signUp(
                            email = trimmedEmail,
                            password = password,
                            displayName = displayName,
                            username = trimmedUsername,
                            referredBy = referralCode.trim().takeIf { it.isNotBlank() },
                        )
                    }
                }
            },
            isLoading = isLoading.value,
        )

        Spacer(modifier = Modifier.height(24.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = androidx.compose.foundation.layout.Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Have an account? ",
                color = AuthTextMuted,
                fontSize = 14.sp,
            )
            Text(
                text = "Sign In",
                color = AuthBlue,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.clickable { onNavigateBack() },
            )
        }
    }
}
