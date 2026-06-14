package com.kingbattle.data.api

import com.kingbattle.data.local.TokenManager
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(private val tokenManager: TokenManager) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()

        // Prepare request builder with JSON content type
        val requestBuilder = originalRequest.newBuilder()
            .addHeader("Content-Type", "application/json")

        // Add Authorization header if token exists
        val token = tokenManager.getToken()
        if (token != null) {
            requestBuilder.addHeader("Authorization", "Bearer $token")
        }

        val newRequest = requestBuilder.build()
        return chain.proceed(newRequest)
    }
}
