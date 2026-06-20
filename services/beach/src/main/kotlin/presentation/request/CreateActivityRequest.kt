package com.hackathon.summer.faf.presentation.request

import kotlinx.serialization.Serializable

@Serializable
data class CreateActivityRequest(
    val activity_id: String,
    val activity_name: String,
    val description: String? = null,
    val capacity: Int
)
