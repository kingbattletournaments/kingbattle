package com.kingbattle.data.api

import okhttp3.Interceptor
import okhttp3.Response

/** Prevent stale match list counts from HTTP caches on CDN/proxy layers. */
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
            .header("Cache-Control", "no-cache")
            .header("Pragma", "no-cache")
            .build()
        return chain.proceed(noCacheRequest)
    }
}
