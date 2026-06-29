package com.kingbattle.presentation.welcome

import android.media.MediaPlayer
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import com.kingbattle.R
import kotlinx.coroutines.delay

@Composable
fun WelcomeScreen(
    onNavigateNext: () -> Unit
) {
    val context = LocalContext.current.applicationContext
    val welcomePainter = painterResource(R.drawable.welcome_screen)

    LaunchedEffect(Unit) {
        delay(300)
        try {
            val mediaPlayer = MediaPlayer.create(context, R.raw.welcome_sound)
            mediaPlayer.setOnCompletionListener { mp ->
                mp.release()
            }
            mediaPlayer.start()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    LaunchedEffect(Unit) {
        delay(2000)
        onNavigateNext()
    }

    Box(
        modifier = Modifier.fillMaxSize()
    ) {
        Image(
            painter = welcomePainter,
            contentDescription = "Welcome Screen Image",
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
    }
}
