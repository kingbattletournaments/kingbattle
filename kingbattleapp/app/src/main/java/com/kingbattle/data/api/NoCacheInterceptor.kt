package com.kingbattle.data.api

import okhttp3.CacheControl
import okhttp3.Interceptor
import okhttp3.Response

/** Prevent stale match/mode data from any HTTP cache layer. */
class NoCacheInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val shouldBypassCache =
            request.method == "GET" &&
                (
                    request.url.encodedPath.contains("/matches") ||
                        request.url.encodedPath.contains("/modes")
                    )
        if (!shouldBypassCache) {
            return chain.proceed(request)
        }
        val noCacheRequest = request.newBuilder()
            .cacheControl(CacheControl.FORCE_NETWORK)
            .header("Cache-Control", "no-cache, no-store")
            .header("Pragma", "no-cache")
            .build()
        val response = chain.proceed(noCacheRequest)
        return response.newBuilder()
            .header("Cache-Control", "no-store, no-cache, must-revalidate")
            .header("Pragma", "no-cache")
            .build()
    }
}
