package com.kingbattle.di

import com.kingbattle.data.api.KingBattleApi
import com.kingbattle.data.local.TokenManager
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface FcmEntryPoint {
    fun tokenManager(): TokenManager
    fun api(): KingBattleApi
}
