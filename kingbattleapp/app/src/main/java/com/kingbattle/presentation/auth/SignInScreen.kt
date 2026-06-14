package com.kingbattle.presentation.auth

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.kingbattle.presentation.home.AccentOrange
import com.kingbattle.presentation.home.ThemeBorderColor
import com.kingbattle.presentation.home.ThemeCardBg
import com.kingbattle.presentation.home.ThemeDarkBg
import com.kingbattle.presentation.home.TextMuted
import com.kingbattle.presentation.home.TextWhite

// Custom Google Vector Logo in Compose
val GoogleLogoIcon: ImageVector
    get() = ImageVector.Builder(
        name = "GoogleLogo",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f
    ).path(
        fill = SolidColor(Color(0xFF4285F4)) // Blue
    ) {
        moveTo(22.56f, 12.25f)
        curveToRelative(0f, -0.78f, -0.07f, -1.53f, -0.2f, -2.25f)
        horizontalLineTo(12f)
        verticalLineToRelative(4.26f)
        horizontalLineToRelative(5.92f)
        curveToRelative(-0.26f, 1.37f, -1.04f, 2.53f, -2.21f, 3.31f)
        verticalLineToRelative(2.77f)
        horizontalLineToRelative(3.57f)
        curveToRelative(2.08f, -1.92f, 3.28f, -4.74f, 3.28f, -8.09f)
        close()
    }.path(
        fill = SolidColor(Color(0xFF34A853)) // Green
    ) {
        moveTo(12f, 23f)
        curveToRelative(2.97f, 0f, 5.46f, -0.98f, 7.28f, -2.66f)
        lineToRelative(-3.57f, -2.77f)
        curveToRelative(-0.98f, 0.66f, -2.23f, 1.06f, -3.71f, 1.06f)
        curveToRelative(-2.86f, 0f, -5.29f, -1.93f, -6.16f, -4.53f)
        horizontalLineTo(2.18f)
        verticalLineToRelative(2.84f)
        curveTo(3.99f, 20.53f, 7.7f, 23f, 12f, 23f)
        close()
    }.path(
        fill = SolidColor(Color(0xFFFBBC05)) // Yellow
    ) {
        moveTo(5.84f, 14.09f)
        curveToRelative(-0.22f, -0.66f, -0.35f, -1.36f, -0.35f, -2.09f)
        curveToRelative(0f, -0.73f, 0.13f, -1.43f, 0.35f, -2.09f)
        verticalLineTo(7.06f)
        horizontalLineTo(2.18f)
        curveTo(1.43f, 8.55f, 1f, 10.22f, 1f, 12f)
        curveToRelative(0f, 1.78f, 0.43f, 3.45f, 1.18f, 4.94f)
        lineToRelative(3.66f, -2.85f)
        close()
    }.path(
        fill = SolidColor(Color(0xFFEA4335)) // Red
    ) {
        moveTo(12f, 5.38f)
        curveToRelative(1.62f, 0f, 3.06f, 0.56f, 4.21f, 1.64f)
        lineToRelative(3.15f, -3.15f)
        curveTo(17.45f, 2.09f, 14.97f, 1f, 12f, 1f)
        curveTo(7.7f, 1f, 3.99f, 3.47f, 2.18f, 7.06f)
        lineToRelative(3.66f, 2.85f)
        curveToRelative(0.87f, -2.6f, 3.3f, -4.53f, 6.16f, -4.53f)
        close()
    }.build()

const val GOOGLE_WEB_CLIENT_ID = "king-battle-google-auth-client-id"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignInScreen(
    onSignInSuccess: () -> Unit,
    onNavigateToSignUp: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    val isLoading = viewModel.isLoading.collectAsState()
    val errorMessage = viewModel.errorMessage.collectAsState()
    val isLoggedIn = viewModel.isLoggedIn.collectAsState()

    val context = LocalContext.current

    LaunchedEffect(isLoggedIn.value) {
        if (isLoggedIn.value) {
            onSignInSuccess()
        }
    }

    // Google Sign-In setup
    val gso = remember {
        com.google.android.gms.auth.api.signin.GoogleSignInOptions.Builder(com.google.android.gms.auth.api.signin.GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestIdToken(GOOGLE_WEB_CLIENT_ID)
            .build()
    }

    val googleSignInClient = remember {
        com.google.android.gms.auth.api.signin.GoogleSignIn.getClient(context, gso)
    }

    val googleSignInLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = com.google.android.gms.auth.api.signin.GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(com.google.android.gms.common.api.ApiException::class.java)
            val idToken = account.idToken
            if (idToken != null) {
                viewModel.signInWithGoogle(idToken, onSuccess = onSignInSuccess, onError = { err ->
                    Toast.makeText(context, err, Toast.LENGTH_LONG).show()
                })
            } else {
                Toast.makeText(context, "Failed to retrieve Google credentials.", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(context, "Google Sign-In error: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ThemeDarkBg)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "KING BATTLE",
                color = AccentOrange,
                fontSize = 32.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 2.sp,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            Text(
                text = "Enter the Battlefield & Win Rewards",
                color = TextMuted,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(bottom = 40.dp)
            )

            // Email Field
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Username or Email") },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = TextWhite,
                    unfocusedTextColor = TextWhite,
                    focusedBorderColor = AccentOrange,
                    unfocusedBorderColor = ThemeBorderColor,
                    focusedLabelColor = AccentOrange,
                    unfocusedLabelColor = TextMuted
                )
            )

            // Password Field
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = TextWhite,
                    unfocusedTextColor = TextWhite,
                    focusedBorderColor = AccentOrange,
                    unfocusedBorderColor = ThemeBorderColor,
                    focusedLabelColor = AccentOrange,
                    unfocusedLabelColor = TextMuted
                )
            )

            if (errorMessage.value != null) {
                Text(
                    text = errorMessage.value!!,
                    color = Color.Red,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
            }

            // Login Button
            Button(
                onClick = {
                    if (email.trim().isEmpty() || password.trim().isEmpty()) {
                        Toast.makeText(context, "Fill in all fields", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    viewModel.signIn(email.trim(), password)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AccentOrange),
                shape = RoundedCornerShape(8.dp),
                enabled = !isLoading.value
            ) {
                if (isLoading.value) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Color.White
                    )
                } else {
                    Text("Sign In", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Divider "OR"
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                HorizontalDivider(modifier = Modifier.weight(1f), color = ThemeBorderColor, thickness = 1.dp)
                Text(
                    text = "OR",
                    color = TextMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
                HorizontalDivider(modifier = Modifier.weight(1f), color = ThemeBorderColor, thickness = 1.dp)
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Continue with Google Button
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .clickable(enabled = !isLoading.value) {
                        try {
                            // Try launching native client chooser
                            val signInIntent = googleSignInClient.signInIntent
                            googleSignInLauncher.launch(signInIntent)
                        } catch (e: Exception) {
                            e.printStackTrace()
                            Toast.makeText(context, "Google Sign-In launcher error: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
                        }
                    },
                shape = RoundedCornerShape(8.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Row(
                    modifier = Modifier.fillMaxSize(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = GoogleLogoIcon,
                        contentDescription = "Google Logo",
                        tint = Color.Unspecified,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "Continue with Google",
                        color = Color(0xFF1F1F1F),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Don't have an account? ", color = TextMuted, fontSize = 14.sp)
                Text(
                    "Sign Up",
                    modifier = Modifier.clickable { onNavigateToSignUp() },
                    color = AccentOrange,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }

}
